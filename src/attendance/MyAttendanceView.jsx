import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import {
  Alert, Badge, Container, DataTable, Spinner,
} from '@openedx/paragon';

import { getMyCourseAttendance } from './api';
import { fetchProgramCourses } from '../calendar/api';
import SearchableSelect from '../shared/SearchableSelect';
import { ATTENDANCE_STATUS } from '../shared/constants';
import { extractApiError, formatDateTime, getStatusVariant } from '../shared/utils';

const PAGE_SIZE = 25;
const NO_COURSE_VALUE = '__none__';

const CX = { cellClassName: 'text-center', headerClassName: 'justify-content-center' };

const SessionCell = ({ row }) => (
  <div>
    <div>{row.original.session_title || '—'}</div>
    <small className="text-muted">{formatDateTime(row.original.session_date)}</small>
  </div>
);
SessionCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      session_title: PropTypes.string,
      session_date: PropTypes.string,
    }).isRequired,
  }).isRequired,
};

// Every row carries a derived status — an unmarked session reads "Pending",
// the same word the admin By-Learner tab uses for it.
const StatusCell = ({ value }) => (
  <Badge variant={getStatusVariant(value)}>
    {ATTENDANCE_STATUS[value] || value}
  </Badge>
);
StatusCell.propTypes = { value: PropTypes.string.isRequired };

const NotesCell = ({ row }) => (
  row.original.is_overridden && row.original.override_reason
    ? <small className="text-muted">{row.original.override_reason}</small>
    : null
);
NotesCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      is_overridden: PropTypes.bool,
      override_reason: PropTypes.string,
    }).isRequired,
  }).isRequired,
};

const COLUMNS = [
  { Header: 'Session', accessor: 'session_title', Cell: SessionCell },
  {
    Header: 'Status', accessor: 'status', Cell: StatusCell, ...CX,
  },
  {
    Header: 'Notes', accessor: 'override_reason', Cell: NotesCell, ...CX,
  },
];

const MyAttendanceView = () => {
  const { programId } = useParams();

  const [error, setError] = useState('');

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [rows, setRows] = useState([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [rowCount, setRowCount] = useState(0);

  useEffect(() => {
    if (!programId) { return () => {}; }
    let cancelled = false;
    (async () => {
      try {
        const coursesData = await fetchProgramCourses(programId);
        if (cancelled) { return; }
        setCourses((coursesData || []).map((c) => ({ id: c.course_key, title: c.display_name })));
      } catch (err) {
        if (!cancelled) { setError(extractApiError(err, 'Failed to load your courses')); }
      } finally {
        if (!cancelled) { setCoursesLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [programId]);

  // Server-paged fetch of the learner's own derived attendance, for the
  // selected course or for the programme's course-less events (seminars,
  // workshops, conferences — `course_id=""`). One row per completed session
  // with its status already resolved server-side, so the page never merges two
  // sources and never depends on holding the learner's whole history. Paragon's
  // DataTable calls this on mount and on every page change (manualPagination);
  // key={selectedCourseId} remounts the table on selection change, re-firing it
  // for page 1.
  const fetchRows = useCallback(async ({ pageIndex: nextIndex = 0 } = {}) => {
    setRowsLoading(true);
    setRowsError('');
    try {
      const courseKey = selectedCourseId === NO_COURSE_VALUE ? '' : selectedCourseId;
      const data = await getMyCourseAttendance(programId, courseKey, {
        page: nextIndex + 1,
        pageSize: PAGE_SIZE,
      });
      setRows(data.results ?? []);
      setRowCount(data.count ?? 0);
      setPageIndex(nextIndex);
    } catch (err) {
      setRowsError(extractApiError(err, 'Failed to load your attendance'));
    } finally {
      setRowsLoading(false);
    }
  }, [programId, selectedCourseId]);

  const courseOptions = useMemo(() => {
    const opts = courses.map((c) => ({ value: c.id, label: c.title || c.id }));
    opts.unshift({ value: NO_COURSE_VALUE, label: 'Sessions without a course' });
    return opts;
  }, [courses]);

  const selectedCourseOption = useMemo(
    () => courseOptions.find((o) => o.value === selectedCourseId) || null,
    [courseOptions, selectedCourseId],
  );

  const pageCount = Math.max(1, Math.ceil(rowCount / PAGE_SIZE));

  if (coursesLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Loading your attendance...</p>
      </Container>
    );
  }

  return (
    <Container className="py-3">
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {rowsError && (
        <Alert variant="danger" dismissible onClose={() => setRowsError('')}>
          {rowsError}
        </Alert>
      )}

      <div className="mb-4" style={{ maxWidth: 400 }}>
        <SearchableSelect
          id="my-attendance-course"
          label="Course"
          options={courseOptions}
          value={selectedCourseOption}
          onChange={(opt) => {
            setSelectedCourseId(opt?.value || '');
            setRows([]);
            setRowCount(0);
            setPageIndex(0);
          }}
          loading={coursesLoading}
          placeholder="Select a course…"
        />
      </div>

      {!selectedCourseId && (
        <Alert variant="info">Select a course above to see your attendance.</Alert>
      )}

      {selectedCourseId && rowsLoading && (
        <div className="text-center py-4">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Loading sessions…</p>
        </div>
      )}

      {/* Server-paged table, for a course or for the programme's course-less
          events. It stays mounted while loading — unmounting would re-fire
          Paragon's fetchData effect (see PerSessionReport). The spinner above
          renders alongside the table, not instead of it. */}
      {selectedCourseId && (
        <DataTable
          key={selectedCourseId}
          isPaginated
          manualPagination
          fetchData={fetchRows}
          pageCount={pageCount}
          itemCount={rowCount}
          data={rows}
          columns={COLUMNS}
          initialState={{ pageIndex, pageSize: PAGE_SIZE }}
        >
          <DataTable.Table />
          <DataTable.EmptyTable content="No sessions found yet." />
          <DataTable.TableFooter />
        </DataTable>
      )}
    </Container>
  );
};

export default MyAttendanceView;
