export const ATTENDANCE_STATUS = {
  present: 'Present',
  absent: 'Absent',
  leave: 'On Leave',
  pending: 'Pending',
};

// Labels for Session.status field (distinct from AttendanceRecord.status)
export const SESSION_STATUS_LABELS = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const SESSION_PLATFORM = {
  ZOOM: 'zoom',
  MANUAL: 'manual',
};

export const SESSION_PLATFORM_LABELS = {
  [SESSION_PLATFORM.ZOOM]: 'Zoom',
  [SESSION_PLATFORM.MANUAL]: 'In Class',
};

// ─── Requests ───────────────────────────────────────────────────────────────
// Generic Request/RequestType system. Two built-in types ship with the backend.

export const REQUEST_TYPE = {
  REMOTE_SESSION: 'remote_session',
  LEAVE: 'leave',
};

export const REQUEST_TYPE_LABELS = {
  [REQUEST_TYPE.REMOTE_SESSION]: 'Remote Session',
  [REQUEST_TYPE.LEAVE]: 'Leave Request',
};

export const REQUEST_TYPE_VARIANTS = {
  [REQUEST_TYPE.REMOTE_SESSION]: 'info',
  [REQUEST_TYPE.LEAVE]: 'secondary',
};

// Backend returns uppercase state values.
export const REQUEST_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  WITHDRAWAL_PENDING: 'WITHDRAWAL_PENDING',
  WITHDRAWN: 'WITHDRAWN',
  WITHDRAWAL_REJECTED: 'WITHDRAWAL_REJECTED',
};

export const REQUEST_STATUS_LABELS = {
  [REQUEST_STATUS.PENDING]: 'Pending',
  [REQUEST_STATUS.APPROVED]: 'Approved',
  [REQUEST_STATUS.REJECTED]: 'Rejected',
  [REQUEST_STATUS.CANCELLED]: 'Cancelled',
  [REQUEST_STATUS.WITHDRAWAL_PENDING]: 'Withdrawal Under Review',
  [REQUEST_STATUS.WITHDRAWN]: 'Withdrawn',
  [REQUEST_STATUS.WITHDRAWAL_REJECTED]: 'Withdrawal Denied',
};

export const REQUEST_STATUS_VARIANTS = {
  [REQUEST_STATUS.PENDING]: 'warning',
  [REQUEST_STATUS.APPROVED]: 'success',
  [REQUEST_STATUS.REJECTED]: 'danger',
  [REQUEST_STATUS.CANCELLED]: 'secondary',
  [REQUEST_STATUS.WITHDRAWAL_PENDING]: 'warning',
  [REQUEST_STATUS.WITHDRAWN]: 'success',
  [REQUEST_STATUS.WITHDRAWAL_REJECTED]: 'danger',
};

export const SUBSTITUTE_REQUEST_STATUS = {
  OPEN: 'open',
  ASSIGNED: 'assigned',
  CLOSED: 'closed',
};

export const SUBSTITUTE_REQUEST_STATUS_LABELS = {
  open: 'Open',
  assigned: 'Assigned',
  closed: 'Closed',
};

export const SUBSTITUTE_REQUEST_STATUS_VARIANTS = {
  open: 'warning',
  assigned: 'info',
  closed: 'secondary',
};

// Role strings returned by attendance APIs.
// Global role (calendar `user_role` top-level) is 2-way — admin vs learner.
// Per-session role (each session's own `user_role`) adds 'instructor' as a
// read-only scope: learner on the roster gets a badge + roster visibility,
// no mutate permissions.
export const USER_ROLE = {
  ADMIN: 'admin',
  INSTRUCTOR: 'instructor',
  LEARNER: 'learner',
};
