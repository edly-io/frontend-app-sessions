import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import {
  Alert, Badge, Button, Container, DataTable, Form, Spinner,
} from '@openedx/paragon';
import { Add } from '@openedx/paragon/icons';

import { getMyRequests, deleteRequest, withdrawRequest } from './api';
import {
  REQUEST_STATUS,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_VARIANTS,
  REQUEST_TYPE,
  REQUEST_TYPE_LABELS,
  REQUEST_TYPE_VARIANTS,
} from '../shared/constants';
import { extractApiError, formatDateTime } from '../shared/utils';
import CreateRequestModal from './CreateRequestModal';
import RequestDetailCell from './RequestDetailCell';
import LeaveUsageSummary from './LeaveUsageSummary';

const PAGE_SIZE = 15;

const TRUNCATE_AT = 40;

const SectionHeading = ({ children }) => (
  <h3 style={{
    fontSize: 19,
    fontWeight: 700,
    color: '#1e40af',
    borderBottom: '2px solid #bfdbfe',
    paddingBottom: 10,
    marginBottom: 20,
    marginTop: 0,
    letterSpacing: '-0.01em',
  }}
  >
    {children}
  </h3>
);

SectionHeading.propTypes = {
  children: PropTypes.node.isRequired,
};

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

const LearnerRequestsView = ({ lockedType }) => {
  const { programId } = useParams();
  const [requests, setRequests] = useState([]);
  const [count, setCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterState, setFilterState] = useState('');
  // eslint-disable-next-line react/destructuring-assignment
  const [filterType, setFilterType] = useState(lockedType || '');
  useEffect(() => { setFilterType(lockedType || ''); }, [lockedType]);
  const [filterQ, setFilterQ] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  // Shape: { id: string, kind: 'delete' | 'withdraw', requestTypeLabel?: string }

  const fetchData = useCallback(async ({ pageIndex: nextIndex } = {}) => {
    const targetIndex = nextIndex ?? 0;
    setError('');
    try {
      const data = await getMyRequests({
        program_key: programId,
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
      setError(extractApiError(err, 'Failed to load your requests'));
    } finally {
      setInitialLoading(false);
    }
  }, [programId, filterState, filterType, filterQ, filterStartDate, filterEndDate]);

  useEffect(() => { fetchData({ pageIndex: 0 }); }, [fetchData]);

  /* eslint-disable react/no-unstable-nested-components, react/prop-types */
  const columns = useMemo(() => [
    ...(!lockedType ? [{
      Header: 'Type',
      accessor: 'request_type_label',
      Cell: ({ value }) => (
        <Badge variant={REQUEST_TYPE_VARIANTS[value] || 'secondary'}>
          {REQUEST_TYPE_LABELS[value] || value}
        </Badge>
      ),
    }] : []),
    {
      Header: 'Detail',
      id: 'detail',
      Cell: ({ row }) => <RequestDetailCell req={row.original} programKey={programId || ''} />,
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
      Header: 'Reviewer note',
      accessor: 'reviewer_note',
      Cell: ({ value }) => (value ? <CollapsibleText text={value} muted /> : <span className="text-muted">—</span>),
    },
    {
      Header: 'Submitted',
      accessor: 'created',
      Cell: ({ value }) => formatDateTime(value),
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
    {
      Header: 'Actions',
      id: 'actions',
      Cell: ({ row }) => {
        const req = row.original;
        const isLeave = req.request_type_label === REQUEST_TYPE.LEAVE;

        // Confirm step active for this row
        if (confirmAction?.id === req.id) {
          const btnVariant = confirmAction.kind === 'delete' ? 'danger' : 'warning';
          return (
            <span style={{ display: 'flex', gap: 4 }}>
              <Button
                variant={btnVariant}
                size="sm"
                onClick={async () => {
                  try {
                    if (confirmAction.kind === 'withdraw') {
                      await withdrawRequest(req.id);
                    } else {
                      await deleteRequest(req.id, confirmAction.requestTypeLabel);
                    }
                  } catch (err) {
                    setError(extractApiError(err, 'Action failed'));
                  } finally {
                    setConfirmAction(null);
                    fetchData({ pageIndex: 0 });
                  }
                }}
              >
                Confirm
              </Button>
              <Button
                variant="tertiary"
                size="sm"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </Button>
            </span>
          );
        }

        // PENDING → Delete (works for both leave and remote_session)
        if (req.state === REQUEST_STATUS.PENDING) {
          return (
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => setConfirmAction({
                id: req.id,
                kind: 'delete',
                requestTypeLabel: req.request_type_label,
              })}
            >
              Delete
            </Button>
          );
        }

        // WITHDRAWAL_REJECTED leave → helper text + Withdraw
        if (req.state === REQUEST_STATUS.WITHDRAWAL_REJECTED && isLeave) {
          return (
            <div>
              <small className="text-muted d-block mb-1">
                Your previous withdrawal request was denied.
              </small>
              <Button
                variant="outline-warning"
                size="sm"
                onClick={() => setConfirmAction({ id: req.id, kind: 'withdraw' })}
              >
                Withdraw
              </Button>
            </div>
          );
        }

        // APPROVED leave → Withdraw
        if (req.state === REQUEST_STATUS.APPROVED && isLeave) {
          return (
            <Button
              variant="outline-warning"
              size="sm"
              onClick={() => setConfirmAction({ id: req.id, kind: 'withdraw' })}
            >
              Withdraw
            </Button>
          );
        }

        return null;
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [confirmAction]);
  /* eslint-enable react/no-unstable-nested-components, react/prop-types */

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

      {lockedType === REQUEST_TYPE.LEAVE && (
        <div className="mb-5">
          <SectionHeading>My Leave Usage</SectionHeading>
          <LeaveUsageSummary programKey={programId || ''} />
        </div>
      )}

      <div className="mb-4">
        <SectionHeading>Requests</SectionHeading>
      </div>

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
          {!lockedType && (
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
          )}
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
          <Button
            variant="primary"
            size="sm"
            iconBefore={Add}
            onClick={() => setShowCreateModal(true)}
          >
            New request
          </Button>
        </div>
      </div>

      {count === 0 ? (
        <Alert variant="info">No requests yet. Use &quot;New request&quot; to get started.</Alert>
      ) : (
        <div className="sticky-header-table">
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
        </div>
      )}

      <CreateRequestModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        programKey={programId || ''}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchData({ pageIndex: 0 });
        }}
      />
    </Container>
  );
};

LearnerRequestsView.propTypes = {
  lockedType: PropTypes.string,
};

LearnerRequestsView.defaultProps = {
  lockedType: null,
};

export default LearnerRequestsView;
