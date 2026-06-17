import React, { useState, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  IconButton,
  Badge,
  OverlayTrigger,
  Popover,
} from '@openedx/paragon';
import {
  ChevronLeft, ChevronRight, Launch, Add, EditOutline, DeleteOutline, EventBusy,
} from '@openedx/paragon/icons';
import { bucketSessionsByDay, getStatusVariant } from '../shared/utils';
import { SESSION_STATUS_LABELS, USER_ROLE, REQUEST_STATUS } from '../shared/constants';
import RequestStatusBadge from '../shared/RequestStatusBadge';
import ScopeBadge from '../shared/ScopeBadge';
import InstructingBadge from '../shared/InstructingBadge';

// ─── Constants ────────────────────────────────────────────────────────────────

const VIEWS = { MONTH: 'month', WEEK: 'week', DAY: 'day' };

// Sun(0) first, matching JS getDay() order
const WEEK_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns a local date string YYYY-MM-DD for any Date object. */
const toDateKey = (date) => date.toLocaleDateString('en-CA');

/** Returns the Sunday that starts the week containing `date`. */
const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun … 6=Sat
  d.setDate(d.getDate() - day); // shift back to Sunday
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Returns an array of 7 Date objects for Mon–Sun of the week containing `date`. */
export const getWeekDays = (date) => {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
};

/** Returns all Date objects for the 4–6 week grid rows of a month view. */
export const getMonthGridDays = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const gridStart = getWeekStart(firstDay);

  // Extend grid to the Saturday that ends the week containing the last day
  // (weeks run Sun–Sat, so Saturday = getDay() 6 is the last column)
  const endDay = new Date(lastDay);
  const endDayOfWeek = endDay.getDay();
  const daysToSaturday = endDayOfWeek === 6 ? 0 : 6 - endDayOfWeek;
  endDay.setDate(endDay.getDate() + daysToSaturday);

  const days = [];
  const cursor = new Date(gridStart);
  while (cursor <= endDay) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

/** Formats a date range label for the toolbar. */
const formatRangeLabel = (view, date) => {
  const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  if (view === VIEWS.MONTH) { return monthYear; }
  if (view === VIEWS.DAY) {
    return date.toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
    });
  }
  // Week
  const days = getWeekDays(date);
  const start = days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const end = days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${start} – ${end}`;
};

// ─── Shared style helpers ─────────────────────────────────────────────────────

const statusColors = {
  scheduled: '#0d6efd',
  in_progress: '#0a58ca',
  completed: '#198754',
  cancelled: '#dc3545',
};

// Small status-indicator dots rendered inside each session chip.
// Light shades so they remain visible on the dark type-color background.
const statusDotColors = {
  scheduled: '#93c5fd',
  in_progress: '#fb923c',
  completed: '#4ade80',
  cancelled: '#f87171',
};

// Returns the chip background: session type color when available, falling back to status.
const getChipBg = (session, sessionTypeColors) => (
  (sessionTypeColors && session.session_type && sessionTypeColors[session.session_type])
  || statusColors[session.status]
  || '#6c757d'
);

const GRADED_DATE_BORDER = '#f59e0b';
const GRADED_DATE_BG = '#fffbeb';
const GRADED_DATE_TEXT = '#92400e';

const getDayHeaderColor = (isToday, isWeekend) => {
  if (isToday) { return '#4f46e5'; }
  if (isWeekend) { return '#adb5bd'; }
  return '#6c757d';
};

// Weekend = Saturday (6) or Sunday (0) in JS getDay()
const isWeekendDay = (date) => date.getDay() === 0 || date.getDay() === 6;

const getCellBackground = (isToday, isWeekend) => {
  if (isToday) { return '#eef2ff'; } // soft indigo tint
  if (isWeekend) { return '#f8f8f8'; } // subtle grey for non-working days
  return '#fff';
};

// ─── SessionPopover ───────────────────────────────────────────────────────────
// Anchored to a chip. Shows session details and per-session actions.
// Wraps a trigger element; consumers pass the chip as a child button/span.

const formatTimeRange = (session) => {
  const start = new Date(session.scheduled_start_time);
  const startLabel = start.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  if (!session.scheduled_end_time) { return startLabel; }
  const end = new Date(session.scheduled_end_time);
  const endLabel = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${startLabel} – ${endLabel}`;
};

/**
 * Format the instructor display string from the new plural `instructor_names`
 * field, falling back to the legacy `instructor_name` singular for old payloads.
 */
const formatInstructors = (session) => {
  const names = session.instructor_names;
  if (Array.isArray(names) && names.length) { return names.join(', '); }
  return session.instructor_name || '';
};

// Inline button styled as a hyperlink — blue + always-underlined, with a
// hover/focus state that darkens the colour. Used by both popovers for the
// session-title click target. Inline styles can't express :hover, so hover
// state is tracked via React.
const TitleLink = ({ title, onClick, ariaLabel }) => {
  const [active, setActive] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      aria-label={ariaLabel}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        font: 'inherit',
        cursor: 'pointer',
        color: active ? '#0a58ca' : '#0d6efd',
        textDecoration: 'underline',
        textAlign: 'left',
      }}
    >
      {title}
    </button>
  );
};
TitleLink.propTypes = {
  title: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string,
};
TitleLink.defaultProps = {
  ariaLabel: undefined,
};

