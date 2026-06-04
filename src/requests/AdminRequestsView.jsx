import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import {
  Alert, Badge, Button, Container, DataTable, Form, Spinner, StandardModal,
} from '@openedx/paragon';

import { getRequests, reviewRequest } from './api';
import {
  REQUEST_STATUS,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_VARIANTS,
  REQUEST_TYPE_LABELS,
  REQUEST_TYPE_VARIANTS,
} from '../shared/constants';
import { extractApiError, formatDateTime } from '../shared/utils';
import RequestDetailCell from './RequestDetailCell';

const PAGE_SIZE = 50;

const TRUNCATE_AT = 40;

const CollapsibleText = ({ text, muted }) => {
  const [expanded, setExpanded] = useState(false);
  const cls = muted ? 'text-muted' : 'text-break';
  const sz = muted ? '0.875rem' : undefined;
  if (!text || text.length <= TRUNCATE_AT) {
    return <span className={cls} style={{ fontSize: sz }}>{text}</span>;
  }
  return (
    <span style={{ fontSize: sz }}>
      <span className={cls}>
        {expanded ? text : `${text.slice(0, TRUNCATE_AT)}…`}
      </span>
      {' '}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          fontSize: 'inherit',
          color: '#374151',
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        {expanded ? 'less' : 'more'}
      </button>
    </span>
  );
};
CollapsibleText.propTypes = { text: PropTypes.string, muted: PropTypes.bool };
CollapsibleText.defaultProps = { text: '', muted: false };

const AdminRequestsView = ({ readOnly }) => {
  const { programId } = useParams();
  const [requests, setRequests] = useState([]);
  const [count, setCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [actioningId, setActioningId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  const fetchData = useCallback(async ({ pageIndex: nextIndex } = {}) => {
    const targetIndex = nextIndex ?? 0;
    setError('');
    try {
      const data = await getRequests({
        ...(programId ? { program_key: programId } : {}),
        ...(filterState ? { state: filterState } : {}),
        ...(filterType ? { type: filterType } : {}),
        ...(filterQ ? { q: filterQ } : {}),
        ...(filterStartDate ? { start_date: filterStartDate } : {}),
        ...(filterEndDate ? { end_date: filterEndDate } : {}),
        page: targetIndex + 1,
        page_size: PAGE_SIZE,
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
  }, [programId, filterState, filterType, filterQ, filterStartDate, filterEndDate]);

  useEffect(() => { fetchData({ pageIndex: 0 }); }, [fetchData]);

  const applyReview = async (request, state, reviewerNote = '') => {
    setActioningId(request.id);
    try {
      const updated = await reviewRequest(
        request.id,
        { state, reviewer_note: reviewerNote },
        request.request_type_label,
      );
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
  const columns = useMemo(() => {
    const base = [
      {
        Header: 'Submitter',
        id: 'submitter',
        Cell: ({ row }) => {
          const req = row.original;
          const displayName = req.submitter_name || req.submitter_email;
          if (!displayName) { return <span className="text-muted">—</span>; }
          return (
            <div>
              <div>{displayName}</div>
              {req.submitter_name && req.submitter_email && (
                <small className="text-muted">{req.submitter_email}</small>
              )}
            </div>
          );
        },
      },
      {
        Header: 'Type',
        accessor: 'request_type_label',
        Cell: ({ value }) => (
          <Badge variant={REQUEST_TYPE_VARIANTS[value] || 'secondary'}>
            {REQUEST_TYPE_LABELS[value] || value}
          </Badge>
        ),
      },
      {
        Header: 'Detail',
        id: 'detail',
        Cell: ({ row }) => <RequestDetailCell req={row.original} />,
      },
      {
        Header: 'Reason',
        accessor: 'reason',
        Cell: ({ value }) => <CollapsibleText text={value} />,
      },
      {
        Header: 'Status',
        accessor: 'state',
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
        Header: 'Reviewer note',
        accessor: 'reviewer_note',
        Cell: ({ value }) => (value ? <CollapsibleText text={value} muted /> : <span className="text-muted">—</span>),
      },
      {
        Header: 'Attachment',
        id: 'attachment',
        Cell: ({ row }) => {
          const { attachment } = row.original;
          if (!attachment) { return <span className="text-muted">—</span>; }
          const filename = decodeURIComponent(attachment.split('/').pop() || 'file');
          return (
            <a href={attachment} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.875rem' }}>
              {filename}
            </a>
          );
        },
      },
    ];

    if (!readOnly) {
      base.push({
        Header: 'Actions',
        id: 'actions',
        Cell: ({ row }) => {
          const request = row.original;
          if (request.state !== REQUEST_STATUS.PENDING) { return null; }
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
      });
    }

    return base;
  // handleApprove/handleOpenReject depend on actioningId
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actioningId, readOnly]);
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

      <div className="d-flex align-items-center flex-wrap mb-3" style={{ gap: 8 }}>
        <Form.Control
          type="text"
          value={filterQ}
          onChange={(e) => setFilterQ(e.target.value)}
          placeholder="Search..."
          style={{ width: 180 }}
        />
        <div className="d-flex align-items-center flex-wrap ml-auto" style={{ gap: 8 }}>
          <Form.Control
            as="select"
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="">All statuses</option>
            {Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Form.Control>
          <Form.Control
            as="select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="">All types</option>
            {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Form.Control>
          <div className="d-flex align-items-center" style={{ gap: 4 }}>
            <small className="text-muted text-nowrap">Submission date:</small>
            <Form.Control
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              style={{ width: 'auto' }}
              aria-label="From date"
            />
            <span className="text-muted">–</span>
            <Form.Control
              type="date"
              value={filterEndDate}
              min={filterStartDate || undefined}
              onChange={(e) => setFilterEndDate(e.target.value)}
              style={{ width: 'auto' }}
              aria-label="To date"
            />
            {(filterStartDate || filterEndDate) && (
              <Button
                variant="tertiary"
                size="sm"
                onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {count === 0 ? (
        <Alert variant="info">No requests found.</Alert>
      ) : (
        <DataTable
          key={`${filterState}-${filterType}-${filterQ}-${filterStartDate}-${filterEndDate}`}
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

      {!readOnly && (
        <StandardModal
          isOpen={Boolean(rejectTarget)}
          onClose={() => setRejectTarget(null)}
          title="Reject request"
          footerNode={(
            <>
              <Button variant="tertiary" onClick={() => setRejectTarget(null)}>Cancel</Button>
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
      )}
    </Container>
  );
};

AdminRequestsView.propTypes = {
  readOnly: PropTypes.bool,
};

AdminRequestsView.defaultProps = {
  readOnly: false,
};

export default AdminRequestsView;
