import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { getConfig } from '@edx/frontend-platform';

const getBaseUrl = () => `${getConfig().LMS_BASE_URL}/fbr/api/attendance/v1`;

export const getHolidays = async () => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(`${getBaseUrl()}/public-holidays/`);
  return Array.isArray(data) ? data : data.results ?? [];
};

export const createHoliday = async (payload) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.post(`${getBaseUrl()}/public-holidays/`, payload);
  return data;
};

export const updateHoliday = async (id, payload) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.patch(`${getBaseUrl()}/public-holidays/${id}/`, payload);
  return data;
};

export const deleteHoliday = async (id) => {
  const client = getAuthenticatedHttpClient();
  await client.delete(`${getBaseUrl()}/public-holidays/${id}/`);
};
