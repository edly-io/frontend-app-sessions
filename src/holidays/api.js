import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { getConfig } from '@edx/frontend-platform';

const getBaseUrl = () => `${getConfig().LMS_BASE_URL}/fbr/api/attendance/v1`;

export const getHolidays = async ({ search = '', page = 1, pageSize = 20 } = {}) => {
  const client = getAuthenticatedHttpClient();
  const params = new URLSearchParams({ page, page_size: pageSize });
  if (search) { params.set('search', search); }
  const { data } = await client.get(`${getBaseUrl()}/public-holidays/?${params}`);
  return { count: data.count ?? 0, results: data.results ?? [] };
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
