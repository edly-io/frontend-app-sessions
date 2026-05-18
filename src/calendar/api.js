import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { getConfig } from '@edx/frontend-platform';

const getBaseUrl = () => `${getConfig().LMS_BASE_URL}/fbr/api/attendance/v1`;

export const createSession = async (sessionData) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.post(`${getBaseUrl()}/sessions/`, sessionData);
  return data;
};

export const updateSession = async (sessionId, sessionData) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.patch(`${getBaseUrl()}/sessions/${sessionId}/`, sessionData);
  return data;
};

// Backend DELETE is not wired in urls.py — use soft-cancel (status: 'cancelled')
// which preserves the audit trail and Zoom meeting. See deleteSession discussion.
export const deleteSession = async (sessionId) => updateSession(sessionId, { status: 'cancelled' });

// Soft-cancel via partial update. Preserves the session row and Zoom meeting.
export const cancelSession = async (sessionId) => updateSession(sessionId, { status: 'cancelled' });

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
 * Fetch all instructors / staff members (flat list, not course-scoped).
 * Called after the user selects a course run in ScheduleMeetingModal to
 * populate the instructor autocomplete.
 *
 * GET /fbr/api/attendance/v1/instructors/
 * Returns: [{ user_id, email, name }, ...]
 */
export const fetchInstructors = async () => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(`${getBaseUrl()}/instructors/`);
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
