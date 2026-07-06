import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  Link, useLocation, useParams, useSearchParams,
} from 'react-router-dom';
import {
  Alert, Badge, Button, Container, DataTable, Form, OverlayTrigger, Spinner,
  StandardModal, Toast, Tooltip,
} from '@openedx/paragon';
import { ArrowBack, Edit } from '@openedx/paragon/icons';

import {
  getAttendanceRoster,
  markAttendance,
} from './api';
import { useConfig } from '../app/useConfig';
import { ATTENDANCE_STATUS, USER_ROLE } from '../shared/constants';
import { extractApiError, formatDateTime, getStatusVariant } from '../shared/utils';

const PAGE_SIZE = 25;

const EDIT_OPTIONS = [
  { value: 'present', label: 'Present', variant: 'success' },
  { value: 'absent', label: 'Absent', variant: 'danger' },
];

// ─── Cell renderers ──────────────────────────────────────────────────────────

const LearnerCell = ({ row }) => (
  <div>
    <div className="font-weight-semibold">{row.original.full_name || row.original.username || '—'}</div>
    <small className="text-muted">{row.original.email}</small>
  </div>
);
LearnerCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      full_name: PropTypes.string,
      username: PropTypes.string,
      email: PropTypes.string,
    }),
  }).isRequired,
};

const StatusCell = ({ row }) => {
  const {
    canEdit, currentStatus, onStatusChange, user_id: userId, isSaving,
  } = row.original;

  if (!canEdit) {
    const label = ATTENDANCE_STATUS[currentStatus] || currentStatus || '—';
    return currentStatus
      ? <Badge variant={getStatusVariant(currentStatus)}>{label}</Badge>
      : <span className="text-muted">—</span>;
  }

  return (
    <div className="d-flex justify-content-center" style={{ gap: 4 }}>
      {EDIT_OPTIONS.map((opt) => {
        const isSelected = currentStatus === opt.value;
        return (
          <Button
            key={opt.value}
            size="sm"
            variant={isSelected ? opt.variant : 'outline-secondary'}
            onClick={() => !isSelected && !isSaving && onStatusChange(userId, opt.value)}
            disabled={isSaving}
            style={{ minWidth: 76, borderRadius: 20 }}
          >
            {opt.label}
          </Button>
        );
      })}
    </div>
  );
};
StatusCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      user_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      currentStatus: PropTypes.string,
      canEdit: PropTypes.bool.isRequired,
      isSaving: PropTypes.bool,
      onStatusChange: PropTypes.func.isRequired,
    }).isRequired,
  }).isRequired,
};

const ReasonCell = ({ row }) => {
  const { pendingReason } = row.original;
  if (!pendingReason) { return <span className="text-muted">—</span>; }
  return <small className="text-muted font-italic">{pendingReason}</small>;
};
ReasonCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({ pendingReason: PropTypes.string }),
  }).isRequired,
};

const SourceCell = ({ row }) => {
  const { source } = row.original;
  return source
    ? <Badge variant="light">{source}</Badge>
    : <span className="text-muted">—</span>;
};
SourceCell.propTypes = {
  row: PropTypes.shape({ original: PropTypes.shape({ source: PropTypes.string }) }).isRequired,
};

const MarkedByCell = ({ row }) => (
  <small className="text-muted">{row.original.overridden_by_email || '—'}</small>
);
MarkedByCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({ overridden_by_email: PropTypes.string }),
  }).isRequired,
};

const NoteCell = ({ row }) => {
  const {
    record_id: recordId, onNoteClick, user_id: userId, currentStatus, notes,
  } = row.original;
  const hasNote = notes != null && notes !== '';
  if (!recordId) {
    return (
      <OverlayTrigger
        trigger={['hover', 'focus']}
        overlay={<Tooltip id={`note-tip-${userId}`}>Mark attendance before adding a note</Tooltip>}
      >
        <span><Button variant="outline-primary" size="sm" disabled>Add note</Button></span>
      </OverlayTrigger>
    );
  }
  if (!hasNote) {
    return (
      <Button
        variant="outline-primary"
        size="sm"
        onClick={() => onNoteClick(recordId, userId, currentStatus, '')}
      >
        Add note
      </Button>
    );
  }
  return (
    <div className="d-flex align-items-center" style={{ gap: 6 }}>
      <small className="text-muted">{notes}</small>
      <Button
        variant="tertiary"
        size="sm"
        iconBefore={Edit}
        aria-label="Edit note"
        onClick={() => onNoteClick(recordId, userId, currentStatus, notes)}
      />
    </div>
  );
};
NoteCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      record_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      user_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      currentStatus: PropTypes.string,
      notes: PropTypes.string,
      onNoteClick: PropTypes.func.isRequired,
    }).isRequired,
  }).isRequired,
};

