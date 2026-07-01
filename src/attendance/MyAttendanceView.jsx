import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Badge, Container, DataTable, Spinner,
} from '@openedx/paragon';

import { getMyAttendanceRecords } from './api';
import { ATTENDANCE_STATUS } from '../shared/constants';
import { extractApiError, formatDateTime, getStatusVariant } from '../shared/utils';

const PAGE_SIZE = 25;

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

const CourseCell = ({ value }) => <span className="text-muted">{value || '—'}</span>;
CourseCell.propTypes = { value: PropTypes.string };
CourseCell.defaultProps = { value: '' };

const StatusCell = ({ value }) => (
  value
    ? (
      <Badge variant={getStatusVariant(value)}>
        {ATTENDANCE_STATUS[value] || value}
      </Badge>
    )
    : <span className="text-muted">—</span>
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
  { Header: 'Session', accessor: 'session_title', Cell: SessionCell },
  { Header: 'Course', accessor: 'course_id', Cell: CourseCell },
  { Header: 'Status', accessor: 'status', Cell: StatusCell },
  { Header: 'Notes', accessor: 'override_reason', Cell: NotesCell },
];

const MyAttendanceView = () => {
  const [records, setRecords] = useState([]);
  const [count, setCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async ({ pageIndex: nextIndex } = {}) => {
    const targetIndex = nextIndex ?? 0;
    try {
      const data = await getMyAttendanceRecords({
        page: targetIndex + 1,
        pageSize: PAGE_SIZE,
      });
      const results = Array.isArray(data) ? data : data.results ?? [];
      const total = Array.isArray(data) ? data.length : data.count ?? results.length;
      setRecords(results);
      setCount(total);
      setPageIndex(targetIndex);
    } catch (err) {
      setError(extractApiError(err, 'Failed to load your attendance'));
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => { fetchData({ pageIndex: 0 }); }, [fetchData]);

  if (initialLoading) {
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
      {count === 0 ? (
        <Alert variant="info">You have no attendance records yet.</Alert>
      ) : (
        <DataTable
          isPaginated
          manualPagination
          fetchData={fetchData}
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

export default MyAttendanceView;
