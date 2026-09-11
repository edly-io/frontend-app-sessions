import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert, Badge, Button, Container, DataTable, Spinner,
} from '@openedx/paragon';

import { fetchProgramCourses } from '../calendar/api';
import { getCourseSessionsList, getSessionsPage } from './api';
import SearchableSelect from '../shared/SearchableSelect';
import { SESSION_STATUS_LABELS } from '../shared/constants';
import { extractApiError, formatDateTime, getStatusVariant } from '../shared/utils';

const NO_COURSE_VALUE = '__none__';
const PAGE_SIZE = 25;

const TitleCell = ({ row }) => (
  <div>{row.original.title || '—'}</div>
);
TitleCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      title: PropTypes.string,
    }),
  }).isRequired,
};

const DateCell = ({ value }) => (
  <span className="text-muted" style={{ whiteSpace: 'nowrap' }}>
    {value ? formatDateTime(value) : '—'}
  </span>
);
DateCell.propTypes = { value: PropTypes.string };
DateCell.defaultProps = { value: '' };

const StatusBadge = ({ value }) => (
  <Badge variant={getStatusVariant(value)}>
    {SESSION_STATUS_LABELS[value] || value}
  </Badge>
);
StatusBadge.propTypes = { value: PropTypes.string };
StatusBadge.defaultProps = { value: '' };

const MarkingWindowCell = ({ row }) => {
  const { marking_window_open: open, marking_window_remaining_days: days } = row.original;
  return open
    ? (
      <div>
        <Badge variant="success">Open</Badge>
        {days != null && (
          <div className="text-muted mt-1" style={{ fontSize: 11 }}>
            {days}
            {' '}
            {days === 1 ? 'day' : 'days'}
            {' '}
            left
          </div>
        )}
      </div>
    )
    : <Badge variant="secondary">Closed</Badge>;
};
MarkingWindowCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      marking_window_open: PropTypes.bool,
      marking_window_remaining_days: PropTypes.number,
    }),
  }).isRequired,
};

// onViewAttendance is injected into each row via tableData so this cell stays at module scope.
const ActionsCell = ({ row }) => (
  <Button
    variant="tertiary"
    size="sm"
    onClick={() => row.original.onViewAttendance(row.original.id)}
  >
    View Attendance
  </Button>
);
ActionsCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      id: PropTypes.string.isRequired,
      onViewAttendance: PropTypes.func.isRequired,
    }),
  }).isRequired,
};

