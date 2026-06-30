import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import {
  getCalendarSessions,
  createSession,
  updateSession,
  cancelSession,
  deleteSession,
  getSessionsConfig,
  getProgramDates,
  fetchProgramCourses,
  fetchProgramInstructors,
} from './api';

jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: jest.fn(),
}));
jest.mock('@edx/frontend-platform', () => ({
  getConfig: jest.fn().mockReturnValue({
    LMS_BASE_URL: 'http://localhost:18000',
    STUDIO_BASE_URL: 'http://localhost:18010',
  }),
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

// ─── getCalendarSessions ──────────────────────────────────────────────────────

describe('getCalendarSessions', () => {
  it('sends start_date and end_date as query params', async () => {
    mockClient.get.mockResolvedValue({ data: { results: [], user_role: 'learner' } });
    await getCalendarSessions('2026-06-01', '2026-06-30', 'prog1');
    const [url] = mockClient.get.mock.calls[0];
    expect(url).toContain('start_date=2026-06-01');
    expect(url).toContain('end_date=2026-06-30');
  });

  it('includes program_key when provided', async () => {
    mockClient.get.mockResolvedValue({ data: { results: [], user_role: 'admin' } });
    await getCalendarSessions('2026-06-01', '2026-06-30', 'prog1');
    const [url] = mockClient.get.mock.calls[0];
    expect(url).toContain('program_key=prog1');
  });

  it('omits program_key when not provided', async () => {
    mockClient.get.mockResolvedValue({ data: { results: [], user_role: 'learner' } });
    await getCalendarSessions('2026-06-01', '2026-06-30');
    const [url] = mockClient.get.mock.calls[0];
    expect(url).not.toContain('program_key');
  });

  it('returns sessions array and userRole', async () => {
    mockClient.get.mockResolvedValue({ data: { results: [{ id: 's1' }], user_role: 'admin' } });
    const result = await getCalendarSessions('2026-06-01', '2026-06-30');
    expect(result).toEqual({ sessions: [{ id: 's1' }], userRole: 'admin' });
  });
});

// ─── createSession ────────────────────────────────────────────────────────────

describe('createSession', () => {
  it('posts to /sessions/ and returns data', async () => {
    mockClient.post.mockResolvedValue({ data: { id: 'new' } });
    const result = await createSession({ title: 'Test Session' });
    expect(mockClient.post).toHaveBeenCalledWith(
      expect.stringContaining('/sessions/'),
      { title: 'Test Session' },
    );
    expect(result).toEqual({ id: 'new' });
  });
});

// ─── updateSession ────────────────────────────────────────────────────────────

describe('updateSession', () => {
  it('patches the session by id', async () => {
    mockClient.patch.mockResolvedValue({ data: { id: 'abc', title: 'Updated' } });
    const result = await updateSession('abc', { title: 'Updated' });
    expect(mockClient.patch).toHaveBeenCalledWith(
      expect.stringContaining('/sessions/abc/'),
      { title: 'Updated' },
    );
    expect(result.title).toBe('Updated');
  });
});

// ─── cancelSession ────────────────────────────────────────────────────────────

describe('cancelSession', () => {
  it('posts to the cancel endpoint', async () => {
    mockClient.post.mockResolvedValue({ data: { id: 'abc', status: 'cancelled' } });
    await cancelSession('abc');
    expect(mockClient.post).toHaveBeenCalledWith(
      expect.stringContaining('/sessions/abc/cancel/'),
    );
  });
});

// ─── deleteSession ────────────────────────────────────────────────────────────

describe('deleteSession', () => {
  it('sends DELETE to the session endpoint', async () => {
    mockClient.delete.mockResolvedValue({});
    await deleteSession('abc');
    expect(mockClient.delete).toHaveBeenCalledWith(
      expect.stringContaining('/sessions/abc/'),
    );
  });
});

// ─── getSessionsConfig ────────────────────────────────────────────────────────

describe('getSessionsConfig', () => {
  it('fetches from /config/', async () => {
    mockClient.get.mockResolvedValue({ data: { user_role: 'admin' } });
    const result = await getSessionsConfig();
    expect(mockClient.get).toHaveBeenCalledWith(expect.stringContaining('/config/'));
    expect(result).toEqual({ user_role: 'admin' });
  });
});

// ─── getProgramDates ──────────────────────────────────────────────────────────

describe('getProgramDates', () => {
  it('flattens course date blocks into a single array', async () => {
    mockClient.get.mockResolvedValue({
      data: {
        courses: [
          {
            course_key: 'c1',
            course_name: 'Course One',
            date_blocks: [
              {
                title: 'HW1', date: '2026-06-01', assignment_type: 'Homework', complete: false, link: 'https://x',
              },
            ],
          },
          {
            course_key: 'c2',
            course_name: 'Course Two',
            date_blocks: [
              { title: 'Quiz 1', date: '2026-06-10', complete: null },
            ],
          },
        ],
      },
    });
    const result = await getProgramDates('prog1');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ courseKey: 'c1', title: 'HW1', assignmentType: 'Homework' });
    expect(result[1]).toMatchObject({ courseKey: 'c2', title: 'Quiz 1' });
  });

  it('returns empty array when no courses', async () => {
    mockClient.get.mockResolvedValue({ data: {} });
    const result = await getProgramDates('prog1');
    expect(result).toEqual([]);
  });

  it('returns empty array when course has no date_blocks', async () => {
    mockClient.get.mockResolvedValue({ data: { courses: [{ course_key: 'c1', course_name: 'C1', date_blocks: [] }] } });
    const result = await getProgramDates('prog1');
    expect(result).toEqual([]);
  });
});

// ─── fetchProgramCourses / fetchProgramInstructors ───────────────────────────

describe('fetchProgramCourses', () => {
  it('fetches from /programs/<key>/courses/ and returns array', async () => {
    const courses = [{ course_key: 'course-v1:Org+C+R', display_name: 'Intro' }];
    mockClient.get.mockResolvedValue({ data: courses });
    const result = await fetchProgramCourses('program-v1:Org+P+1');
    expect(mockClient.get).toHaveBeenCalledWith(expect.stringContaining('/programs/program-v1%3AOrg%2BP%2B1/courses/'));
    expect(result).toEqual(courses);
  });
});

describe('fetchProgramInstructors', () => {
  it('fetches from /programs/users/ with no_page and returns array', async () => {
    const users = [{
      id: 1, email: 'a@b.com', first_name: 'Alice', last_name: 'A',
    }];
    mockClient.get.mockResolvedValue({ data: users });
    const result = await fetchProgramInstructors('program-v1:Org+P+1');
    expect(mockClient.get).toHaveBeenCalledWith(expect.stringContaining('no_page'));
    expect(mockClient.get).toHaveBeenCalledWith(expect.stringContaining('role=instructor'));
    expect(result).toEqual(users);
  });
});
