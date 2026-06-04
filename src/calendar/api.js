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

// Soft-cancel: preserves the session row and Zoom meeting for audit/rescheduling.
export const cancelSession = async (sessionId) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.post(`${getBaseUrl()}/sessions/${sessionId}/cancel/`);
  return data;
};

// Hard delete. Blocked by the backend for sessions that have already started,
// completed, or are in progress — use cancelSession for those.
export const deleteSession = async (sessionId) => {
  const client = getAuthenticatedHttpClient();
  await client.delete(`${getBaseUrl()}/sessions/${sessionId}/`);
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

export const getSessionsConfig = async () => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(`${getBaseUrl()}/config/`);
  return data;
};

/**
 * Fetch graded subsection due dates for all courses in a program.
 * Not windowed — returns all dates for the whole program.
 *
 * GET /fbr/api/attendance/v1/program-dates/?program_key=KEY
 * Returns flattened array of date events across all courses.
 */
export const getProgramDates = async (programKey) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(`${getBaseUrl()}/program-dates/?program_key=${encodeURIComponent(programKey)}`);
  const events = [];
  (data.courses || []).forEach((course) => {
    (course.date_blocks || []).forEach((block) => {
      events.push({
        id: `${course.course_key}::${block.title}`,
        courseKey: course.course_key,
        courseName: course.course_name,
        title: block.title,
        date: block.date,
        link: block.link || '',
        assignmentType: block.assignment_type || null,
        complete: block.complete ?? null,
      });
    });
  });
  return events;
};

// ─── Calendar API ─────────────────────────────────────────────────────────────
//
// Returns sessions within a date window for the calendar UI via the unified
// SessionViewSet list endpoint. program_key + start_date + end_date are all
// required; window must be <= 45 days. Visibility is role-scoped on the backend.
export const getCalendarSessions = async (startDate, endDate, programKey = '') => {
  const client = getAuthenticatedHttpClient();
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
  if (programKey) { params.set('program_key', programKey); }
  const { data } = await client.get(`${getBaseUrl()}/sessions/?${params}`);
  return { sessions: data.results, userRole: data.user_role };
};
