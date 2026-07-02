import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import {
  Alert, Badge, Button, Container, DataTable, Form, Spinner, StandardModal, Toast,
} from '@openedx/paragon';

import { Edit } from '@openedx/paragon/icons';

import { getTraineeAttendance, markAttendance } from './api';
import SearchableSelect from '../shared/SearchableSelect';
import { fetchProgramCourses, fetchProgramLearners } from '../calendar/api';
import { useConfig } from '../app/useConfig';
import { ATTENDANCE_STATUS, USER_ROLE } from '../shared/constants';
import { extractApiError, formatDateTime, getStatusVariant } from '../shared/utils';

const PAGE_SIZE = 50;

const EDIT_OPTIONS = [
  { value: 'present', label: 'Present', variant: 'success' },
  { value: 'absent', label: 'Absent', variant: 'danger' },
];

// ─── Cell renderers ──────────────────────────────────────────────────────────

const SessionCell = ({ row }) => (
  <div>
    <div>{row.original.session_title || '—'}</div>
    {row.original.session_date && (
      <small className="text-muted">{formatDateTime(row.original.session_date)}</small>
    )}
  </div>
);
SessionCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      session_title: PropTypes.string,
      session_date: PropTypes.string,
    }),
  }).isRequired,
};

const StatusCell = ({ row }) => {
  const {
    status, canEdit, isSaving, onStatusChange, session_id: sessionId, user_id: userId,
  } = row.original;

  if (!canEdit) {
    return (
      <Badge variant={getStatusVariant(status)}>
        {ATTENDANCE_STATUS[status] || status || '—'}
      </Badge>
    );
  }

  return (
    <div className="d-flex" style={{ gap: 4 }}>
      {EDIT_OPTIONS.map((opt) => {
        const isSelected = status === opt.value;
        return (
          <Button
            key={opt.value}
            size="sm"
            variant={isSelected ? opt.variant : 'outline-secondary'}
            onClick={() => !isSelected && !isSaving && onStatusChange(sessionId, userId, opt.value)}
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
      session_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      user_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      status: PropTypes.string,
      canEdit: PropTypes.bool,
      isSaving: PropTypes.bool,
      onStatusChange: PropTypes.func,
    }),
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

const OverrideCell = ({ row }) => (
  row.original.is_overridden && row.original.override_reason
    ? <small className="text-muted">{row.original.override_reason}</small>
    : <span className="text-muted">—</span>
);
OverrideCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      is_overridden: PropTypes.bool,
      override_reason: PropTypes.string,
    }),
  }).isRequired,
};

const NoteCell = ({ row }) => {
  const {
    record_id: recordId, session_id: sessionId, onNoteClick, user_id: userId, status, notes,
  } = row.original;
  if (!recordId) { return null; }
  const hasNote = notes != null && notes !== '';
  return (
    <div className="d-flex align-items-center" style={{ gap: 6 }}>
      {hasNote && <small className="text-muted">{notes}</small>}
      <Button
        variant="tertiary"
        size="sm"
        iconBefore={Edit}
        aria-label={hasNote ? 'Edit note' : 'Add note'}
        onClick={() => onNoteClick(sessionId, userId, status, notes ?? '')}
      />
    </div>
  );
};
NoteCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      record_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      session_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      user_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      status: PropTypes.string,
      notes: PropTypes.string,
      onNoteClick: PropTypes.func,
    }),
  }).isRequired,
};

const BASE_COLUMNS = [
  { Header: 'Session', accessor: 'session_title', Cell: SessionCell },
  { Header: 'Status', id: 'status', Cell: StatusCell },
  { Header: 'Change reason', accessor: 'override_reason', Cell: OverrideCell },
  { Header: 'Source', id: 'source', Cell: SourceCell },
  { Header: 'Marked by', id: 'marked_by', Cell: MarkedByCell },
];

// ─── Component ───────────────────────────────────────────────────────────────

