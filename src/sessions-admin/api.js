import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { getConfig } from '@edx/frontend-platform';

// TODO(phase-6B): swap this stub for a real GET /fbr/api/programs/v1/programs/
// call once the programs team ships the endpoint. Shape of each item must
// stay `{ id, slug, name }` so callers don't change.
const STUB_PROGRAMS = [
  { id: 1, slug: 'default', name: 'Default Program' },
  { id: 2, slug: 'second', name: 'Second Program' },
];

export const getPrograms = async () => STUB_PROGRAMS;

const getAttendanceBaseUrl = () => `${getConfig().LMS_BASE_URL}/fbr/api/attendance/v1`;

/**
 * Active enrollments for the session's course. Used by the admin roster page
 * to seed the marking UI.
 *
 * GET /fbr/api/attendance/v1/sessions/{session_id}/enrolled-learners/
 */
export const getEnrolledLearners = async (sessionId) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(
    `${getAttendanceBaseUrl()}/sessions/${sessionId}/enrolled-learners/`,
  );
  return data;
};

/**
 * Bulk-upsert manual attendance for a session. Admin-only on the backend.
 *
 * POST /fbr/api/attendance/v1/sessions/{session_id}/mark-attendance/
 * Body: { records: [{ user_id, status }, ...] }
 */
export const markAttendance = async (sessionId, records) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.post(
    `${getAttendanceBaseUrl()}/sessions/${sessionId}/mark-attendance/`,
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
    `${getAttendanceBaseUrl()}/records/me/${qs ? `?${qs}` : ''}`,
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
    `${getAttendanceBaseUrl()}/calendar-sessions/?${params}`,
  );
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
    `${getAttendanceBaseUrl()}/sessions/${sessionId}/`,
  );
  return data;
};

/**
 * Paginated attendance records. Wraps GET /fbr/api/attendance/v1/records/
 * which requires either session_id or course_id. Used by the Per-Session and
 * Per-Learner reports.
 *
 * @param {Object} opts
 * @param {string}  [opts.sessionId]
 * @param {string}  [opts.userId]
 * @param {string}  [opts.courseId]
 * @param {number}  [opts.page]
 * @param {number}  [opts.pageSize]
 */
export const getAttendanceRecordsPage = async ({
  sessionId, userId, courseId, page, pageSize,
} = {}) => {
  const client = getAuthenticatedHttpClient();
  const params = new URLSearchParams();
  if (sessionId) { params.set('session_id', sessionId); }
  if (userId) { params.set('user_id', String(userId)); }
  if (courseId) { params.set('course_id', String(courseId)); }
  if (page) { params.set('page', String(page)); }
  if (pageSize) { params.set('page_size', String(pageSize)); }
  const qs = params.toString();
  const { data } = await client.get(
    `${getAttendanceBaseUrl()}/records/${qs ? `?${qs}` : ''}`,
  );
  return data;
};

/**
 * Correct the ``course_id`` and/or ``instructor_emails`` on a past session.
 * Admin-only. Does not trigger Zoom sync or the immutability guard.
 *
 * PATCH /fbr/api/attendance/v1/sessions/{session_id}/
 * Body: { course_id?: string, instructor_emails?: string[] }
 * Returns the updated session object.
 */
export const correctSession = async (sessionId, data) => {
  const client = getAuthenticatedHttpClient();
  const { data: responseData } = await client.patch(
    `${getAttendanceBaseUrl()}/sessions/${sessionId}/`,
    data,
  );
  return responseData;
};

/**
 * All users with a staff or instructor role across any course.
 * Used by the session correction form to populate the instructor picker.
 *
 * GET /fbr/api/attendance/v1/instructors/
 * Returns: [{ user_id, email, name }, ...]
 */
export const fetchAllInstructors = async () => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(`${getAttendanceBaseUrl()}/instructors/`);
  return data;
};

/**
 * Active enrolments for a course. Used by the Per-Learner report's learner
 * picker.
 *
 * GET /fbr/api/attendance/v1/courses/{courseKey}/enrolled-learners/
 */
export const getCourseEnrolledLearners = async (courseKey) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(
    `${getAttendanceBaseUrl()}/courses/${encodeURIComponent(courseKey)}/enrolled-learners/`,
  );
  return data;
};

/**
 * Per-learner attendance aggregation. Used by the Course Summary report.
 *
 * GET /fbr/api/attendance/v1/attendance-summary/
 *
 * @param {Object} opts
 * @param {string}  opts.courseId   — required
 * @param {string}  [opts.startDate] — ISO datetime
 * @param {string}  [opts.endDate]   — ISO datetime
 */
export const getAttendanceSummary = async ({ courseId, startDate, endDate } = {}) => {
  const client = getAuthenticatedHttpClient();
  const params = new URLSearchParams();
  if (courseId) { params.set('course_id', courseId); }
  if (startDate) { params.set('start_date', startDate); }
  if (endDate) { params.set('end_date', endDate); }
  const qs = params.toString();
  const { data } = await client.get(
    `${getAttendanceBaseUrl()}/attendance-summary/${qs ? `?${qs}` : ''}`,
  );
  return data;
};

// ─── Locations ──────────────────────────────────────────────────────────────
// Global catalogue of physical venues (e.g. "IRSA 1"). List + detail are open
// to any authenticated user — the schedule modal needs them for its picker.
// Mutations are admin-only (backend permission `IsAdminOrAuthenticatedReadOnly`).

export const getLocations = async () => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(`${getAttendanceBaseUrl()}/locations/`);
  return Array.isArray(data) ? data : data.results ?? [];
};

export const createLocation = async (payload) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.post(`${getAttendanceBaseUrl()}/locations/`, payload);
  return data;
};

export const updateLocation = async (id, payload) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.patch(
    `${getAttendanceBaseUrl()}/locations/${id}/`,
    payload,
  );
  return data;
};

export const deleteLocation = async (id) => {
  const client = getAuthenticatedHttpClient();
  await client.delete(`${getAttendanceBaseUrl()}/locations/${id}/`);
};