// Controlled popover — only one popover can be open across the whole calendar at
// any time, and it closes cleanly when Edit/Delete opens another modal.
const SessionPopover = ({
  session, children, isOpen, onOpenChange, onEdit, onDelete, onCancel, onSessionDetail,
  canManageSessions = false, isInstructor = false,
  isLearner = false, learnerRequest = null,
}) => {
  // Derive display-only status: a session that has ended but was never
  // explicitly marked complete by the backend should show as "Completed".
  const isPast = new Date(session.scheduled_end_time || session.scheduled_start_time) <= new Date();
  const displayStatus = (isPast && session.status === 'scheduled') ? 'completed' : session.status;
  const statusLabel = SESSION_STATUS_LABELS[displayStatus] || displayStatus;
  const instructorDisplay = formatInstructors(session);
  // Prefer the per-session `my_request` returned by the API; fall back to the
  // window-level studentRequestMap for backward compatibility with older payloads.
  const myRequest = learnerRequest || session.my_request;
  const hasMeeting = Boolean(session.meeting_id || session.meeting_join_url);
  const learnerCanJoin = (
    session.create_zoom_meeting
    || (myRequest?.state === 'APPROVED' && myRequest?.type === 'remote_session')
  );

  const handleEdit = (e) => {
    e.stopPropagation();
    onOpenChange(false);
    onEdit(session);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onOpenChange(false);
    onDelete(session);
  };

  const handleCancel = (e) => {
    e.stopPropagation();
    onOpenChange(false);
    onCancel(session);
  };

  const handleViewDetail = (e) => {
    e.stopPropagation();
    onOpenChange(false);
    onSessionDetail(session);
  };

  const handleJoin = (e, url) => {
    e.stopPropagation();
    onOpenChange(false);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const popover = (
    <Popover
      id={`session-popover-${session.id}`}
      style={{
        maxWidth: 320,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        border: '1px solid #adb5bd',
        borderRadius: 6,
      }}
    >
      <Popover.Title
        as="h5"
        style={{
          fontSize: 14,
          margin: 0,
          background: '#e7f1ff',
          borderBottom: '1px solid #c5d9f2',
          padding: '8px 12px',
        }}
      >
        <TitleLink
          title={session.title}
          onClick={handleViewDetail}
          ariaLabel={`Show details for ${session.title}`}
        />
      </Popover.Title>
      <Popover.Content style={{ fontSize: 13 }}>
        {session.course_name && (
          <div className="text-muted mb-1">{session.course_name}</div>
        )}
        {instructorDisplay && (
          <div className="text-muted mb-1">Instructor: {instructorDisplay}</div>
        )}
        {/* Time + status badge on the same row */}
        <div className="d-flex align-items-center mb-2" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span>{formatTimeRange(session)}</span>
        </div>
        <div className="mb-2 d-flex" style={{ gap: 4, flexWrap: 'wrap' }}>
          <Badge variant={getStatusVariant(displayStatus)}>{statusLabel}</Badge>
          {/* Cancelled session = dead end; suppress scope/instructor noise. */}
          {displayStatus !== 'cancelled' && (
            <>
              {/* Admin-only meeting scope hint. */}
              {canManageSessions && (
                hasMeeting
                  ? <ScopeBadge scope={session.create_zoom_meeting ? 'public' : 'gated'} />
                  : <ScopeBadge scope="in_person" />
              )}
              {session.user_role === USER_ROLE.INSTRUCTOR && <InstructingBadge />}
            </>
          )}
        </div>
        {session.status === 'scheduled' && (
          <div className="d-flex align-items-center" style={{ gap: 6, flexWrap: 'wrap' }}>
            {/* Admin: full edit. Instructor: description-only edit on own future sessions. */}
            {(canManageSessions || (isInstructor
              && session.user_role === USER_ROLE.INSTRUCTOR
              && new Date(session.scheduled_start_time) > new Date())) && (
              <Button variant="tertiary" size="sm" iconBefore={EditOutline} onClick={handleEdit}>
                Edit
              </Button>
            )}
            {/* Cancel and Delete only make sense for future sessions. */}
            {canManageSessions && new Date(session.scheduled_start_time) > new Date() && (
              <>
                <Button
                  variant="tertiary"
                  size="sm"
                  iconBefore={EventBusy}
                  onClick={handleCancel}
                  style={{ color: '#f0ad4e' }}
                >
                  Cancel
                </Button>
                <Button
                  variant="tertiary"
                  size="sm"
                  iconBefore={DeleteOutline}
                  onClick={handleDelete}
                  style={{ color: '#dc3545' }}
                >
                  Delete
                </Button>
              </>
            )}
            {/* Host (admin/instructor) → Start with meeting_start_url. */}
            {canManageSessions && session.meeting_start_url && !isPast && (
              <Button
                variant="success"
                size="sm"
                iconAfter={Launch}
                onClick={(e) => handleJoin(e, session.meeting_start_url)}
              >
                Start
              </Button>
            )}
            {/* Join button — admins always when URL present; learners only when scope allows. */}
            {(() => {
              if (isPast) { return null; }
              if (canManageSessions && session.meeting_start_url) { return null; }
              if (isLearner && !learnerCanJoin) { return null; }
              const requestJoinUrl = myRequest?.data?.meetings?.[session.id]?.meeting_join_url;
              const joinUrl = session.meeting_join_url || requestJoinUrl;
              return joinUrl ? (
                <Button variant="primary" size="sm" iconAfter={Launch} onClick={(e) => handleJoin(e, joinUrl)}>
                  Join
                </Button>
              ) : null;
            })()}
            {/* Learner-only: request status badge — only show for approved requests. */}
            {!isPast && isLearner && myRequest?.state === REQUEST_STATUS.APPROVED && (
              <RequestStatusBadge request={myRequest} />
            )}
          </div>
        )}
      </Popover.Content>
    </Popover>
  );

  return (
    <OverlayTrigger
      show={isOpen}
      onToggle={(next) => onOpenChange(next)}
      trigger="click"
      placement="auto"
      rootClose
      overlay={popover}
    >
      {children}
    </OverlayTrigger>
  );
};

// ─── DayPopover (Month view — shows all sessions for a day) ──────────────────
// Anchored to the cell. Each session row has inline Edit / Delete / Join
// buttons — no nested SessionPopover needed.

const DayPopover = ({
  date, sessions, children, isOpen, onOpenChange, onEdit, onDelete, onCancel, onSessionDetail,
  canManageSessions = false, isInstructor = false,
  isLearner = false, studentRequestMap,
  gradedDates = [],
}) => {
  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const scrollRef = useRef(null);
  const [atBottom, setAtBottom] = useState(false);
  const [openGradedId, setOpenGradedId] = useState(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) { return; }
    setAtBottom(el.scrollHeight - el.scrollTop <= el.clientHeight + 4);
  };

  const showScrollHint = sessions.length >= 3 && !atBottom;

  const handleEdit = (e, session) => {
    e.stopPropagation();
    onOpenChange(false);
    onEdit(session);
  };

  const handleDelete = (e, session) => {
    e.stopPropagation();
    onOpenChange(false);
    onDelete(session);
  };

  const handleCancel = (e, session) => {
    e.stopPropagation();
    onOpenChange(false);
    onCancel(session);
  };

  const handleViewDetail = (e, session) => {
    e.stopPropagation();
    onOpenChange(false);
    onSessionDetail(session);
  };

  const handleJoin = (e, url) => {
    e.stopPropagation();
    onOpenChange(false);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const popover = (
    <Popover
      id={`day-popover-${toDateKey(date)}`}
      style={{
        maxWidth: 380,
        minWidth: 260,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        border: '1px solid #adb5bd',
        borderRadius: 6,
      }}
    >
      <Popover.Title
        as="h5"
        style={{
          fontSize: 13,
          margin: 0,
          background: '#e7f1ff',
          borderBottom: '1px solid #c5d9f2',
          padding: '8px 12px',
        }}
      >
        {dateLabel}
        <span className="text-muted ml-1" style={{ fontWeight: 400 }}>
          ({sessions.length} session{sessions.length !== 1 ? 's' : ''}
          {gradedDates.length > 0 && `, ${gradedDates.length} due date${gradedDates.length !== 1 ? 's' : ''}`})
        </span>
      </Popover.Title>
      <Popover.Content style={{ padding: 0 }}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            fontSize: 13, maxHeight: 360, overflowY: 'auto', padding: 8,
          }}
        >
          {sessions.map((session) => {
            const instructorDisplay = formatInstructors(session);
            const myRequest = studentRequestMap?.get(session.id) || session.my_request;
            const hasMeeting = Boolean(session.meeting_id || session.meeting_join_url);
            const learnerCanJoin = (
              session.create_zoom_meeting
              || (myRequest?.state === 'APPROVED' && myRequest?.type === 'remote_session')
            );
            const isPast = new Date(session.scheduled_end_time || session.scheduled_start_time) <= new Date();
            const displayStatus = (isPast && session.status === 'scheduled') ? 'completed' : session.status;
            return (
              <div
                key={session.id}
                className="d-flex align-items-start"
                style={{ gap: 8, padding: '8px 4px', borderBottom: '1px solid #f0f0f0' }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: statusColors[displayStatus] || '#6c757d',
                    marginTop: 6,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    <TitleLink
                      title={session.title}
                      onClick={(e) => handleViewDetail(e, session)}
                      ariaLabel={`Show details for ${session.title}`}
                    />
                  </div>
                  {session.course_name && (
                  <div className="text-muted" style={{ fontSize: 12 }}>{session.course_name}</div>
                  )}
                  {instructorDisplay && (
                  <div className="text-muted" style={{ fontSize: 12 }}>Instructor: {instructorDisplay}</div>
                  )}
                  <div style={{ fontSize: 12, color: '#6c757d' }}>{formatTimeRange(session)}</div>
                  {/* On Leave indicator for learner-approved leaves */}
                  {studentRequestMap?.get(session.id) && (
                    <div
                      style={{
                        display: 'inline-block',
                        fontSize: 10,
                        color: '#065f46',
                        background: '#d1fae5',
                        borderRadius: 3,
                        padding: '1px 5px',
                        marginTop: 2,
                        fontWeight: 500,
                      }}
                    >
                      On Leave
                    </div>
                  )}
                  {/* Cancelled session = dead end; suppress scope/instructor noise. */}
                  {session.status !== 'cancelled' && (
                    <>
                      {/* Admin-only Zoom scope hint. */}
                      {canManageSessions && (
                        <div className="mt-1 d-flex" style={{ gap: 4, flexWrap: 'wrap' }}>
                          {hasMeeting
                            ? <ScopeBadge scope={session.create_zoom_meeting ? 'public' : 'gated'} />
                            : <ScopeBadge scope="in_person" />}
                        </div>
                      )}
                      {session.user_role === USER_ROLE.INSTRUCTOR && (
                        <div className="mt-1"><InstructingBadge /></div>
                      )}
                    </>
                  )}
                  {session.status === 'scheduled' && (
                  <div className="mt-1 d-flex align-items-center" style={{ gap: 4, flexWrap: 'wrap' }}>
                    {/* Admin: full edit. Instructor: description-only edit on own future sessions. */}
                    {(canManageSessions || (isInstructor
                      && session.user_role === USER_ROLE.INSTRUCTOR
                      && new Date(session.scheduled_start_time) > new Date())) && (
                      <Button
                        variant="tertiary"
                        size="sm"
                        iconBefore={EditOutline}
                        onClick={(e) => handleEdit(e, session)}
                      >
                        Edit
                      </Button>
                    )}
                    {/* Cancel and Delete only make sense for future sessions. */}
                    {canManageSessions && new Date(session.scheduled_start_time) > new Date() && (
                      <>
                        <Button
                          variant="tertiary"
                          size="sm"
                          iconBefore={EventBusy}
                          style={{ color: '#f0ad4e' }}
                          onClick={(e) => handleCancel(e, session)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="tertiary"
                          size="sm"
                          iconBefore={DeleteOutline}
                          style={{ color: '#dc3545' }}
                          onClick={(e) => handleDelete(e, session)}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                    {/* Host → Start with meeting_start_url. */}
                    {canManageSessions && session.meeting_start_url && !isPast && (
                      <Button
                        variant="success"
                        size="sm"
                        iconAfter={Launch}
                        onClick={(e) => handleJoin(e, session.meeting_start_url)}
                      >
                        Start
                      </Button>
                    )}
                    {/* Join — admins always when URL present; learners only when scope allows. */}
                    {(() => {
                      if (isPast) { return null; }
                      if (canManageSessions && session.meeting_start_url) { return null; }
                      if (isLearner && !learnerCanJoin) { return null; }
                      const requestJoinUrl = myRequest?.data?.meetings?.[session.id]?.meeting_join_url;
                      const joinUrl = session.meeting_join_url || requestJoinUrl;
                      return joinUrl ? (
                        <Button
                          variant="primary"
                          size="sm"
                          iconAfter={Launch}
                          onClick={(e) => handleJoin(e, joinUrl)}
                        >
                          Join
                        </Button>
                      ) : null;
                    })()}
                    {/* Learner-only: request status badge (creation moved to Requests tab). */}
                    {!isPast && isLearner && myRequest && (
                      <RequestStatusBadge request={myRequest} />
                    )}
                  </div>
                  )}
                </div>
              </div>
            );
          })}
          {gradedDates.length > 0 && (
            <div style={{ borderTop: sessions.length > 0 ? '1px solid #f0f0f0' : 'none', marginTop: sessions.length > 0 ? 4 : 0 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#92400e',
                margin: '8px 4px 4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
              >
                Due Dates
              </div>
              {gradedDates.map((event) => (
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                <GradedDatePopover
                  key={event.id}
                  event={event}
                  isOpen={openGradedId === event.id}
                  onOpenChange={(next) => setOpenGradedId(next ? event.id : null)}
                >
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: 'block',
                      width: '100%',
                      background: GRADED_DATE_BG,
                      color: GRADED_DATE_TEXT,
                      border: `1px solid ${GRADED_DATE_BORDER}`,
                      borderRadius: 3,
                      fontSize: 12,
                      padding: '4px 8px',
                      marginBottom: 4,
                      textAlign: 'left',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={`Due: ${event.title} (${event.courseName})`}
                  >
                    <div style={{
                      fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                    >{event.title}
                    </div>
                    <div style={{
                      fontSize: 10, opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                    >{event.courseName}
                    </div>
                  </button>
                </GradedDatePopover>
              ))}
            </div>
          )}
        </div>
        {showScrollHint && (
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              pointerEvents: 'none',
              background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.95))',
              textAlign: 'center',
              padding: '12px 0 6px',
              fontSize: 11,
              color: '#6c757d',
              letterSpacing: '0.02em',
            }}
          >
            ↓ scroll for more
          </div>
        )}
      </Popover.Content>
    </Popover>
  );

  return (
    <OverlayTrigger
      show={isOpen}
      onToggle={(next) => onOpenChange(next)}
      trigger="click"
      placement="auto"
      rootClose
      overlay={popover}
    >
      {children}
    </OverlayTrigger>
  );
};

// ─── GradedDatePopover ────────────────────────────────────────────────────────
// Anchored to an amber chip/block. Shows due-date details and LMS link.

const GradedDatePopover = ({
  event, children, isOpen, onOpenChange,
}) => {
  const dueDate = new Date(event.date);
  const dueDateLabel = dueDate.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  const handleOpenLms = (e) => {
    e.stopPropagation();
    onOpenChange(false);
    window.open(event.link, '_blank', 'noopener,noreferrer');
  };

  const popover = (
    <Popover
      id={`graded-date-popover-${CSS.escape(event.id)}`}
      style={{
        maxWidth: 300,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        border: `1px solid ${GRADED_DATE_BORDER}`,
        borderRadius: 6,
      }}
    >
      <Popover.Title
        as="h5"
        style={{
          fontSize: 13,
          margin: 0,
          background: GRADED_DATE_BG,
          borderBottom: '1px solid #fde68a',
          padding: '8px 12px',
          color: GRADED_DATE_TEXT,
        }}
      >
        {event.courseName}
      </Popover.Title>
      <Popover.Content style={{ fontSize: 13 }}>
        <div className="font-weight-bold mb-1">{event.title}</div>
        <div className="text-muted mb-2">Due: {dueDateLabel}</div>
        <div className="mb-2 d-flex" style={{ gap: 4, flexWrap: 'wrap' }}>
          {event.assignmentType && (
            <Badge
              variant="light"
              style={{ fontSize: 10, border: `1px solid ${GRADED_DATE_BORDER}`, color: GRADED_DATE_TEXT }}
            >
              {event.assignmentType}
            </Badge>
          )}
          {event.complete && (
            <Badge variant="success" style={{ fontSize: 10 }}>Completed</Badge>
          )}
        </div>
        {event.link && (
          <Button
            variant="outline-primary"
            size="sm"
            iconAfter={Launch}
            onClick={handleOpenLms}
          >
            Open in LMS
          </Button>
        )}
      </Popover.Content>
    </Popover>
  );

  return (
    <OverlayTrigger
      show={isOpen}
      onToggle={(next) => onOpenChange(next)}
      trigger="click"
      placement="auto"
      rootClose
      overlay={popover}
    >
      {children}
    </OverlayTrigger>
  );
};

// ─── DayCell (Month view only) ────────────────────────────────────────────────

const MAX_CHIPS = 2;

const DayCell = ({
  date, sessions = [], onEditSession, onDeleteSession, onCancelSession, onSessionDetail,
  openPopoverId, setOpenPopoverId,
  openDayKey, setOpenDayKey,
  isOutsideMonth = false, cellMinHeight = 110, canManageSessions = false,
  isInstructor = false, isLearner = false, studentRequestMap, leaveDateMap = null, holidays = [],
  gradedDates = [], sessionTypeColors = {},
}) => {
  const dateKey = toDateKey(date);
  const today = toDateKey(new Date());
  const isToday = dateKey === today;
  const isWeekend = isWeekendDay(date);
  const visible = sessions.slice(0, MAX_CHIPS);
  const overflow = sessions.length - MAX_CHIPS;
  const hasSessions = sessions.length > 0 || gradedDates.length > 0;
  const isDayOpen = openDayKey === dateKey;

  const setDayOpen = (next) => {
    if (next) { setOpenPopoverId(null); }
    setOpenDayKey((curr) => {
      if (next) { return dateKey; }
      return curr === dateKey ? null : curr;
    });
  };

  // Cell is interactive (Enter/Space toggles the day popover) but contains
  // its own button children (session chips, "+N more"), so we can't use a
  // real <button> wrapper — nested buttons are invalid HTML. The role +
  // tabIndex + onKeyDown trio gives the same affordances on a div.
  /* eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  const cellContent = (
    <div
      role={hasSessions ? 'button' : undefined}
      tabIndex={hasSessions ? 0 : undefined}
      onKeyDown={hasSessions ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setDayOpen(!isDayOpen);
        }
      } : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        minHeight: cellMinHeight,
        border: '1px solid #dee2e6',
        borderRadius: 4,
        padding: '4px 6px',
        background: getCellBackground(isToday, isWeekend),
        cursor: hasSessions ? 'pointer' : 'default',
        textAlign: 'left',
        opacity: isOutsideMonth ? 0.4 : 1,
        width: '100%',
      }}
      aria-label={`${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}, ${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
    >
      {/* Day number */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: '50%',
          fontSize: 13,
          fontWeight: isToday ? 700 : 400,
          background: isToday ? '#0d6efd' : 'transparent',
          color: isToday ? '#fff' : 'inherit',
          marginBottom: 4,
          flexShrink: 0,
        }}
      >
        {date.getDate()}
      </span>

      {/* Holiday banners — one per holiday covering this day */}
      {holidays.map((h) => (
        <div
          key={h.id}
          style={{
            fontSize: 10,
            color: '#92400e',
            background: '#fef3c7',
            borderRadius: 3,
            padding: '1px 4px',
            marginBottom: 3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {h.name}
        </div>
      ))}

      {/* Leave banner — shown when at least one session on this day has an approved leave */}
      {(isLearner || isInstructor) && leaveDateMap?.get(dateKey) && (
        <div
          style={{
            fontSize: 10,
            color: '#065f46',
            background: '#d1fae5',
            borderRadius: 3,
            padding: '1px 4px',
            marginBottom: 3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          On Leave
        </div>
      )}

      {/* Graded date chips — amber, clickable, opens due-date detail popover */}
      {gradedDates.slice(0, MAX_CHIPS).map((event) => (
        <GradedDatePopover
          key={event.id}
          event={event}
          isOpen={openPopoverId === `gd::${event.id}`}
          onOpenChange={(next) => setOpenPopoverId((curr) => {
            if (next) { return `gd::${event.id}`; }
            return curr === `gd::${event.id}` ? null : curr;
          })}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpenDayKey(null); }}
            onKeyDown={(e) => e.stopPropagation()}
            title={`Due: ${event.title} (${event.courseName})`}
            style={{
              display: 'block',
              background: GRADED_DATE_BG,
              color: GRADED_DATE_TEXT,
              border: `1px solid ${GRADED_DATE_BORDER}`,
              borderRadius: 3,
              fontSize: 11,
              padding: '1px 5px',
              marginBottom: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textAlign: 'left',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {event.title}
          </button>
        </GradedDatePopover>
      ))}
      {gradedDates.length > MAX_CHIPS && (
        <div style={{
          fontSize: 10, color: GRADED_DATE_TEXT, marginBottom: 2, lineHeight: 1.4,
        }}
        >
          +{gradedDates.length - MAX_CHIPS} due date{gradedDates.length - MAX_CHIPS > 1 ? 's' : ''}
        </div>
      )}

      {/* Session chips — each individually clickable, opens session popover.
          Sessions covered by an approved leave render as non-interactive grey chips. */}
      {visible.map((session) => {
        const leaveRequest = studentRequestMap?.get(session.id);
        if (leaveRequest) {
          return (
            <div
              key={session.id}
              title={`${session.title} — On Leave`}
              style={{
                display: 'block',
                background: '#e5e7eb',
                color: '#6b7280',
                borderRadius: 3,
                fontSize: 11,
                padding: '1px 5px',
                marginBottom: 2,
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textDecoration: 'line-through',
                userSelect: 'none',
              }}
            >
              {session.title}
            </div>
          );
        }
        return (
          <SessionPopover
            key={session.id}
            session={session}
            isOpen={openPopoverId === session.id}
            onOpenChange={(next) => setOpenPopoverId((curr) => {
              if (next) { return session.id; }
              return curr === session.id ? null : curr;
            })}
            onEdit={onEditSession}
            onDelete={onDeleteSession}
            onCancel={onCancelSession}
            onSessionDetail={onSessionDetail}
            canManageSessions={canManageSessions}
            isInstructor={isInstructor}
            isLearner={isLearner}
            learnerRequest={null}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpenDayKey(null); }}
              onKeyDown={(e) => e.stopPropagation()}
              title={session.title}
              style={{
                display: 'block',
                background: getChipBg(session, sessionTypeColors),
                color: '#fff',
                border: 'none',
                borderRadius: 3,
                fontSize: 11,
                padding: '1px 5px',
                marginBottom: 2,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
              <span style={{
                display: 'flex', alignItems: 'center', gap: 2, overflow: 'hidden',
              }}
              >
                <span style={{
                  width: 6,
                  height: 6,
                  minWidth: 6,
                  borderRadius: '50%',
                  background: statusDotColors[session.status] || '#e5e7eb',
                  flexShrink: 0,
                }}
                />
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textDecoration: session.status === 'cancelled' ? 'line-through' : 'none',
                }}
                >
                  {session.title}
                </span>
              </span>
            </button>
          </SessionPopover>
        );
      })}

      {/* Overflow — clickable, opens the day popover */}
      {overflow > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpenPopoverId(null); setDayOpen(true); }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: 11,
            color: '#0d6efd',
            textDecoration: 'underline',
            cursor: 'pointer',
            textAlign: 'left',
            marginTop: 'auto',
          }}
        >
          +{overflow} more
        </button>
      )}
    </div>
  );
  /* eslint-enable jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-tabindex */

  if (!hasSessions) { return cellContent; }

  return (
    <DayPopover
      date={date}
      sessions={sessions}
      gradedDates={gradedDates}
      isOpen={isDayOpen}
      onOpenChange={setDayOpen}
      onEdit={onEditSession}
      onDelete={onDeleteSession}
      onCancel={onCancelSession}
      onSessionDetail={onSessionDetail}
      canManageSessions={canManageSessions}
      isInstructor={isInstructor}
      isLearner={isLearner}
      studentRequestMap={studentRequestMap}
    >
      {cellContent}
    </DayPopover>
  );
};