const PerCourseView = () => {
  const { programId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState('');

  const [selectedCourseKey, setSelectedCourseKey] = useState(searchParams.get('course_id') || '');
  const [allSessions, setAllSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState('');
  const [sessionPageIndex, setSessionPageIndex] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);

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

  // Server-paged fetch for a real course. Paragon's DataTable calls this on
  // mount and on every page change (manualPagination); key={selectedCourseKey}
  // remounts the table on course change, re-firing it for page 1.
  const fetchSessions = useCallback(async ({ pageIndex: nextIndex = 0 } = {}) => {
    setSessionsLoading(true);
    setSessionsError('');
    try {
      const data = await getCourseSessionsList(selectedCourseKey, programId, {
        page: nextIndex + 1,
        pageSize: PAGE_SIZE,
      });
      setAllSessions(data.results ?? []);
      setSessionCount(data.count ?? 0);
      setSessionPageIndex(nextIndex);
    } catch (err) {
      setSessionsError(extractApiError(err, 'Failed to load sessions'));
    } finally {
      setSessionsLoading(false);
    }
  }, [programId, selectedCourseKey]);

  // The "no course" option has no server-side filter yet, so it still fetches
  // page 1 of /sessions/ and narrows in the browser (see bug 3.14).
  useEffect(() => {
    if (!programId || selectedCourseKey !== NO_COURSE_VALUE) {
      return () => {};
    }
    let cancelled = false;
    setSessionsLoading(true);
    setSessionsError('');
    (async () => {
      try {
        const data = await getSessionsPage({ programKey: programId, pageSize: 200 });
        if (cancelled) { return; }
        const results = Array.isArray(data) ? data : data.results ?? [];
        setAllSessions(results);
        setSessionCount(results.length);
      } catch (err) {
        if (!cancelled) { setSessionsError(extractApiError(err, 'Failed to load sessions')); }
      } finally {
        if (!cancelled) { setSessionsLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [programId, selectedCourseKey]);

  const courseOptions = useMemo(() => {
    const opts = courses.map((c) => ({ value: c.id, label: c.title || `Course ${c.id}` }));
    opts.unshift({ value: NO_COURSE_VALUE, label: 'Sessions without a course' });
    return opts;
  }, [courses]);

  const selectedCourseOption = useMemo(() => (
    courseOptions.find((o) => o.value === selectedCourseKey) || null
  ), [courseOptions, selectedCourseKey]);

  const filteredSessions = useMemo(() => {
    if (!selectedCourseKey) { return []; }
    const raw = selectedCourseKey === NO_COURSE_VALUE
      ? allSessions.filter((s) => !s.course_id)
      : allSessions;
    const courseName = selectedCourseKey !== NO_COURSE_VALUE
      ? (courses.find((c) => c.id === selectedCourseKey)?.title || null)
      : null;
    const onViewAttendance = (id) => {
      const session = raw.find((s) => s.id === id);
      navigate(
        `/${programId}/attendance/sessions/${id}?course_id=${encodeURIComponent(selectedCourseKey)}`,
        {
          state: {
            sessionTitle: session?.title,
            sessionTime: session?.scheduled_start_time,
            courseName,
            markingWindowRemainingDays: session?.marking_window_remaining_days ?? null,
          },
        },
      );
    };
    return raw.map((s) => ({ ...s, onViewAttendance }));
  }, [allSessions, selectedCourseKey, courses, navigate, programId]);

  // A real course is paged by the server; the "no course" option is not.
  const isServerPaginated = selectedCourseKey !== NO_COURSE_VALUE;
  const pageCount = Math.max(1, Math.ceil(sessionCount / PAGE_SIZE));

  const cx = { cellClassName: 'text-center', headerClassName: 'justify-content-center' };
  const columns = useMemo(() => [
    { Header: 'Title', accessor: 'title', Cell: TitleCell },
    {
      Header: 'Date', accessor: 'scheduled_start_time', Cell: DateCell, ...cx,
    },
    {
      Header: 'Status', accessor: 'status', Cell: StatusBadge, ...cx,
    },
    {
      Header: 'Marking Window', id: 'marking_window', Cell: MarkingWindowCell, ...cx,
    },
    {
      Header: 'Actions', id: 'actions', Cell: ActionsCell, ...cx,
    },
  ], []);

  return (
    <Container className="py-3">
      <h3 className="mb-1">Attendance by Course</h3>
      <p className="text-muted mb-3">
        Select a course to view its completed sessions, then open the roster for a session.
      </p>

      {coursesError && (
        <Alert variant="danger" dismissible onClose={() => setCoursesError('')}>
          {coursesError}
        </Alert>
      )}
      {sessionsError && (
        <Alert variant="danger" dismissible onClose={() => setSessionsError('')}>
          {sessionsError}
        </Alert>
      )}

      <div className="mb-4" style={{ maxWidth: 400 }}>
        <SearchableSelect
          id="per-course-selector"
          label="Course"
          options={courseOptions}
          value={selectedCourseOption}
          onChange={(opt) => {
            setSelectedCourseKey(opt?.value || '');
            setAllSessions([]);
            setSessionCount(0);
            setSessionPageIndex(0);
          }}
          loading={coursesLoading}
          placeholder="Search courses…"
        />
      </div>

      {!selectedCourseKey && (
        <Alert variant="info">Select a course above to see its sessions.</Alert>
      )}

      {selectedCourseKey && sessionsLoading && (
        <div className="text-center py-4">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Loading sessions…</p>
        </div>
      )}

      {selectedCourseKey && !isServerPaginated && !sessionsLoading && filteredSessions.length === 0 && (
        <Alert variant="info">No completed sessions found for this course.</Alert>
      )}

      {/* Server-paged table for a real course. It stays mounted while loading —
          unmounting would re-fire Paragon's fetchData effect (see PerSessionReport).
          The spinner above renders alongside the table, not instead of it. */}
      {selectedCourseKey && isServerPaginated && (
        <DataTable
          key={selectedCourseKey}
          isPaginated
          manualPagination
          fetchData={fetchSessions}
          pageCount={pageCount}
          itemCount={sessionCount}
          data={filteredSessions}
          columns={columns}
          initialState={{ pageIndex: sessionPageIndex, pageSize: PAGE_SIZE }}
        >
          <DataTable.Table />
          <DataTable.EmptyTable content="No completed sessions found for this course." />
          <DataTable.TableFooter />
        </DataTable>
      )}

      {selectedCourseKey && !isServerPaginated && !sessionsLoading && filteredSessions.length > 0 && (
        <DataTable
          isPaginated={filteredSessions.length > PAGE_SIZE}
          data={filteredSessions}
          columns={columns}
          itemCount={filteredSessions.length}
          initialState={{ pageSize: PAGE_SIZE }}
        >
          <DataTable.Table />
          <DataTable.EmptyTable content="No sessions" />
          {filteredSessions.length > PAGE_SIZE && <DataTable.TableFooter />}
        </DataTable>
      )}
    </Container>
  );
};

export default PerCourseView;
