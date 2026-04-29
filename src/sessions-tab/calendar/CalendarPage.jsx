import React, {
  useState, useEffect, useMemo, useCallback,
} from 'react';
import {
  Container, Spinner, Alert, Toast, StandardModal, Button,
} from '@openedx/paragon';
import {
  getCalendarSessions, deleteSession, cancelSession, getMySessionRequests,
} from '../api';
import { extractApiError } from '../utils';
import { USER_ROLE } from '../constants';
import ScheduleMeetingModal from '../ScheduleMeetingModal';
import SessionRequestModal from '../SessionRequestModal';
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

const CalendarPage = () => {
  const [sessions, setSessions] = useState([]);
  const [userRole, setUserRole] = useState(USER_ROLE.LEARNER);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canManageSessions = userRole === USER_ROLE.ADMIN;
  const isLearner = userRole === USER_ROLE.LEARNER;
  const [refreshKey, setRefreshKey] = useState(0);

  // Learner-only: map of sessionId → SessionRequest for the visible window.
  // Drives "Request"/"Pending"/"Approved" state inside session popovers.
  const [myRequests, setMyRequests] = useState(() => new Map());
  const [requestModalSession, setRequestModalSession] = useState(null);

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
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const { start, end } = useMemo(
    () => computeFetchWindow(view, currentDate),
    [view, currentDate],
  );

  // Re-fetch whenever the visible window changes or a mutation triggers a refresh.
  // The backend requires start_date + end_date and enforces a 45-day max window.
  useEffect(() => {
    let cancelled = false;
    const fetchSessions = async () => {
      setLoading(true);
      try {
        const { sessions: data, userRole: role } = await getCalendarSessions(start.toISOString(), end.toISOString());
        if (cancelled) { return; }
        setSessions(data);
        const resolvedRole = role || USER_ROLE.LEARNER;
        setUserRole(resolvedRole);
        setError('');

        // Hydrate learner's request state for the visible window so popovers
        // render the correct CTA (Request / Pending / Approved + Join).
        if (resolvedRole === USER_ROLE.LEARNER) {
          const requests = await getMySessionRequests({
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            // Pull the full window in one shot — backend now paginates /me/
            // (default 50). The calendar wants every visible request to render
            // its session badge correctly. 200 is the backend max_page_size.
            pageSize: 200,
          });
          if (cancelled) { return; }
          const list = Array.isArray(requests) ? requests : requests.results || [];
          setMyRequests(new Map(list.map((r) => [r.session, r])));
        } else {
          setMyRequests(new Map());
        }
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
  }, [start, end, refreshKey]);

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
      await deleteSession(sessionToDelete.course_id, sessionToDelete.id);
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
      await cancelSession(sessionToCancel.course_id, sessionToCancel.id);
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

  // Learner request flow — open modal from a session chip / popover.
  const handleRequestSession = useCallback((session) => {
    setRequestModalSession(session);
  }, []);

  const handleRequestSuccess = (created) => {
    // Optimistically merge the new request so the popover flips to "Pending"
    // without waiting for a full calendar refetch.
    setMyRequests((prev) => {
      const next = new Map(prev);
      next.set(created.session, created);
      return next;
    });
    showSuccess('Request submitted.');
  };

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
          isLearner={isLearner}
          studentRequestMap={myRequests}
          onRequestSession={handleRequestSession}
        />
      </Container>
    );
  };

  return (
    <>
      <main id="main-content" className="d-flex flex-column flex-grow-1">
        {renderContent()}
      </main>

      {/* Create / Edit modal — only for admins */}
      {canManageSessions && (
        <ScheduleMeetingModal
          isOpen={modalSession !== undefined}
          onClose={() => setModalSession(undefined)}
          courseId={modalSession?.course_id || ''}
          session={modalSession}
          onSuccess={handleSessionSuccess}
        />
      )}

      {/* Learner request submission */}
      {isLearner && (
        <SessionRequestModal
          isOpen={Boolean(requestModalSession)}
          onClose={() => setRequestModalSession(null)}
          session={requestModalSession}
          sessionHasZoom={!!(requestModalSession?.meeting_join_url)}
          onSuccess={handleRequestSuccess}
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