// ─── MonthGrid ────────────────────────────────────────────────────────────────

const MonthGrid = ({
  currentDate, sessionMap, onEditSession, onDeleteSession, onCancelSession, onSessionDetail,
  openPopoverId, setOpenPopoverId,
  openDayKey, setOpenDayKey, canManageSessions = false, isInstructor = false,
  isLearner = false, studentRequestMap, leaveDateMap = null, holidayMap = new Map(),
  gradedDatesMap = new Map(), sessionTypeColors = {},
}) => {
  const days = getMonthGridDays(currentDate);
  const currentMonth = currentDate.getMonth();

  return (
    <div style={{ border: '1px solid #dee2e6', borderRadius: 4, overflow: 'hidden' }}>
      {/* Day-name header row — matches week/day view style */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #dee2e6',
        background: '#fff',
      }}
      >
        {WEEK_DAY_NAMES.map((name, idx) => {
          const isWeekend = idx === 0 || idx === 6; // Sun=0, Sat=6
          return (
            <div
              key={name}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px 4px',
                fontSize: 12,
                fontWeight: 600,
                color: isWeekend ? '#adb5bd' : '#6c757d',
                borderLeft: idx === 0 ? 'none' : '1px solid #dee2e6',
              }}
            >
              {name}
            </div>
          );
        })}
      </div>

      {/* Day cells grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, padding: 4,
      }}
      >
        {days.map((day) => (
          <DayCell
            key={toDateKey(day)}
            date={day}
            sessions={sessionMap.get(toDateKey(day)) || []}
            onEditSession={onEditSession}
            onDeleteSession={onDeleteSession}
            onCancelSession={onCancelSession}
            onSessionDetail={onSessionDetail}
            openPopoverId={openPopoverId}
            setOpenPopoverId={setOpenPopoverId}
            openDayKey={openDayKey}
            setOpenDayKey={setOpenDayKey}
            isOutsideMonth={day.getMonth() !== currentMonth}
            cellMinHeight={110}
            canManageSessions={canManageSessions}
            isInstructor={isInstructor}
            isLearner={isLearner}
            studentRequestMap={studentRequestMap}
            leaveDateMap={leaveDateMap}
            holidays={holidayMap.get(toDateKey(day)) || []}
            gradedDates={gradedDatesMap.get(toDateKey(day)) || []}
            sessionTypeColors={sessionTypeColors}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Time Grid (Week and Day views) ──────────────────────────────────────────

const START_HOUR = 0; // midnight — full 24-hour calendar
const END_HOUR = 24; // 12 AM (next day, exclusive)
const HOUR_HEIGHT = 60; // px per hour
const TIME_COL_WIDTH = 52; // px — left time axis column
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const formatHour = (hour) => {
  if (hour === 0) { return '12 AM'; }
  if (hour < 12) { return `${hour} AM`; }
  if (hour === 12) { return '12 PM'; }
  return `${hour - 12} PM`;
};

/** Top offset and height (px) for a session block inside the time grid. */
const getSessionPosition = (session) => {
  const start = new Date(session.scheduled_start_time);
  const end = new Date(session.scheduled_end_time || session.scheduled_start_time);
  const startDec = start.getHours() + start.getMinutes() / 60;
  const endDec = end.getHours() + end.getMinutes() / 60;
  const top = (Math.max(startDec, START_HOUR) - START_HOUR) * HOUR_HEIGHT;
  const height = Math.max(
    (Math.min(endDec, END_HOUR) - Math.max(startDec, START_HOUR)) * HOUR_HEIGHT,
    22, // minimum block height so very short sessions remain clickable
  );
  return { top, height };
};

/**
 * Given the sessions for one day, returns a map of
 *   sessionId → { lane, totalLanes }
 * so overlapping sessions are rendered side-by-side.
 * Non-overlapping sessions always get full column width because totalLanes
 * reflects only the concurrent overlap depth at each session's own time slot.
 */
const layoutSessions = (sessions) => {
  if (sessions.length === 0) { return {}; }

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.scheduled_start_time) - new Date(b.scheduled_start_time),
  );

  // Greedy lane assignment — place each session in the earliest free lane
  const laneEndTimes = [];
  const sessionLane = {};

  for (const session of sorted) {
    const startMs = new Date(session.scheduled_start_time).getTime();
    const endMs = new Date(session.scheduled_end_time || session.scheduled_start_time).getTime();

    let lane = laneEndTimes.findIndex((endTime) => endTime <= startMs);
    if (lane === -1) {
      lane = laneEndTimes.length; // open a new lane
    }
    laneEndTimes[lane] = endMs;
    sessionLane[session.id] = lane;
  }

  // Per-session totalLanes = (max lane among concurrent sessions) + 1,
  // so isolated sessions expand to full width
  const result = {};
  for (const session of sorted) {
    const startMs = new Date(session.scheduled_start_time).getTime();
    const endMs = new Date(session.scheduled_end_time || session.scheduled_start_time).getTime();

    const concurrent = sorted.filter((other) => {
      const os = new Date(other.scheduled_start_time).getTime();
      const oe = new Date(other.scheduled_end_time || other.scheduled_start_time).getTime();
      return os < endMs && oe > startMs;
    });

    const maxLane = Math.max(...concurrent.map((s) => sessionLane[s.id]));
    result[session.id] = { lane: sessionLane[session.id], totalLanes: maxLane + 1 };
  }

  return result;
};

