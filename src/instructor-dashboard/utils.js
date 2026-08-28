export const parseDashboardDate = value => {
  if (!value) { return null; }
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (intl, value, options = {}, timeZone = undefined) => {
  const date = parseDashboardDate(value);
  if (!date) { return ''; }
  return intl.formatDate(date, {
    day: 'numeric', month: 'short', timeZone, ...options,
  });
};

export const formatTime = (intl, value, timeZone = undefined) => {
  const date = parseDashboardDate(value);
  return date ? intl.formatTime(date, { hour: 'numeric', minute: '2-digit', timeZone }) : '';
};
