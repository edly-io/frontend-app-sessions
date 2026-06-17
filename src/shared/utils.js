export const formatDateTime = (dateString) => {
  if (!dateString) { return ''; }
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const toISOString = (dateTimeLocalString) => {
  if (!dateTimeLocalString) { return ''; }
  return new Date(dateTimeLocalString).toISOString();
};

export const toDateTimeLocal = (isoString) => {
  if (!isoString) { return ''; }
  const date = new Date(isoString);
  const offset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - offset);
  return localDate.toISOString().slice(0, 16);
};

export const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) { return '0m'; }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export const getStatusVariant = (status) => {
  const variantMap = {
    present: 'success',
    absent: 'danger',
    late: 'warning',
    left_early: 'warning',
    partial: 'info',
    scheduled: 'secondary',
    in_progress: 'primary',
    completed: 'success',
    cancelled: 'danger',
  };
  return variantMap[status] || 'secondary';
};

/**
 * Extract a user-friendly error message from an Axios error.
 * Centralises the error extraction pattern used across all catch blocks.
 */
export const extractApiError = (err, fallback = 'An unexpected error occurred') => {
  const { data } = err.response || {};
  if (!data) { return err.message || fallback; }
  if (typeof data === 'string') { return data; }
  if (data.detail) { return data.detail; }
  if (data.error) { return data.error; }
  // DRF field-level validation errors: { field: ["msg", ...], non_field_errors: [...] }
  if (typeof data === 'object') {
    const messages = Object.entries(data).flatMap(([field, val]) => {
      const msgs = Array.isArray(val) ? val : [val];
      return field === 'non_field_errors'
        ? msgs
        : msgs.map((m) => `${field}: ${m}`);
    });
    if (messages.length) { return messages.join(' | '); }
  }
  return err.message || fallback;
};

/**
 * Group an array of sessions into a Map keyed by local date string (YYYY-MM-DD).
 * Each session appears under its start day in the user's local timezone.
 */
export const bucketSessionsByDay = (sessions) => {
  const map = new Map();
  sessions.forEach((session) => {
    if (!session.scheduled_start_time) { return; }
    const key = new Date(session.scheduled_start_time).toLocaleDateString('en-CA'); // YYYY-MM-DD
    if (!map.has(key)) { map.set(key, []); }
    map.get(key).push(session);
  });
  return map;
};
