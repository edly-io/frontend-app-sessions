import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { getConfig } from '@edx/frontend-platform';

const getBaseUrl = () => `${getConfig().LMS_BASE_URL}/fbr/api/attendance/v1`;

export const createSession = async (courseId, sessionData) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.post(`${getBaseUrl()}/courses/${courseId}/sessions/`, sessionData);
  return data;
};

export const updateSession = async (courseId, sessionId, sessionData) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.patch(`${getBaseUrl()}/courses/${courseId}/sessions/${sessionId}/`, sessionData);
  return data;
};

export const deleteSession = async (courseId, sessionId) => {
  const client = getAuthenticatedHttpClient();
  await client.delete(`${getBaseUrl()}/courses/${courseId}/sessions/${sessionId}/`);
};

// Soft-cancel via partial update. Backend accepts {status:'cancelled'} on
// SessionViewSet today; preserves audit trail and the Zoom meeting (unlike
// destroy(), which tears Zoom down). Pair endpoint with a transition guard
// in api/views.py — see Phase 8 in the plan.
export const cancelSession = async (courseId, sessionId) => updateSession(courseId, sessionId, { status: 'cancelled' });

export const getAttendanceRecords = async (filters = {}) => {
  const client = getAuthenticatedHttpClient();
  const params = new URLSearchParams(filters);
  const { data } = await client.get(`${getBaseUrl()}/records/?${params}`);
  return data;
};

// ─── Course Run & Instructor lookup APIs ──────────────────────────────────────
// Used to populate the searchable autocomplete fields in ScheduleMeetingModal.

/**
 * Fetch all course runs accessible to the requesting instructor.
 * Searched by `title` in the frontend autocomplete.
 *
 * GET /fbr/api/attendance/v1/course-runs/
 * Returns: [{ id: "course-v1:Org+Course+Run", title: "..." }, ...]
 */
export const fetchCourseRuns = async () => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(`${getBaseUrl()}/course-runs/`);
  return data;
};

/**
 * Fetch instructors / course-team members for a specific course run.
 * Called after the user selects a course run in ScheduleMeetingModal.
 * Searched by `name` in the frontend autocomplete.
 *
 * GET /fbr/api/attendance/v1/courses/{courseId}/instructors/
 * Returns: [{ user_id, email, name }, ...]
 *
 * @param {string} courseId - Course key string, e.g. "course-v1:Org+Course+Run"
 */
export const fetchInstructors = async (courseId) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(`${getBaseUrl()}/courses/${courseId}/instructors/`);
  return data;
};

/**
 * Fetch all instructors / staff members across all courses.
 * Used in correction mode (past-session edit) where the course itself may be
 * changing — scoping the instructor list to the old course would be misleading.
 *
 * GET /fbr/api/attendance/v1/instructors/
 * Returns: [{ user_id, email, name }, ...]
 */
export const fetchAllInstructors = async () => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(`${getBaseUrl()}/instructors/`);
  return data;
};

/**
 * Correct the course assignment and/or instructors on a past session.
 * Admin-only. Routes to Path 1 (non-course-scoped PATCH) — no Zoom sync and
 * no immutability guard apply. Only `course_id` and `instructor_emails` are
 * accepted; all other fields are ignored by the backend.
 *
 * PATCH /fbr/api/attendance/v1/sessions/{sessionId}/
 * Returns the updated session object.
 */
export const correctSession = async (sessionId, correctionData) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.patch(
    `${getBaseUrl()}/sessions/${sessionId}/`,
    correctionData,
  );
  return data;
};

// ─── Calendar API ─────────────────────────────────────────────────────────────
//
// Returns sessions within a date window for the calendar UI. Visibility is
// role-based on the backend (admins see all; instructors see their courses;
// learners see enrolled courses). The window is required and must be
// <= 45 days — the calendar re-fetches on navigation, so one month/week/day
// at a time is all we ever load.
export const getCalendarSessions = async (startDate, endDate) => {
  const client = getAuthenticatedHttpClient();
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  const { data } = await client.get(`${getBaseUrl()}/calendar-sessions/?${params}`);
  return { sessions: data.results, userRole: data.user_role };
};

// ─── Session Requests ─────────────────────────────────────────────────────────
// Learner submits; admin/instructor reviews (approve/reject). On approval of a
// remote_zoom request the backend creates a per-learner Zoom meeting and
// returns the join URL on the request object. Leave approvals mark the
// learner's attendance as absent+overridden.

/**
 * Learner submits a session request.
 *
 * POST /fbr/api/attendance/v1/session-requests/
 * Body: { session: sessionId, request_type: 'remote_zoom'|'leave', reason: string }
 * Returns: the created SessionRequest (including server-populated fields).
 */
export const createSessionRequest = async ({ session, requestType, reason }) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.post(`${getBaseUrl()}/session-requests/`, {
    session,
    request_type: requestType,
    reason,
  });
  return data;
};

/**
 * List session requests visible to the authenticated reviewer.
 * Admin sees all; instructor sees requests for their courses; learner sees none
 * (learners must use `getMySessionRequests` instead).
 *
 * GET /fbr/api/attendance/v1/session-requests/
 */
export const getSessionRequests = async ({
  courseId, status, sessionId, page, pageSize,
} = {}) => {
  const client = getAuthenticatedHttpClient();
  const params = new URLSearchParams();
  if (courseId) { params.set('course_id', courseId); }
  if (status) { params.set('status', status); }
  if (sessionId) { params.set('session_id', sessionId); }
  if (page) { params.set('page', String(page)); }
  if (pageSize) { params.set('page_size', String(pageSize)); }
  const qs = params.toString();
  const url = `${getBaseUrl()}/session-requests/${qs ? `?${qs}` : ''}`;
  const { data } = await client.get(url);
  return data;
};

/**
 * List the authenticated learner's own requests, optionally scoped to a
 * `session.scheduled_start_time` window — matches calendar fetch windows so
 * the learner's calendar can hydrate request state for the visible range.
 *
 * GET /fbr/api/attendance/v1/session-requests/me/
 */
export const getMySessionRequests = async ({
  startDate, endDate, page, pageSize,
} = {}) => {
  const client = getAuthenticatedHttpClient();
  const params = new URLSearchParams();
  if (startDate) { params.set('start_date', startDate); }
  if (endDate) { params.set('end_date', endDate); }
  if (page) { params.set('page', String(page)); }
  if (pageSize) { params.set('page_size', String(pageSize)); }
  const qs = params.toString();
  const url = `${getBaseUrl()}/session-requests/me/${qs ? `?${qs}` : ''}`;
  const { data } = await client.get(url);
  return data;
};

/**
 * Approve or reject a pending request.
 *
 * PATCH /fbr/api/attendance/v1/session-requests/{requestId}/review/
 * Body: { status: 'approved'|'rejected', reviewer_note?: string }
 * Returns: the updated SessionRequest (meeting_join_url populated on approved
 *          remote_zoom requests).
 */
export const reviewSessionRequest = async (requestId, { status, reviewerNote = '' }) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.patch(
    `${getBaseUrl()}/session-requests/${requestId}/review/`,
    { status, reviewer_note: reviewerNote },
  );
  return data;
};
