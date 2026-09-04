import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';

const getBaseUrl = () => `${getConfig().LMS_BASE_URL}/fbr/api/audit-logs/v1`;

// eslint-disable-next-line import/prefer-default-export
export const getAuditLogs = async ({
  appLabel,
  models = [],
  objectId,
  programKey,
  action,
  search,
  dateFrom,
  dateTo,
  page = 1,
  pageSize = 20,
}) => {
  const params = new URLSearchParams({
    app_label: appLabel,
    page: String(page),
    page_size: String(pageSize),
  });
  models.forEach((m) => params.append('model', m));
  if (objectId !== undefined && objectId !== null) { params.set('object_id', String(objectId)); }
  if (programKey) { params.set('program_key', String(programKey)); }
  if (action !== undefined && action !== null && action !== '') { params.set('action', String(action)); }
  if (search) { params.set('search', search); }
  if (dateFrom) { params.set('date_from', dateFrom); }
  if (dateTo) { params.set('date_to', dateTo); }
  const { data } = await getAuthenticatedHttpClient()
    .get(`${getBaseUrl()}/logs/?${params}`);
  return { results: data.results || [], count: data.count || 0 };
};
