import React, {
  useState, useEffect, useMemo, useRef,
} from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Button, Form, Spinner, StandardModal,
} from '@openedx/paragon';

import { getCalendarSessions, getProgramDates } from '../calendar/api';
import { createRequest, getLeaveUsage } from './api';
import {
  REQUEST_TYPE,
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  USER_ROLE,
} from '../shared/constants';
import { extractApiError, formatDateTime } from '../shared/utils';
import { useConfig } from '../app/useConfig';

const TYPE_OPTIONS = [
  { value: REQUEST_TYPE.REMOTE_SESSION, label: REQUEST_TYPE_LABELS[REQUEST_TYPE.REMOTE_SESSION] },
  { value: REQUEST_TYPE.LEAVE, label: REQUEST_TYPE_LABELS[REQUEST_TYPE.LEAVE] },
];

const LEAVE_CATEGORIES = [
  { value: 'CASUAL', label: 'Casual' },
  { value: 'MED', label: 'Medical' },
  { value: 'EMER', label: 'Emergency' },
];

const LEAVE_CATEGORY_LABELS = {
  CASUAL: 'Casual',
  MED: 'Medical',
  EMER: 'Emergency',
};

const LEAVE_MODE_LABELS = {
  full_day: 'Full day',
  session_specific: 'Session-specific',
};

