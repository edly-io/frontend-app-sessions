import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Badge, Container, DataTable, Spinner,
} from '@openedx/paragon';

import { getAttendanceRecordsPage, getCourseEnrolledLearners } from '../api';
import SearchableSelect from '../../shared/SearchableSelect';
import { fetchCourseRuns } from '../../calendar/api';
import { ATTENDANCE_STATUS } from '../../shared/constants';
import { extractApiError, formatDateTime, getStatusVariant } from '../../shared/utils';

const PAGE_SIZE = 50;

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

const StatusCell = ({ value }) => (
  <Badge variant={getStatusVariant(value)}>
    {ATTENDANCE_STATUS[value] || value}
  </Badge>
);
StatusCell.propTypes = { value: PropTypes.string };
StatusCell.defaultProps = { value: '' };

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

const MarkedAtCell = ({ row }) => (
  <small className="text-muted">
    {row.original.overridden_at ? formatDateTime(row.original.overridden_at) : '—'}
  </small>
);
MarkedAtCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({ overridden_at: PropTypes.string }),
  }).isRequired,
};

const COLUMNS = [
  { Header: 'Session', accessor: 'session_title', Cell: SessionCell },
  { Header: 'Status', accessor: 'status', Cell: StatusCell },
  { Header: 'Override reason', accessor: 'override_reason', Cell: OverrideCell },
  { Header: 'Marked by', id: 'marked_by', Cell: MarkedByCell },
  { Header: 'Marked at', id: 'marked_at', Cell: MarkedAtCell },
];

// ─── Component ───────────────────────────────────────────────────────────────

const PerLearnerHistoryReport = () => {
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

  // Load all course runs for the course picker.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCourseRuns();
        if (cancelled) { return; }
        const results = Array.isArray(data) ? data : data.results ?? [];
        setCourses(results);
      } catch (err) {
        if (!cancelled) { setCoursesError(extractApiError(err, 'Failed to load courses')); }
      } finally {
        if (!cancelled) { setCoursesLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load learners for the selected course.
  const loadLearners = useCallback(async (courseKey) => {
    setLearnersLoading(true);
    setLearnersError('');
    setLearners([]);
    setSelectedUserId('');
    setRecords([]);
    setCount(0);
    try {
      const data = await getCourseEnrolledLearners(courseKey);
      const results = Array.isArray(data) ? data : data.results ?? [];
      setLearners(results);
    } catch (err) {
      setLearnersError(extractApiError(err, 'Failed to load learners'));
    } finally {
      setLearnersLoading(false);
    }
  }, []);

  const handleCourseChange = (option) => {
    const courseKey = option?.value || '';
    // Clear user ref when course changes so handleFetchData won't fire for a stale user.
    selectedCourseIdRef.current = courseKey;
    selectedUserIdRef.current = '';
    setSelectedCourseId(courseKey);
    if (courseKey) {
      loadLearners(courseKey);
    } else {
      setLearners([]);
      setSelectedUserId('');
      setRecords([]);
      setCount(0);
    }
  };

  // Stable fetchData — empty deps so Paragon's DataTable useEffect never re-fires
  // due to a reference change. Reads user/course IDs from refs so we don't close over
  // state values (which would produce a new function on every selection change).
  const handleFetchData = useCallback(async ({ pageIndex: nextPageIndex = 0 } = {}) => {
    const uid = selectedUserIdRef.current;
    const cid = selectedCourseIdRef.current;
    if (!uid || !cid) { return; }
    setRecordsLoading(true);
    setRecordsError('');
    try {
      const data = await getAttendanceRecordsPage({
        userId: uid,
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
    // Update ref synchronously before state so handleFetchData sees the new value
    // when Paragon's useEffect fires on DataTable mount.
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

  const learnerOptions = useMemo(() => learners.map((l) => ({
    value: l.user_id,
    label: l.full_name ? `${l.full_name} (${l.email})` : l.email,
  })), [learners]);

  const selectedLearnerOption = useMemo(() => (
    learnerOptions.find((o) => o.value === selectedUserId) || null
  ), [learnerOptions, selectedUserId]);

  return (
    <Container className="py-3">
      <h3 className="mb-1">Per-Learner Attendance History</h3>
      <p className="text-muted mb-3">
        Pick a course and a learner to see every session they were marked for, in
        chronological order. Use this view to investigate a single learner&apos;s
        attendance pattern across the term.
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

      {/* DataTable must stay mounted while records are loading — see PerSessionReport
          for the full explanation of why !recordsLoading and count>0 cannot gate
          the DataTable. Rendering it unconditionally (when a learner is selected)
          means Paragon fires fetchData on mount — that is the initial fetch trigger.
          key={selectedUserId} forces a clean remount on learner change.
          DataTable.EmptyTable handles the "no records" state when data=[] */}
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

export default PerLearnerHistoryReport;
