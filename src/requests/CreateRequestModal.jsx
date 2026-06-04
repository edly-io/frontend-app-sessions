import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Button, Form, Spinner, StandardModal,
} from '@openedx/paragon';

import { getCalendarSessions } from '../calendar/api';
import { createRequest } from './api';
import { REQUEST_TYPE, REQUEST_TYPE_LABELS } from '../shared/constants';
import { extractApiError, formatDateTime } from '../shared/utils';

const TYPE_OPTIONS = [
  { value: REQUEST_TYPE.REMOTE_SESSION, label: REQUEST_TYPE_LABELS[REQUEST_TYPE.REMOTE_SESSION] },
  { value: REQUEST_TYPE.LEAVE, label: REQUEST_TYPE_LABELS[REQUEST_TYPE.LEAVE] },
];

const CreateRequestModal = ({
  isOpen, onClose, programKey, onSuccess,
}) => {
  const [typeSlug, setTypeSlug] = useState(REQUEST_TYPE.REMOTE_SESSION);
  const [leaveMode, setLeaveMode] = useState('full_day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsFetched, setSessionsFetched] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fetchError, setFetchError] = useState('');

  const resetSessions = () => {
    setSessions([]);
    setSessionsLoading(false);
    setSessionsFetched(false);
    setSelectedSessionIds([]);
    setFetchError('');
  };

  const resetForm = () => {
    setTypeSlug(REQUEST_TYPE.REMOTE_SESSION);
    setLeaveMode('full_day');
    setStartDate('');
    setEndDate('');
    resetSessions();
    setReason('');
    setAttachment(null);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleTypeChange = (value) => {
    setTypeSlug(value);
    resetSessions();
  };

  const handleLeaveModeChange = (mode) => {
    setLeaveMode(mode);
    resetSessions();
  };

  const handleStartDateChange = (value) => {
    setStartDate(value);
    resetSessions();
  };

  const handleEndDateChange = (value) => {
    setEndDate(value);
    resetSessions();
  };

  // Fetch sessions whenever a valid date range is set.
  // Full-day leave auto-selects all returned sessions; session-specific leave
  // leaves selection to the user. The backend requires session_ids for all types.
  useEffect(() => {
    if (!startDate || !endDate || startDate > endDate) { return undefined; }
    let cancelled = false;
    const fetchSessions = async () => {
      setSessionsLoading(true);
      setSessionsFetched(false);
      setFetchError('');
      setSessions([]);
      setSelectedSessionIds([]);
      try {
        const { sessions: data } = await getCalendarSessions(startDate, endDate, programKey);
        if (cancelled) { return; }
        const now = new Date();
        const upcoming = (data || []).filter(
          (s) => s.status === 'scheduled' && new Date(s.scheduled_start_time) > now,
        );
        setSessions(upcoming);
        setSessionsFetched(true);
        // Full-day leave: auto-select every session in the range
        if (typeSlug === REQUEST_TYPE.LEAVE && leaveMode === 'full_day') {
          setSelectedSessionIds(upcoming.map((s) => s.id));
        }
      } catch (err) {
        if (!cancelled) { setFetchError(extractApiError(err, 'Failed to load sessions')); }
      } finally {
        if (!cancelled) { setSessionsLoading(false); }
      }
    };
    fetchSessions();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, typeSlug, leaveMode, programKey]);

  // ── Selection helpers ──

  const toggleSession = (id) => {
    setSelectedSessionIds((prev) => (
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    ));
  };

  const isAllSessionsSelected = sessions.length > 0 && selectedSessionIds.length === sessions.length;

  const toggleAllSessions = () => {
    if (isAllSessionsSelected) {
      setSelectedSessionIds([]);
    } else {
      setSelectedSessionIds(sessions.map((s) => s.id));
    }
  };

  // ── Validation ──

  const isFullDayLeave = typeSlug === REQUEST_TYPE.LEAVE && leaveMode === 'full_day';

  const isValid = () => {
    if (!reason.trim()) { return false; }
    if (typeSlug === REQUEST_TYPE.LEAVE) {
      if (!startDate || !endDate) { return false; }
      if (isFullDayLeave) { return true; }
      return selectedSessionIds.length > 0;
    }
    return selectedSessionIds.length > 0;
  };

  // ── Submit ──

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      await createRequest({
        type: typeSlug,
        reason: reason.trim(),
        program_key: programKey,
        ...(typeSlug === REQUEST_TYPE.LEAVE
          ? {
            leave_start_date: startDate,
            leave_end_date: endDate,
            ...(!isFullDayLeave && { session_ids: selectedSessionIds }),
          }
          : { session_ids: selectedSessionIds }),
        attachment: attachment || undefined,
      });
      resetForm();
      onSuccess();
    } catch (err) {
      setError(extractApiError(err, 'Failed to submit request'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Session list (remote_session + session-specific leave) ──

  const renderSessionList = () => {
    if (!sessionsFetched && !sessionsLoading) { return null; }
    if (sessionsLoading) {
      return <div className="py-2 text-center"><Spinner animation="border" size="sm" /></div>;
    }
    if (fetchError) {
      return <Alert variant="danger" className="mt-2 mb-0">{fetchError}</Alert>;
    }
    if (sessions.length === 0) {
      return (
        <p className="text-muted mt-2 mb-0" style={{ fontSize: 13 }}>
          No upcoming scheduled sessions found in this date range.
        </p>
      );
    }
    return (
      <div className="mt-2">
        <div className="mb-1">
          <Form.Check
            type="checkbox"
            id="select-all-sessions"
            label={isAllSessionsSelected ? 'Deselect all' : 'Select all'}
            checked={isAllSessionsSelected}
            onChange={toggleAllSessions}
          />
        </div>
        <div style={{
          maxHeight: 220,
          overflowY: 'auto',
          border: '1px solid #dee2e6',
          borderRadius: 4,
          padding: '4px 8px',
        }}
        >
          {sessions.map((s) => (
            <Form.Check
              key={s.id}
              type="checkbox"
              id={`session-${s.id}`}
              label={`${formatDateTime(s.scheduled_start_time)} · ${s.title}`}
              checked={selectedSessionIds.includes(s.id)}
              onChange={() => toggleSession(s.id)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Request"
      footerNode={(
        <>
          <Button variant="tertiary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || !isValid()}
            className="ml-2"
          >
            {submitting ? <Spinner animation="border" size="sm" className="mr-2" /> : null}
            Submit
          </Button>
        </>
      )}
    >
      {error && <Alert variant="danger" className="mb-3">{error}</Alert>}

      {/* Request type selector */}
      <Form.Group className="mb-3">
        <Form.Label>Request type</Form.Label>
        <Form.Control
          as="select"
          value={typeSlug}
          onChange={(e) => handleTypeChange(e.target.value)}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Form.Control>
      </Form.Group>

      {/* Leave mode selector */}
      {typeSlug === REQUEST_TYPE.LEAVE && (
        <Form.Group className="mb-3">
          <Form.Label>Leave type</Form.Label>
          <div className="d-flex" style={{ gap: 16 }}>
            <Form.Check
              type="radio"
              id="leave-mode-full-day"
              name="leaveMode"
              label="Full day"
              checked={leaveMode === 'full_day'}
              onChange={() => handleLeaveModeChange('full_day')}
            />
            <Form.Check
              type="radio"
              id="leave-mode-session-specific"
              name="leaveMode"
              label="Session-specific"
              checked={leaveMode === 'session_specific'}
              onChange={() => handleLeaveModeChange('session_specific')}
            />
          </div>
        </Form.Group>
      )}

      {/* Date range */}
      <Form.Group className="mb-3">
        <Form.Label>Date range</Form.Label>
        <div className="d-flex align-items-center" style={{ gap: 8 }}>
          <Form.Control
            type="date"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            style={{ flex: 1 }}
            aria-label="Start date"
          />
          <span style={{ color: '#6c757d' }}>–</span>
          <Form.Control
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => handleEndDateChange(e.target.value)}
            style={{ flex: 1 }}
            aria-label="End date"
          />
          {sessionsLoading && <Spinner animation="border" size="sm" />}
        </div>
      </Form.Group>

      {/* Session list — session-specific leave and remote_session only */}
      {!isFullDayLeave && (
        <Form.Group className="mb-3">
          <Form.Label>Select sessions</Form.Label>
          {renderSessionList()}
        </Form.Group>
      )}

      {/* Reason */}
      <Form.Group className="mb-3">
        <Form.Label>
          Reason <span className="text-danger">*</span>
        </Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why you are making this request."
          maxLength={1000}
        />
      </Form.Group>

      {/* Attachment */}
      <Form.Group className="mb-0">
        <Form.Label>Attachment <small className="text-muted">(optional)</small></Form.Label>
        <Form.Control
          type="file"
          onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        />
        {attachment && (
          <small className="text-muted mt-1 d-block">
            {attachment.name}
            {' '}
            <Button
              variant="tertiary"
              size="sm"
              className="p-0 ml-1"
              onClick={() => setAttachment(null)}
            >
              Remove
            </Button>
          </small>
        )}
      </Form.Group>
    </StandardModal>
  );
};

CreateRequestModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  programKey: PropTypes.string.isRequired,
  onSuccess: PropTypes.func.isRequired,
};

export default CreateRequestModal;