const PerLearnerView = () => {
  const { programId } = useParams();
  const { data: config } = useConfig();
  const isAdmin = config?.user_role === USER_ROLE.ADMIN;

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState('');

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [learners, setLearners] = useState([]);
  const [learnersLoading, setLearnersLoading] = useState(false);
  const [learnersError, setLearnersError] = useState('');

  const [selectedUserId, setSelectedUserId] = useState('');
  const selectedUserIdRef = useRef('');
  const selectedCourseIdRef = useRef('');

  const [records, setRecords] = useState([]);
  const [count, setCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState('');

  const [savingSessionId, setSavingSessionId] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [showToast, setShowToast] = useState(false);

  const [reasonModal, setReasonModal] = useState(null); // { sessionId, userId, pendingStatus }
  const [reasonText, setReasonText] = useState('');

  const [noteModal, setNoteModal] = useState(null); // { recordId, userId, status, initialNotes }
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState('');

  useEffect(() => {
    if (!programId) { return () => {}; }
    let cancelled = false;
    (async () => {
      try {
        const [coursesData, learnersData] = await Promise.all([
          fetchProgramCourses(programId),
          fetchProgramLearners(programId),
        ]);
        if (cancelled) { return; }
        setCourses((coursesData || []).map((c) => ({ id: c.course_key, title: c.display_name })));
        setLearners(learnersData || []);
      } catch (err) {
        if (!cancelled) { setCoursesError(extractApiError(err, 'Failed to load courses or learners')); }
      } finally {
        if (!cancelled) {
          setCoursesLoading(false);
          setLearnersLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [programId]);

  const handleCourseChange = (option) => {
    const courseKey = option?.value || '';
    selectedCourseIdRef.current = courseKey;
    selectedUserIdRef.current = '';
    setSelectedCourseId(courseKey);
    setSelectedUserId('');
    setRecords([]);
    setCount(0);
  };

  // Stable fetchData — reads user/course IDs from refs so reference never changes.
  const handleFetchData = useCallback(async ({ pageIndex: nextPageIndex = 0 } = {}) => {
    const uid = selectedUserIdRef.current;
    const cid = selectedCourseIdRef.current;
    if (!uid || !cid) { return; }
    setRecordsLoading(true);
    setRecordsError('');
    try {
      const data = await getTraineeAttendance(uid, {
        programKey: programId,
        courseId: cid !== '__none__' ? cid : undefined,
        page: nextPageIndex + 1,
        pageSize: PAGE_SIZE,
      });
      const results = Array.isArray(data) ? data : data.results ?? [];
      const total = Array.isArray(data) ? data.length : data.count ?? results.length;
      setRecords(results);
      setCount(total);
      setPageIndex(nextPageIndex);
    } catch (err) {
      setRecordsError(extractApiError(err, 'Failed to load attendance history'));
    } finally {
      setRecordsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLearnerChange = (option) => {
    const uid = option?.value || '';
    selectedUserIdRef.current = uid;
    setSelectedUserId(uid);
    setPageIndex(0);
    setRecords([]);
    setCount(0);
  };

  const saveStatusChange = useCallback(async (sessionId, userId, newStatus, reason) => {
    setSavingSessionId(String(sessionId));
    setSaveError('');
    setRecords((prev) => prev.map((r) => (
      String(r.session_id) === String(sessionId) ? { ...r, status: newStatus } : r
    )));
    try {
      const record = { user_id: Number(userId), status: newStatus };
      if (reason) { record.reason = reason; }
      await markAttendance(sessionId, [record]);
      // Silent reload to pick up record_id and fresh data
      const data = await getTraineeAttendance(selectedUserIdRef.current, {
        programKey: programId,
        courseId: selectedCourseIdRef.current !== '__none__' ? selectedCourseIdRef.current : undefined,
        page: pageIndex + 1,
        pageSize: PAGE_SIZE,
      });
      const results = Array.isArray(data) ? data : data.results ?? [];
      setRecords(results);
      setShowToast(true);
    } catch (err) {
      setSaveError(extractApiError(err, 'Failed to save attendance'));
      // Revert optimistic update
      await handleFetchData({ pageIndex });
    } finally {
      setSavingSessionId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, pageIndex]);

  const handleStatusChange = useCallback((sessionId, userId, newStatus) => {
    const row = records.find((r) => String(r.session_id) === String(sessionId));
    if (!row) { return; }
    if ((row.record_id ?? row.id) != null) {
      setReasonText('');
      setReasonModal({ sessionId, userId, pendingStatus: newStatus });
    } else {
      saveStatusChange(sessionId, userId, newStatus, null);
    }
  }, [records, saveStatusChange]);

  const confirmReasonModal = () => {
    if (!reasonModal) { return; }
    const { sessionId, userId, pendingStatus } = reasonModal;
    const reason = reasonText.trim();
    setReasonModal(null);
    setReasonText('');
    saveStatusChange(sessionId, userId, pendingStatus, reason);
  };

  const openNoteModal = (sessionId, userId, status, existingNotes) => {
    setNoteModal({
      sessionId, userId, status, initialNotes: existingNotes,
    });
    setNoteText(existingNotes);
    setNoteError('');
  };

  const handleNoteSave = async () => {
    setNoteSaving(true);
    setNoteError('');
    try {
      await markAttendance(noteModal.sessionId, [{
        user_id: Number(noteModal.userId),
        status: noteModal.status,
        notes: noteText,
      }]);
      setRecords((prev) => prev.map((r) => (
        String(r.session_id) === String(noteModal.sessionId)
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

  const columns = useMemo(() => {
    const cols = [...BASE_COLUMNS];
    if (isAdmin) {
      cols.push({ Header: 'Note', id: 'note', Cell: NoteCell });
    }
    return cols;
  }, [isAdmin]);

  const courseOptions = useMemo(() => [
    { value: '__none__', label: 'Sessions without course' },
    ...courses.map((c) => ({ value: c.id, label: c.title || `Course ${c.id}` })),
  ], [courses]);

  const selectedCourseOption = useMemo(() => (
    courseOptions.find((o) => o.value === selectedCourseId) || null
  ), [courseOptions, selectedCourseId]);

  const learnerOptions = useMemo(() => learners.map((l) => {
    const fullName = [l.first_name, l.last_name].filter(Boolean).join(' ');
    return {
      value: l.id,
      label: fullName ? `${fullName} (${l.email})` : l.email,
    };
  }), [learners]);

  const selectedLearnerOption = useMemo(() => (
    learnerOptions.find((o) => o.value === selectedUserId) || null
  ), [learnerOptions, selectedUserId]);

  const tableData = useMemo(() => records.map((row) => ({
    ...row,
    record_id: row.record_id ?? row.id ?? null, // trainee endpoint uses 'id', roster uses 'record_id'
    canEdit: isAdmin && row.status !== 'leave',
    isSaving: savingSessionId === String(row.session_id),
    onStatusChange: handleStatusChange,
    onNoteClick: openNoteModal,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [records, isAdmin, savingSessionId, handleStatusChange]);

  return (
    <Container className="py-3">
      <h3 className="mb-1">Attendance by Learner</h3>
      <p className="text-muted mb-3">
        Pick a course and a learner to see their session-by-session attendance history.
      </p>

      {coursesError && (
        <Alert variant="danger" dismissible onClose={() => setCoursesError('')}>
          {coursesError}
        </Alert>
      )}
      {learnersError && (
        <Alert variant="danger" dismissible onClose={() => setLearnersError('')}>
          {learnersError}
        </Alert>
      )}
      {recordsError && (
        <Alert variant="danger" dismissible onClose={() => setRecordsError('')}>
          {recordsError}
        </Alert>
      )}
      {saveError && (
        <Alert variant="danger" dismissible onClose={() => setSaveError('')}>
          {saveError}
        </Alert>
      )}

      <div className="d-flex flex-wrap mb-4" style={{ gap: 16 }}>
        <div style={{ minWidth: 280, maxWidth: 360, flex: '1 1 280px' }}>
          <SearchableSelect
            id="per-learner-course"
            label="Course"
            options={courseOptions}
            value={selectedCourseOption}
            onChange={handleCourseChange}
            loading={coursesLoading}
            placeholder="Search courses…"
          />
        </div>
        <div style={{ minWidth: 280, maxWidth: 360, flex: '1 1 280px' }}>
          <SearchableSelect
            id="per-learner-user"
            label="Learner"
            options={learnerOptions}
            value={selectedLearnerOption}
            onChange={handleLearnerChange}
            loading={learnersLoading}
            disabled={!selectedCourseId || learners.length === 0}
            placeholder={selectedCourseId ? 'Search learners…' : 'Select a course first'}
          />
        </div>
      </div>

      {!selectedCourseId && (
        <Alert variant="info">Select a course and learner to see their attendance history.</Alert>
      )}

      {selectedCourseId && !selectedUserId && !learnersLoading && (
        <Alert variant="info">Select a learner above to see their attendance history.</Alert>
      )}

      {selectedUserId && recordsLoading && records.length === 0 && (
        <div className="text-center py-4">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Loading attendance history…</p>
        </div>
      )}

      {selectedUserId && (
        <DataTable
          key={selectedUserId}
          isPaginated
          manualPagination
          fetchData={handleFetchData}
          pageCount={Math.max(1, Math.ceil(count / PAGE_SIZE))}
          itemCount={count}
          data={tableData}
          columns={columns}
          initialState={{ pageIndex, pageSize: PAGE_SIZE }}
        >
          <DataTable.Table />
          <DataTable.EmptyTable content="No records" />
          <DataTable.TableFooter />
        </DataTable>
      )}

      {/* Reason modal */}
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

export default PerLearnerView;
