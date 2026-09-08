import React, { useState, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Link, useParams } from 'react-router-dom';
import {
  Button,
  IconButton,
  Badge,
  Icon,
  OverlayTrigger,
  Popover,
  Tooltip,
} from '@openedx/paragon';
import {
  ChevronLeft, ChevronRight, Launch, Add, EditOutline, DeleteOutline, EventBusy, InfoOutline,
} from '@openedx/paragon/icons';
import { bucketSessionsByDay, getStatusVariant } from '../shared/utils';
import { SESSION_STATUS_LABELS, USER_ROLE, REQUEST_STATUS } from '../shared/constants';
import RequestStatusBadge from '../shared/RequestStatusBadge';
import ScopeBadge from '../shared/ScopeBadge';
import InstructingBadge from '../shared/InstructingBadge';
import './calendar.scss';
import { getSessionStartLink } from './api';

// ─── Constants ────────────────────────────────────────────────────────────────

const VIEWS = { MONTH: 'month', WEEK: 'week', DAY: 'day' };

// Sun(0) first, matching JS getDay() order
const WEEK_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Fetch a fresh Zoom host start link and open it. The link is minted on demand
// (it expires ~2h after Zoom generates it), so we open a blank tab first — inside
// the click gesture, to dodge popup blockers — then navigate it once the link
// arrives. opener is nulled to keep the no-opener protection without 'noopener',
// which would otherwise deny us the window handle.
const openSessionStartLink = async (sessionId) => {
  const win = window.open('about:blank', '_blank');
  if (win) { win.opener = null; }
  try {
    const url = await getSessionStartLink(sessionId);
    if (!url) { throw new Error('No start link returned'); }
    if (win) { win.location.href = url; } else { window.open(url, '_blank', 'noopener,noreferrer'); }
  } catch (err) {
    if (win) { win.close(); }
    // eslint-disable-next-line no-alert
    window.alert('Could not open the meeting start link. Please try again.');
  }
};

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

// A day is today, a weekend, or neither. Both the cell's ground and the
// day-name colour follow from that, so it is a modifier rather than a value.
const dayVariant = (isToday, isWeekend) => {
  if (isToday) { return 'today'; }
  if (isWeekend) { return 'weekend'; }
  return 'plain';
};

// Weekend = Saturday (6) or Sunday (0) in JS getDay()
const isWeekendDay = (date) => date.getDay() === 0 || date.getDay() === 6;

