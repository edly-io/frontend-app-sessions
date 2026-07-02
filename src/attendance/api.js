import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { getConfig } from '@edx/frontend-platform';

const getBaseUrl = () => `${getConfig().LMS_BASE_URL}/fbr/api/attendance/v1`;

/**
 * Bulk-upsert manual attendance for a session. Admin-only on the backend.
 *
 * POST /fbr/api/attendance/v1/sessions/{session_id}/mark-attendance/
 * Body: { records: [{ user_id, status }, ...] }
 */
export const markAttendance = async (sessionId, records) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.post(
    `${getBaseUrl()}/sessions/${sessionId}/mark-attendance/`,
    { records },
  );
  return data;
};

/**
 * Cross-session attendance history for the authenticated learner.
 *
 * GET /fbr/api/attendance/v1/records/me/
 */
export const getMyAttendanceRecords = async ({ page, pageSize } = {}) => {
  const client = getAuthenticatedHttpClient();
  const params = new URLSearchParams();
  if (page) { params.set('page', String(page)); }
  if (pageSize) { params.set('page_size', String(pageSize)); }
  const qs = params.toString();
  const { data } = await client.get(
    `${getBaseUrl()}/records/me/${qs ? `?${qs}` : ''}`,
  );
  return data;
};

/**
 * Past sessions across all courses, used by the admin sessions list.
 *
 * Calls `GET /fbr/api/attendance/v1/calendar-sessions/` with an explicit date
 * window. Pass `startDate`/`endDate` (Date objects) for precise control, or
 * fall back to `daysBack` for a window ending now. Calendar endpoint enforces
 * a 45-day max window.
 *
 * @param {Object}  opts
 * @param {number}  [opts.daysBack=30]  Window width when no explicit dates given.
 * @param {Date}    [opts.startDate]    Explicit window start (overrides daysBack).
 * @param {Date}    [opts.endDate]      Explicit window end (overrides now).
 */
export const getPastSessionsForAttendance = async ({ daysBack = 30, startDate, endDate } = {}) => {
  const client = getAuthenticatedHttpClient();
  const end = endDate ?? new Date();
  const start = startDate ?? new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    attendance_only: '1',
  });
  const { data } = await client.get(
    `${getBaseUrl()}/calendar-sessions/?${params}`,
  );
  return data;
};

/**
 * Paginated session list for a program.
 *
 * GET /fbr/api/attendance/v1/sessions/?program_key=<key>&status=<status>
 *
 * @param {Object} opts
 * @param {string}  opts.programKey  — required
 * @param {string}  [opts.status]    — e.g. 'completed'
 * @param {number}  [opts.page]
 * @param {number}  [opts.pageSize]
 */
export const getSessionsPage = async ({
  programKey, status, page, pageSize,
} = {}) => {
  const client = getAuthenticatedHttpClient();
  const params = new URLSearchParams();
  if (programKey) { params.set('program_key', programKey); }
  if (status) { params.set('status', status); }
  if (page) { params.set('page', String(page)); }
  if (pageSize) { params.set('page_size', String(pageSize)); }
  const { data } = await client.get(`${getBaseUrl()}/sessions/?${params}`);
  return data;
};

/**
 * Fetch a single session by ID.
 *
 * GET /fbr/api/attendance/v1/sessions/{session_id}/
 */
export const getSession = async (sessionId) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(
    `${getBaseUrl()}/sessions/${sessionId}/`,
  );
  return data;
};

/**
 * Derived attendance roster for a session. Single call replaces the old
 * 3-call merge (enrolled-learners + records + session detail).
 *
 * GET /fbr/api/attendance/v1/sessions/{sessionId}/attendance-roster/
 * Returns { results: [...rows], session: { marking_window_open, ... } }
 */
export const getAttendanceRoster = async (sessionId) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(
    `${getBaseUrl()}/sessions/${encodeURIComponent(sessionId)}/attendance-roster/`,
  );
  return data;
};

/**
 * Per-learner attendance history within a course (derived — includes pending/leave).
 * Replaces the deprecated GET /v1/records/?user_id&course_id.
 *
 * GET /fbr/api/attendance/v1/trainees/{userId}/attendance/?course_id=<key>
 * Returns paginated { count, next, previous, results: [...] }.
 * Omit courseId to get the trainee's programme-only (no-course) sessions.
 */
export const getTraineeAttendance = async (userId, {
  programKey, courseId, page, pageSize,
} = {}) => {
  const client = getAuthenticatedHttpClient();
  const params = new URLSearchParams();
  if (programKey) { params.set('program_key', programKey); }
  if (courseId) { params.set('course_id', courseId); }
  if (page) { params.set('page', String(page)); }
  if (pageSize) { params.set('page_size', String(pageSize)); }
  const qs = params.toString();
  const { data } = await client.get(
    `${getBaseUrl()}/trainees/${userId}/attendance/${qs ? `?${qs}` : ''}`,
  );
  return data;
};

/**
 * Per-learner rollup for a course — one row per enrolled learner.
 *
 * GET /fbr/api/attendance/v1/courses/{courseId}/attendance-summary/
 * Returns { results: [{ user_id, email, full_name, present, absent, leave,
 *                       pending, total, attendance_rate }] }
 */
export const getCourseSummary = async (courseId) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(
    `${getBaseUrl()}/courses/${encodeURIComponent(courseId)}/attendance-summary/`,
  );
  return data;
};

/**
 * All sessions for a specific course within a program.
 *
 * GET /fbr/api/attendance/v1/courses/{courseKey}/sessions/?program_key=<key>
 * Returns { results: [...] } with fields: id, title, session_type,
 * scheduled_start_time, scheduled_end_time, status, marking_window_open.
 */
export const getCourseSessionsList = async (courseKey, programKey) => {
  const client = getAuthenticatedHttpClient();
  const params = new URLSearchParams({ program_key: programKey });
  const { data } = await client.get(
    `${getBaseUrl()}/courses/${encodeURIComponent(courseKey)}/sessions/?${params}`,
  );
  return data;
};
