import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import {
  Alert, Badge, Container, DataTable, Spinner,
} from '@openedx/paragon';

import { getTraineeAttendance } from './api';
import SearchableSelect from '../shared/SearchableSelect';
import { fetchProgramCourses, fetchProgramLearners } from '../calendar/api';
import { ATTENDANCE_STATUS } from '../shared/constants';
import { extractApiError, formatDateTime, getStatusVariant } from '../shared/utils';

const PAGE_SIZE = 50;

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

const StatusCell = ({ value }) => (
  <Badge variant={getStatusVariant(value)}>
    {ATTENDANCE_STATUS[value] || value}
  </Badge>
);
StatusCell.propTypes = { value: PropTypes.string };
StatusCell.defaultProps = { value: '' };

const SourceCell = ({ value }) => (
  value
    ? <Badge variant="light">{value}</Badge>
    : <span className="text-muted">—</span>
);
SourceCell.propTypes = { value: PropTypes.string };
SourceCell.defaultProps = { value: '' };

const OverrideCell = ({ row }) => (
  row.original.is_overridden && row.original.override_reason
    ? <small className="text-muted">{row.original.override_reason}</small>
    : null
);
OverrideCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      is_overridden: PropTypes.bool,
      override_reason: PropTypes.string,
    }),
  }).isRequired,
};

const MarkedByCell = ({ row }) => (
  <small className="text-muted">{row.original.overridden_by_email || '—'}</small>
);
MarkedByCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({ overridden_by_email: PropTypes.string }),
  }).isRequired,
};

const COLUMNS = [
  { Header: 'Session', accessor: 'session_title', Cell: SessionCell },
  { Header: 'Status', accessor: 'status', Cell: StatusCell },
  { Header: 'Source', accessor: 'source', Cell: SourceCell },
  { Header: 'Override reason', accessor: 'override_reason', Cell: OverrideCell },
  { Header: 'Marked by', id: 'marked_by', Cell: MarkedByCell },
];

const PerLearnerView = () => {
  const { programId } = useParams();
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
        courseId: cid,
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
  }, []);

  const handleLearnerChange = (option) => {
    const uid = option?.value || '';
    selectedUserIdRef.current = uid;
    setSelectedUserId(uid);
    setPageIndex(0);
    setRecords([]);
    setCount(0);
  };

  const courseOptions = useMemo(() => courses.map((c) => ({
    value: c.id,
    label: c.title || `Course ${c.id}`,
  })), [courses]);

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

      {selectedUserId && recordsLoading && (
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
          data={records}
          columns={COLUMNS}
          initialState={{ pageIndex, pageSize: PAGE_SIZE }}
        >
          <DataTable.Table />
          <DataTable.EmptyTable content="No records" />
          <DataTable.TableFooter />
        </DataTable>
      )}
    </Container>
  );
};

export default PerLearnerView;
