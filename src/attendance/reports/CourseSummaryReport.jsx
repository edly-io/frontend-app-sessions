import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  Alert, Container, DataTable, Form, Spinner,
} from '@openedx/paragon';

import SearchableSelect from '../../shared/SearchableSelect';
import { fetchProgramCourses } from '../../calendar/api';
import { extractApiError } from '../../shared/utils';

// ─── Default date range helpers ───────────────────────────────────────────────

const toDateInput = (date) => date.toISOString().slice(0, 10);

const getDefaultDates = () => {
  const end = new Date();
  const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
  return { start: toDateInput(start), end: toDateInput(end) };
};

// ─── Cell renderers ──────────────────────────────────────────────────────────

const LearnerCell = ({ row }) => (
  <div>
    <div>{row.original.full_name || row.original.email}</div>
    {row.original.full_name && (
      <small className="text-muted">{row.original.email}</small>
    )}
  </div>
);
LearnerCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      full_name: PropTypes.string,
      email: PropTypes.string,
    }),
  }).isRequired,
};

const RateCell = ({ value }) => {
  const pct = Math.round((value ?? 0) * 100);
  let variant = 'success';
  if (pct < 75) {
    variant = 'danger';
  } else if (pct < 90) {
    variant = 'warning';
  }
  return (
    <span className={`text-${variant} font-weight-bold`}>{pct}%</span>
  );
};
RateCell.propTypes = { value: PropTypes.number };
RateCell.defaultProps = { value: 0 };

const COLUMNS = [
  { Header: 'Learner', accessor: 'full_name', Cell: LearnerCell },
  { Header: 'Sessions', accessor: 'total' },
  { Header: 'Present', accessor: 'present' },
  { Header: 'Absent', accessor: 'absent' },
  { Header: 'Late', accessor: 'late' },
  { Header: 'Left Early', accessor: 'left_early' },
  { Header: 'Partial', accessor: 'partial' },
  { Header: 'Attendance %', accessor: 'rate', Cell: RateCell },
];

// ─── Component ───────────────────────────────────────────────────────────────

const CourseSummaryReport = () => {
  const { programId } = useParams();
  const defaults = getDefaultDates();

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState('');

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);

  const [rows, setRows] = useState([]);
  const [sessionCount, setSessionCount] = useState(null);
  const [summaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  // Load course list for the picker.
  useEffect(() => {
    if (!programId) { return () => {}; }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchProgramCourses(programId);
        if (cancelled) { return; }
        setCourses((data || []).map((c) => ({ id: c.course_key, title: c.display_name })));
      } catch (err) {
        if (!cancelled) { setCoursesError(extractApiError(err, 'Failed to load courses')); }
      } finally {
        if (!cancelled) { setCoursesLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [programId]);

  const loadSummary = useCallback(async (courseId) => {
    if (!courseId) { return; }
    setSummaryError('This report is no longer available.');
  }, []);

  const handleCourseChange = (option) => {
    const courseId = option?.value || '';
    setSelectedCourseId(courseId);
    setRows([]);
    setSessionCount(null);
    if (courseId) {
      loadSummary(courseId);
    }
  };

  const courseOptions = useMemo(() => courses.map((c) => ({
    value: c.id,
    label: c.title || `Course ${c.id}`,
  })), [courses]);

  const selectedCourseOption = useMemo(() => (
    courseOptions.find((o) => o.value === selectedCourseId) || null
  ), [courseOptions, selectedCourseId]);

  const handleDateChange = (field) => (e) => {
    const val = e.target.value;
    if (field === 'start') {
      setStartDate(val);
    } else {
      setEndDate(val);
    }
    if (selectedCourseId) {
      loadSummary(selectedCourseId);
    }
  };

  return (
    <Container className="py-3">
      <h3 className="mb-1">Course Attendance Summary</h3>
      <p className="text-muted mb-3">
        Aggregated attendance per learner for a course over a date range —
        present / absent / late counts and overall attendance percentage. Sort
        by percentage to surface the lowest attenders first.
      </p>

      {coursesError && (
        <Alert variant="danger" dismissible onClose={() => setCoursesError('')}>
          {coursesError}
        </Alert>
      )}
      {summaryError && (
        <Alert variant="danger" dismissible onClose={() => setSummaryError('')}>
          {summaryError}
        </Alert>
      )}

      {/* Filters row */}
      <div className="d-flex flex-wrap mb-4" style={{ gap: 16 }}>
        <div style={{ minWidth: 280, maxWidth: 360, flex: '1 1 280px' }}>
          <SearchableSelect
            id="summary-course"
            label="Course"
            options={courseOptions}
            value={selectedCourseOption}
            onChange={handleCourseChange}
            loading={coursesLoading}
            placeholder="Search courses…"
          />
        </div>

        <Form.Group controlId="summary-start" style={{ minWidth: 160 }}>
          <Form.Label>From</Form.Label>
          <Form.Control
            type="date"
            value={startDate}
            onChange={handleDateChange('start')}
          />
        </Form.Group>

        <Form.Group controlId="summary-end" style={{ minWidth: 160 }}>
          <Form.Label>To</Form.Label>
          <Form.Control
            type="date"
            value={endDate}
            onChange={handleDateChange('end')}
          />
        </Form.Group>
      </div>

      {!selectedCourseId && !coursesLoading && (
        <Alert variant="info">Select a course to see the attendance summary.</Alert>
      )}

      {selectedCourseId && summaryLoading && (
        <div className="text-center py-4">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Loading summary…</p>
        </div>
      )}

      {selectedCourseId && !summaryLoading && rows.length === 0 && (
        <Alert variant="info">No attendance records for this course in the selected date range.</Alert>
      )}

      {selectedCourseId && !summaryLoading && rows.length > 0 && (
        <>
          {sessionCount !== null && (
            <p className="text-muted mb-2">
              <strong>{sessionCount}</strong> session{sessionCount !== 1 ? 's' : ''} in range
            </p>
          )}
          <DataTable
            isSortable
            data={rows}
            columns={COLUMNS}
            itemCount={rows.length}
            initialState={{ sortBy: [{ id: 'rate', desc: false }] }}
          >
            <DataTable.Table />
            <DataTable.EmptyTable content="No learners" />
          </DataTable>
        </>
      )}
    </Container>
  );
};

export default CourseSummaryReport;
