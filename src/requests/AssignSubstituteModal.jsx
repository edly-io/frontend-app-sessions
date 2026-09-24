import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Button, Form, Spinner, StandardModal,
} from '@openedx/paragon';

import {
  updateSession, fetchProgramCourses, fetchProgramInstructors, cancelSession,
} from '../calendar/api';
import { assignSubstitute, closeSubstituteRequest, getApprovedLeaves } from './api';
import { extractApiError, formatDateTime } from '../shared/utils';
import SearchableSelect from '../shared/SearchableSelect';

const formatInstructorLabel = (i) => {
  const fullName = `${i.first_name || ''} ${i.last_name || ''}`.trim();
  return fullName ? `${fullName} (${i.email})` : i.email;
};

const AssignSubstituteModal = ({
  isOpen, onClose, substituteRequest, programKey, onSuccess,
}) => {
  const session = substituteRequest?.session ?? null;
  const isSessionType = (session?.session_type || 'session') === 'session';
  const sessionDate = session?.scheduled_start_time
    ? session.scheduled_start_time.slice(0, 10)
    : null;

  const [title, setTitle] = useState('');
  const [selectedCourseRun, setSelectedCourseRun] = useState(null);
  const [selectedInstructors, setSelectedInstructors] = useState([]);

  const [courseRunOptions, setCourseRunOptions] = useState([]);
  const [courseRunsLoading, setCourseRunsLoading] = useState(false);
  const [instructorOptions, setInstructorOptions] = useState([]);
  const [instructorsLoading, setInstructorsLoading] = useState(false);
  const [onLeaveEmails, setOnLeaveEmails] = useState(new Set());

  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  // Original instructor emails — used to detect whether the user has changed the selection.
  const [originalEmails, setOriginalEmails] = useState([]);

  useEffect(() => {
    if (!isOpen || !session) { return; }

    const emails = session.instructor_emails || [];
    setTitle(session.title || '');
    setSelectedCourseRun(
      session.course_id
        ? { value: session.course_id, label: session.course_name || session.course_id }
        : null,
    );
    setSelectedInstructors(emails.map((e) => ({ value: e, label: e })));
    setOriginalEmails([...emails].sort());
    setError('');

    if (!programKey) { return; }

    setCourseRunsLoading(true);
    fetchProgramCourses(programKey)
      .then((data) => setCourseRunOptions(
        (data || []).map((c) => ({ value: c.course_key, label: c.display_name || c.course_key })),
      ))
      .catch(() => {})
      .finally(() => setCourseRunsLoading(false));

    // Approved leaves scoped to this program — used to exclude instructors
    // who are themselves on leave on the session's date.
    getApprovedLeaves({ program_key: programKey })
      .then((leaves) => {
        if (!sessionDate) { setOnLeaveEmails(new Set()); return; }
        const conflicting = (leaves || []).filter((leave) => {
          if (!leave.leave_start_date || !leave.leave_end_date) { return false; }
          return sessionDate >= leave.leave_start_date && sessionDate <= leave.leave_end_date;
        });
        setOnLeaveEmails(new Set(conflicting.map((l) => l.submitter_email).filter(Boolean)));
      })
      .catch(() => setOnLeaveEmails(new Set()));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Refetch instructor pool whenever the course changes. Mirrors ScheduleMeetingModal:
  // lecture-type sessions require a course before showing anyone; other types
  // list all city instructors when no course is picked, but scope to the course
  // team as soon as one is.
  const selectedCourseRunId = selectedCourseRun?.value ?? null;
  useEffect(() => {
    if (!isOpen || !programKey) { return; }
    if (!selectedCourseRunId && isSessionType) {
      setInstructorOptions([]);
      return;
    }
    setInstructorsLoading(true);
    fetchProgramInstructors(programKey, selectedCourseRunId)
      .then((data) => setInstructorOptions(
        (data || []).map((i) => ({
          value: i.email,
          label: formatInstructorLabel(i),
        })),
      ))
      .catch(() => {})
      .finally(() => setInstructorsLoading(false));
  }, [isOpen, programKey, selectedCourseRunId, isSessionType]);

  // Available substitutes = fetched pool minus anyone on approved leave that day.
  const availableInstructorOptions = useMemo(
    () => instructorOptions.filter((opt) => !onLeaveEmails.has(opt.value)),
    [instructorOptions, onLeaveEmails],
  );

  // All course/city instructors are on approved leave on this date — nothing to
  // offer. Note: this is only meaningful once the pool has actually loaded.
  const allOnLeave = !instructorsLoading
    && instructorOptions.length > 0
    && availableInstructorOptions.length === 0;

  const instructorChanged = useMemo(() => {
    const current = selectedInstructors.map((i) => i.value).sort().join(',');
    return current !== originalEmails.join(',');
  }, [selectedInstructors, originalEmails]);

  const isValid = selectedInstructors.length > 0
    && instructorChanged
    && !selectedInstructors.some((i) => onLeaveEmails.has(i.value));

  const handleAssign = async () => {
    setError('');
    setSubmitting(true);
    try {
      await updateSession(session.id, {
        title,
        ...(selectedCourseRun ? { course_id: selectedCourseRun.value } : {}),
        instructor_emails: selectedInstructors.map((i) => i.value),
      });
      // Use the first newly-added instructor as the substitute, not the original.
      // If the admin added a new sub without removing the original, [0] would
      // still be the original instructor — so pick the first one not in originalEmails.
      const addedInstructor = selectedInstructors.find((i) => !originalEmails.includes(i.value));
      const substituteEmail = (addedInstructor || selectedInstructors[0]).value;
      await assignSubstitute(substituteRequest.id, substituteEmail);
      onSuccess();
    } catch (err) {
      setError(extractApiError(err, 'Failed to assign substitute'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSession = async () => {
    setError('');
    setCancelling(true);
    try {
      await cancelSession(session.id);
      await closeSubstituteRequest(substituteRequest.id);
      onSuccess();
    } catch (err) {
      setError(extractApiError(err, 'Failed to cancel session'));
    } finally {
      setCancelling(false);
    }
  };

  const courseName = selectedCourseRun?.label
    || session?.course_name
    || (session?.course_id ? session.course_id : '');

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Substitute"
      isFullscreenOnMobile
      footerNode={allOnLeave ? (
        <>
          <Button variant="tertiary" onClick={onClose} disabled={cancelling}>
            Close
          </Button>
          <Button
            variant="danger"
            onClick={handleCancelSession}
            disabled={cancelling}
            className="ml-2"
          >
            {cancelling ? <Spinner animation="border" size="sm" className="mr-2" /> : null}
            Cancel Session
          </Button>
        </>
      ) : (
        <>
          <Button variant="tertiary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAssign}
            disabled={submitting || !isValid}
            className="ml-2"
          >
            {submitting ? <Spinner animation="border" size="sm" className="mr-2" /> : null}
            Assign Substitute
          </Button>
        </>
      )}
    >
      {error && <Alert variant="danger" className="mb-3">{error}</Alert>}

      {/* Session summary — the admin needs to know which class they're covering */}
      {session && (
        <div className="mb-3 p-3 assign-substitute-modal__session-summary">
          <div className="font-weight-bold mb-1">{session.title}</div>
          {courseName && (
            <div className="assign-substitute-modal__session-summary-line">
              <span className="text-muted">Course: </span>
              <strong>{courseName}</strong>
            </div>
          )}
          {session.scheduled_start_time && (
            <div className="assign-substitute-modal__session-summary-line text-muted">
              {formatDateTime(session.scheduled_start_time)}
            </div>
          )}
        </div>
      )}

      {/* Highlight on-leave instructors in red */}
      {session?.instructor_emails?.length > 0 && (
        <div className="assign-substitute-modal__on-leave-banner mb-3 p-2">
          <div className="assign-substitute-modal__on-leave-title">
            Current instructor(s) on leave:
          </div>
          {session.instructor_emails.map((email) => (
            <div key={email} className="assign-substitute-modal__on-leave-email">• {email}</div>
          ))}
          <div className="assign-substitute-modal__on-leave-hint">
            Update the instructor(s) below to assign a substitute.
          </div>
        </div>
      )}

      {allOnLeave && (
        <Alert variant="warning" className="mb-0">
          <strong>No substitutes available.</strong> All instructors
          {selectedCourseRun ? (
            <> assigned to <strong>{selectedCourseRun.label}</strong></>
          ) : (
            <> in this program</>
          )}
          {' '}are on approved leave on this date. Cancel the session to close
          this request.
        </Alert>
      )}

      {!allOnLeave && (
        <>
          <Form.Group className="mb-3">
            <Form.Label>Session title</Form.Label>
            <Form.Control
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Form.Group>

          <SearchableSelect
            id="assign-course-run"
            label="Course"
            options={courseRunOptions}
            value={selectedCourseRun}
            onChange={setSelectedCourseRun}
            placeholder="Search by course title..."
            loading={courseRunsLoading}
          />

          <SearchableSelect
            id="assign-instructors"
            label="Instructor(s)"
            options={availableInstructorOptions}
            value={selectedInstructors}
            onChange={setSelectedInstructors}
            multiple
            placeholder={
              isSessionType && !selectedCourseRun
                ? 'Select a course first'
                : 'Search by name or email...'
            }
            loading={instructorsLoading}
            disabled={isSessionType && !selectedCourseRun}
            isInvalid={!instructorChanged && selectedInstructors.length > 0}
          />
          <small className="text-muted d-block assign-substitute-modal__scope-hint">
            {selectedCourseRun ? (
              <>Only instructors assigned to <strong>{selectedCourseRun.label}</strong> are shown.</>
            ) : (
              <>Only instructors from the program&apos;s city are shown.</>
            )}
            {' '}Instructors on approved leave on this date are excluded.
          </small>
          {!instructorChanged && selectedInstructors.length > 0 && (
            <div className="assign-substitute-modal__validation-error">
              Please assign a different instructor to enable saving.
            </div>
          )}
        </>
      )}
    </StandardModal>
  );
};

AssignSubstituteModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  substituteRequest: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    substitute_instructor_email: PropTypes.string,
    session: PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      title: PropTypes.string,
      course_id: PropTypes.string,
      course_name: PropTypes.string,
      session_type: PropTypes.string,
      scheduled_start_time: PropTypes.string,
      instructor_emails: PropTypes.arrayOf(PropTypes.string),
    }),
  }),
  programKey: PropTypes.string,
  onSuccess: PropTypes.func.isRequired,
};

AssignSubstituteModal.defaultProps = {
  substituteRequest: null,
  programKey: '',
};

export default AssignSubstituteModal;
