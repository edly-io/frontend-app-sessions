export const ATTENDANCE_STATUS = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  left_early: 'Left Early',
  partial: 'Partial Attendance',
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
};

export const REQUEST_STATUS_LABELS = {
  [REQUEST_STATUS.PENDING]: 'Pending',
  [REQUEST_STATUS.APPROVED]: 'Approved',
  [REQUEST_STATUS.REJECTED]: 'Rejected',
};

export const REQUEST_STATUS_VARIANTS = {
  [REQUEST_STATUS.PENDING]: 'warning',
  [REQUEST_STATUS.APPROVED]: 'success',
  [REQUEST_STATUS.REJECTED]: 'danger',
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
