import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Badge, Button, Container, DataTable, Form, Spinner,
} from '@openedx/paragon';

import { useConfig } from '../app/useConfig';
import {
  SUBSTITUTE_REQUEST_STATUS,
  SUBSTITUTE_REQUEST_STATUS_LABELS,
  SUBSTITUTE_REQUEST_STATUS_VARIANTS,
  USER_ROLE,
} from '../shared/constants';
import { extractApiError, formatDateTime } from '../shared/utils';
import { cancelSession } from '../calendar/api';
import { getSubstituteRequests, closeSubstituteRequest, getSubstituteRequest } from './api';
import AssignSubstituteModal from './AssignSubstituteModal';
import useModalParams from '../shared/useModalParams';

const PAGE_SIZE = 15;

const SubstituteRequestsView = () => {
  const { programId } = useParams();
  const { data: config } = useConfig();

  const [requests, setRequests] = useState([]);
  const [count, setCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const {
    modal, modalId, openModal, closeModal,
  } = useModalParams();
  const isAssignOpen = modal === 'assign-substitute';
  const [assignModalData, setAssignModalData] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const fetchData = useCallback(async ({ pageIndex: nextIndex } = {}) => {
    const targetIndex = nextIndex ?? 0;
    setError('');
    try {
      const data = await getSubstituteRequests({
        program_key: programId,
        ...(filterStatus ? { status: filterStatus } : {}),
        ...(filterDateFrom ? { date_from: filterDateFrom } : {}),
        ...(filterDateTo ? { date_to: filterDateTo } : {}),
        page: targetIndex + 1,
        page_size: PAGE_SIZE,
      });
      const results = Array.isArray(data) ? data : data.results ?? [];
      const total = Array.isArray(data) ? data.length : data.count ?? results.length;
      setRequests(results);
      setCount(total);
      setPageIndex(targetIndex);
    } catch (err) {
      setError(extractApiError(err, 'Failed to load substitute requests'));
    } finally {
      setInitialLoading(false);
    }
  }, [programId, filterStatus, filterDateFrom, filterDateTo]);

  useEffect(() => { fetchData({ pageIndex: 0 }); }, [fetchData]);

  useEffect(() => {
    if (!isAssignOpen || !modalId) { setAssignModalData(null); return; }
    const found = requests.find((r) => String(r.id) === String(modalId));
    if (found) { setAssignModalData(found); return; }
    getSubstituteRequest(modalId)
      .then(setAssignModalData)
      .catch(() => closeModal());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAssignOpen, modalId, requests]);

  const handleCancelSession = async (req) => {
    try {
      await cancelSession(req.session.id);
      await closeSubstituteRequest(req.id);
    } catch (err) {
      setError(extractApiError(err, 'Failed to cancel session'));
    } finally {
      setCancellingId(null);
      fetchData({ pageIndex: 0 });
    }
  };

  /* eslint-disable react/no-unstable-nested-components, react/prop-types */
  const columns = useMemo(() => [
    {
      Header: 'Session',
      id: 'session',
      Cell: ({ row }) => {
        const { session } = row.original;
        return (
          <div>
            <div style={{ fontWeight: 600 }}>{session.title}</div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              {formatDateTime(session.scheduled_start_time)}
            </div>
            {session.location?.name && (
              <div className="text-muted" style={{ fontSize: 12 }}>{session.location.name}</div>
            )}
          </div>
        );
      },
    },
    {
      Header: 'Instructor on Leave',
      id: 'instructor',
      Cell: ({ row }) => {
        const { leave_request: lr } = row.original;
        return (
          <div>
            <div style={{ fontSize: 13 }}>{lr.submitter_email}</div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              {lr.leave_start_date} – {lr.leave_end_date}
            </div>
          </div>
        );
      },
    },
    {
      Header: 'Status',
      accessor: 'status',
      Cell: ({ value }) => (
        <Badge variant={SUBSTITUTE_REQUEST_STATUS_VARIANTS[value] || 'secondary'}>
          {SUBSTITUTE_REQUEST_STATUS_LABELS[value] || value}
        </Badge>
      ),
    },
    {
      Header: 'Substitute',
      accessor: 'substitute_instructor_email',
      Cell: ({ value }) => (value
        ? <span style={{ fontSize: 13 }}>{value}</span>
        : <span className="text-muted">—</span>),
    },
    {
      Header: 'Actions',
      id: 'actions',
      Cell: ({ row }) => {
        const req = row.original;
        const isClosed = req.status === SUBSTITUTE_REQUEST_STATUS.CLOSED;

        if (cancellingId === req.id) {
          return (
            <div style={{ fontSize: 12 }}>
              <p className="mb-2" style={{ color: '#374151' }}>
                Cancel this session and close the substitute request?
              </p>
              <span style={{ display: 'flex', gap: 4 }}>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleCancelSession(req)}
                >
                  Cancel Session
                </Button>
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={() => setCancellingId(null)}
                >
                  No, go back
                </Button>
              </span>
            </div>
          );
        }

        if (isClosed) { return null; }

        return (
          <span style={{ display: 'flex', gap: 4 }}>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => openModal('assign-substitute', req.id)}
            >
              Assign Substitute
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => setCancellingId(req.id)}
            >
              Cancel Session
            </Button>
          </span>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [cancellingId]);
  /* eslint-enable react/no-unstable-nested-components, react/prop-types */

  if (config?.user_role !== USER_ROLE.ADMIN) { return null; }

  if (initialLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Loading substitute requests...</p>
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
          as="select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ width: 'auto' }}
        >
          <option value="">All statuses</option>
          {Object.entries(SUBSTITUTE_REQUEST_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Form.Control>

        <div className="d-flex align-items-center ml-auto" style={{ gap: 4 }}>
          <small className="text-muted text-nowrap">Session date:</small>
          <Form.Control
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            style={{ width: 'auto' }}
            aria-label="From date"
          />
          <span className="text-muted">–</span>
          <Form.Control
            type="date"
            value={filterDateTo}
            min={filterDateFrom || undefined}
            onChange={(e) => setFilterDateTo(e.target.value)}
            style={{ width: 'auto' }}
            aria-label="To date"
          />
          {(filterDateFrom || filterDateTo) && (
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {count === 0 ? (
        <Alert variant="info">No substitute requests found for this program.</Alert>
      ) : (
        <div className="sticky-header-table">
          <DataTable
            key={`${filterStatus}-${filterDateFrom}-${filterDateTo}`}
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
            <DataTable.EmptyTable content="No substitute requests" />
            <DataTable.TableFooter />
          </DataTable>
        </div>
      )}

      <AssignSubstituteModal
        isOpen={isAssignOpen && !!assignModalData}
        onClose={() => { closeModal(); setAssignModalData(null); }}
        substituteRequest={assignModalData}
        programKey={programId || ''}
        onSuccess={() => {
          closeModal();
          setAssignModalData(null);
          fetchData({ pageIndex: 0 });
        }}
      />
    </Container>
  );
};

export default SubstituteRequestsView;
