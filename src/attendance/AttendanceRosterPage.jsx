import React, {
  useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  Alert, Badge, Button, Container, DataTable, Form, Spinner, Toast,
} from '@openedx/paragon';
import { ArrowBack, Save } from '@openedx/paragon/icons';

import {
  getEnrolledLearners,
  getSession,
  markAttendance,
  getAttendanceRecords,
} from './api';
import { extractApiError, formatDateTime, getStatusVariant } from '../shared/utils';

// Must match the backend AttendanceSettings.marking_window_days default.
// This is used only for UX hints — the backend enforces the real value.
const MARKING_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MARKING_WINDOW_MS = MARKING_WINDOW_DAYS * MS_PER_DAY;

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
];

const DEFAULT_STATUS = 'present';
const PAGE_SIZE = 25;

// Milliseconds remaining in the marking window. Negative when the window has
// already closed. Returns null when the session has no end time yet.
const msUntilWindowClose = (endTimeStr) => {
  if (!endTimeStr) { return null; }
  const endMs = new Date(endTimeStr).getTime();
  if (Number.isNaN(endMs)) { return null; }
  return (endMs + MARKING_WINDOW_MS) - Date.now();
};

const NameCell = ({ value }) => value || '—';
NameCell.propTypes = { value: PropTypes.string };
NameCell.defaultProps = { value: '' };

const EmailCell = ({ value }) => <span className="text-muted">{value || '—'}</span>;
EmailCell.propTypes = { value: PropTypes.string };
EmailCell.defaultProps = { value: '' };

// Mode-aware status cell. When read-only it renders a status badge; when
// editable it renders radio buttons. Extracted to module scope so React does
// not treat it as a new component on every render.
const StatusCell = ({ row }) => {
  const {
    isReadOnly, currentStatus, onStatusChange, user_id: userId,
  } = row.original;

  if (isReadOnly) {
    const label = STATUS_OPTIONS.find((o) => o.value === currentStatus)?.label ?? currentStatus ?? '—';
    return currentStatus
      ? <Badge variant={getStatusVariant(currentStatus)}>{label}</Badge>
      : <span className="text-muted">—</span>;
  }

  return (
    <div className="d-flex" style={{ gap: 12 }}>
      {STATUS_OPTIONS.map((opt) => (
        <Form.Check
          key={opt.value}
          type="radio"
          name={`status-${userId}`}
          id={`status-${userId}-${opt.value}`}
          label={opt.label}
          checked={currentStatus === opt.value}
          onChange={() => onStatusChange(opt.value)}
        />
      ))}
    </div>
  );
};
StatusCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      user_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      currentStatus: PropTypes.string,
      isReadOnly: PropTypes.bool.isRequired,
      onStatusChange: PropTypes.func.isRequired,
    }).isRequired,
  }).isRequired,
};

const COLUMNS = [
  { Header: 'Name', accessor: 'full_name', Cell: NameCell },
  { Header: 'Email', accessor: 'email', Cell: EmailCell },
  { Header: 'Status', id: 'status', Cell: StatusCell },
];