const formatLeaveDate = (value) => {
  if (!value) { return null; }
  const date = value.includes('T') ? new Date(value) : new Date(`${value}T12:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

const renderLeaveRange = (leave) => {
  const start = formatLeaveDate(leave.leave_start_date);
  const end = formatLeaveDate(leave.leave_end_date);
  if (!start) { return end; }
  if (!end || start === end) { return start; }
  return `${start} - ${end}`;
};

const formatDateTimeWithAt = (value) => (
  formatDateTime(value).replace(/, (?=\d{1,2}:\d{2} [AP]M$)/, ' at ')
);

const CreateRequestModal = ({
  isOpen, onClose, programKey, onSuccess, lockedType,
}) => {
  const { data: config } = useConfig();
  const isInstructor = config?.user_role === USER_ROLE.INSTRUCTOR;

  const defaultType = lockedType || REQUEST_TYPE.REMOTE_SESSION;
  const [typeSlug, setTypeSlug] = useState(defaultType);
  useEffect(() => { setTypeSlug(lockedType || REQUEST_TYPE.REMOTE_SESSION); }, [lockedType]);
  const [leaveMode, setLeaveMode] = useState('full_day');
  const [leaveCategory, setLeaveCategory] = useState('CASUAL');
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
  const [leaveUsageData, setLeaveUsageData] = useState(null);
  const [thresholdExceeded, setThresholdExceeded] = useState(null);
  const [instructorSessionWarning, setInstructorSessionWarning] = useState(null);
  const [overlapConflict, setOverlapConflict] = useState(null);
  const [programDates, setProgramDates] = useState([]);
  const topRef = useRef(null);

  const resetSessions = () => {
    setSessions([]);
    setSessionsLoading(false);
    setSessionsFetched(false);
    setSelectedSessionIds([]);
    setFetchError('');
  };

  const resetForm = () => {
    setTypeSlug(lockedType || REQUEST_TYPE.REMOTE_SESSION);
    setLeaveMode('full_day');
    setLeaveCategory('CASUAL');
    setStartDate('');
    setEndDate('');
    resetSessions();
    setReason('');
    setAttachment(null);
    setError('');
    setLeaveUsageData(null);
    setThresholdExceeded(null);
    setInstructorSessionWarning(null);
    setOverlapConflict(null);
    setProgramDates([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleTypeChange = (value) => {
    setTypeSlug(value);
    setThresholdExceeded(null);
    setInstructorSessionWarning(null);
    setOverlapConflict(null);
    resetSessions();
  };

  const handleLeaveModeChange = (mode) => {
    setLeaveMode(mode);
    setThresholdExceeded(null);
    setInstructorSessionWarning(null);
    setOverlapConflict(null);
    resetSessions();
  };

  const handleStartDateChange = (value) => {
    setStartDate(value);
    setThresholdExceeded(null);
    setInstructorSessionWarning(null);
    setOverlapConflict(null);
    resetSessions();
  };

  const handleEndDateChange = (value) => {
    setEndDate(value);
    setThresholdExceeded(null);
    setInstructorSessionWarning(null);
    setOverlapConflict(null);
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
        const scheduled = (data || []).filter((s) => s.status === 'scheduled');
        setSessions(scheduled);
        setSessionsFetched(true);
        // Full-day leave: auto-select every session in the range
        if (typeSlug === REQUEST_TYPE.LEAVE && leaveMode === 'full_day') {
          setSelectedSessionIds(scheduled.map((s) => s.id));
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

  // Fetch leave usage for trainees only — instructors are exempt from threshold enforcement.
  useEffect(() => {
    if (!isOpen || typeSlug !== REQUEST_TYPE.LEAVE || isInstructor) { setLeaveUsageData(null); return; }
    getLeaveUsage({ program_key: programKey })
      .then(setLeaveUsageData)
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, typeSlug, programKey, isInstructor]);

  // Fetch graded activity dates once when the leave modal opens.
  useEffect(() => {
    if (!isOpen || typeSlug !== REQUEST_TYPE.LEAVE || !programKey) { return; }
    getProgramDates(programKey).then(setProgramDates).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, programKey]);

  const gradedActivitiesInRange = useMemo(() => {
    if (!startDate || !endDate || typeSlug !== REQUEST_TYPE.LEAVE) { return []; }
    return programDates.filter((event) => {
      const d = event.date ? event.date.slice(0, 10) : '';
      return d >= startDate && d <= endDate;
    });
  }, [programDates, startDate, endDate, typeSlug]);

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

  // ── Leave usage projection ──

  const ownUsage = leaveUsageData?.leaves?.[0] ?? null;
  const usageThreshold = leaveUsageData?.threshold ?? null;
  const projectedCount = ownUsage !== null ? ownUsage.total_leaves_availed + 1 : null;
  const wouldExceed = projectedCount !== null && usageThreshold !== null
    && projectedCount > usageThreshold;

  // ── Validation ──

  const isFullDayLeave = typeSlug === REQUEST_TYPE.LEAVE && leaveMode === 'full_day';

  const requiresAttachment = typeSlug === REQUEST_TYPE.LEAVE
    && (leaveCategory === 'MED' || leaveCategory === 'EMER');

  const shouldAwaitInstructorSessionCheck = isInstructor
    && isFullDayLeave
    && Boolean(startDate && endDate)
    && !sessionsFetched
    && !fetchError;

  const isValid = () => {
    if (!reason.trim()) { return false; }
    if (requiresAttachment && !attachment) { return false; }
    if (typeSlug === REQUEST_TYPE.LEAVE) {
      if (!startDate || !endDate) { return false; }
      if (isFullDayLeave) { return true; }
      return selectedSessionIds.length > 0;
    }
    return selectedSessionIds.length > 0;
  };

  useEffect(() => {
    if (thresholdExceeded || instructorSessionWarning || overlapConflict || error) {
      if (typeof topRef.current?.scrollIntoView === 'function') {
        topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [thresholdExceeded, instructorSessionWarning, overlapConflict, error]);

  // ── Submit ──

  const buildPayload = () => ({
    type: typeSlug,
    reason: reason.trim(),
    program_key: programKey,
    ...(typeSlug === REQUEST_TYPE.LEAVE
      ? {
        leave_start_date: startDate,
        leave_end_date: endDate,
        category: leaveCategory,
        leave_type: leaveMode,
        ...(!isFullDayLeave && { session_ids: selectedSessionIds }),
      }
      : { session_ids: selectedSessionIds }),
    attachment: attachment || undefined,
  });

  const handleSubmit = async () => {
    setError('');
    setThresholdExceeded(null);
    setInstructorSessionWarning(null);
    setOverlapConflict(null);
    if (isInstructor && isFullDayLeave && sessions.length > 0) {
      setInstructorSessionWarning({
        detail: 'You have a scheduled session during this leave period:',
        sessions,
      });
      return;
    }
    setSubmitting(true);
    try {
      await createRequest(buildPayload());
      resetForm();
      onSuccess();
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.error === 'threshold_exceeded') {
        setThresholdExceeded(err.response.data);
      } else if (err.response?.status === 400 && err.response?.data?.error === 'overlapping_leave') {
        setOverlapConflict(err.response.data);
      } else {
        setError(extractApiError(err, 'Failed to submit request'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleInstructorWarningSubmit = async () => {
    setError('');
    setInstructorSessionWarning(null);
    setOverlapConflict(null);
    setSubmitting(true);
    try {
      await createRequest(buildPayload());
      resetForm();
      onSuccess();
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.error === 'overlapping_leave') {
        setOverlapConflict(err.response.data);
      } else {
        setError(extractApiError(err, 'Failed to submit request'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverrideSubmit = async () => {
    setError('');
    setInstructorSessionWarning(null);
    setOverlapConflict(null);
    setSubmitting(true);
    try {
      await createRequest({ ...buildPayload(), override: true });
      resetForm();
      onSuccess();
    } catch (err) {
      setThresholdExceeded(null);
      if (err.response?.status === 400 && err.response?.data?.error === 'overlapping_leave') {
        setOverlapConflict(err.response.data);
      } else {
        setError(extractApiError(err, 'Failed to submit request'));
      }
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

  let footerNode;
  if (thresholdExceeded) {
    footerNode = (
      <>
        <Button variant="tertiary" onClick={() => setThresholdExceeded(null)} disabled={submitting}>
          Go back
        </Button>
        <Button
          variant="warning"
          onClick={handleOverrideSubmit}
          disabled={submitting}
          className="ml-2"
        >
          {submitting ? <Spinner animation="border" size="sm" className="mr-2" /> : null}
          Submit anyway
        </Button>
      </>
    );
  } else if (instructorSessionWarning) {
    footerNode = (
      <>
        <Button
          variant="tertiary"
          onClick={() => setInstructorSessionWarning(null)}
          disabled={submitting}
        >
          Go back
        </Button>
        <Button
          variant="warning"
          onClick={handleInstructorWarningSubmit}
          disabled={submitting}
          className="ml-2"
        >
          {submitting ? <Spinner animation="border" size="sm" className="mr-2" /> : null}
          Submit anyway
        </Button>
      </>
    );
  } else {
    footerNode = (
      <>
        <Button variant="tertiary" onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={submitting || !isValid() || shouldAwaitInstructorSessionCheck}
          className="ml-2"
        >
          {submitting ? <Spinner animation="border" size="sm" className="mr-2" /> : null}
          Submit
        </Button>
      </>
    );
  }

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Request"
      footerNode={footerNode}
    >
      <div ref={topRef} />
      {thresholdExceeded && (
        <Alert variant="warning" className="mb-3">
          <strong>Leave threshold would be exceeded</strong>
          <p className="mb-1 mt-2" style={{ fontSize: 13 }}>{thresholdExceeded.detail}</p>
          <small className="text-muted">
            Current usage: {thresholdExceeded.current_usage} ·{' '}
            This request: {thresholdExceeded.prospective_usage} ·{' '}
            Threshold: {thresholdExceeded.threshold}
          </small>
        </Alert>
      )}
      {instructorSessionWarning && (
        <Alert variant="warning" className="mb-3">
          <strong>Scheduled sessions during leave</strong>
          <p className="mb-2 mt-2" style={{ fontSize: 13 }}>
            {instructorSessionWarning.detail}
          </p>
          <ul className="mb-2 pl-3" style={{ fontSize: 13 }}>
            {instructorSessionWarning.sessions.map((session) => (
              <li key={session.id}>
                {formatDateTimeWithAt(session.scheduled_start_time)}
                {' · '}
                {session.title}
              </li>
            ))}
          </ul>
          <p className="mb-0" style={{ fontSize: 13 }}>
            You can still submit this leave request if needed.
          </p>
        </Alert>
      )}
      {overlapConflict && (
        <Alert variant="danger" className="mb-3">
          <strong>Leave dates overlap</strong>
          <p className="mb-2 mt-2" style={{ fontSize: 13 }}>
            Your selected leave dates overlap with an existing leave request:
          </p>
          {Array.isArray(overlapConflict.overlapping_leaves)
            && overlapConflict.overlapping_leaves.length > 0 && (
            <ul className="mb-0 pl-3" style={{ fontSize: 13 }}>
              {overlapConflict.overlapping_leaves.map((leave) => (
                <li key={leave.id} className="mb-2">
                  <div>
                    <strong>
                      {LEAVE_CATEGORY_LABELS[leave.category] || leave.category || 'Leave'}
                      {' Leave'}
                    </strong>
                    {' · '}
                    {LEAVE_MODE_LABELS[leave.leave_type] || leave.leave_type}
                    {' · '}
                    {REQUEST_STATUS_LABELS[leave.status] || leave.status}
                  </div>
                  <div>
                    Date:
                    {' '}
                    {renderLeaveRange(leave)}
                  </div>
                  {leave.applied_on && (
                    <div>
                      Applied on:
                      {' '}
                      {formatDateTimeWithAt(leave.applied_on)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}
      {error && <Alert variant="danger" className="mb-3">{error}</Alert>}

      {/* Request type selector — hidden when opened from a specific tab */}
      {!lockedType && (
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
      )}

      {/* Leave category */}
      {typeSlug === REQUEST_TYPE.LEAVE && (
        <Form.Group className="mb-3">
          <Form.Label>Leave category <span className="text-danger">*</span></Form.Label>
          <Form.Control
            as="select"
            value={leaveCategory}
            onChange={(e) => setLeaveCategory(e.target.value)}
          >
            {LEAVE_CATEGORIES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Form.Control>
        </Form.Group>
      )}

      {/* Leave usage projection banner */}
      {typeSlug === REQUEST_TYPE.LEAVE && ownUsage && usageThreshold !== null && (
        <Alert
          variant={wouldExceed ? 'warning' : 'info'}
          className="mb-3 py-2"
          style={{ fontSize: 13 }}
        >
          You have used <strong>{ownUsage.total_leaves_availed}</strong> of{' '}
          <strong>{usageThreshold}</strong> allowed leaves.
          {' '}If approved, your total will be <strong>{projectedCount}</strong>.
          {wouldExceed && ' This exceeds your leave threshold.'}
        </Alert>
      )}

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

      {/* Graded activity warning */}
      {typeSlug === REQUEST_TYPE.LEAVE && gradedActivitiesInRange.length > 0 && (
        <Alert variant="warning" className="mb-3" style={{ fontSize: 13 }}>
          <strong>This leave period includes graded activity deadlines:</strong>
          <ul className="mb-0 mt-1 pl-3">
            {gradedActivitiesInRange.map((event) => (
              <li key={event.id}>
                <strong>{event.title}</strong>
                {' — '}{event.courseName}
                <span className="text-muted ml-1">
                  (due {new Date(`${event.date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                </span>
              </li>
            ))}
          </ul>
        </Alert>
      )}

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
        <Form.Label>
          Attachment
          {' '}
          {requiresAttachment
            ? <span className="text-danger">*</span>
            : <small className="text-muted">(optional)</small>}
        </Form.Label>
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
  lockedType: PropTypes.string,
};

CreateRequestModal.defaultProps = {
  lockedType: null,
};

export default CreateRequestModal;
