import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { getConfig } from '@edx/frontend-platform';

const getBaseUrl = () => `${getConfig().LMS_BASE_URL}/fbr/api/attendance/v1`;

// ─── Locations ──────────────────────────────────────────────────────────────
// Global catalogue of physical venues (e.g. "IRSA 1"). List + detail are open
// to any authenticated user — the schedule modal needs them for its picker.
// Mutations are admin-only (backend permission `IsAdminOrAuthenticatedReadOnly`).

export const getLocations = async () => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(`${getBaseUrl()}/locations/`);
  return Array.isArray(data) ? data : data.results ?? [];
};

export const createLocation = async (payload) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.post(`${getBaseUrl()}/locations/`, payload);
  return data;
};

export const updateLocation = async (id, payload) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.patch(
    `${getBaseUrl()}/locations/${id}/`,
    payload,
  );
  return data;
};

export const deleteLocation = async (id) => {
  const client = getAuthenticatedHttpClient();
  await client.delete(`${getBaseUrl()}/locations/${id}/`);
};
