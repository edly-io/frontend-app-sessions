import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Badge, Container, DataTable, Spinner,
} from '@openedx/paragon';

import { getAttendanceRoster, getPastSessionsForAttendance } from '../api';
import SearchableSelect from '../../shared/SearchableSelect';
import { ATTENDANCE_STATUS } from '../../shared/constants';
import { extractApiError, formatDateTime, getStatusVariant } from '../../shared/utils';

const PAGE_SIZE = 50;

// ─── Cell renderers ──────────────────────────────────────────────────────────

const LearnerCell = ({ row }) => (
  <div>
    <div>{row.original.email || '—'}</div>
  </div>
);
LearnerCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({ email: PropTypes.string }),
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
  { Header: 'Learner', accessor: 'email', Cell: LearnerCell },
  { Header: 'Status', accessor: 'status', Cell: StatusCell },
  { Header: 'Override reason', accessor: 'override_reason', Cell: OverrideCell },
  { Header: 'Marked by', id: 'marked_by', Cell: MarkedByCell },
  { Header: 'Marked at', id: 'marked_at', Cell: MarkedAtCell },
];

// ─── Component ───────────────────────────────────────────────────────────────

const PerSessionReport = () => {
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState('');

  const [selectedSessionId, setSelectedSessionId] = useState('');
  const selectedSessionIdRef = useRef('');

  const [records, setRecords] = useState([]);
  const [count, setCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState('');

  // Load session list for the picker (past 45 days is the max window).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPastSessionsForAttendance({ daysBack: 45 });
        if (cancelled) { return; }
        const results = Array.isArray(data) ? data : data.results ?? [];
        results.sort((a, b) => (
          new Date(b.scheduled_start_time) - new Date(a.scheduled_start_time)
        ));
        setSessions(results);
      } catch (err) {
        if (!cancelled) { setSessionsError(extractApiError(err, 'Failed to load sessions')); }
      } finally {
        if (!cancelled) { setSessionsLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Stable fetchData — empty deps so Paragon's DataTable useEffect never re-fires
  // due to a reference change. Reads session ID from a ref so we don't close over
  // selectedSessionId (which would force a new function on every session change).
  const handleFetchData = useCallback(async ({ pageIndex: nextPageIndex = 0 } = {}) => {
    const sid = selectedSessionIdRef.current;
    if (!sid) { return; }
    setRecordsLoading(true);
    setRecordsError('');
    try {
      const data = await getAttendanceRoster(sid);
      const results = Array.isArray(data) ? data : data.results ?? [];
      const total = results.length;
      setRecords(results);
      setCount(total);
      setPageIndex(nextPageIndex);
    } catch (err) {
      setRecordsError(extractApiError(err, 'Failed to load attendance records'));
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  const handleSessionChange = (option) => {
    const sid = option?.value || '';
    // Update ref synchronously before state so handleFetchData sees the new value
    // when Paragon's useEffect fires on DataTable mount.
    selectedSessionIdRef.current = sid;
    setSelectedSessionId(sid);
    setPageIndex(0);
    setRecords([]);
    setCount(0);
  };

  const sessionOptions = useMemo(() => sessions.map((s) => {
    const parts = [s.title || `Session ${s.id}`];
    if (s.scheduled_start_time) { parts.push(formatDateTime(s.scheduled_start_time)); }
    return {
      value: s.id,
      label: s.course_name ? `${parts.join(' — ')} (${s.course_name})` : parts.join(' — '),
    };
  }), [sessions]);

  const selectedSessionOption = useMemo(() => (
    sessionOptions.find((o) => o.value === selectedSessionId) || null
  ), [sessionOptions, selectedSessionId]);

  return (
    <Container className="py-3">
      <h3 className="mb-1">Per-Session Attendance</h3>
      <p className="text-muted mb-3">
        Pick a past session to see who attended, who was absent, and any override
        notes the instructor added. Use this view to audit a single session in
        detail.
      </p>

      {sessionsError && (
        <Alert variant="danger" dismissible onClose={() => setSessionsError('')}>
          {sessionsError}
        </Alert>
      )}
      {recordsError && (
        <Alert variant="danger" dismissible onClose={() => setRecordsError('')}>
          {recordsError}
        </Alert>
      )}

      <div className="d-flex flex-wrap mb-4" style={{ gap: 16 }}>
        <div style={{ minWidth: 360, maxWidth: 480, flex: '1 1 360px' }}>
          <SearchableSelect
            id="per-session-picker"
            label="Session"
            options={sessionOptions}
            value={selectedSessionOption}
            onChange={handleSessionChange}
            loading={sessionsLoading}
            placeholder="Search sessions…"
          />
        </div>
      </div>

      {!selectedSessionId && !sessionsLoading && (
        <Alert variant="info">Select a session above to see its attendance.</Alert>
      )}

      {selectedSessionId && recordsLoading && (
        <div className="text-center py-4">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Loading attendance records...</p>
        </div>
      )}

      {/* DataTable must stay mounted while records are loading — unmounting it
          causes Paragon's internal useEffect (which has fetchData in its deps)
          to re-fire on every remount, creating an infinite request loop.
          The loading spinner above renders alongside the table, not instead of it.
          Rendering DataTable unconditionally (when a session is selected) means
          Paragon fires fetchData on mount — that is the initial fetch trigger.
          key={selectedSessionId} forces a clean remount when the session changes,
          which triggers Paragon's useEffect to fetch the first page of new data.
          DataTable.EmptyTable handles the "no records" state when data=[] */}
      {selectedSessionId && (
        <DataTable
          key={selectedSessionId}
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

export default PerSessionReport;
