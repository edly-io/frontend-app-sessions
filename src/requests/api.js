import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { getConfig } from '@edx/frontend-platform';

const getBaseUrl = () => `${getConfig().LMS_BASE_URL}/fbr/api/attendance/v1`;

const leaveUrl = (suffix = '') => `${getBaseUrl()}/requests/leave/${suffix}`;
const remoteUrl = (suffix = '') => `${getBaseUrl()}/requests/remote-session/${suffix}`;

const typeUrl = (type, suffix = '') => (type === 'leave' ? leaveUrl(suffix) : remoteUrl(suffix));

/**
 * Learner submits a new request.
 *
 * Leave:          POST /v1/requests/leave/
 *   leave_start_date + leave_end_date always required.
 *   session_ids optional — present for session-specific leave, absent for full-day.
 * Remote session: POST /v1/requests/remote-session/  { reason, program_key, session_ids: [uuid, ...] }
 */
export const createRequest = async ({
  // eslint-disable-next-line camelcase
  type, reason, program_key, session_ids,
  // eslint-disable-next-line camelcase
  attachment, leave_start_date, leave_end_date,
}) => {
  const client = getAuthenticatedHttpClient();
  const form = new FormData();
  form.append('reason', reason);
  form.append('program_key', program_key);
  if (leave_start_date) { form.append('leave_start_date', leave_start_date); }
  if (leave_end_date) { form.append('leave_end_date', leave_end_date); }
  if (session_ids && session_ids.length) {
    session_ids.forEach((id) => form.append('session_ids', id));
  }
  if (attachment) { form.append('attachment', attachment); }
  const { data } = await client.post(typeUrl(type), form);
  return data;
};

/**
 * Learner deletes their own PENDING request.
 *
 * DELETE /v1/requests/leave/{id}/  or  DELETE /v1/requests/remote-session/{id}/
 */
export const deleteRequest = async (requestId, requestType) => {
  const client = getAuthenticatedHttpClient();
  await client.delete(typeUrl(requestType, `${requestId}/`));
};

/**
 * Fetch requests from one or both typed endpoints and merge.
 * When type is specified only that endpoint is called (true server pagination).
 * Without a type filter both endpoints are called with page_size=500 and merged.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
const fetchMergedRequests = async ({
  // eslint-disable-next-line camelcase
  state, type, q, program_key, page, page_size, start_date, end_date,
} = {}) => {
  const client = getAuthenticatedHttpClient();

  const build = (extra = {}) => {
    const p = new URLSearchParams();
    if (state) { p.set('state', state); }
    if (q) { p.set('q', q); }
    if (program_key) { p.set('program_key', program_key); }
    if (start_date) { p.set('start_date', start_date); }
    if (end_date) { p.set('end_date', end_date); }
    Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return p.toString();
  };

  if (type) {
    // Single-endpoint fetch — server pagination works as normal.
    const qs = build({ page: page ?? 1, page_size: page_size ?? 25 });
    const { data } = await client.get(`${typeUrl(type)}?${qs}`);
    return data;
  }

  // Both endpoints in parallel — fetch generously and merge client-side.
  const bigQs = build({ page_size: 500 });
  const [leaveRes, remoteRes] = await Promise.all([
    client.get(`${leaveUrl()}?${bigQs}`),
    client.get(`${remoteUrl()}?${bigQs}`),
  ]);
  const leaveResults = Array.isArray(leaveRes.data) ? leaveRes.data : (leaveRes.data.results ?? []);
  const remoteResults = Array.isArray(remoteRes.data) ? remoteRes.data : (remoteRes.data.results ?? []);
  const merged = [...leaveResults, ...remoteResults].sort(
    (a, b) => new Date(b.created) - new Date(a.created),
  );

  // Apply client-side pagination over the merged list.
  const perPage = page_size ?? 25;
  const pageNum = page ?? 1;
  const startIdx = (pageNum - 1) * perPage;
  return {
    count: merged.length,
    results: merged.slice(startIdx, startIdx + perPage),
  };
};

/**
 * Admin lists all requests for a programme (both types merged).
 *
 * GET /v1/requests/leave/?program_key=…  +  GET /v1/requests/remote-session/?program_key=…
 */
export const getRequests = fetchMergedRequests;

/**
 * Learner lists their own requests (server auto-scopes by role).
 * Alias of getRequests.
 */
export const getMyRequests = fetchMergedRequests;

/**
 * Fetch all APPROVED leave requests for the authenticated learner.
 * Used by CalendarPage to hydrate the studentRequestMap for leave display.
 *
 * GET /v1/requests/leave/?state=APPROVED&program_key=…
 */
export const getApprovedLeaves = async ({
  // eslint-disable-next-line camelcase
  program_key,
} = {}) => {
  const client = getAuthenticatedHttpClient();
  const params = new URLSearchParams({ state: 'APPROVED', page_size: '200' });
  if (program_key) { params.set('program_key', program_key); }
  const { data } = await client.get(`${leaveUrl()}?${params.toString()}`);
  const results = Array.isArray(data) ? data : data.results ?? [];
  return results;
};

/**
 * Admin approves or rejects a pending request.
 *
 * PATCH /v1/requests/leave/{id}/review/  or  PATCH /v1/requests/remote-session/{id}/review/
 */
export const reviewRequest = async (requestId, { state, reviewer_note = '' }, requestType) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.patch(
    typeUrl(requestType, `${requestId}/review/`),
    { state, reviewer_note },
  );
  return data;
};