// ─── Main component ──────────────────────────────────────────────────────────

const AttendanceRosterPage = () => {
  const { programId, sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('course_id') || '';
  const { state: navState } = useLocation();
  const { data: config } = useConfig();
  const isAdmin = config?.user_role === USER_ROLE.ADMIN;

  const [roster, setRoster] = useState([]);
  const [sessionMeta, setSessionMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // { [userId]: { status, originalStatus, recordId, reason? } }
  const [overrides, setOverrides] = useState({});
  const [savingUserId, setSavingUserId] = useState(null);
  const [showToast, setShowToast] = useState(false);

  const [reasonModal, setReasonModal] = useState(null); // { userId, pendingStatus }
  const [reasonText, setReasonText] = useState('');

  const [noteModal, setNoteModal] = useState(null); // { recordId, userId, currentStatus, initialNotes }
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState('');

  const loadRoster = useCallback(async () => {
    const data = await getAttendanceRoster(sessionId);
    const rows = Array.isArray(data) ? data : data.results ?? [];
    const meta = {
      ...(data.session ?? {}),
      title: navState?.sessionTitle ?? null,
      scheduled_start_time: navState?.sessionTime ?? null,
      course_name: navState?.courseName ?? null,
    };
    setRoster(rows);
    setSessionMeta(meta);
    const seed = {};
    rows.forEach((row) => {
      seed[row.user_id] = {
        status: row.status || 'pending',
        originalStatus: row.status || 'pending',
        recordId: row.record_id ?? null,
      };
    });
    setOverrides(seed);
  }, [sessionId, navState]);

  useEffect(() => {
    let cancelled = false;
    loadRoster()
      .catch((err) => { setError(extractApiError(err, 'Failed to load roster')); })
      .finally(() => { if (!cancelled) { setLoading(false); } });
    return () => { cancelled = true; };
  }, [loadRoster]);

  const windowOpen = sessionMeta?.marking_window_open ?? false;

  // Remaining days: prefer nav state (set by PerCourseView), else compute from
  // scheduled_end_time (in roster response) + config marking_window_days.
  const markingWindowRemainingDays = useMemo(() => {
    if (navState?.markingWindowRemainingDays != null) {
      return navState.markingWindowRemainingDays;
    }
    if (!windowOpen) { return 0; }
    const ref = sessionMeta?.scheduled_end_time;
    const windowDays = config?.marking_window_days;
    if (!ref || windowDays == null) { return null; }
    const deadline = new Date(ref).getTime() + windowDays * 86400000;
    const remaining = Math.ceil((deadline - Date.now()) / 86400000);
    return remaining > 0 ? remaining : 0;
  }, [navState, windowOpen, sessionMeta, config]);

  const saveStatusChange = useCallback(async (userId, newStatus, reason) => {
    setSavingUserId(String(userId));
    setError('');
    setOverrides((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], status: newStatus, ...(reason ? { reason } : {}) },
    }));
    try {
      const record = { user_id: Number(userId), status: newStatus };
      if (reason) { record.reason = reason; }
      await markAttendance(sessionId, [record]);
      await loadRoster();
      setShowToast(true);
    } catch (err) {
      setError(extractApiError(err, 'Failed to save attendance'));
      setOverrides((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], status: prev[userId].originalStatus },
      }));
    } finally {
      setSavingUserId(null);
    }
  }, [sessionId, loadRoster]);

  const handleStatusChange = (userId, newStatus) => {
    const current = overrides[userId];
    if (!current) { return; }
    if (current.recordId !== null) {
      setReasonText('');
      setReasonModal({ userId, pendingStatus: newStatus });
    } else {
      saveStatusChange(userId, newStatus, null);
    }
  };

  const confirmReasonModal = () => {
    if (!reasonModal) { return; }
    const { userId, pendingStatus } = reasonModal;
    const reason = reasonText.trim();
    setReasonModal(null);
    setReasonText('');
    saveStatusChange(userId, pendingStatus, reason);
  };

  const openNoteModal = (recordId, userId, currentStatus, existingNotes) => {
    setNoteModal({
      recordId, userId, currentStatus, initialNotes: existingNotes,
    });
    setNoteText(existingNotes);
    setNoteError('');
  };

  const handleNoteSave = async () => {
    setNoteSaving(true);
    setNoteError('');
    try {
      await markAttendance(sessionId, [{
        user_id: Number(noteModal.userId),
        status: noteModal.currentStatus,
        notes: noteText,
      }]);
      setRoster((prev) => prev.map((r) => (
        String(r.user_id) === String(noteModal.userId)
          ? { ...r, notes: noteText }
          : r
      )));
      setNoteModal(null);
      setNoteText('');
      setShowToast(true);
    } catch (err) {
      setNoteError(extractApiError(err, 'Failed to save note'));
    } finally {
      setNoteSaving(false);
    }
  };

  const counts = useMemo(() => {
    const out = {
      present: 0, absent: 0, leave: 0, pending: 0,
    };
    Object.values(overrides).forEach(({ status }) => {
      if (out[status] !== undefined) { out[status] += 1; }
    });
    return out;
  }, [overrides]);

  const tableData = useMemo(() => (
    roster.map((row) => {
      const override = overrides[row.user_id] ?? {};
      const currentStatus = override.status ?? row.status ?? 'pending';
      const canEdit = isAdmin && windowOpen && currentStatus !== 'leave';
      return {
        ...row,
        currentStatus,
        canEdit,
        isSaving: savingUserId === String(row.user_id),
        pendingReason: override.reason ?? row.override_reason ?? null,
        onStatusChange: handleStatusChange,
        onNoteClick: openNoteModal,
      };
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [roster, overrides, isAdmin, windowOpen, savingUserId]);

  const columns = useMemo(() => {
    const cx = { cellClassName: 'text-center', headerClassName: 'justify-content-center' };
    const cols = [
      { Header: 'Learner', accessor: 'full_name', Cell: LearnerCell },
      {
        Header: 'Status', id: 'status', Cell: StatusCell, ...cx,
      },
      {
        Header: 'Change reason', id: 'reason', Cell: ReasonCell, ...cx,
      },
      {
        Header: 'Changed by', id: 'marked_by', Cell: MarkedByCell, ...cx,
      },
      {
        Header: 'Source', id: 'source', Cell: SourceCell, ...cx,
      },
    ];
    if (isAdmin) {
      cols.push({
        Header: 'Note', id: 'note', Cell: NoteCell, ...cx,
      });
    }
    return cols;
  }, [isAdmin]);

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
        to={`/${programId}/attendance/by-course${courseId ? `?course_id=${encodeURIComponent(courseId)}` : ''}`}
        variant="tertiary"
        size="sm"
        iconBefore={ArrowBack}
        className="mb-3"
      >
        Back to sessions
      </Button>

      {/* Session context card */}
      <div className="border rounded p-3 mb-4 bg-light">
        {sessionMeta?.course_name && (
          <div className="mb-1">
            <span
              className="text-uppercase font-weight-bold text-muted mr-1"
              style={{ fontSize: '0.7rem', letterSpacing: '0.06em' }}
            >
              Course
            </span>
            <span className="text-muted" style={{ fontSize: '0.875rem' }}>
              {sessionMeta.course_name}
            </span>
          </div>
        )}
        {sessionMeta?.title && (
          <h4 className="mb-0">
            <span
              className="text-uppercase font-weight-bold text-muted mr-2"
              style={{ fontSize: '0.7rem', letterSpacing: '0.06em', verticalAlign: 'middle' }}
            >
              Session
            </span>
            {sessionMeta.title}
          </h4>
        )}
        {sessionMeta?.scheduled_start_time && (
          <div className="text-muted mt-1" style={{ fontSize: '0.875rem' }}>
            {formatDateTime(sessionMeta.scheduled_start_time)}
          </div>
        )}
        <div className="d-flex justify-content-between align-items-center mt-2">
          <div>
            {windowOpen ? (
              <strong style={{ fontSize: '0.875rem', color: '#16a34a' }}>
                Marking window open
                {markingWindowRemainingDays != null && (
                  <> · {markingWindowRemainingDays} {markingWindowRemainingDays === 1 ? 'day' : 'days'} remaining</>
                )}
              </strong>
            ) : (
              <strong style={{ fontSize: '0.875rem', color: '#6c757d' }}>Marking window closed</strong>
            )}
          </div>
          <div className="d-flex" style={{ gap: 6 }}>
            <Badge variant="success">{counts.present} present</Badge>
            <Badge variant="danger">{counts.absent} absent</Badge>
            <Badge variant="warning">{counts.leave} on leave</Badge>
            <Badge variant="secondary">{counts.pending} pending</Badge>
          </div>
        </div>
      </div>

      {isAdmin && !windowOpen && (
        <Alert variant="warning" className="mb-3">
          The attendance marking window for this session is <strong>closed</strong>.
          Records are read-only.
        </Alert>
      )}
      {isAdmin && windowOpen && (
        <Alert variant="info" className="mb-3">
          Marking window is <strong>open</strong>. Select Present or Absent for each
          learner — changes are saved immediately.
        </Alert>
      )}

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {roster.length === 0 ? (
        <Alert variant="info">No learners on the roster for this session.</Alert>
      ) : (
        <DataTable
          isPaginated={roster.length > PAGE_SIZE}
          data={tableData}
          columns={columns}
          itemCount={tableData.length}
          initialState={{ pageSize: PAGE_SIZE }}
        >
          <DataTable.Table />
          <DataTable.EmptyTable content="No learners" />
          {roster.length > PAGE_SIZE && <DataTable.TableFooter />}
        </DataTable>
      )}

      {/* Reason modal — required when changing a previously recorded status */}
      <StandardModal
        title="Reason for change"
        isOpen={!!reasonModal}
        onClose={() => { setReasonModal(null); setReasonText(''); }}
        hasCloseButton
        footerNode={(
          <div className="d-flex justify-content-end" style={{ gap: 8 }}>
            <Button variant="tertiary" onClick={() => { setReasonModal(null); setReasonText(''); }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={confirmReasonModal}
              disabled={!reasonText.trim()}
            >
              Confirm
            </Button>
          </div>
        )}
      >
        <p className="mb-2">
          This learner already has an attendance record. Please provide a reason for
          changing their status.
        </p>
        <Form.Control
          as="textarea"
          rows={3}
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          placeholder="Enter reason…"
        />
      </StandardModal>

      {/* Note modal */}
      <StandardModal
        title="Attendance note"
        isOpen={!!noteModal}
        onClose={() => { setNoteModal(null); setNoteText(''); setNoteError(''); }}
        hasCloseButton
        footerNode={(
          <div className="d-flex justify-content-end" style={{ gap: 8 }}>
            <Button
              variant="tertiary"
              onClick={() => { setNoteModal(null); setNoteText(''); setNoteError(''); }}
            >
              Close
            </Button>
            {isAdmin && (
              <Button
                variant="primary"
                onClick={handleNoteSave}
                disabled={noteText === noteModal?.initialNotes || noteSaving}
              >
                {noteSaving ? 'Saving…' : 'Save note'}
              </Button>
            )}
          </div>
        )}
      >
        {noteError && (
          <Alert variant="danger" className="mb-2">{noteError}</Alert>
        )}
        <Form.Control
          as="textarea"
          rows={4}
          value={noteText}
          onChange={(e) => isAdmin && setNoteText(e.target.value)}
          readOnly={!isAdmin}
          placeholder={isAdmin ? 'Enter a note…' : 'No note recorded.'}
        />
      </StandardModal>

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
          Attendance saved.
        </Toast>
      </div>
    </Container>
  );
};

export default AttendanceRosterPage;
