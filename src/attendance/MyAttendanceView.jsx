import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import {
  Alert, Badge, Container, DataTable, Spinner,
} from '@openedx/paragon';

import { getCourseSessionsList, getMyAttendanceRecords } from './api';
import { fetchProgramCourses } from '../calendar/api';
import SearchableSelect from '../shared/SearchableSelect';
import { ATTENDANCE_STATUS } from '../shared/constants';
import { extractApiError, formatDateTime, getStatusVariant } from '../shared/utils';

const PAGE_SIZE = 25;
const NO_COURSE_VALUE = '__none__';

const CX = { cellClassName: 'text-center', headerClassName: 'justify-content-center' };

const SessionCell = ({ row }) => (
  <div>
    <div>{row.original.title || '—'}</div>
    <small className="text-muted">{formatDateTime(row.original.scheduled_start_time)}</small>
  </div>
);
SessionCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      title: PropTypes.string,
      scheduled_start_time: PropTypes.string,
    }).isRequired,
  }).isRequired,
};

const StatusCell = ({ value }) => (
  value
    ? (
      <Badge variant={getStatusVariant(value)}>
        {ATTENDANCE_STATUS[value] || value}
      </Badge>
    )
    : <span className="text-muted">Not marked</span>
);
StatusCell.propTypes = { value: PropTypes.string };
StatusCell.defaultProps = { value: '' };

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
  { Header: 'Session', accessor: 'title', Cell: SessionCell },
  {
    Header: 'Status', accessor: 'attendance_status', Cell: StatusCell, ...CX,
  },
  {
    Header: 'Notes', accessor: 'override_reason', Cell: NotesCell, ...CX,
  },
];

const MyAttendanceView = () => {
  const { programId } = useParams();

  const [allRecords, setAllRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [error, setError] = useState('');

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState('');
  const [sessionPageIndex, setSessionPageIndex] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    if (!programId) { return () => {}; }
    let cancelled = false;
    (async () => {
      try {
        const [recordsData, coursesData] = await Promise.all([
          getMyAttendanceRecords({ pageSize: 500 }),
          fetchProgramCourses(programId).catch(() => []),
        ]);
        if (cancelled) { return; }
        setAllRecords(Array.isArray(recordsData) ? recordsData : recordsData.results ?? []);
        setCourses((coursesData || []).map((c) => ({ id: c.course_key, title: c.display_name })));
      } catch (err) {
        if (!cancelled) { setError(extractApiError(err, 'Failed to load your attendance')); }
      } finally {
        if (!cancelled) {
          setRecordsLoading(false);
          setCoursesLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [programId]);

  // Server-paged fetch for the selected course. Paragon's DataTable calls this
  // on mount and on every page change (manualPagination); key={selectedCourseId}
  // remounts the table on course change, re-firing it for page 1.
  const fetchSessions = useCallback(async ({ pageIndex: nextIndex = 0 } = {}) => {
    setSessionsLoading(true);
    setSessionsError('');
    try {
      const data = await getCourseSessionsList(selectedCourseId, programId, {
        page: nextIndex + 1,
        pageSize: PAGE_SIZE,
      });
      setSessions(data.results ?? []);
      setSessionCount(data.count ?? 0);
      setSessionPageIndex(nextIndex);
    } catch (err) {
      setSessionsError(extractApiError(err, 'Failed to load sessions'));
    } finally {
      setSessionsLoading(false);
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

  // Index records by session UUID for O(1) lookup when merging
  // The /records/me/ response uses `session` (the FK value) not `session_id`
  const recordsBySessionId = useMemo(() => {
    const map = {};
    allRecords.forEach((r) => { if (r.session) { map[r.session] = r; } });
    return map;
  }, [allRecords]);

  // For no-course selection: build rows directly from records with no course_id
  // For a real course: merge sessions list with records (shows "Not marked" for unrecorded sessions)
  const tableRows = useMemo(() => {
    if (selectedCourseId === NO_COURSE_VALUE) {
      return allRecords
        .filter((r) => !r.course_id)
        .map((r) => ({
          id: r.session,
          title: r.session_title,
          scheduled_start_time: r.session_date,
          attendance_status: r.status ?? null,
          override_reason: r.override_reason ?? null,
          is_overridden: r.is_overridden ?? false,
        }));
    }
    return sessions.map((s) => {
      const record = recordsBySessionId[s.id];
      return {
        ...s,
        attendance_status: record?.status ?? null,
        override_reason: record?.override_reason ?? null,
        is_overridden: record?.is_overridden ?? false,
      };
    });
  }, [selectedCourseId, allRecords, sessions, recordsBySessionId]);

  // A real course is paged by the server; "no course" rows come from the
  // records list and are still paginated client-side (see bug 3.14).
  const isServerPaginated = selectedCourseId !== NO_COURSE_VALUE;
  const pageCount = Math.max(1, Math.ceil(sessionCount / PAGE_SIZE));

  const loading = recordsLoading || coursesLoading;

  if (loading) {
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
      {sessionsError && (
        <Alert variant="danger" dismissible onClose={() => setSessionsError('')}>
          {sessionsError}
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
            setSessions([]);
            setSessionCount(0);
            setSessionPageIndex(0);
          }}
          loading={coursesLoading}
          placeholder="Select a course…"
        />
      </div>

      {!selectedCourseId && (
        <Alert variant="info">Select a course above to see your attendance.</Alert>
      )}

      {selectedCourseId && sessionsLoading && (
        <div className="text-center py-4">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Loading sessions…</p>
        </div>
      )}

      {selectedCourseId && !isServerPaginated && !sessionsLoading && tableRows.length === 0 && (
        <Alert variant="info">
          No attendance records for sessions without a course.
        </Alert>
      )}

      {/* Server-paged table for a real course. It stays mounted while loading —
          unmounting would re-fire Paragon's fetchData effect (see PerSessionReport).
          The spinner above renders alongside the table, not instead of it. */}
      {selectedCourseId && isServerPaginated && (
        <DataTable
          key={selectedCourseId}
          isPaginated
          manualPagination
          fetchData={fetchSessions}
          pageCount={pageCount}
          itemCount={sessionCount}
          data={tableRows}
          columns={COLUMNS}
          initialState={{ pageIndex: sessionPageIndex, pageSize: PAGE_SIZE }}
        >
          <DataTable.Table />
          <DataTable.EmptyTable content="No sessions found for this course yet." />
          <DataTable.TableFooter />
        </DataTable>
      )}

      {selectedCourseId && !isServerPaginated && !sessionsLoading && tableRows.length > 0 && (
        <DataTable
          isPaginated={tableRows.length > PAGE_SIZE}
          data={tableRows}
          columns={COLUMNS}
          itemCount={tableRows.length}
          initialState={{ pageSize: PAGE_SIZE }}
        >
          <DataTable.Table />
          <DataTable.EmptyTable content="No records" />
          {tableRows.length > PAGE_SIZE && <DataTable.TableFooter />}
        </DataTable>
      )}
    </Container>
  );
};

export default MyAttendanceView;
