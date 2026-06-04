import React, {
  useState, useEffect, useMemo, useCallback,
} from 'react';
import { useParams } from 'react-router-dom';
import {
  Container, Spinner, Alert, Toast, StandardModal, Button,
} from '@openedx/paragon';
import {
  getCalendarSessions, deleteSession, cancelSession, getProgramDates,
} from './api';
import { getHolidays } from '../holidays/api';
import { getApprovedLeaves } from '../requests/api';
import { extractApiError } from '../shared/utils';
import { USER_ROLE, REQUEST_TYPE } from '../shared/constants';
import { useConfig } from '../app/useConfig';
import ScheduleMeetingModal from './ScheduleMeetingModal';
import CalendarView, { getMonthGridDays, getWeekDays } from './CalendarView';
import SessionDetailModal from './SessionDetailModal';

const VIEWS = { MONTH: 'month', WEEK: 'week', DAY: 'day' };

/**
 * Compute the [start, end) date window the calendar currently shows.
 * Month → full 6-week grid (Sunday before the 1st → Saturday after the last day)
 * Week  → Sunday → following Sunday
 * Day   → start of day → start of next day
 */
const computeFetchWindow = (view, currentDate) => {
  if (view === VIEWS.MONTH) {
    const days = getMonthGridDays(currentDate);
    const start = new Date(days[0]);
    start.setHours(0, 0, 0, 0);
    const end = new Date(days[days.length - 1]);
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  }
  if (view === VIEWS.WEEK) {
    const days = getWeekDays(currentDate);
    const start = new Date(days[0]);
    start.setHours(0, 0, 0, 0);
    const end = new Date(days[6]);
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  }
  // Day view
  const start = new Date(currentDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const TYPE_COLOR_PALETTE = [
  '#1565c0', // blue
  '#be185d', // rose
  '#c2410c', // orange
  '#0e7490', // cyan
  '#0f766e', // teal
  '#7e22ce', // purple
  '#92400e', // amber-dark
  '#1e3a5f', // navy
];

const CalendarPage = () => {
  const { programId } = useParams();
  const { data: config } = useConfig();
  const userRole = config?.user_role ?? USER_ROLE.LEARNER;
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canManageSessions = userRole === USER_ROLE.ADMIN;
  const isInstructor = userRole === USER_ROLE.INSTRUCTOR;
  const isLearner = userRole === USER_ROLE.LEARNER;
  const [refreshKey, setRefreshKey] = useState(0);

  const sessionTypeColors = useMemo(() => {
    const types = config?.session_types || [];
    const map = {};
    types.forEach((t, i) => {
      map[t.value] = TYPE_COLOR_PALETTE[i % TYPE_COLOR_PALETTE.length];
    });
    return map;
  }, [config]);

  // Calendar navigation state — lifted here because it drives the fetch window.
  const [view, setView] = useState(VIEWS.MONTH);
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // modalSession: undefined = closed | null = create | Session object = edit
  const [modalSession, setModalSession] = useState(undefined);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [sessionToCancel, setSessionToCancel] = useState(null);
  const [cancelError, setCancelError] = useState('');
  const [sessionToView, setSessionToView] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [programDates, setProgramDates] = useState([]);
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const { start, end } = useMemo(
    () => computeFetchWindow(view, currentDate),
    [view, currentDate],
  );

  // Fetch all holidays once on mount (page_size=100 covers any realistic dataset).
  useEffect(() => {
    getHolidays({ pageSize: 100 }).then(({ results }) => setHolidays(results)).catch(() => {});
  }, []);

  // Fetch program dates (graded due dates) once per program — not windowed.
  useEffect(() => {
    if (!programId) { return; }
    getProgramDates(programId).then(setProgramDates).catch(() => {});
  }, [programId]);

  // Fetch approved leaves for learners — re-fetch on every session refresh so
  // a rejection made by the admin clears the grey overlay without a page reload.
  useEffect(() => {
    if (!isLearner || !programId) { return; }
    getApprovedLeaves({ program_key: programId }).then(setApprovedLeaves).catch(() => {});
  }, [isLearner, programId, refreshKey]);

  // Re-fetch whenever the visible window changes or a mutation triggers a refresh.
  // The backend requires start_date + end_date and enforces a 45-day max window.
  useEffect(() => {
    let cancelled = false;
    const fetchSessions = async () => {
      setLoading(true);
      try {
        const toDateStr = (d) => d.toISOString().slice(0, 10);
        const { sessions: data } = await getCalendarSessions(toDateStr(start), toDateStr(end), programId);
        if (cancelled) { return; }
        setSessions(data);
        setError('');
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load sessions. Please try again later.');
        }
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    };
    fetchSessions();
    return () => { cancelled = true; };
  }, [start, end, refreshKey, programId]);

  // Build sessionId → leaveRequest map from the learner's approved leaves.
  // Session-specific leaves: map each linked session directly.
  // Full-day leaves (leave_start_date/leave_end_date set, no sessions): cross-check
  // each loaded calendar session's date against the leave date range.
  const studentRequestMap = useMemo(() => {
    const map = new Map();
    approvedLeaves.forEach((leave) => {
      if (leave.state && leave.state !== 'APPROVED') { return; }
      if (leave.sessions && leave.sessions.length > 0) {
        leave.sessions.forEach((s) => { map.set(s.id, leave); });
      } else if (leave.leave_start_date && leave.leave_end_date) {
        const leaveStart = new Date(`${leave.leave_start_date}T00:00:00`);
        const leaveEnd = new Date(`${leave.leave_end_date}T23:59:59`);
        sessions.forEach((s) => {
          if (!s.scheduled_start_time) { return; }
          const sessionDate = new Date(s.scheduled_start_time);
          if (sessionDate >= leaveStart && sessionDate <= leaveEnd) {
            map.set(s.id, leave);
          }
        });
      }
    });
    // Supplement with session.my_request — covers session-specific leaves where
    // the leave list serializer may not return nested session objects.
    // Only leave requests belong in this map; remote session requests must not
    // trigger the grey/strikethrough overlay.
    sessions.forEach((s) => {
      if (
        !map.has(s.id)
        && s.my_request?.state === 'APPROVED'
        && s.my_request?.type === REQUEST_TYPE.LEAVE
      ) {
        map.set(s.id, s.my_request);
      }
    });
    return map;
  }, [approvedLeaves, sessions]);

  // Full-day leave banner map: date string (YYYY-MM-DD) → leave request.
  // Used by CalendarView to show a non-clickable "On Leave" day banner.
  const leaveDateMap = useMemo(() => {
    const map = new Map();
    approvedLeaves.forEach((leave) => {
      if (leave.state && leave.state !== 'APPROVED') { return; }
      if (!leave.leave_start_date || !leave.leave_end_date) { return; }
      const cur = new Date(`${leave.leave_start_date}T12:00:00`);
      const last = new Date(`${leave.leave_end_date}T12:00:00`);
      while (cur <= last) {
        map.set(cur.toISOString().slice(0, 10), leave);
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [approvedLeaves]);

  const showSuccess = (message) => {
    setToastMessage(message);
    setShowToast(true);
  };

  const handleScheduleNew = () => setModalSession(null);
  const handleEditSession = (session) => setModalSession(session);
  const handleDeleteSession = (session) => {
    setDeleteError('');
    setSessionToDelete(session);
  };

  const handleSessionSuccess = () => {
    const wasEdit = Boolean(modalSession);
    setModalSession(undefined);
    setRefreshKey((prev) => prev + 1);
    showSuccess(wasEdit ? 'Session updated successfully!' : 'Session created successfully!');
  };

  const handleDeleteConfirm = async () => {
    if (!sessionToDelete) { return; }
    try {
      await deleteSession(sessionToDelete.id);
      setSessionToDelete(null);
      setRefreshKey((prev) => prev + 1);
      showSuccess('Session deleted successfully!');
    } catch (err) {
      setDeleteError(extractApiError(err, 'Failed to delete session'));
    }
  };

  const handleDeleteCancel = () => {
    setSessionToDelete(null);
    setDeleteError('');
  };

  const handleCancelSession = (session) => {
    setCancelError('');
    setSessionToCancel(session);
  };

  const handleCancelConfirm = async () => {
    if (!sessionToCancel) { return; }
    try {
      await cancelSession(sessionToCancel.id);
      setSessionToCancel(null);
      setRefreshKey((prev) => prev + 1);
      showSuccess('Session cancelled.');
    } catch (err) {
      setCancelError(extractApiError(err, 'Failed to cancel session'));
    }
  };

  const handleCancelDismiss = () => {
    setSessionToCancel(null);
    setCancelError('');
  };

  const handleViewSession = (session) => {
    setSessionToView(session);
  };

  // ── Calendar navigation handlers passed down to CalendarView ──
  const handleNavigate = useCallback((direction) => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (view === VIEWS.MONTH) {
        d.setMonth(d.getMonth() + direction);
      } else if (view === VIEWS.WEEK) {
        d.setDate(d.getDate() + direction * 7);
      } else {
        d.setDate(d.getDate() + direction);
      }
      return d;
    });
  }, [view]);

  const handleGoToToday = useCallback(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setCurrentDate(d);
  }, []);

  const handleViewChange = useCallback((nextView) => {
    setView(nextView);
  }, []);

  const renderContent = () => {
    // Initial load — show full-page spinner. Subsequent navigations use the
    // inline loading opacity inside CalendarView instead so the grid stays visible.
    if (loading && sessions.length === 0 && !error) {
      return (
        <Container className="py-5 text-center">
          <Spinner animation="border" />
          <p className="mt-2">Loading your sessions...</p>
        </Container>
      );
    }

    if (error) {
      return (
        <Container className="py-5">
          <Alert variant="danger">{error}</Alert>
        </Container>
      );
    }

    return (
      <Container className="py-4">
        <CalendarView
          sessions={sessions}
          view={view}
          currentDate={currentDate}
          onViewChange={handleViewChange}
          onNavigate={handleNavigate}
          onGoToToday={handleGoToToday}
          onScheduleNew={handleScheduleNew}
          onEditSession={handleEditSession}
          onDeleteSession={handleDeleteSession}
          onCancelSession={handleCancelSession}
          onSessionDetail={handleViewSession}
          loading={loading}
          canManageSessions={canManageSessions}
          isInstructor={isInstructor}
          isLearner={isLearner}
          studentRequestMap={studentRequestMap}
          leaveDateMap={leaveDateMap}
          holidays={holidays}
          programDates={programDates}
          sessionTypeColors={sessionTypeColors}
        />
      </Container>
    );
  };

  return (
    <>
      <main id="main-content" className="d-flex flex-column flex-grow-1">
        {renderContent()}
      </main>

      {/* Schedule modal: admins get full edit; instructors get description-only edit */}
      {(canManageSessions || isInstructor) && modalSession !== undefined && (
        <ScheduleMeetingModal
          isOpen
          onClose={() => setModalSession(undefined)}
          programKey={programId || ''}
          session={modalSession}
          onSuccess={handleSessionSuccess}
          holidays={holidays}
          descriptionOnly={isInstructor && !canManageSessions}
        />
      )}

      {/* Delete confirmation — only for admins */}
      {canManageSessions && sessionToDelete && (
        <StandardModal
          isOpen
          onClose={handleDeleteCancel}
          title="Delete Session"
          footerNode={(
            <>
              <Button variant="tertiary" onClick={handleDeleteCancel}>Cancel</Button>
              <Button variant="danger" onClick={handleDeleteConfirm} className="ml-2">
                Delete
              </Button>
            </>
          )}
        >
          {deleteError && <Alert variant="danger" className="mb-3">{deleteError}</Alert>}
          <p>
            Are you sure you want to delete the session <strong>{sessionToDelete.title}</strong>?
            This action cannot be undone.
          </p>
        </StandardModal>
      )}

      {/* Cancel confirmation — only for admins. Soft-cancel preserves the row +
          Zoom; can be re-scheduled via PATCH status:scheduled if needed. */}
      {canManageSessions && sessionToCancel && (
        <StandardModal
          isOpen
          onClose={handleCancelDismiss}
          title="Cancel Session"
          footerNode={(
            <>
              <Button variant="tertiary" onClick={handleCancelDismiss}>Keep scheduled</Button>
              <Button variant="warning" onClick={handleCancelConfirm} className="ml-2">
                Cancel session
              </Button>
            </>
          )}
        >
          {cancelError && <Alert variant="danger" className="mb-3">{cancelError}</Alert>}
          <p>
            Cancel <strong>{sessionToCancel.title}</strong>? Enrolled learners will see
            the session as Cancelled. The Zoom meeting (if any) is kept so you can
            reschedule.
          </p>
        </StandardModal>
      )}

      {/* Session detail — open from popover/day-popover title click. Read-only,
          available to admins and learners alike. */}
      <SessionDetailModal
        session={sessionToView}
        isOpen={Boolean(sessionToView)}
        onClose={() => setSessionToView(null)}
      />

      {/* Toast — persists across view transitions */}
      <div
        style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999,
        }}
        aria-live="polite"
        aria-atomic="true"
      >
        <Toast show={showToast} onClose={() => setShowToast(false)} delay={4000} autohide>
          {toastMessage}
        </Toast>
      </div>
    </>
  );
};

export default CalendarPage;
