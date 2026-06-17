import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Button, Form, Spinner, StandardModal,
} from '@openedx/paragon';

import {
  updateSession, fetchCourseRuns, fetchAllInstructors,
} from '../calendar/api';
import { assignSubstitute } from './api';
import { extractApiError } from '../shared/utils';
import SearchableSelect from '../shared/SearchableSelect';

const AssignSubstituteModal = ({
  isOpen, onClose, substituteRequest, onSuccess,
}) => {
  const session = substituteRequest?.session ?? null;

  const [title, setTitle] = useState('');
  const [selectedCourseRun, setSelectedCourseRun] = useState(null);
  const [selectedInstructors, setSelectedInstructors] = useState([]);

  const [courseRunOptions, setCourseRunOptions] = useState([]);
  const [courseRunsLoading, setCourseRunsLoading] = useState(false);
  const [instructorOptions, setInstructorOptions] = useState([]);
  const [instructorsLoading, setInstructorsLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
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

    setCourseRunsLoading(true);
    fetchCourseRuns()
      .then((data) => setCourseRunOptions(
        (data || []).map((c) => ({ value: c.id, label: c.title || c.id })),
      ))
      .catch(() => {})
      .finally(() => setCourseRunsLoading(false));

    setInstructorsLoading(true);
    fetchAllInstructors()
      .then((data) => setInstructorOptions(
        (data || []).map((i) => ({ value: i.email, label: i.name ? `${i.name} (${i.email})` : i.email })),
      ))
      .catch(() => {})
      .finally(() => setInstructorsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const instructorChanged = useMemo(() => {
    const current = selectedInstructors.map((i) => i.value).sort().join(',');
    return current !== originalEmails.join(',');
  }, [selectedInstructors, originalEmails]);

  const isValid = selectedInstructors.length > 0 && instructorChanged;

  const handleAssign = async () => {
    setError('');
    setSubmitting(true);
    try {
      await updateSession(session.id, {
        title,
        ...(selectedCourseRun ? { course_id: selectedCourseRun.value } : {}),
        instructor_emails: selectedInstructors.map((i) => i.value),
      });
      await assignSubstitute(substituteRequest.id, selectedInstructors[0].value);
      onSuccess();
    } catch (err) {
      setError(extractApiError(err, 'Failed to assign substitute'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Substitute"
      footerNode={(
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

      {/* Highlight on-leave instructors in red */}
      {session?.instructor_emails?.length > 0 && (
        <div
          className="mb-3 p-2"
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 4,
          }}
        >
          <div
            style={{
              fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 4,
            }}
          >
            Current instructor(s) on leave:
          </div>
          {session.instructor_emails.map((email) => (
            <div key={email} style={{ fontSize: 12, color: '#dc2626' }}>• {email}</div>
          ))}
          <div style={{ fontSize: 11, color: '#991b1b', marginTop: 4 }}>
            Update the instructor(s) below to assign a substitute.
          </div>
        </div>
      )}

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
        options={instructorOptions}
        value={selectedInstructors}
        onChange={setSelectedInstructors}
        multiple
        placeholder="Search by name or email..."
        loading={instructorsLoading}
        isInvalid={!instructorChanged && selectedInstructors.length > 0}
      />
      {!instructorChanged && selectedInstructors.length > 0 && (
        <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>
          Please assign a different instructor to enable saving.
        </div>
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
      instructor_emails: PropTypes.arrayOf(PropTypes.string),
    }),
  }),
  onSuccess: PropTypes.func.isRequired,
};

AssignSubstituteModal.defaultProps = {
  substituteRequest: null,
};

export default AssignSubstituteModal;
