import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { getConfig } from '@edx/frontend-platform';

// eslint-disable-next-line import/prefer-default-export
export const getPrograms = async () => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(`${getConfig().STUDIO_BASE_URL}/fbr/api/programs/`);
  const list = Array.isArray(data) ? data : data.results ?? [];
  return list.map((p) => ({ id: p.program_key, name: p.name }));
};