const getSessionTypeLabel = (session, sessionTypeLabels = {}) => {
  const rawType = session?.session_type;
  if (!rawType) { return ''; }
  if (sessionTypeLabels[rawType]) { return sessionTypeLabels[rawType]; }
  return rawType
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const SessionTypeBadge = ({ session, sessionTypeLabels }) => {
  const label = getSessionTypeLabel(session, sessionTypeLabels);
  if (!label) { return null; }
  const tooltip = 'Session type.';
  return (
    <span className="d-inline-flex align-items-center calendar-type-badge">
      <Badge variant="secondary">{label}</Badge>
      <OverlayTrigger
        trigger={['hover', 'focus']}
        placement="top"
        overlay={<Tooltip id={`session-type-tip-${session.session_type || 'unknown'}`}>{tooltip}</Tooltip>}
      >
        <Button
          variant="link"
          aria-label={tooltip}
          className="d-inline-flex align-items-center p-0 border-0 text-muted"
        >
          <Icon src={InfoOutline} className="text-muted" />
        </Button>
      </OverlayTrigger>
    </span>
  );
};
SessionTypeBadge.propTypes = {
  session: PropTypes.shape({
    session_type: PropTypes.string,
  }).isRequired,
  sessionTypeLabels: PropTypes.objectOf(PropTypes.string),
};
SessionTypeBadge.defaultProps = {
  sessionTypeLabels: {},
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

// Paragon's link Button, restyled by .calendar-link-button as an always-underlined
// hyperlink that darkens on hover/focus. Used by both popovers for the
// session-title click target.
const TitleLink = ({
  title, onClick, ariaLabel, isCancelled,
}) => (
  <Button
    variant="link"
    onClick={onClick}
    aria-label={ariaLabel}
    className="calendar-link-button border-0 p-0 text-left"
  >
    <span className={isCancelled ? 'calendar-strikethrough' : undefined}>{title}</span>
  </Button>
);
TitleLink.propTypes = {
  title: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string,
  isCancelled: PropTypes.bool,
};
TitleLink.defaultProps = {
  ariaLabel: undefined,
  isCancelled: false,
};

// Controlled popover — only one popover can be open across the whole calendar at
// any time, and it closes cleanly when Edit/Delete opens another modal.
const SessionPopover = ({
  session, children, isOpen, onOpenChange, onEdit, onDelete, onCancel, onSessionDetail,
  canManageSessions = false, isInstructor = false,
  isLearner = false, learnerRequest = null, sessionTypeLabels,
}) => {
  const { programId } = useParams();
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
  // Hosts (admin or the session's instructor) start the meeting; the start link
  // is fetched on demand, not carried on the session.
  const canStartMeeting = !isPast && Boolean(session.meeting_id)
    && (canManageSessions || session.user_role === USER_ROLE.INSTRUCTOR);

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
      className="calendar-popover calendar-popover--session"
    >
      <Popover.Title
        as="h5"
        className="calendar-popover__title calendar-popover__title--session m-0"
      >
        <TitleLink
          title={session.title}
          onClick={handleViewDetail}
          ariaLabel={`Show details for ${session.title}`}
          isCancelled={displayStatus === 'cancelled'}
        />
      </Popover.Title>
      <Popover.Content className="calendar-popover__content">
        {session.course_name && (
          <div className="text-muted mb-1">Course: {session.course_name}</div>
        )}
        {instructorDisplay && (
          <div className="text-muted mb-1">Instructor: {instructorDisplay}</div>
        )}
        {/* Time + status badge on the same row */}
        <div className="d-flex align-items-center mb-2 calendar-popover__badges flex-wrap">
          <span>{formatTimeRange(session)}</span>
        </div>
        <div className="mb-2 d-flex calendar-popover__meta flex-wrap">
          <Badge variant={getStatusVariant(displayStatus)}>{statusLabel}</Badge>
          {/* Cancelled session = dead end; suppress scope/instructor noise. */}
          {displayStatus !== 'cancelled' && (
            <>
              {canManageSessions && (
                (hasMeeting
                  ? <ScopeBadge scope={session.create_zoom_meeting ? 'public' : 'gated'} />
                  : <ScopeBadge scope="in_person" />)
              )}
              <SessionTypeBadge session={session} sessionTypeLabels={sessionTypeLabels} />
              {session.user_role === USER_ROLE.INSTRUCTOR && <InstructingBadge />}
            </>
          )}
        </div>
        {session.status === 'scheduled' && (
          <div className="d-flex align-items-center calendar-popover__actions flex-wrap">
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
                  className="calendar-action--cancel"
                >
                  Cancel
                </Button>
                <Button
                  variant="tertiary"
                  size="sm"
                  iconBefore={DeleteOutline}
                  onClick={handleDelete}
                  className="calendar-action--delete"
                >
                  Delete
                </Button>
              </>
            )}
            {/* Host (admin or session instructor) → Start; the link is fetched
                on demand from the backend. */}
            {canStartMeeting && (
              <Button
                variant="success"
                size="sm"
                iconAfter={Launch}
                onClick={(e) => { e.stopPropagation(); onOpenChange(false); openSessionStartLink(session.id); }}
              >
                Start as host
              </Button>
            )}
            {/* Join button — shown to non-hosts; learners only when scope allows. */}
            {(() => {
              if (isPast) { return null; }
              if (canStartMeeting) { return null; }
              if (isLearner && !learnerCanJoin) { return null; }
              const requestJoinUrl = myRequest?.data?.meetings?.[session.id]?.meeting_join_url;
              const joinUrl = session.my_join_url || session.meeting_join_url || requestJoinUrl;
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
        {/* Admin-only: quick links to attendance roster and audit history. */}
        {canManageSessions && session.id && (
          <div className="mt-2">
            <Button
              as={Link}
              variant="tertiary"
              size="sm"
              className="p-0"
              to={`/${programId}/attendance/sessions/${session.id}?course_id=${encodeURIComponent(session.course_id || '')}`}
              state={{
                sessionTitle: session.title,
                sessionTime: session.scheduled_start_time,
                courseName: session.course_name,
              }}
              onClick={() => onOpenChange(false)}
            >
              View attendance
            </Button>
            <Button
              as={Link}
              variant="tertiary"
              size="sm"
              className="p-0 d-block"
              to={`/${programId}/calendar?view=audit-log&record_id=${session.id}`}
              onClick={() => onOpenChange(false)}
            >
              View history
            </Button>
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
  gradedDates = [], sessionTypeLabels,
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
      className="calendar-popover calendar-popover--day"
    >
      <Popover.Title
        as="h5"
        className="calendar-popover__title calendar-popover__title--day m-0"
      >
        {dateLabel}
        <span className="text-muted ml-1 calendar-popover__title-count">
          ({sessions.length} session{sessions.length !== 1 ? 's' : ''}
          {gradedDates.length > 0 && `, ${gradedDates.length} due date${gradedDates.length !== 1 ? 's' : ''}`})
        </span>
      </Popover.Title>
      <Popover.Content className="p-0">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="calendar-popover__scroll overflow-auto p-2"
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
            const canStartMeeting = !isPast && Boolean(session.meeting_id)
              && (canManageSessions || session.user_role === USER_ROLE.INSTRUCTOR);
            return (
              <div
                key={session.id}
                className="d-flex align-items-start calendar-day-session"

              >
                <span
                  className="calendar-dot calendar-dot--lg rounded-circle flex-shrink-0"
                  style={{ background: statusColors[displayStatus] || '#6c757d' }}
                />
                <div className="calendar-day-session__body">
                  <div className="calendar-day-session__title">
                    <TitleLink
                      title={session.title}
                      onClick={(e) => handleViewDetail(e, session)}
                      ariaLabel={`Show details for ${session.title}`}
                      isCancelled={displayStatus === 'cancelled'}
                    />
                  </div>
                  {session.course_name && (
                  <div className="text-muted calendar-day-session__meta">{session.course_name}</div>
                  )}
                  {instructorDisplay && (
                  <div className="text-muted calendar-day-session__meta">Instructor: {instructorDisplay}</div>
                  )}
                  <div className="calendar-day-session__note">{formatTimeRange(session)}</div>
                  {/* On Leave indicator for learner-approved leaves */}
                  {studentRequestMap?.get(session.id) && (
                    <div
                      className="calendar-leave-tag d-inline-block"
                    >
                      On Leave
                    </div>
                  )}
                  <div className="mt-1 d-flex calendar-day-session__badges flex-wrap">
                    <Badge variant={getStatusVariant(displayStatus)}>
                      {SESSION_STATUS_LABELS[displayStatus] || displayStatus}
                    </Badge>
                    {/* Cancelled session = dead end; suppress scope/instructor noise. */}
                    {session.status !== 'cancelled' && (
                      <>
                        {canManageSessions && (
                          (hasMeeting
                            ? <ScopeBadge scope={session.create_zoom_meeting ? 'public' : 'gated'} />
                            : <ScopeBadge scope="in_person" />)
                        )}
                        <SessionTypeBadge session={session} sessionTypeLabels={sessionTypeLabels} />
                      </>
                    )}
                  </div>
                  {session.status !== 'cancelled' && session.user_role === USER_ROLE.INSTRUCTOR && (
                    <div className="mt-1"><InstructingBadge /></div>
                  )}
                  {session.status === 'scheduled' && (
                  <div className="mt-1 d-flex align-items-center calendar-day-session__actions flex-wrap">
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
                          className="calendar-action--cancel"
                          onClick={(e) => handleCancel(e, session)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="tertiary"
                          size="sm"
                          iconBefore={DeleteOutline}
                          className="calendar-action--delete"
                          onClick={(e) => handleDelete(e, session)}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                    {/* Host (admin or session instructor) → Start; link fetched on demand. */}
                    {canStartMeeting && (
                      <Button
                        variant="success"
                        size="sm"
                        iconAfter={Launch}
                        onClick={(e) => { e.stopPropagation(); onOpenChange(false); openSessionStartLink(session.id); }}
                      >
                        Start as host
                      </Button>
                    )}
                    {/* Join — shown to non-hosts; learners only when scope allows. */}
                    {(() => {
                      if (isPast) { return null; }
                      if (canStartMeeting) { return null; }
                      if (isLearner && !learnerCanJoin) { return null; }
                      const requestJoinUrl = myRequest?.data?.meetings?.[session.id]?.meeting_join_url;
                      const joinUrl = session.my_join_url || session.meeting_join_url || requestJoinUrl;
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
            <div className={classNames('calendar-graded__group', { 'calendar-graded__group--divided': sessions.length > 0 })}>
              <div className="calendar-graded__heading text-uppercase">
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
                    className="calendar-chip calendar-chip--graded-lg text-truncate d-block w-100 mb-1 text-left"
                    title={`Due: ${event.title} (${event.courseName})`}
                  >
                    <div className="calendar-graded__title overflow-hidden">{event.title}
                    </div>
                    <div className="calendar-graded__meta overflow-hidden">{event.courseName}
                    </div>
                  </button>
                </GradedDatePopover>
              ))}
            </div>
          )}
        </div>
        {showScrollHint && (
          <div
            className="calendar-scroll-hint text-center"
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
      className="calendar-popover calendar-popover--graded"
    >
      <Popover.Title
        as="h5"
        className="calendar-popover__title calendar-popover__title--graded m-0"
      >
        {event.courseName}
      </Popover.Title>
      <Popover.Content className="calendar-popover__content">
        <div className="font-weight-bold mb-1">{event.title}</div>
        <div className="text-muted mb-2">Due: {dueDateLabel}</div>
        <div className="mb-2 d-flex calendar-popover__meta flex-wrap">
          {event.assignmentType && (
            <Badge
              variant="light"
              className="calendar-graded__badge"
            >
              {event.assignmentType}
            </Badge>
          )}
          {event.complete && (
            <Badge variant="success" className="calendar-badge-sm">Completed</Badge>
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
  gradedDates = [], sessionTypeColors = {}, sessionTypeLabels,
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
      className={classNames(
        'calendar-day-cell d-flex flex-column align-items-stretch text-left w-100',
        `calendar-day-cell--${dayVariant(isToday, isWeekend)}`,
        { 'calendar-day-cell--clickable': hasSessions, 'calendar-day-cell--outside': isOutsideMonth },
      )}
      style={{ minHeight: cellMinHeight }}
      aria-label={`${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}, ${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
    >
      {/* Day number */}
      <span
        className={classNames(
          'calendar-day-number d-inline-flex align-items-center justify-content-center rounded-circle mb-1 flex-shrink-0',
          { 'calendar-day-number--today': isToday },
        )}
      >
        {date.getDate()}
      </span>

      {/* Holiday banners — one per holiday covering this day */}
      {holidays.map((h) => (
        <div
          key={h.id}
          className="calendar-chip calendar-chip--holiday text-truncate"
        >
          {h.name}
        </div>
      ))}

      {/* Leave banner — shown when at least one session on this day has an approved leave */}
      {(isLearner || isInstructor) && leaveDateMap?.get(dateKey) && (
        <div
          className="calendar-chip calendar-chip--leave text-truncate"
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
            className="calendar-chip calendar-chip--graded text-truncate d-block text-left w-100"
          >
            {event.title}
          </button>
        </GradedDatePopover>
      ))}
      {gradedDates.length > MAX_CHIPS && (
        <div className="calendar-graded__more">
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
              className="calendar-chip calendar-chip--onleave text-truncate d-block w-100 user-select-none"
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
            sessionTypeLabels={sessionTypeLabels}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpenDayKey(null); }}
              onKeyDown={(e) => e.stopPropagation()}
              title={session.title}
              className="calendar-chip calendar-chip--session text-truncate d-block border-0 w-100"
              style={{ background: getChipBg(session, sessionTypeColors) }}
            >
              {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
              <span className="calendar-chip__inner d-flex align-items-center overflow-hidden">
                <span
                  className="calendar-dot calendar-dot--sm rounded-circle flex-shrink-0"
                  style={{ background: statusDotColors[session.status] || '#e5e7eb' }}
                />
                <span className={classNames('text-truncate', { 'calendar-strikethrough': session.status === 'cancelled' })}>
                  {session.title}
                </span>
              </span>
            </button>
          </SessionPopover>
        );
      })}

      {/* Overflow — clickable, opens the day popover */}
      {overflow > 0 && (
        <Button
          variant="link"
          onClick={(e) => { e.stopPropagation(); setOpenPopoverId(null); setDayOpen(true); }}
          className="calendar-link-button calendar-link-button--chip border-0 p-0 text-left"
        >
          +{overflow} more
        </Button>
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
      sessionTypeLabels={sessionTypeLabels}
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
  gradedDatesMap = new Map(), sessionTypeColors = {}, sessionTypeLabels,
}) => {
  const days = getMonthGridDays(currentDate);
  const currentMonth = currentDate.getMonth();

  return (
    <div className="calendar-month">
      <div className="calendar-month__inner">
        {/* Day-name header row. It shares `calendar-month__col` with the grid
            below so the two stay in the same columns. */}
        <div className="calendar-month__head">
          {WEEK_DAY_NAMES.map((name, idx) => {
            const isWeekend = idx === 0 || idx === 6; // Sun=0, Sat=6
            return (
              <div
                key={name}
                className={`calendar-month__col calendar-month__day-name calendar-month__day-name--${isWeekend ? 'weekend' : 'weekday'}`}
              >
                {name}
              </div>
            );
          })}
        </div>

        <div className="calendar-month__grid">
          {days.map((day) => (
            <div className="calendar-month__col" key={toDateKey(day)}>
              <DayCell
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
                sessionTypeLabels={sessionTypeLabels}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Time Grid (Week and Day views) ──────────────────────────────────────────

const START_HOUR = 0; // midnight — full 24-hour calendar
const END_HOUR = 24; // 12 AM (next day, exclusive)
const HOUR_HEIGHT = 60; // px per hour
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
  programDatesMap = new Map(), sessionTypeColors = {}, sessionTypeLabels,
}) => {
  const todayKey = toDateKey(new Date());

  return (
    <div className="calendar-timegrid overflow-hidden">
      {/* Day header row */}
      <div className="calendar-timegrid__head d-flex">
        {/* Empty corner above time axis */}
        <div className="calendar-timegrid__time-col flex-shrink-0" />
        {days.map((day) => {
          const isToday = toDateKey(day) === todayKey;
          const isWeekend = isWeekendDay(day);
          return (
            <div
              key={toDateKey(day)}
              className={classNames('calendar-timegrid__day text-center', `calendar-timegrid__day--${dayVariant(isToday, isWeekend)}`)}
            >
              {day.toLocaleDateString('en-US', { weekday: 'short' })} {day.getDate()}
              {(holidayMap.get(toDateKey(day)) || []).map((h) => (
                <div
                  key={h.id}
                  className="calendar-tag calendar-tag--holiday text-truncate"
                >
                  {h.name}
                </div>
              ))}
              {isLearner && leaveDateMap?.get(toDateKey(day)) && (
                <div
                  className="calendar-tag calendar-tag--leave text-truncate"
                >
                  On Leave
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scrollable body */}
      <div className="calendar-timegrid__body overflow-auto">
        <div className="calendar-timegrid__canvas d-flex" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT + 14 }}>

          {/* Time axis */}
          <div className="calendar-timegrid__time-col flex-shrink-0 position-relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="calendar-hour-label position-absolute user-select-none"
                style={{ top: (hour - START_HOUR) * HOUR_HEIGHT - 7 }}
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
                className={classNames('calendar-timegrid__col position-relative', `calendar-timegrid__col--${dayVariant(isToday, isWeekend)}`)}
              >
                {/* Hour grid lines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="calendar-hour-line position-absolute"
                    style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
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
                        className="calendar-event calendar-event--graded text-truncate position-absolute text-left"
                        style={{ top }}
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
                        className="calendar-event calendar-event--onleave position-absolute text-left overflow-hidden user-select-none"
                        style={{
                          top, left: `calc(${colLeftPct}% + 2px)`, width: `calc(${colWidthPct}% - 4px)`, height, fontSize: totalLanes >= 2 ? 10 : 11,
                        }}
                      >
                        <div className="calendar-event__row d-flex align-items-start">
                          <span className="calendar-dot calendar-dot--md calendar-dot--onleave rounded-circle flex-shrink-0" />
                          <strong
                            className="calendar-event__title calendar-strikethrough overflow-hidden"
                            style={{ maxHeight: `${Math.max(1, Math.min(3, Math.floor((height - 4) / 14))) * 1.25}em` }}
                          >
                            {session.title}
                          </strong>
                        </div>
                        {height >= 28 && totalLanes < 3 && (
                          <span className="calendar-event__time calendar-event__time--xs">On Leave</span>
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
                      sessionTypeLabels={sessionTypeLabels}
                    >
                      <button
                        type="button"
                        title={`${session.title} — ${startTime}`}
                        className="calendar-event calendar-event--session position-absolute border-0 text-left overflow-hidden"
                        style={{
                          top, left: `calc(${colLeftPct}% + 2px)`, width: `calc(${colWidthPct}% - 4px)`, height, background: bg, fontSize: totalLanes >= 2 ? 10 : 11,
                        }}
                      >
                        <div className="calendar-event__row d-flex align-items-start">
                          <span
                            className="calendar-dot calendar-dot--md rounded-circle flex-shrink-0"
                            style={{ background: statusDotColors[session.status] || '#e5e7eb' }}
                          />
                          <strong
                            className={classNames('calendar-event__title overflow-hidden', { 'calendar-strikethrough': isStrikethrough })}
                            style={{ maxHeight: `${Math.max(1, Math.min(3, Math.floor((height - 4) / 14))) * 1.25}em` }}
                          >
                            {session.title}
                          </strong>
                        </div>
                        {/* Time label — hidden in narrow (3+ lane) columns; popover has it */}
                        {height >= 30 && totalLanes < 3 && (
                          <span className="calendar-event__time">{startTime}</span>
                        )}
                        {/* Course name — only in full-width columns with enough height */}
                        {height >= 45 && totalLanes < 2 && session.course_name && (
                          <span
                            className="calendar-event__time text-truncate d-block"
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
  programDatesMap = new Map(), sessionTypeColors = {}, sessionTypeLabels,
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
    sessionTypeLabels={sessionTypeLabels}
  />
);

// ─── DayView ──────────────────────────────────────────────────────────────────

const DayView = ({
  currentDate, sessionMap, onEditSession, onDeleteSession, onCancelSession, onSessionDetail,
  openPopoverId, setOpenPopoverId, canManageSessions = false, isInstructor = false,
  isLearner = false, studentRequestMap, leaveDateMap = null, holidayMap = new Map(),
  programDatesMap = new Map(), sessionTypeColors = {}, sessionTypeLabels,
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
    sessionTypeLabels={sessionTypeLabels}
  />
);

// ─── CalendarView ─────────────────────────────────────────────────────────────

const CalendarView = ({
  sessions, view, currentDate, onViewChange, onNavigate, onGoToToday,
  onScheduleNew, onEditSession, onDeleteSession, onCancelSession, onSessionDetail,
  loading = false, canManageSessions = false, isInstructor = false,
  isLearner = false, studentRequestMap, leaveDateMap = null, holidays = [],
  programDates = [], sessionTypeColors = {}, sessionTypeLabels,
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
      <div className="d-flex align-items-center flex-wrap mb-3 calendar-toolbar">
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

        <span className="calendar-toolbar__label">
          {formatRangeLabel(view, currentDate)}
        </span>

        {/* View toggles + New session — pushed to the right */}
        <div className="ml-auto d-flex align-items-center calendar-toolbar__actions">
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
              <span className="calendar-toolbar__divider" />
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
      <div className={classNames('calendar-view', { 'calendar-view--loading': loading })}>
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
          sessionTypeLabels={sessionTypeLabels}
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
          sessionTypeLabels={sessionTypeLabels}
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
          sessionTypeLabels={sessionTypeLabels}
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
  my_join_url: PropTypes.string,
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
  sessionTypeLabels: PropTypes.objectOf(PropTypes.string),
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
  sessionTypeLabels: {},
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
  sessionTypeLabels: PropTypes.objectOf(PropTypes.string),
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
  sessionTypeLabels: {},
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
  sessionTypeLabels: PropTypes.objectOf(PropTypes.string),
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
  sessionTypeLabels: {},
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
  sessionTypeLabels: PropTypes.objectOf(PropTypes.string),
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
  sessionTypeLabels: {},
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
  sessionTypeLabels: PropTypes.objectOf(PropTypes.string),
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
  sessionTypeLabels: {},
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
  sessionTypeLabels: PropTypes.objectOf(PropTypes.string),
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
  sessionTypeLabels: {},
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
  sessionTypeLabels: PropTypes.objectOf(PropTypes.string),
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
  sessionTypeLabels: {},
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
  sessionTypeLabels: PropTypes.objectOf(PropTypes.string),
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
  sessionTypeLabels: {},
  holidays: [],
  programDates: [],
};

export default CalendarView;
