import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { getConfig } from '@edx/frontend-platform';

const getBaseUrl = () => `${getConfig().LMS_BASE_URL}/fbr/api/attendance/v1`;

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
