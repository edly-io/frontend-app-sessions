import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { getConfig } from '@edx/frontend-platform';

export const getPrograms = async () => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(`${getConfig().STUDIO_BASE_URL}/fbr/api/programs/`);
  const list = Array.isArray(data) ? data : data.results ?? [];
  return list.map((p) => ({ id: p.program_key, name: p.name }));
};

export const getProgram = async (programKey) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(`${getConfig().STUDIO_BASE_URL}/fbr/api/programs/${programKey}/`);
  return data;
};

export const updateProgram = async (programKey, payload) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.patch(`${getConfig().STUDIO_BASE_URL}/fbr/api/programs/${programKey}/`, payload);
  return data;
};
