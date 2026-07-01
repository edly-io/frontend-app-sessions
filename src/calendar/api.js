import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { getConfig } from '@edx/frontend-platform';

const getBaseUrl = () => `${getConfig().LMS_BASE_URL}/fbr/api/attendance/v1`;
const getProgramsBaseUrl = () => `${getConfig().STUDIO_BASE_URL}/fbr/api/programs`;

export const getSession = async (sessionId) => {
  const { data } = await getAuthenticatedHttpClient()
    .get(`${getBaseUrl()}/sessions/${sessionId}/`);
  return data;
};

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
 * Searched by title in the frontend autocomplete.
 *
 * GET /fbr/api/programs/<program_key>/courses/
 * Returns: [{ course_key, display_name, ... }, ...]
 */
export const fetchProgramCourses = async (programKey) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(`${getProgramsBaseUrl()}/${encodeURIComponent(programKey)}/courses/`);
  return Array.isArray(data) ? data : (data.results ?? []);
};

/**
 * Fetch all instructors for a given program from the CMS programs API.
 * Scoped to the program's city automatically by the backend.
 * Uses ?no_page to bypass pagination and get a plain array in one request.
 *
 * GET /fbr/api/programs/users/?role=instructor&program_key=...&no_page
 * Returns: [{ id, username, email, first_name, last_name }, ...]
 */
export const fetchProgramInstructors = async (programKey) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(
    `${getProgramsBaseUrl()}/users/?role=instructor&no_page&program_key=${encodeURIComponent(programKey)}`,
  );
  return Array.isArray(data) ? data : (data.results ?? []);
};

/**
 * Fetch all learners enrolled in a program.
 *
 * GET /fbr/api/programs/<program_key>/learners/?no_page
 * Returns: [{ id, username, email, first_name, last_name }, ...]
 */
export const fetchProgramLearners = async (programKey) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(
    `${getProgramsBaseUrl()}/${encodeURIComponent(programKey)}/learners/?no_page`,
  );
  return Array.isArray(data) ? data : (data.results ?? []);
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
