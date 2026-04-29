import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import {
  Alert, Badge, Button, Container, DataTable, Form, Icon, Spinner,
} from '@openedx/paragon';
import {
  ArrowBackIos, ArrowForwardIos, People, Search,
} from '@openedx/paragon/icons';

import { getPastSessionsForAttendance } from '../api';
import { extractApiError, formatDateTime, getStatusVariant } from '../../sessions-tab/utils';
import { SESSION_STATUS_LABELS } from '../../sessions-tab/constants';

const PAGE_SIZE = 25;
const WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Truncate a Date to midnight local time — keeps window boundaries clean. */
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Format a Date as "Apr 28, 2026" for the window label. */
const formatWindowLabel = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const TitleCell = ({ row }) => (
  <div>
    <strong>{row.original.title}</strong>
    {row.original.course_name && (
      <div className="small text-muted">{row.original.course_name}</div>
    )}
  </div>
);
TitleCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      title: PropTypes.string,
      course_name: PropTypes.string,
    }).isRequired,
  }).isRequired,
};

const DateCell = ({ value }) => formatDateTime(value);
DateCell.propTypes = { value: PropTypes.string };
DateCell.defaultProps = { value: '' };

const SyncCell = ({ row }) => {
  const { attendance_synced: synced, attendance_sync_error: syncError } = row.original;
  if (syncError) { return <Badge variant="danger" title={syncError}>Sync error</Badge>; }
  if (synced) { return <Badge variant="success">Synced</Badge>; }
  return <Badge variant="secondary">Not synced</Badge>;
};
SyncCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      attendance_synced: PropTypes.bool,
      attendance_sync_error: PropTypes.string,
    }).isRequired,
  }).isRequired,
};

/**
 * Derive what the status should display as. Sessions that are still marked
 * "scheduled" or "in_progress" in the DB but whose end time has passed are
 * shown as "completed" — the DB field lags behind reality until a background
 * task updates it.
 */
const getEffectiveStatus = (dbStatus, scheduledEndTime) => {
  if ((dbStatus === 'scheduled' || dbStatus === 'in_progress') && scheduledEndTime) {
    if (new Date(scheduledEndTime) < new Date()) {
      return 'completed';
    }
  }
  return dbStatus;
};

const StatusCell = ({ row }) => {
  const { status, scheduled_end_time: endTime } = row.original;
  const effective = getEffectiveStatus(status, endTime);
  return (
    <Badge variant={getStatusVariant(effective)}>
      {SESSION_STATUS_LABELS[effective] || effective}
    </Badge>
  );
};
StatusCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      status: PropTypes.string,
      scheduled_end_time: PropTypes.string,
    }).isRequired,
  }).isRequired,
};

// Extracted to module scope (react/no-unstable-nested-components).
const ViewMarkActionCell = ({ row }) => {
  const { programId } = useParams();
  return (
    <Button
      as={Link}
      to={`/sessions/${programId}/attendance/sessions/${row.original.id}`}
      state={{ session: row.original }}
      variant="outline-primary"
      size="sm"
      iconBefore={People}
    >
      View / Mark
    </Button>
  );
};
ViewMarkActionCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    }).isRequired,
  }).isRequired,
};

const COLUMNS = [
  { Header: 'Title', accessor: 'title', Cell: TitleCell },
  { Header: 'Date', accessor: 'scheduled_start_time', Cell: DateCell },
  { Header: 'Status', accessor: 'status', Cell: StatusCell },
  { Header: 'Attendance', accessor: 'attendance_synced', Cell: SyncCell },
  { Header: 'Action', id: 'action', Cell: ViewMarkActionCell },
];

const AdminSessionsList = () => {
  // windowEnd is midnight today by default; windowStart is derived from it.
  const [windowEnd, setWindowEnd] = useState(() => startOfDay(new Date()));
  const windowStart = useMemo(
    () => new Date(windowEnd.getTime() - WINDOW_DAYS * MS_PER_DAY),
    [windowEnd],
  );
  const isAtLatestWindow = windowEnd >= startOfDay(new Date());

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSessions([]);
    setError('');
    (async () => {
      try {
        const data = await getPastSessionsForAttendance({ startDate: windowStart, endDate: windowEnd });
        if (cancelled) { return; }
        const results = Array.isArray(data) ? data : data.results ?? [];
        results.sort((a, b) => (
          new Date(b.scheduled_start_time) - new Date(a.scheduled_start_time)
        ));
        setSessions(results);
      } catch (err) {
        if (!cancelled) { setError(extractApiError(err, 'Failed to load sessions')); }
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [windowEnd]); // windowStart is derived; only windowEnd drives re-fetch

  const handlePrev = () => setWindowEnd(new Date(windowEnd.getTime() - WINDOW_DAYS * MS_PER_DAY));
  const handleNext = () => setWindowEnd(new Date(windowEnd.getTime() + WINDOW_DAYS * MS_PER_DAY));

  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) { return sessions; }
    return sessions.filter((s) => (
      (s.title || '').toLowerCase().includes(q)
      || (s.course_name || '').toLowerCase().includes(q)
    ));
  }, [sessions, query]);

  const renderSessionList = () => {
    if (loading) {
      return (
        <div className="py-5 text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3">Loading sessions…</p>
        </div>
      );
    }
    if (sessions.length === 0) {
      return (
        <Alert variant="info">
          No sessions found between {formatWindowLabel(windowStart)} and {formatWindowLabel(windowEnd)}.
        </Alert>
      );
    }
    return (
      <>
        <Form.Group controlId="sessions-search" className="mb-3" style={{ maxWidth: 320 }}>
          <Form.Control
            type="search"
            placeholder="Search sessions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leadingElement={<Icon src={Search} />}
          />
        </Form.Group>
        <DataTable
          key={query}
          isPaginated
          data={filteredSessions}
          columns={COLUMNS}
          itemCount={filteredSessions.length}
          initialState={{ pageSize: PAGE_SIZE }}
        >
          <DataTable.Table />
          <DataTable.EmptyTable content="No sessions match your search" />
          <DataTable.TableFooter />
        </DataTable>
      </>
    );
  };

  return (
    <Container className="py-3">
      <h3 className="mb-1">Sessions</h3>
      <p className="text-muted mb-3">
        Showing sessions from <strong>{formatWindowLabel(windowStart)}</strong> –{' '}
        <strong>{formatWindowLabel(windowEnd)}</strong>. Click{' '}
        <strong>View / Mark</strong> to record or review attendance for a session.
      </p>

      {/* Window navigation */}
      <div className="d-flex align-items-center mb-3" style={{ gap: 8 }}>
        <Button
          variant="outline-primary"
          size="sm"
          iconBefore={ArrowBackIos}
          onClick={handlePrev}
        >
          Previous
        </Button>
        <Button
          variant="outline-primary"
          size="sm"
          iconAfter={ArrowForwardIos}
          onClick={handleNext}
          disabled={isAtLatestWindow}
        >
          Next
        </Button>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {renderSessionList()}
    </Container>
  );
};

export default AdminSessionsList;