const AttendanceRosterPage = () => {
  const { programId, sessionId } = useParams();
  const location = useLocation();
  // Nav state gives an instant first render; the API fetch below is the source of truth.
  const navSession = location.state?.session || null;

  const [sessionData, setSessionData] = useState(navSession);
  // Initialise optimistically from nav state; overwritten once the API responds.
  const [isLocked, setIsLocked] = useState(navSession?.attendance_marked ?? false);
  // Set true if a save is rejected with `marking_window_closed`, so the page
  // can re-render read-only without a manual refresh.
  const [windowClosedByServer, setWindowClosedByServer] = useState(false);

  const msRemaining = msUntilWindowClose(sessionData?.scheduled_end_time);
  const isExpired = windowClosedByServer || (msRemaining !== null && msRemaining <= 0);
  const daysRemaining = (msRemaining !== null && msRemaining > 0)
    ? Math.ceil(msRemaining / MS_PER_DAY)
    : 0;

  const [learners, setLearners] = useState([]);
  const [statusByUserId, setStatusByUserId] = useState(() => new Map());
  const [hasRecords, setHasRecords] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rosterData, recordsData, freshSession] = await Promise.all([
          getEnrolledLearners(sessionId),
          getAttendanceRecords({ session_id: sessionId, page_size: 500 }),
          getSession(sessionId),
        ]);
        if (cancelled) { return; }
        const roster = rosterData.results ?? [];
        const existing = recordsData.results ?? [];
        const lockedAtLoad = freshSession.attendance_marked ?? false;
        const remaining = msUntilWindowClose(freshSession.scheduled_end_time);
        const expiredAtLoad = remaining !== null && remaining <= 0;
        const readOnlyAtLoad = lockedAtLoad || expiredAtLoad;

        const rosterIds = new Set(roster.map((r) => r.user_id));
        const seeded = new Map();
        existing.forEach((rec) => {
          if (!rosterIds.has(rec.user_id)) { return; }
          seeded.set(rec.user_id, STATUS_OPTIONS.some((s) => s.value === rec.status)
            ? rec.status
            : DEFAULT_STATUS);
        });
        // Only seed default-Present rows for editable mode. In read-only mode
        // unseeded rows render "—" rather than a fabricated "Present" badge.
        if (!readOnlyAtLoad) {
          roster.forEach((row) => {
            if (!seeded.has(row.user_id)) { seeded.set(row.user_id, DEFAULT_STATUS); }
          });
        }
        setLearners(roster);
        setStatusByUserId(seeded);
        setHasRecords(existing.length > 0);
        setSessionData(freshSession);
        setIsLocked(lockedAtLoad);
      } catch (err) {
        if (!cancelled) { setError(extractApiError(err, 'Failed to load roster')); }
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const setStatusFor = (userId, value) => {
    setStatusByUserId((prev) => {
      const next = new Map(prev);
      next.set(userId, value);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const records = Array.from(statusByUserId.entries()).map(([userId, recStatus]) => ({
        user_id: userId,
        status: recStatus,
      }));
      await markAttendance(sessionId, records);
      setIsLocked(true);
      setHasRecords(true);
      setShowToast(true);
    } catch (err) {
      // Race: window closed between page load and Save. Flip to read-only so
      // the user does not stare at the same Save button after rejection.
      if (err.response?.data?.error === 'marking_window_closed') {
        setWindowClosedByServer(true);
      }
      setError(extractApiError(err, 'Failed to save attendance'));
    } finally {
      setSaving(false);
    }
  };

  const counts = useMemo(() => {
    const out = { present: 0, absent: 0, late: 0 };
    statusByUserId.forEach((value) => {
      if (out[value] !== undefined) { out[value] += 1; }
    });
    return out;
  }, [statusByUserId]);

  const currentlyReadOnly = isLocked || isExpired;

  const tableData = useMemo(() => (
    learners.map((l) => {
      const stored = statusByUserId.get(l.user_id);
      return {
        ...l,
        // Read-only with no real record: undefined so StatusCell shows "—"
        // instead of a fabricated "Present" badge.
        currentStatus: stored ?? (currentlyReadOnly ? undefined : DEFAULT_STATUS),
        isReadOnly: currentlyReadOnly,
        onStatusChange: (value) => setStatusFor(l.user_id, value),
      };
    })
  ), [learners, statusByUserId, currentlyReadOnly]);

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Loading roster…</p>
      </Container>
    );
  }

  return (
    <Container className="py-3">
      <Button
        as={Link}
        to={`/${programId}/attendance/sessions`}
        variant="tertiary"
        size="sm"
        iconBefore={ArrowBack}
        className="mb-3"
      >
        Back to sessions
      </Button>

      {/* Session context card */}
      <div className="border rounded p-3 mb-4 bg-light">
        <div className="d-flex flex-column flex-sm-row align-items-sm-start justify-content-between">
          <div>
            {sessionData?.course_name && (
              <div className="mb-1">
                <span
                  className="text-uppercase font-weight-bold text-muted mr-1"
                  style={{ fontSize: '0.7rem', letterSpacing: '0.06em' }}
                >
                  Course
                </span>
                <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                  {sessionData.course_name}
                </span>
              </div>
            )}
            {sessionData?.title && (
              <h4 className="mb-0">
                <span
                  className="text-uppercase font-weight-bold text-muted mr-2"
                  style={{ fontSize: '0.7rem', letterSpacing: '0.06em', verticalAlign: 'middle' }}
                >
                  Session
                </span>
                {sessionData.title}
              </h4>
            )}
            {sessionData?.scheduled_start_time && (
              <div className="text-muted mt-1" style={{ fontSize: '0.875rem' }}>
                {formatDateTime(sessionData.scheduled_start_time)}
              </div>
            )}
          </div>
          <div className="d-flex mt-2 mt-sm-0" style={{ gap: 6, flexShrink: 0 }}>
            <Badge variant="success">{counts.present} present</Badge>
            <Badge variant="danger">{counts.absent} absent</Badge>
            <Badge variant="warning">{counts.late} late</Badge>
          </div>
        </div>
      </div>

      {/* State-specific banners */}
      {isLocked && (
        <Alert variant="success" className="mb-3">
          Attendance has been recorded for this session and is now <strong>locked</strong>.
        </Alert>
      )}
      {!isLocked && isExpired && (
        <Alert variant="warning" className="mb-3">
          The {MARKING_WINDOW_DAYS}-day attendance marking window for this session has passed.
          {hasRecords
            ? ' Attendance can no longer be edited.'
            : ' No attendance was recorded for this session.'}
        </Alert>
      )}
      {!currentlyReadOnly && sessionData?.scheduled_end_time && (
        <Alert variant="info" className="mb-3">
          You have{' '}
          <strong>
            {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
          </strong>{' '}
          remaining to record attendance for this session.
        </Alert>
      )}

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {learners.length === 0 ? (
        <Alert variant="info">No learners are enrolled in this course.</Alert>
      ) : (
        <>
          <DataTable
            isPaginated={learners.length > PAGE_SIZE}
            data={tableData}
            columns={COLUMNS}
            itemCount={tableData.length}
            initialState={{ pageSize: PAGE_SIZE }}
          >
            <DataTable.Table />
            <DataTable.EmptyTable content="No learners" />
            {learners.length > PAGE_SIZE && <DataTable.TableFooter />}
          </DataTable>

          {!currentlyReadOnly && (
            <div className="mt-3">
              <div
                className="small mb-3 rounded px-3 py-2"
                style={{ backgroundColor: '#fff8e1', border: '1px solid #f5c518', color: '#7a5c00' }}
              >
                <span style={{ fontWeight: 600 }}>⚠ Warning:</span>{' '}
                Once you save, attendance records for this session will be{' '}
                <strong>locked</strong> and cannot be changed.
              </div>
              <Button
                variant="primary"
                iconBefore={Save}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save attendance'}
              </Button>
            </div>
          )}
        </>
      )}

      <div
        style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999,
        }}
        aria-live="polite"
      >
        <Toast
          show={showToast}
          onClose={() => setShowToast(false)}
          delay={3500}
          autohide
        >
          Attendance saved and locked.
        </Toast>
      </div>
    </Container>
  );
};

export default AttendanceRosterPage;
