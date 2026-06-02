import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { getConfig } from '@edx/frontend-platform';
import {
  getHolidays, createHoliday, updateHoliday, deleteHoliday,
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

describe('getHolidays', () => {
  it('fetches from /public-holidays/ with pagination params', async () => {
    mockClient.get.mockResolvedValue({ data: { count: 0, results: [] } });
    await getHolidays({ page: 2, pageSize: 10 });
    const [url] = mockClient.get.mock.calls[0];
    expect(url).toContain('page=2');
    expect(url).toContain('page_size=10');
  });

  it('includes search param when provided', async () => {
    mockClient.get.mockResolvedValue({ data: { count: 0, results: [] } });
    await getHolidays({ search: 'eid' });
    const [url] = mockClient.get.mock.calls[0];
    expect(url).toContain('search=eid');
  });

  it('returns count and results', async () => {
    mockClient.get.mockResolvedValue({ data: { count: 1, results: [{ id: 1 }] } });
    const result = await getHolidays();
    expect(result).toEqual({ count: 1, results: [{ id: 1 }] });
  });

  it('returns zeros for missing fields', async () => {
    mockClient.get.mockResolvedValue({ data: {} });
    const result = await getHolidays();
    expect(result).toEqual({ count: 0, results: [] });
  });
});

describe('createHoliday', () => {
  it('posts to /public-holidays/ and returns data', async () => {
    mockClient.post.mockResolvedValue({ data: { id: 1, name: 'Eid' } });
    const result = await createHoliday({ name: 'Eid', start_date: '2026-04-01', end_date: '2026-04-01' });
    expect(mockClient.post).toHaveBeenCalledWith(
      expect.stringContaining('/public-holidays/'),
      { name: 'Eid', start_date: '2026-04-01', end_date: '2026-04-01' },
    );
    expect(result).toEqual({ id: 1, name: 'Eid' });
  });
});

describe('updateHoliday', () => {
  it('patches the holiday by id', async () => {
    mockClient.patch.mockResolvedValue({ data: { id: 1, name: 'Eid Updated' } });
    const result = await updateHoliday(1, { name: 'Eid Updated' });
    expect(mockClient.patch).toHaveBeenCalledWith(
      expect.stringContaining('/public-holidays/1/'),
      { name: 'Eid Updated' },
    );
    expect(result).toEqual({ id: 1, name: 'Eid Updated' });
  });
});

describe('deleteHoliday', () => {
  it('sends DELETE to the holiday endpoint', async () => {
    mockClient.delete.mockResolvedValue({});
    await deleteHoliday(5);
    expect(mockClient.delete).toHaveBeenCalledWith(
      expect.stringContaining('/public-holidays/5/'),
    );
  });
});