const TimeGrid = ({
  days, sessionMap, onEditSession, onDeleteSession, onCancelSession, onSessionDetail,
  openPopoverId, setOpenPopoverId, canManageSessions = false, isInstructor = false,
  isLearner = false, studentRequestMap, leaveDateMap = null, holidayMap = new Map(),
  programDatesMap = new Map(), sessionTypeColors = {},
}) => {
  const todayKey = toDateKey(new Date());

  return (
    <div style={{ border: '1px solid #dee2e6', borderRadius: 4, overflow: 'hidden' }}>
      {/* Day header row */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #dee2e6',
        background: '#fff',
        position: 'sticky',
        top: 0,
        zIndex: 2,
      }}
      >
        {/* Empty corner above time axis */}
        <div style={{ width: TIME_COL_WIDTH, flexShrink: 0 }} />
        {days.map((day) => {
          const isToday = toDateKey(day) === todayKey;
          const isWeekend = isWeekendDay(day);
          return (
            <div
              key={toDateKey(day)}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px 4px',
                fontSize: 12,
                fontWeight: 600,
                color: getDayHeaderColor(isToday, isWeekend),
                borderLeft: '1px solid #dee2e6',
              }}
            >
              {day.toLocaleDateString('en-US', { weekday: 'short' })} {day.getDate()}
              {(holidayMap.get(toDateKey(day)) || []).map((h) => (
                <div
                  key={h.id}
                  style={{
                    fontSize: 9,
                    color: '#92400e',
                    background: '#fef3c7',
                    borderRadius: 2,
                    padding: '0 3px',
                    marginTop: 2,
                    lineHeight: 1.4,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {h.name}
                </div>
              ))}
              {isLearner && leaveDateMap?.get(toDateKey(day)) && (
                <div
                  style={{
                    fontSize: 9,
                    color: '#065f46',
                    background: '#d1fae5',
                    borderRadius: 2,
                    padding: '0 3px',
                    marginTop: 2,
                    lineHeight: 1.4,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  On Leave
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scrollable body */}
      <div style={{ overflowY: 'auto', maxHeight: 580 }}>
        <div style={{ display: 'flex', height: (END_HOUR - START_HOUR) * HOUR_HEIGHT + 14, paddingTop: 14 }}>

          {/* Time axis */}
          <div style={{ width: TIME_COL_WIDTH, flexShrink: 0, position: 'relative' }}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                style={{
                  position: 'absolute',
                  top: (hour - START_HOUR) * HOUR_HEIGHT - 7,
                  right: 6,
                  fontSize: 10,
                  color: '#9ca3af',
                  userSelect: 'none',
                  lineHeight: 1,
                }}
              >
                {formatHour(hour)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const key = toDateKey(day);
            const isToday = key === todayKey;
            const isWeekend = isWeekendDay(day);
            const daySessions = sessionMap.get(key) || [];
            const layout = layoutSessions(daySessions);

            return (
              <div
                key={key}
                style={{
                  flex: 1,
                  position: 'relative',
                  borderLeft: '1px solid #dee2e6',
                  background: getCellBackground(isToday, isWeekend),
                }}
              >
                {/* Hour grid lines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    style={{
                      position: 'absolute',
                      top: (hour - START_HOUR) * HOUR_HEIGHT,
                      left: 0,
                      right: 0,
                      borderTop: '1px solid #e5e7eb',
                    }}
                  />
                ))}

                {/* Graded due-date blocks — amber, positioned at due time */}
                {(programDatesMap.get(key) || []).map((event) => {
                  const dueDate = new Date(event.date);
                  const startDec = dueDate.getHours() + dueDate.getMinutes() / 60;
                  const top = (Math.max(startDec, START_HOUR) - START_HOUR) * HOUR_HEIGHT;
                  const dueTimeLabel = dueDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                  return (
                    <GradedDatePopover
                      key={event.id}
                      event={event}
                      isOpen={openPopoverId === `gd::${event.id}`}
                      onOpenChange={(next) => setOpenPopoverId((curr) => {
                        if (next) { return `gd::${event.id}`; }
                        return curr === `gd::${event.id}` ? null : curr;
                      })}
                    >
                      <button
                        type="button"
                        title={`Due: ${event.title} — ${dueTimeLabel}`}
                        style={{
                          position: 'absolute',
                          top,
                          left: 2,
                          right: 2,
                          height: 22,
                          background: GRADED_DATE_BG,
                          color: GRADED_DATE_TEXT,
                          border: `1px solid ${GRADED_DATE_BORDER}`,
                          borderRadius: 3,
                          padding: '1px 4px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          overflow: 'hidden',
                          zIndex: 0,
                          fontSize: 10,
                          lineHeight: 1.25,
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {dueTimeLabel} Due: {event.title}
                      </button>
                    </GradedDatePopover>
                  );
                })}

                {/* Session blocks — each opens a popover with Edit/Delete/Join.
                    Sessions covered by an approved leave render as non-interactive grey blocks. */}
                {daySessions.map((session) => {
                  const { top, height } = getSessionPosition(session);
                  const { lane, totalLanes } = layout[session.id] || { lane: 0, totalLanes: 1 };
                  const colWidthPct = (100 / totalLanes).toFixed(2);
                  const colLeftPct = ((lane / totalLanes) * 100).toFixed(2);
                  const startTime = new Date(session.scheduled_start_time)
                    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                  const leaveRequest = studentRequestMap?.get(session.id);

                  if (leaveRequest) {
                    return (
                      <div
                        key={session.id}
                        title={`${session.title} — On Leave`}
                        style={{
                          position: 'absolute',
                          top,
                          left: `calc(${colLeftPct}% + 2px)`,
                          width: `calc(${colWidthPct}% - 4px)`,
                          height,
                          background: '#e5e7eb',
                          color: '#6b7280',
                          borderRadius: 3,
                          padding: '2px 6px',
                          textAlign: 'left',
                          overflow: 'hidden',
                          zIndex: 1,
                          fontSize: totalLanes >= 2 ? 10 : 11,
                          lineHeight: 1.25,
                          userSelect: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                          <span style={{
                            width: 7,
                            height: 7,
                            minWidth: 7,
                            borderRadius: '50%',
                            background: '#9ca3af',
                            marginTop: 2,
                            flexShrink: 0,
                          }}
                          />
                          <strong style={{
                            display: '-webkit-box',
                            WebkitLineClamp: Math.max(1, Math.min(3, Math.floor((height - 4) / 14))),
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                            textDecoration: 'line-through',
                          }}
                          >
                            {session.title}
                          </strong>
                        </div>
                        {height >= 28 && totalLanes < 3 && (
                          <span style={{ opacity: 0.8, fontSize: 9 }}>On Leave</span>
                        )}
                      </div>
                    );
                  }

                  const bg = getChipBg(session, sessionTypeColors);
                  const isStrikethrough = session.status === 'cancelled';

                  return (
                    <SessionPopover
                      key={session.id}
                      session={session}
                      isOpen={openPopoverId === session.id}
                      onOpenChange={(next) => setOpenPopoverId((curr) => {
                        if (next) { return session.id; }
                        return curr === session.id ? null : curr;
                      })}
                      onEdit={onEditSession}
                      onDelete={onDeleteSession}
                      onCancel={onCancelSession}
                      onSessionDetail={onSessionDetail}
                      canManageSessions={canManageSessions}
                      isInstructor={isInstructor}
                      isLearner={isLearner}
                      learnerRequest={null}
                    >
                      <button
                        type="button"
                        title={`${session.title} — ${startTime}`}
                        style={{
                          position: 'absolute',
                          top,
                          left: `calc(${colLeftPct}% + 2px)`,
                          width: `calc(${colWidthPct}% - 4px)`,
                          height,
                          background: bg,
                          color: '#fff',
                          borderRadius: 3,
                          border: 'none',
                          padding: '2px 6px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          overflow: 'hidden',
                          zIndex: 1,
                          fontSize: totalLanes >= 2 ? 10 : 11,
                          lineHeight: 1.25,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                          <span style={{
                            width: 7,
                            height: 7,
                            minWidth: 7,
                            borderRadius: '50%',
                            background: statusDotColors[session.status] || '#e5e7eb',
                            marginTop: 2,
                            flexShrink: 0,
                          }}
                          />
                          <strong style={{
                            display: '-webkit-box',
                            WebkitLineClamp: Math.max(1, Math.min(3, Math.floor((height - 4) / 14))),
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                            textDecoration: isStrikethrough ? 'line-through' : 'none',
                          }}
                          >
                            {session.title}
                          </strong>
                        </div>
                        {/* Time label — hidden in narrow (3+ lane) columns; popover has it */}
                        {height >= 30 && totalLanes < 3 && (
                          <span style={{ opacity: 0.85, fontSize: 10 }}>{startTime}</span>
                        )}
                        {/* Course name — only in full-width columns with enough height */}
                        {height >= 45 && totalLanes < 2 && session.course_name && (
                          <span
                            style={{
                              opacity: 0.85,
                              fontSize: 10,
                              display: 'block',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {session.course_name}
                          </span>
                        )}
                      </button>
                    </SessionPopover>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── WeekGrid ─────────────────────────────────────────────────────────────────

const WeekGrid = ({
  currentDate, sessionMap, onEditSession, onDeleteSession, onCancelSession, onSessionDetail,
  openPopoverId, setOpenPopoverId, canManageSessions = false, isInstructor = false,
  isLearner = false, studentRequestMap, leaveDateMap = null, holidayMap = new Map(),
  programDatesMap = new Map(), sessionTypeColors = {},
}) => (
  <TimeGrid
    days={getWeekDays(currentDate)}
    sessionMap={sessionMap}
    onEditSession={onEditSession}
    onDeleteSession={onDeleteSession}
    onCancelSession={onCancelSession}
    onSessionDetail={onSessionDetail}
    openPopoverId={openPopoverId}
    setOpenPopoverId={setOpenPopoverId}
    canManageSessions={canManageSessions}
    isInstructor={isInstructor}
    isLearner={isLearner}
    studentRequestMap={studentRequestMap}
    leaveDateMap={leaveDateMap}
    holidayMap={holidayMap}
    programDatesMap={programDatesMap}
    sessionTypeColors={sessionTypeColors}
  />
);

// ─── DayView ──────────────────────────────────────────────────────────────────

const DayView = ({
  currentDate, sessionMap, onEditSession, onDeleteSession, onCancelSession, onSessionDetail,
  openPopoverId, setOpenPopoverId, canManageSessions = false, isInstructor = false,
  isLearner = false, studentRequestMap, leaveDateMap = null, holidayMap = new Map(),
  programDatesMap = new Map(), sessionTypeColors = {},
}) => (
  <TimeGrid
    days={[currentDate]}
    sessionMap={sessionMap}
    onEditSession={onEditSession}
    onDeleteSession={onDeleteSession}
    onCancelSession={onCancelSession}
    onSessionDetail={onSessionDetail}
    openPopoverId={openPopoverId}
    setOpenPopoverId={setOpenPopoverId}
    canManageSessions={canManageSessions}
    isInstructor={isInstructor}
    isLearner={isLearner}
    studentRequestMap={studentRequestMap}
    leaveDateMap={leaveDateMap}
    holidayMap={holidayMap}
    programDatesMap={programDatesMap}
    sessionTypeColors={sessionTypeColors}
  />
);

// ─── CalendarView ─────────────────────────────────────────────────────────────

const CalendarView = ({
  sessions, view, currentDate, onViewChange, onNavigate, onGoToToday,
  onScheduleNew, onEditSession, onDeleteSession, onCancelSession, onSessionDetail,
  loading = false, canManageSessions = false, isInstructor = false,
  isLearner = false, studentRequestMap, leaveDateMap = null, holidays = [],
  programDates = [], sessionTypeColors = {},
}) => {
  // Only one popover open at a time; null = none. Chip clicks and outside
  // clicks flip this; Edit/Delete actions also reset it before bubbling up.
  const [openPopoverId, setOpenPopoverId] = useState(null);
  // Day popover (Month view) — keyed by date string e.g. "2026-03-27"
  const [openDayKey, setOpenDayKey] = useState(null);

  const sessionMap = bucketSessionsByDay(sessions);

  const programDatesMap = useMemo(() => {
    const map = new Map();
    programDates.forEach((event) => {
      const key = toDateKey(new Date(event.date));
      const slot = map.get(key);
      if (slot) { slot.push(event); } else { map.set(key, [event]); }
    });
    return map;
  }, [programDates]);

  const holidayMap = useMemo(() => {
    const map = new Map();
    holidays.forEach((h) => {
      const cur = new Date(`${h.start_date}T00:00:00`);
      const last = new Date(`${h.end_date}T00:00:00`);
      while (cur <= last) {
        const key = toDateKey(cur);
        const slot = map.get(key);
        if (slot) { slot.push(h); } else { map.set(key, [h]); }
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [holidays]);

  // ── Navigation ──
  const navigate = (direction) => {
    setOpenPopoverId(null);
    setOpenDayKey(null);
    onNavigate(direction);
  };

  const goToToday = () => {
    setOpenPopoverId(null);
    setOpenDayKey(null);
    onGoToToday();
  };

  const handleViewChange = (nextView) => {
    setOpenPopoverId(null);
    setOpenDayKey(null);
    onViewChange(nextView);
  };

  const handleEdit = (session) => {
    setOpenPopoverId(null);
    setOpenDayKey(null);
    onEditSession(session);
  };

  const handleDelete = (session) => {
    setOpenPopoverId(null);
    setOpenDayKey(null);
    onDeleteSession(session);
  };

  const handleCancel = (session) => {
    setOpenPopoverId(null);
    setOpenDayKey(null);
    onCancelSession(session);
  };

  const handleViewSession = (session) => {
    setOpenPopoverId(null);
    setOpenDayKey(null);
    onSessionDetail(session);
  };

  const handleScheduleNew = () => {
    setOpenPopoverId(null);
    setOpenDayKey(null);
    onScheduleNew();
  };

  return (
    <div>
      {/* ── Toolbar ── */}
      <div className="d-flex align-items-center flex-wrap mb-3" style={{ gap: 8 }}>
        <IconButton
          src={ChevronLeft}
          iconAs={ChevronLeft}
          alt="Previous"
          onClick={() => navigate(-1)}
          size="sm"
        />
        <Button variant="outline-primary" size="sm" onClick={goToToday}>
          Today
        </Button>
        <IconButton
          src={ChevronRight}
          iconAs={ChevronRight}
          alt="Next"
          onClick={() => navigate(1)}
          size="sm"
        />

        <span style={{ fontWeight: 600, fontSize: 16, minWidth: 180 }}>
          {formatRangeLabel(view, currentDate)}
        </span>

        {/* View toggles + New session — pushed to the right */}
        <div className="ml-auto d-flex align-items-center" style={{ gap: 4 }}>
          {Object.values(VIEWS).map((v) => (
            <Button
              key={v}
              variant={view === v ? 'primary' : 'outline-primary'}
              size="sm"
              onClick={() => handleViewChange(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Button>
          ))}
          {canManageSessions && (
            <>
              <span style={{
                width: 1, height: 24, background: '#dee2e6', margin: '0 4px',
              }}
              />
              <Button
                variant="success"
                size="sm"
                iconBefore={Add}
                onClick={handleScheduleNew}
              >
                New session
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Active view — subtle opacity during navigation re-fetches ── */}
      <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 120ms ease-out' }}>
        {view === VIEWS.MONTH && (
        <MonthGrid
          currentDate={currentDate}
          sessionMap={sessionMap}
          onEditSession={handleEdit}
          onDeleteSession={handleDelete}
          onCancelSession={handleCancel}
          onSessionDetail={handleViewSession}
          openPopoverId={openPopoverId}
          setOpenPopoverId={setOpenPopoverId}
          openDayKey={openDayKey}
          setOpenDayKey={setOpenDayKey}
          canManageSessions={canManageSessions}
          isInstructor={isInstructor}
          isLearner={isLearner}
          studentRequestMap={studentRequestMap}
          leaveDateMap={leaveDateMap}
          holidayMap={holidayMap}
          gradedDatesMap={programDatesMap}
          sessionTypeColors={sessionTypeColors}
        />
        )}
        {view === VIEWS.WEEK && (
        <WeekGrid
          currentDate={currentDate}
          sessionMap={sessionMap}
          onEditSession={handleEdit}
          onDeleteSession={handleDelete}
          onCancelSession={handleCancel}
          onSessionDetail={handleViewSession}
          openPopoverId={openPopoverId}
          setOpenPopoverId={setOpenPopoverId}
          canManageSessions={canManageSessions}
          isInstructor={isInstructor}
          isLearner={isLearner}
          studentRequestMap={studentRequestMap}
          leaveDateMap={leaveDateMap}
          holidayMap={holidayMap}
          programDatesMap={programDatesMap}
          sessionTypeColors={sessionTypeColors}
        />
        )}
        {view === VIEWS.DAY && (
        <DayView
          currentDate={currentDate}
          sessionMap={sessionMap}
          onEditSession={handleEdit}
          onDeleteSession={handleDelete}
          onCancelSession={handleCancel}
          onSessionDetail={handleViewSession}
          openPopoverId={openPopoverId}
          setOpenPopoverId={setOpenPopoverId}
          canManageSessions={canManageSessions}
          isInstructor={isInstructor}
          isLearner={isLearner}
          studentRequestMap={studentRequestMap}
          leaveDateMap={leaveDateMap}
          holidayMap={holidayMap}
          programDatesMap={programDatesMap}
          sessionTypeColors={sessionTypeColors}
        />
        )}
      </div>

    </div>
  );
};

// ─── PropTypes ────────────────────────────────────────────────────────────────

GradedDatePopover.propTypes = {
  event: PropTypes.shape({
    id: PropTypes.string.isRequired,
    courseName: PropTypes.string,
    title: PropTypes.string,
    date: PropTypes.string,
    link: PropTypes.string,
    assignmentType: PropTypes.string,
    complete: PropTypes.bool,
  }).isRequired,
  children: PropTypes.node.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
};

const requestShape = PropTypes.shape({
  state: PropTypes.string,
  type: PropTypes.string,
});

const sessionShape = PropTypes.shape({
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  title: PropTypes.string,
  course_id: PropTypes.string,
  course_name: PropTypes.string,
  status: PropTypes.string,
  scheduled_start_time: PropTypes.string,
  scheduled_end_time: PropTypes.string,
  meeting_id: PropTypes.string,
  meeting_join_url: PropTypes.string,
  meeting_start_url: PropTypes.string,
  create_zoom_meeting: PropTypes.bool,
  user_role: PropTypes.string,
  session_type: PropTypes.string,
  my_request: requestShape,
  location: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    biometric_machine_serial_number: PropTypes.string,
  }),
});

SessionPopover.propTypes = {
  session: sessionShape.isRequired,
  children: PropTypes.node.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onCancel: PropTypes.func,
  onSessionDetail: PropTypes.func,
  canManageSessions: PropTypes.bool,
  isInstructor: PropTypes.bool,
  isLearner: PropTypes.bool,
  learnerRequest: requestShape,
};
SessionPopover.defaultProps = {
  onEdit: () => {},
  onDelete: () => {},
  onCancel: () => {},
  onSessionDetail: () => {},
  canManageSessions: false,
  isInstructor: false,
  isLearner: false,
  learnerRequest: null,
};

DayPopover.propTypes = {
  date: PropTypes.instanceOf(Date).isRequired,
  sessions: PropTypes.arrayOf(sessionShape).isRequired,
  children: PropTypes.node.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onCancel: PropTypes.func,
  onSessionDetail: PropTypes.func,
  canManageSessions: PropTypes.bool,
  isInstructor: PropTypes.bool,
  isLearner: PropTypes.bool,
  studentRequestMap: PropTypes.instanceOf(Map),
  gradedDates: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    courseKey: PropTypes.string,
    courseName: PropTypes.string,
    title: PropTypes.string,
    date: PropTypes.string,
    link: PropTypes.string,
    assignmentType: PropTypes.string,
    complete: PropTypes.bool,
  })),
};
DayPopover.defaultProps = {
  onEdit: () => {},
  onDelete: () => {},
  onCancel: () => {},
  onSessionDetail: () => {},
  canManageSessions: false,
  isInstructor: false,
  isLearner: false,
  studentRequestMap: null,
  gradedDates: [],
};

const gradedDateShape = PropTypes.shape({
  id: PropTypes.string,
  courseKey: PropTypes.string,
  courseName: PropTypes.string,
  title: PropTypes.string,
  date: PropTypes.string,
  link: PropTypes.string,
  assignmentType: PropTypes.string,
  complete: PropTypes.bool,
});

DayCell.propTypes = {
  date: PropTypes.instanceOf(Date).isRequired,
  sessions: PropTypes.arrayOf(sessionShape),
  onEditSession: PropTypes.func,
  onDeleteSession: PropTypes.func,
  onCancelSession: PropTypes.func,
  onSessionDetail: PropTypes.func,
  openPopoverId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  setOpenPopoverId: PropTypes.func.isRequired,
  openDayKey: PropTypes.string,
  setOpenDayKey: PropTypes.func.isRequired,
  isOutsideMonth: PropTypes.bool,
  cellMinHeight: PropTypes.number,
  canManageSessions: PropTypes.bool,
  isInstructor: PropTypes.bool,
  isLearner: PropTypes.bool,
  studentRequestMap: PropTypes.instanceOf(Map),
  leaveDateMap: PropTypes.instanceOf(Map),
  sessionTypeColors: PropTypes.objectOf(PropTypes.string),
  holidays: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number, start_date: PropTypes.string, end_date: PropTypes.string, name: PropTypes.string,
  })),
  gradedDates: PropTypes.arrayOf(gradedDateShape),
};
DayCell.defaultProps = {
  sessions: [],
  onEditSession: () => {},
  onDeleteSession: () => {},
  onCancelSession: () => {},
  onSessionDetail: () => {},
  openPopoverId: null,
  openDayKey: null,
  isOutsideMonth: false,
  cellMinHeight: 110,
  canManageSessions: false,
  isInstructor: false,
  isLearner: false,
  studentRequestMap: null,
  leaveDateMap: null,
  sessionTypeColors: {},
  gradedDates: [],
};

MonthGrid.propTypes = {
  currentDate: PropTypes.instanceOf(Date).isRequired,
  sessionMap: PropTypes.instanceOf(Map).isRequired,
  onEditSession: PropTypes.func,
  onDeleteSession: PropTypes.func,
  onCancelSession: PropTypes.func,
  onSessionDetail: PropTypes.func,
  openPopoverId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  setOpenPopoverId: PropTypes.func.isRequired,
  openDayKey: PropTypes.string,
  setOpenDayKey: PropTypes.func.isRequired,
  canManageSessions: PropTypes.bool,
  isInstructor: PropTypes.bool,
  isLearner: PropTypes.bool,
  studentRequestMap: PropTypes.instanceOf(Map),
  leaveDateMap: PropTypes.instanceOf(Map),
  sessionTypeColors: PropTypes.objectOf(PropTypes.string),
  holidayMap: PropTypes.instanceOf(Map),
  gradedDatesMap: PropTypes.instanceOf(Map),
};
MonthGrid.defaultProps = {
  onEditSession: () => {},
  onDeleteSession: () => {},
  onCancelSession: () => {},
  onSessionDetail: () => {},
  openPopoverId: null,
  openDayKey: null,
  canManageSessions: false,
  isInstructor: false,
  isLearner: false,
  studentRequestMap: null,
  leaveDateMap: null,
  sessionTypeColors: {},
  holidayMap: null,
  gradedDatesMap: null,
};

TimeGrid.propTypes = {
  days: PropTypes.arrayOf(PropTypes.instanceOf(Date)).isRequired,
  sessionMap: PropTypes.instanceOf(Map).isRequired,
  onEditSession: PropTypes.func,
  onDeleteSession: PropTypes.func,
  onCancelSession: PropTypes.func,
  onSessionDetail: PropTypes.func,
  openPopoverId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  setOpenPopoverId: PropTypes.func.isRequired,
  canManageSessions: PropTypes.bool,
  isInstructor: PropTypes.bool,
  isLearner: PropTypes.bool,
  studentRequestMap: PropTypes.instanceOf(Map),
  leaveDateMap: PropTypes.instanceOf(Map),
  sessionTypeColors: PropTypes.objectOf(PropTypes.string),
  holidayMap: PropTypes.instanceOf(Map),
  programDatesMap: PropTypes.instanceOf(Map),
};
TimeGrid.defaultProps = {
  onEditSession: () => {},
  onDeleteSession: () => {},
  onCancelSession: () => {},
  onSessionDetail: () => {},
  openPopoverId: null,
  canManageSessions: false,
  isInstructor: false,
  isLearner: false,
  studentRequestMap: null,
  leaveDateMap: null,
  sessionTypeColors: {},
  holidayMap: null,
  programDatesMap: null,
};

WeekGrid.propTypes = {
  currentDate: PropTypes.instanceOf(Date).isRequired,
  sessionMap: PropTypes.instanceOf(Map).isRequired,
  onEditSession: PropTypes.func,
  onDeleteSession: PropTypes.func,
  onCancelSession: PropTypes.func,
  onSessionDetail: PropTypes.func,
  openPopoverId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  setOpenPopoverId: PropTypes.func.isRequired,
  canManageSessions: PropTypes.bool,
  isInstructor: PropTypes.bool,
  isLearner: PropTypes.bool,
  studentRequestMap: PropTypes.instanceOf(Map),
  leaveDateMap: PropTypes.instanceOf(Map),
  sessionTypeColors: PropTypes.objectOf(PropTypes.string),
  holidayMap: PropTypes.instanceOf(Map),
  programDatesMap: PropTypes.instanceOf(Map),
};
WeekGrid.defaultProps = {
  onEditSession: () => {},
  onDeleteSession: () => {},
  onCancelSession: () => {},
  onSessionDetail: () => {},
  openPopoverId: null,
  canManageSessions: false,
  isInstructor: false,
  isLearner: false,
  studentRequestMap: null,
  leaveDateMap: null,
  sessionTypeColors: {},
  holidayMap: null,
  programDatesMap: null,
};

DayView.propTypes = {
  currentDate: PropTypes.instanceOf(Date).isRequired,
  sessionMap: PropTypes.instanceOf(Map).isRequired,
  onEditSession: PropTypes.func,
  onDeleteSession: PropTypes.func,
  onCancelSession: PropTypes.func,
  onSessionDetail: PropTypes.func,
  openPopoverId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  setOpenPopoverId: PropTypes.func.isRequired,
  canManageSessions: PropTypes.bool,
  isInstructor: PropTypes.bool,
  isLearner: PropTypes.bool,
  studentRequestMap: PropTypes.instanceOf(Map),
  leaveDateMap: PropTypes.instanceOf(Map),
  sessionTypeColors: PropTypes.objectOf(PropTypes.string),
  holidayMap: PropTypes.instanceOf(Map),
  programDatesMap: PropTypes.instanceOf(Map),
};
DayView.defaultProps = {
  onEditSession: () => {},
  onDeleteSession: () => {},
  onCancelSession: () => {},
  onSessionDetail: () => {},
  openPopoverId: null,
  canManageSessions: false,
  isInstructor: false,
  isLearner: false,
  studentRequestMap: null,
  leaveDateMap: null,
  sessionTypeColors: {},
  holidayMap: null,
  programDatesMap: null,
};

CalendarView.propTypes = {
  sessions: PropTypes.arrayOf(sessionShape).isRequired,
  view: PropTypes.oneOf(['month', 'week', 'day']).isRequired,
  currentDate: PropTypes.instanceOf(Date).isRequired,
  onViewChange: PropTypes.func.isRequired,
  onNavigate: PropTypes.func.isRequired,
  onGoToToday: PropTypes.func.isRequired,
  onScheduleNew: PropTypes.func.isRequired,
  onEditSession: PropTypes.func,
  onDeleteSession: PropTypes.func,
  onCancelSession: PropTypes.func,
  onSessionDetail: PropTypes.func,
  loading: PropTypes.bool,
  canManageSessions: PropTypes.bool,
  isInstructor: PropTypes.bool,
  isLearner: PropTypes.bool,
  studentRequestMap: PropTypes.instanceOf(Map),
  leaveDateMap: PropTypes.instanceOf(Map),
  sessionTypeColors: PropTypes.objectOf(PropTypes.string),
  holidays: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number,
    date: PropTypes.string,
    name: PropTypes.string,
  })),
  programDates: PropTypes.arrayOf(gradedDateShape),
};
CalendarView.defaultProps = {
  onEditSession: () => {},
  onDeleteSession: () => {},
  onCancelSession: () => {},
  onSessionDetail: () => {},
  loading: false,
  canManageSessions: false,
  isInstructor: false,
  isLearner: false,
  studentRequestMap: null,
  leaveDateMap: null,
  sessionTypeColors: {},
  holidays: [],
  programDates: [],
};

export default CalendarView;
