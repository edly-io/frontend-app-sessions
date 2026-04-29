import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Badge, Container, DataTable, Spinner,
} from '@openedx/paragon';

import { getMySessionRequests } from '../sessions-tab/api';
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_VARIANTS,
  REQUEST_TYPE_LABELS,
} from '../sessions-tab/constants';
import { extractApiError, formatDateTime } from '../sessions-tab/utils';

const rowShape = PropTypes.shape({
  original: PropTypes.shape({
    session_title: PropTypes.string,
    session_start_time: PropTypes.string,
    reviewer_note: PropTypes.string,
  }).isRequired,
}).isRequired;

const CourseCell = ({ value }) => <span>{value || '—'}</span>;
CourseCell.propTypes = { value: PropTypes.string };
CourseCell.defaultProps = { value: '' };

const SessionCell = ({ row }) => (
  <div>
    <div>{row.original.session_title || '—'}</div>
    <small className="text-muted">{formatDateTime(row.original.session_start_time)}</small>
  </div>
);
SessionCell.propTypes = { row: rowShape };

const TypeCell = ({ value }) => REQUEST_TYPE_LABELS[value] || value;
TypeCell.propTypes = { value: PropTypes.string.isRequired };

const ReasonCell = ({ value }) => <span className="text-break">{value}</span>;
ReasonCell.propTypes = { value: PropTypes.string };
ReasonCell.defaultProps = { value: '' };

const StatusCell = ({ value }) => (
  <Badge variant={REQUEST_STATUS_VARIANTS[value] || 'secondary'}>
    {REQUEST_STATUS_LABELS[value] || value}
  </Badge>
);
StatusCell.propTypes = { value: PropTypes.string.isRequired };

const ReviewerNoteCell = ({ row }) => (
  row.original.reviewer_note
    ? <small className="text-muted">{row.original.reviewer_note}</small>
    : null
);
ReviewerNoteCell.propTypes = { row: rowShape };

const SubmittedCell = ({ value }) => formatDateTime(value);
SubmittedCell.propTypes = { value: PropTypes.string };
SubmittedCell.defaultProps = { value: '' };

const COLUMNS = [
  { Header: 'Course', accessor: 'course_name', Cell: CourseCell },
  { Header: 'Session', accessor: 'session_title', Cell: SessionCell },
  { Header: 'Type', accessor: 'request_type', Cell: TypeCell },
  { Header: 'Reason', accessor: 'reason', Cell: ReasonCell },
  { Header: 'Status', accessor: 'status', Cell: StatusCell },
  { Header: 'Reviewer note', accessor: 'reviewer_note', Cell: ReviewerNoteCell },
  { Header: 'Submitted', accessor: 'created', Cell: SubmittedCell },
];

const PAGE_SIZE = 25;

const MyRequestsView = () => {
  const [requests, setRequests] = useState([]);
  const [count, setCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  // `initialLoading` distinguishes the very first load (full-page spinner)
  // from page-change reloads (subtle in-place loading).
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');

  // DataTable's `fetchData` callback fires with `{ pageIndex, pageSize, ... }`
  // both on initial mount and on any page-nav click.
  const fetchData = useCallback(async ({ pageIndex: nextIndex } = {}) => {
    const targetIndex = nextIndex ?? 0;
    try {
      const data = await getMySessionRequests({
        page: targetIndex + 1,
        pageSize: PAGE_SIZE,
      });
      // Backend now paginates; legacy non-paginated callers still see flat arrays.
      const results = Array.isArray(data) ? data : data.results ?? [];
      const total = Array.isArray(data) ? data.length : data.count ?? results.length;
      setRequests(results);
      setCount(total);
      setPageIndex(targetIndex);
    } catch (err) {
      setError(extractApiError(err, 'Failed to load your requests'));
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => { fetchData({ pageIndex: 0 }); }, [fetchData]);

  if (initialLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Loading your requests...</p>
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
        <Alert variant="info">You have no session requests yet.</Alert>
      ) : (
        <DataTable
          isPaginated
          manualPagination
          fetchData={fetchData}
          pageCount={Math.max(1, Math.ceil(count / PAGE_SIZE))}
          itemCount={count}
          data={requests}
          columns={COLUMNS}
          initialState={{ pageIndex, pageSize: PAGE_SIZE }}
        >
          <DataTable.Table />
          <DataTable.EmptyTable content="No requests" />
          <DataTable.TableFooter />
        </DataTable>
      )}
    </Container>
  );
};

export default MyRequestsView;
