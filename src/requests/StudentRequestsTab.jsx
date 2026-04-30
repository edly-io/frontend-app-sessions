import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Badge,
  Button,
  Container,
  DataTable,
  Form,
  Spinner,
  StandardModal,
} from '@openedx/paragon';

import { getSessionRequests, reviewSessionRequest } from './api';
import {
  REQUEST_STATUS,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_VARIANTS,
  REQUEST_TYPE_LABELS,
} from '../shared/constants';
import { formatDateTime, extractApiError } from '../shared/utils';

/**
 * Reviewer DataTable for session requests.
 *
 * Admins see all; instructors are scoped to their courses by the backend.
 * The caller passes `courseId` to narrow the list to a specific course (used
 * when this tab is embedded inside the course-scoped v2 Sessions page).
 *
 * Approve is a one-click action. Reject opens a small modal to capture an
 * optional note, since learners benefit from knowing why the request was
 * denied.
 */
const PAGE_SIZE = 25;

const StudentRequestsTab = ({ courseId, onPendingCountChange }) => {
  const [requests, setRequests] = useState([]);
  const [count, setCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  // DataTable invokes `fetchData` on mount and whenever the page changes.
  // Backend response is `{count, results}`; legacy non-paginated callers
  // (per-course tab pre-pagination) may still see a flat array.
  const fetchData = useCallback(async ({ pageIndex: nextIndex } = {}) => {
    const targetIndex = nextIndex ?? 0;
    setError('');
    try {
      const data = await getSessionRequests({
        ...(courseId ? { courseId } : {}),
        page: targetIndex + 1,
        pageSize: PAGE_SIZE,
      });
      const results = Array.isArray(data) ? data : data.results ?? [];
      const total = Array.isArray(data) ? data.length : data.count ?? results.length;
      setRequests(results);
      setCount(total);
      setPageIndex(targetIndex);
    } catch (err) {
      setError(extractApiError(err, 'Failed to load requests'));
    } finally {
      setInitialLoading(false);
    }
  }, [courseId]);

  useEffect(() => { fetchData({ pageIndex: 0 }); }, [fetchData]);

  // Bubble up the pending count so the surrounding tab nav can badge the tab.
  useEffect(() => {
    if (!onPendingCountChange) { return; }
    const pending = requests.filter((r) => r.status === REQUEST_STATUS.PENDING).length;
    onPendingCountChange(pending);
  }, [requests, onPendingCountChange]);

  const applyReview = async (request, status, reviewerNote = '') => {
    setActioningId(request.id);
    try {
      const updated = await reviewSessionRequest(request.id, { status, reviewerNote });
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      setError(extractApiError(err, 'Failed to update request'));
    } finally {
      setActioningId(null);
    }
  };

  const handleApprove = (request) => applyReview(request, REQUEST_STATUS.APPROVED);

  const handleOpenReject = (request) => {
    setRejectNote('');
    setRejectTarget(request);
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) { return; }
    await applyReview(rejectTarget, REQUEST_STATUS.REJECTED, rejectNote.trim());
    setRejectTarget(null);
  };

  /* eslint-disable react/no-unstable-nested-components, react/prop-types */
  const columns = useMemo(() => [
    {
      Header: 'Student',
      accessor: 'user_name',
      Cell: ({ row }) => (
        <div>
          <div>{row.original.user_name || '—'}</div>
          <small className="text-muted">{row.original.email}</small>
        </div>
      ),
    },
    {
      Header: 'Course',
      accessor: 'course_name',
      Cell: ({ value }) => <span>{value || '—'}</span>,
    },
    {
      Header: 'Session',
      accessor: 'session_title',
      Cell: ({ row }) => (
        <div>
          <div>{row.original.session_title}</div>
          <small className="text-muted">
            {formatDateTime(row.original.session_start_time)}
          </small>
        </div>
      ),
    },
    {
      Header: 'Type',
      accessor: 'request_type',
      Cell: ({ value }) => REQUEST_TYPE_LABELS[value] || value,
    },
    {
      Header: 'Reason',
      accessor: 'reason',
      Cell: ({ value }) => <span className="text-break">{value}</span>,
    },
    {
      Header: 'Status',
      accessor: 'status',
      Cell: ({ value }) => (
        <Badge variant={REQUEST_STATUS_VARIANTS[value] || 'secondary'}>
          {REQUEST_STATUS_LABELS[value] || value}
        </Badge>
      ),
    },
    {
      Header: 'Submitted',
      accessor: 'created',
      Cell: ({ value }) => formatDateTime(value),
    },
    {
      Header: 'Actions',
      id: 'actions',
      Cell: ({ row }) => {
        const request = row.original;
        if (request.status !== REQUEST_STATUS.PENDING) {
          return request.reviewer_note
            ? <small className="text-muted">{request.reviewer_note}</small>
            : null;
        }
        const busy = actioningId === request.id;
        return (
          <div className="d-flex" style={{ gap: '0.4rem' }}>
            <Button
              variant="success"
              size="sm"
              onClick={() => handleApprove(request)}
              disabled={busy}
            >
              Approve
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => handleOpenReject(request)}
              disabled={busy}
            >
              Reject
            </Button>
          </div>
        );
      },
    },
    // handleApprove/handleOpenReject depend on actioningId; re-create cells when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [actioningId]);
  /* eslint-enable react/no-unstable-nested-components, react/prop-types */

  if (initialLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Loading requests...</p>
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
        <Alert variant="info">No student requests yet.</Alert>
      ) : (
        <DataTable
          isPaginated
          manualPagination
          fetchData={fetchData}
          pageCount={Math.max(1, Math.ceil(count / PAGE_SIZE))}
          itemCount={count}
          data={requests}
          columns={columns}
          initialState={{ pageIndex, pageSize: PAGE_SIZE }}
        >
          <DataTable.Table />
          <DataTable.EmptyTable content="No requests" />
          <DataTable.TableFooter />
        </DataTable>
      )}

      <StandardModal
        isOpen={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title="Reject request"
        footerNode={(
          <>
            <Button variant="tertiary" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmReject}
              disabled={actioningId === rejectTarget?.id}
              className="ml-2"
            >
              Reject request
            </Button>
          </>
        )}
      >
        <Form.Group>
          <Form.Label>Note for the learner (optional)</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Let them know why you couldn't approve this request."
            maxLength={500}
          />
        </Form.Group>
      </StandardModal>
    </Container>
  );
};

StudentRequestsTab.propTypes = {
  courseId: PropTypes.string,
  onPendingCountChange: PropTypes.func,
};

StudentRequestsTab.defaultProps = {
  courseId: undefined,
  onPendingCountChange: undefined,
};

export default StudentRequestsTab;
