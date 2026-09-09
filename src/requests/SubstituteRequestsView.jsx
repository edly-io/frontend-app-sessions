import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Badge, Button, Col, Container, DataTable, Form, Row, Spinner,
} from '@openedx/paragon';

import { useConfig } from '../app/useConfig';
import {
  SESSION_STATUS,
  SESSION_STATUS_LABELS,
  SUBSTITUTE_REQUEST_STATUS,
  SUBSTITUTE_REQUEST_STATUS_LABELS,
  SUBSTITUTE_REQUEST_STATUS_VARIANTS,
  USER_ROLE,
} from '../shared/constants';
import { extractApiError, formatDateTime } from '../shared/utils';
import './requests.scss';
import { cancelSession } from '../calendar/api';
import { getSubstituteRequests, closeSubstituteRequest, getSubstituteRequest } from './api';
import AssignSubstituteModal from './AssignSubstituteModal';
import useModalParams from '../shared/useModalParams';

const PAGE_SIZE = 15;

/**
 * A cancelled session needs no cover.
 *
 * Cancelling from this tab already closes the request, but the calendar's
 * cancel does not — so a row can outlive the session it covers. The backend
 * refuses to assign against one (`session_cancelled`), and this is the same
 * rule applied in the UI so the admin is never offered the action.
 */
const isSessionCancelled = (session) => session?.status === SESSION_STATUS.CANCELLED;

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

  const handleCloseRequest = async (req) => {
    try {
      await closeSubstituteRequest(req.id);
    } catch (err) {
      setError(extractApiError(err, 'Failed to close substitute request'));
    } finally {
      fetchData({ pageIndex: 0 });
    }
  };

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
            <div className="d-flex align-items-center font-weight-bold">
              {session.title}
              {/* The Status column reports the *request's* status, so without
                  this a cancelled session is indistinguishable from a live one
                  and an admin arranges cover for a class that is not happening. */}
              {isSessionCancelled(session) && (
                <Badge variant="light" className="ml-2">{SESSION_STATUS_LABELS.cancelled}</Badge>
              )}
            </div>
            <div className="text-muted requests-view__cell-meta">
              {formatDateTime(session.scheduled_start_time)}
            </div>
            {session.location?.name && (
              <div className="text-muted requests-view__cell-meta">{session.location.name}</div>
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
            <div className="requests-view__cell-text">{lr.submitter_email}</div>
            <div className="text-muted requests-view__cell-meta">
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
        ? <span className="requests-view__cell-text">{value}</span>
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
            <div className="requests-view__cell-meta">
              <p className="mb-2 requests-view__confirm-text">
                Cancel this session and close the substitute request?
              </p>
              <span className="requests-view__row-actions">
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

        // Neither action is meaningful once the session is cancelled: assigning
        // is refused by the backend, and cancelling again returns
        // `already_cancelled`. The row still needs clearing though, and closing
        // is otherwise only reachable as a side effect of "Cancel Session" —
        // so offer it on its own here rather than stranding the row.
        if (isSessionCancelled(req.session)) {
          return (
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => handleCloseRequest(req)}
            >
              Close
            </Button>
          );
        }

        return (
          <span className="requests-view__row-actions">
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

      <Row className="requests-filters align-items-end">
        <Col xs={12} sm={6} md={4} lg={3} className="mb-2">
          <Form.Label htmlFor="substitute-requests-status" className="requests-filters__label">
            Status
          </Form.Label>
          <Form.Control
            id="substitute-requests-status"
            as="select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {Object.entries(SUBSTITUTE_REQUEST_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Form.Control>
        </Col>

        <Col xs={12} sm="auto" className="mb-2">
          <span className="requests-filters__label">Session date</span>
          <div className="requests-filters__dates">
            <div className="requests-filters__date-field">
              <Form.Label htmlFor="substitute-date-from" className="requests-filters__date-label">
                From
              </Form.Label>
              <Form.Control
                id="substitute-date-from"
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="requests-filters__date"
              />
            </div>
            <div className="requests-filters__date-field">
              <Form.Label htmlFor="substitute-date-to" className="requests-filters__date-label">
                To
              </Form.Label>
              <Form.Control
                id="substitute-date-to"
                type="date"
                value={filterDateTo}
                min={filterDateFrom || undefined}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="requests-filters__date"
              />
            </div>
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
        </Col>
      </Row>

      {count === 0 ? (
        <Alert variant="info">No substitute requests found for this program.</Alert>
      ) : (
        <div className="sticky-header-table sessions-table-scroll">
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
