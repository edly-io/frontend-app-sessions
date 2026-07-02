import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  Alert, Container, DataTable, Spinner,
} from '@openedx/paragon';

import SearchableSelect from '../../shared/SearchableSelect';
import { fetchProgramCourses } from '../../calendar/api';
import { getCourseSummary } from '../api';
import { extractApiError } from '../../shared/utils';

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
  const pct = Math.round((value ?? 0));
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
  { Header: 'Leave', accessor: 'leave' },
  { Header: 'Pending', accessor: 'pending' },
  { Header: 'Attendance %', accessor: 'attendance_rate', Cell: RateCell },
];

// ─── Component ───────────────────────────────────────────────────────────────

const CourseSummaryReport = () => {
  const { programId } = useParams();

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState('');

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [rows, setRows] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');

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
    setSummaryLoading(true);
    setSummaryError('');
    setRows([]);
    try {
      const data = await getCourseSummary(courseId);
      setRows(Array.isArray(data) ? data : data.results ?? []);
    } catch (err) {
      setSummaryError(extractApiError(err, 'Failed to load summary'));
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const handleCourseChange = (option) => {
    const courseId = option?.value || '';
    setSelectedCourseId(courseId);
    setRows([]);
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

  return (
    <Container className="py-3">
      <h3 className="mb-1">Course Attendance Summary</h3>
      <p className="text-muted mb-3">
        Aggregated attendance per learner for a course — present / absent / leave /
        pending counts and attendance percentage across all completed sessions.
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

      <div className="mb-4" style={{ minWidth: 280, maxWidth: 400 }}>
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
        <Alert variant="info">No attendance data for this course yet.</Alert>
      )}

      {selectedCourseId && !summaryLoading && rows.length > 0 && (
        <DataTable
          isSortable
          data={rows}
          columns={COLUMNS}
          itemCount={rows.length}
          initialState={{ sortBy: [{ id: 'attendance_rate', desc: false }] }}
        >
          <DataTable.Table />
          <DataTable.EmptyTable content="No learners" />
        </DataTable>
      )}
    </Container>
  );
};

export default CourseSummaryReport;
