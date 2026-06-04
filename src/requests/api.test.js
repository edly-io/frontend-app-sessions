import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import {
  createRequest,
  deleteRequest,
  getRequests,
  getMyRequests,
  getApprovedLeaves,
  reviewRequest,
} from './api';

jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: jest.fn(),
}));
jest.mock('@edx/frontend-platform', () => ({
  getConfig: jest.fn().mockReturnValue({ LMS_BASE_URL: 'http://localhost:18000' }),
}));

const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
};

beforeAll(() => {
  getAuthenticatedHttpClient.mockReturnValue(mockClient);
});

beforeEach(() => jest.clearAllMocks());

// ─── createRequest ────────────────────────────────────────────────────────────

describe('createRequest', () => {
  it('posts to leave endpoint for leave type', async () => {
    mockClient.post.mockResolvedValue({ data: { id: 1 } });
    await createRequest({
      type: 'leave',
      reason: 'sick',
      program_key: 'prog1',
      leave_start_date: '2026-06-01',
      leave_end_date: '2026-06-01',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      expect.stringContaining('/requests/leave/'),
      expect.any(FormData),
    );
  });

  it('posts to remote-session endpoint for remote_session type', async () => {
    mockClient.post.mockResolvedValue({ data: { id: 2 } });
    await createRequest({
      type: 'remote_session',
      reason: 'working remotely',
      program_key: 'prog1',
      session_ids: ['abc'],
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      expect.stringContaining('/requests/remote-session/'),
      expect.any(FormData),
    );
  });

  it('returns response data', async () => {
    mockClient.post.mockResolvedValue({ data: { id: 99 } });
    const result = await createRequest({ type: 'leave', reason: 'r', program_key: 'p' });
    expect(result).toEqual({ id: 99 });
  });
});

// ─── deleteRequest ────────────────────────────────────────────────────────────

describe('deleteRequest', () => {
  it('deletes from the leave endpoint', async () => {
    mockClient.delete.mockResolvedValue({});
    await deleteRequest('123', 'leave');
    expect(mockClient.delete).toHaveBeenCalledWith(
      expect.stringContaining('/requests/leave/123/'),
    );
  });

  it('deletes from the remote-session endpoint', async () => {
    mockClient.delete.mockResolvedValue({});
    await deleteRequest('456', 'remote_session');
    expect(mockClient.delete).toHaveBeenCalledWith(
      expect.stringContaining('/requests/remote-session/456/'),
    );
  });
});

// ─── getApprovedLeaves ────────────────────────────────────────────────────────

describe('getApprovedLeaves', () => {
  it('always sends state=APPROVED', async () => {
    mockClient.get.mockResolvedValue({ data: { results: [] } });
    await getApprovedLeaves({ program_key: 'prog1' });
    expect(mockClient.get).toHaveBeenCalledWith(
      expect.stringContaining('state=APPROVED'),
    );
  });

  it('includes program_key in query string', async () => {
    mockClient.get.mockResolvedValue({ data: { results: [] } });
    await getApprovedLeaves({ program_key: 'my-prog' });
    expect(mockClient.get).toHaveBeenCalledWith(
      expect.stringContaining('program_key=my-prog'),
    );
  });

  it('returns results array from paginated response', async () => {
    mockClient.get.mockResolvedValue({ data: { results: [{ id: 1 }] } });
    const result = await getApprovedLeaves({});
    expect(result).toEqual([{ id: 1 }]);
  });

  it('handles flat array response', async () => {
    mockClient.get.mockResolvedValue({ data: [{ id: 2 }] });
    const result = await getApprovedLeaves({});
    expect(result).toEqual([{ id: 2 }]);
  });
});

// ─── reviewRequest ────────────────────────────────────────────────────────────

describe('reviewRequest', () => {
  it('patches the leave review endpoint', async () => {
    mockClient.patch.mockResolvedValue({ data: { id: 1, state: 'APPROVED' } });
    await reviewRequest('123', { state: 'APPROVED', reviewer_note: 'ok' }, 'leave');
    expect(mockClient.patch).toHaveBeenCalledWith(
      expect.stringContaining('/requests/leave/123/review/'),
      { state: 'APPROVED', reviewer_note: 'ok' },
    );
  });

  it('patches the remote-session review endpoint', async () => {
    mockClient.patch.mockResolvedValue({ data: { id: 2, state: 'REJECTED' } });
    await reviewRequest('456', { state: 'REJECTED', reviewer_note: 'no' }, 'remote_session');
    expect(mockClient.patch).toHaveBeenCalledWith(
      expect.stringContaining('/requests/remote-session/456/review/'),
      { state: 'REJECTED', reviewer_note: 'no' },
    );
  });

  it('returns updated request data', async () => {
    mockClient.patch.mockResolvedValue({ data: { id: 1 } });
    const result = await reviewRequest('1', { state: 'APPROVED', reviewer_note: '' }, 'leave');
    expect(result).toEqual({ id: 1 });
  });
});

// ─── getRequests / getMyRequests (merged fetch) ───────────────────────────────

describe('getRequests', () => {
  it('calls both leave and remote-session endpoints when no type filter', async () => {
    mockClient.get.mockResolvedValue({ data: { results: [] } });
    await getRequests({});
    expect(mockClient.get).toHaveBeenCalledTimes(2);
    const urls = mockClient.get.mock.calls.map(([url]) => url);
    expect(urls.some((u) => u.includes('/requests/leave/'))).toBe(true);
    expect(urls.some((u) => u.includes('/requests/remote-session/'))).toBe(true);
  });

  it('calls only the leave endpoint when type=leave', async () => {
    mockClient.get.mockResolvedValue({ data: { results: [], count: 0 } });
    await getRequests({ type: 'leave' });
    expect(mockClient.get).toHaveBeenCalledTimes(1);
    expect(mockClient.get).toHaveBeenCalledWith(expect.stringContaining('/requests/leave/'));
  });

  it('merges and sorts results by created desc', async () => {
    mockClient.get
      .mockResolvedValueOnce({ data: { results: [{ id: 1, created: '2026-06-01T10:00:00Z' }] } })
      .mockResolvedValueOnce({ data: { results: [{ id: 2, created: '2026-06-02T10:00:00Z' }] } });
    const result = await getRequests({});
    expect(result.results[0].id).toBe(2);
    expect(result.results[1].id).toBe(1);
  });

  it('applies client-side pagination to merged results', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i, created: `2026-0${i + 1 < 10 ? '0' : ''}${i + 1}-01T00:00:00Z` }));
    mockClient.get
      .mockResolvedValueOnce({ data: { results: items.slice(0, 5) } })
      .mockResolvedValueOnce({ data: { results: items.slice(5) } });
    const result = await getRequests({ page: 1, page_size: 3 });
    expect(result.results).toHaveLength(3);
    expect(result.count).toBe(10);
  });
});

describe('getMyRequests', () => {
  it('is an alias of getRequests (calls both endpoints)', async () => {
    mockClient.get.mockResolvedValue({ data: { results: [] } });
    await getMyRequests({});
    expect(mockClient.get).toHaveBeenCalledTimes(2);
  });
});
