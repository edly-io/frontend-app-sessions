import React, {
  useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import {
  Alert, Badge, Button, Container, DataTable, Form, Spinner, StandardModal, Toast,
} from '@openedx/paragon';
import { ArrowBack, Save } from '@openedx/paragon/icons';

import {
  getAttendanceRoster,
  markAttendance,
} from './api';
import { useConfig } from '../app/useConfig';
import { ATTENDANCE_STATUS, USER_ROLE } from '../shared/constants';
import { extractApiError, formatDateTime, getStatusVariant } from '../shared/utils';

const PAGE_SIZE = 25;

// Editable statuses — leave and pending are always read-only.
const EDIT_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
];

// ─── Cell renderers ──────────────────────────────────────────────────────────

const NameCell = ({ value }) => value || '—';
NameCell.propTypes = { value: PropTypes.string };
NameCell.defaultProps = { value: '' };

const EmailCell = ({ value }) => <span className="text-muted">{value || '—'}</span>;
EmailCell.propTypes = { value: PropTypes.string };
EmailCell.defaultProps = { value: '' };

// Renders radio buttons (editable) or a status badge (read-only / leave / pending).
const StatusCell = ({ row }) => {
  const {
    canEdit, currentStatus, onStatusChange, user_id: userId,
  } = row.original;

  if (!canEdit) {
    const label = ATTENDANCE_STATUS[currentStatus] || currentStatus || '—';
    return currentStatus
      ? <Badge variant={getStatusVariant(currentStatus)}>{label}</Badge>
      : <span className="text-muted">—</span>;
  }

  return (
    <div className="d-flex" style={{ gap: 12 }}>
      {EDIT_OPTIONS.map((opt) => (
        <Form.Check
          key={opt.value}
          type="radio"
          name={`status-${userId}`}
          id={`status-${userId}-${opt.value}`}
          label={opt.label}
          checked={currentStatus === opt.value}
          onChange={() => onStatusChange(userId, opt.value)}
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
      canEdit: PropTypes.bool.isRequired,
      onStatusChange: PropTypes.func.isRequired,
    }).isRequired,
  }).isRequired,
};

const NoteCell = ({ row }) => {
  const {
    record_id: recordId, onNoteClick, user_id: userId, currentStatus, notes,
  } = row.original;
  if (!recordId) { return null; }
  const hasNote = notes != null && notes !== '';
  return (
    <Button
      variant="tertiary"
      size="sm"
      aria-label={hasNote ? 'View or edit note' : 'Add note'}
      onClick={() => onNoteClick(recordId, userId, currentStatus, notes ?? '')}
    >
      {hasNote ? '💬' : '+'}
    </Button>
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
  const { data: config } = useConfig();
  const isAdmin = config?.user_role === USER_ROLE.ADMIN;

  const [roster, setRoster] = useState([]);
  const [sessionMeta, setSessionMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // { [userId]: { status, reason?, originalStatus, recordId } }
  const [overrides, setOverrides] = useState({});

  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Reason modal: opened when changing an already-recorded status.
  const [reasonModal, setReasonModal] = useState(null); // { userId, pendingStatus }
  const [reasonText, setReasonText] = useState('');

  // Note modal.
  const [noteModal, setNoteModal] = useState(null); // { recordId, userId, currentStatus, initialNotes } | null
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAttendanceRoster(sessionId);
        if (cancelled) { return; }
        const rows = Array.isArray(data) ? data : data.results ?? [];
        const meta = data.session ?? null;
        setRoster(rows);
        setSessionMeta(meta);
        // Seed overrides from existing roster statuses.
        const seed = {};
        rows.forEach((row) => {
          seed[row.user_id] = {
            status: row.status || 'pending',
            originalStatus: row.status || 'pending',
            recordId: row.record_id ?? null,
          };
        });
        setOverrides(seed);
      } catch (err) {
        if (!cancelled) { setError(extractApiError(err, 'Failed to load roster')); }
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const windowOpen = sessionMeta?.marking_window_open ?? false;

  const handleStatusChange = (userId, newStatus) => {
    const current = overrides[userId];
    if (!current) { return; }
    // If the row already has a real record, require a reason for the change.
    if (current.recordId !== null) {
      setReasonText('');
      setReasonModal({ userId, pendingStatus: newStatus });
    } else {
      setOverrides((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], status: newStatus },
      }));
    }
  };

  const confirmReasonModal = () => {
    if (!reasonModal) { return; }
    const { userId, pendingStatus } = reasonModal;
    setOverrides((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], status: pendingStatus, reason: reasonText.trim() },
    }));
    setReasonModal(null);
    setReasonText('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // Send only rows whose status differs from the original.
      const changed = Object.entries(overrides)
        .filter(([, v]) => v.status !== v.originalStatus)
        .map(([userId, v]) => {
          const record = { user_id: Number(userId), status: v.status };
          if (v.reason) { record.reason = v.reason; }
          return record;
        });
      if (changed.length > 0) {
        await markAttendance(sessionId, changed);
      }
      // Update originals to reflect saved state.
      setOverrides((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((uid) => {
          next[uid] = { ...next[uid], originalStatus: next[uid].status, reason: undefined };
        });
        return next;
      });
      setShowToast(true);
    } catch (err) {
      setError(extractApiError(err, 'Failed to save attendance'));
    } finally {
      setSaving(false);
    }
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
      // leave rows and pending rows (no record_id + window closed) are not editable;
      // only admin can edit when window is open and status is not leave.
      const canEdit = isAdmin && windowOpen && currentStatus !== 'leave';
      return {
        ...row,
        currentStatus,
        canEdit,
        onStatusChange: handleStatusChange,
        onNoteClick: openNoteModal,
      };
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [roster, overrides, isAdmin, windowOpen]);

  const hasUnsavedChanges = useMemo(() => (
    Object.values(overrides).some((v) => v.status !== v.originalStatus)
  ), [overrides]);

  const columns = useMemo(() => {
    const cols = [
      { Header: 'Name', accessor: 'full_name', Cell: NameCell },
      { Header: 'Email', accessor: 'email', Cell: EmailCell },
      { Header: 'Status', id: 'status', Cell: StatusCell },
    ];
    if (isAdmin) {
      cols.push({ Header: 'Note', id: 'note', Cell: NoteCell });
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
        to={`/${programId}/attendance/by-course`}
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
          </div>
          <div className="d-flex mt-2 mt-sm-0" style={{ gap: 6, flexShrink: 0 }}>
            <Badge variant="success">{counts.present} present</Badge>
            <Badge variant="danger">{counts.absent} absent</Badge>
            <Badge variant="warning">{counts.leave} on leave</Badge>
            <Badge variant="secondary">{counts.pending} pending</Badge>
          </div>
        </div>
      </div>

      {/* Marking window banner */}
      {isAdmin && !windowOpen && (
        <Alert variant="warning" className="mb-3">
          The attendance marking window for this session is <strong>closed</strong>.
          Records are read-only.
        </Alert>
      )}
      {isAdmin && windowOpen && (
        <Alert variant="info" className="mb-3">
          Marking window is <strong>open</strong>. Select Present or Absent for each learner,
          then save.
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
        <>
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

          {isAdmin && windowOpen && (
            <div className="mt-3">
              <Button
                variant="primary"
                iconBefore={Save}
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
              >
                {saving ? 'Saving…' : 'Save attendance'}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Reason modal — required when changing an already-recorded status */}
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
