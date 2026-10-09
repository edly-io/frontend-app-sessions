import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import {
  Alert, Badge, Button, Col, Container, DataTable, Form, Row, Spinner,
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
import SectionHeading from '../shared/SectionHeading';
import DatepickerControl from '../shared/date-picker-control/DatepickerControl';
import './requests.scss';
import CreateRequestModal from './CreateRequestModal';
import RequestDetailCell from './RequestDetailCell';
import LeaveUsageSummary from './LeaveUsageSummary';
import useModalParams from '../shared/useModalParams';
import { MobileRowCard, MobileRowCardsList, MobileRowField } from '../shared/MobileRowCards';
import useIsBelowLg from '../shared/useIsBelowLg';

const PAGE_SIZE = 15;

const TRUNCATE_AT = 40;

const CollapsibleText = ({ text, muted }) => {
  const [expanded, setExpanded] = useState(false);
  const cls = muted ? 'text-muted' : 'text-break';
  const sz = muted ? ' requests-view__collapsible--muted' : '';
  if (!text || text.length <= TRUNCATE_AT) {
    return <span className={`${cls}${sz}`}>{text}</span>;
  }
  return (
    <span className={sz.trim()}>
      <span className={cls}>
        {expanded ? text : `${text.slice(0, TRUNCATE_AT)}…`}
      </span>
      {' '}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="requests-view__collapsible-toggle"
      >
        {expanded ? 'less' : 'more'}
      </button>
    </span>
  );
};
CollapsibleText.propTypes = { text: PropTypes.string, muted: PropTypes.bool };
CollapsibleText.defaultProps = { text: '', muted: false };

const LearnerRequestsView = ({ lockedType }) => {
  const isBelowLg = useIsBelowLg();
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
  const { modal, openModal, closeModal } = useModalParams();
  const isCreateOpen = modal === 'new-request';
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

  const renderActions = useCallback((req) => {
    const isLeave = req.request_type_label === REQUEST_TYPE.LEAVE;

    if (confirmAction?.id === req.id) {
      const btnVariant = confirmAction.kind === 'delete' ? 'danger' : 'warning';
      return (
        <span className="requests-view__row-actions">
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
          <Button variant="tertiary" size="sm" onClick={() => setConfirmAction(null)}>Cancel</Button>
        </span>
      );
    }

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
  }, [confirmAction, fetchData]);

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
      Cell: ({ row }) => (
        <div className="requests-view__detail-cell">
          <RequestDetailCell req={row.original} programKey={programId || ''} />
        </div>
      ),
    },
    {
      Header: 'Reason',
      accessor: 'reason',
      Cell: ({ value }) => <div className="requests-view__reason-cell"><CollapsibleText text={value} /></div>,
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
      Cell: ({ value }) => <span className="text-nowrap">{formatDateTime(value)}</span>,
    },
    {
      Header: 'Attachment',
      id: 'attachment',
      Cell: ({ row }) => {
        const { attachment } = row.original;
        if (!attachment) { return <span className="text-muted">—</span>; }
        const filename = decodeURIComponent(attachment.split('/').pop() || 'file');
        return (
          <a href={attachment} target="_blank" rel="noopener noreferrer" className="requests-view__attachment-link">
            {filename}
          </a>
        );
      },
    },
    {
      Header: 'Actions',
      id: 'actions',
      Cell: ({ row }) => renderActions(row.original),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [confirmAction, renderActions]);
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

      <Row className="requests-filters align-items-end">
        <Col xs={12} sm={6} lg={3} className="mb-2">
          <Form.Label htmlFor="my-requests-search" className="requests-filters__label">
            Search
          </Form.Label>
          <Form.Control
            id="my-requests-search"
            type="text"
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
            placeholder="Search..."
          />
        </Col>

        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label htmlFor="my-requests-status" className="requests-filters__label">
            Status
          </Form.Label>
          <Form.Control
            id="my-requests-status"
            as="select"
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
          >
            <option value="">All statuses</option>
            {Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Form.Control>
        </Col>

        {!lockedType && (
          <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
            <Form.Label htmlFor="my-requests-type" className="requests-filters__label">
              Type
            </Form.Label>
            <Form.Control
              id="my-requests-type"
              as="select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">All types</option>
              {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Form.Control>
          </Col>
        )}

        <Col xs={12} sm="auto" className="mb-2">
          <span className="requests-filters__label">Submission date</span>
          <div className="requests-filters__dates">
            <div className="requests-filters__date-field">
              <Form.Label htmlFor="my-requests-date-from" className="requests-filters__date-label">
                From
              </Form.Label>
              <DatepickerControl
                id="my-requests-date-from"
                value={filterStartDate}
                onChange={setFilterStartDate}
                className="requests-filters__date"
              />
            </div>
            <div className="requests-filters__date-field">
              <Form.Label htmlFor="my-requests-date-to" className="requests-filters__date-label">
                To
              </Form.Label>
              <DatepickerControl
                id="my-requests-date-to"
                value={filterEndDate}
                minDate={filterStartDate}
                onChange={setFilterEndDate}
                className="requests-filters__date"
              />
            </div>
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
        </Col>
      </Row>

      <div className="d-flex mb-3">
        <Button
          variant="primary"
          size="sm"
          iconBefore={Add}
          className="ml-auto flex-shrink-0"
          onClick={() => openModal('new-request')}
        >
          New request
        </Button>
      </div>

      {count === 0 ? (
        <Alert variant="info">No requests yet. Use &quot;New request&quot; to get started.</Alert>
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
          {!isBelowLg && (
            <div className="sticky-header-table sessions-table-scroll">
              <DataTable.Table />
              <DataTable.EmptyTable content="No requests" />
            </div>
          )}
          {isBelowLg && requests.length > 0 && (
            <MobileRowCardsList>
                {requests.map((req) => {
                  const { attachment } = req;
                  const filename = attachment ? decodeURIComponent(attachment.split('/').pop() || 'file') : null;
                  const actions = renderActions(req);
                  return (
                    <MobileRowCard
                      key={req.id}
                      title={<RequestDetailCell req={req} programKey={programId || ''} />}
                      subtitle={req.created ? formatDateTime(req.created) : null}
                      footer={actions}
                    >
                      {!lockedType && (
                        <MobileRowField label="Type">
                          <Badge variant={REQUEST_TYPE_VARIANTS[req.request_type_label] || 'secondary'}>
                            {REQUEST_TYPE_LABELS[req.request_type_label] || req.request_type_label}
                          </Badge>
                        </MobileRowField>
                      )}
                      <MobileRowField label="Status">
                        <Badge variant={REQUEST_STATUS_VARIANTS[req.state] || 'secondary'}>
                          {REQUEST_STATUS_LABELS[req.state] || req.state}
                        </Badge>
                      </MobileRowField>
                      {req.reason && (
                        <MobileRowField label="Reason">
                          <CollapsibleText text={req.reason} />
                        </MobileRowField>
                      )}
                      {req.reviewer_note && (
                        <MobileRowField label="Reviewer note">
                          <CollapsibleText text={req.reviewer_note} muted />
                        </MobileRowField>
                      )}
                      {attachment && (
                        <MobileRowField label="Attachment">
                          <a href={attachment} target="_blank" rel="noopener noreferrer" className="requests-view__attachment-link">
                            {filename}
                          </a>
                        </MobileRowField>
                      )}
                    </MobileRowCard>
                  );
                })}
            </MobileRowCardsList>
          )}
          <DataTable.TableFooter />
        </DataTable>
      )}

      <CreateRequestModal
        isOpen={isCreateOpen}
        onClose={closeModal}
        programKey={programId || ''}
        lockedType={lockedType || null}
        onSuccess={() => {
          closeModal();
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
