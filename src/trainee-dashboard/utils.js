export const parseApiDate = value => {
  if (!value) { return null; }
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (intl, value, options = {}) => {
  const date = parseApiDate(value);
  return date ? intl.formatDate(date, {
    day: '2-digit', month: 'short', year: 'numeric', ...options,
  }) : '';
};

export const formatTime = (intl, value) => {
  const date = parseApiDate(value);
  return date ? intl.formatTime(date, { hour: '2-digit', minute: '2-digit' }) : '';
};

export const getDateTile = (intl, value) => {
  const date = parseApiDate(value);
  return date ? {
    day: intl.formatDate(date, { day: 'numeric' }),
    month: intl.formatDate(date, { month: 'short' }),
  } : { day: '', month: '' };
};

export const joinInstructorNames = instructors => (
  instructors?.map(instructor => instructor.full_name).filter(Boolean).join(', ') || ''
);
