import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import {
  Alert, Badge, Button, Col, Container, DataTable, Form, Row, Spinner, StandardModal,
} from '@openedx/paragon';

import { Add } from '@openedx/paragon/icons';
import { UserIdentity } from '@edly-io/frontend-component-fbr';
import {
  getRequests, reviewRequest, bulkApproveLeaves,
} from './api';
import {
  REQUEST_STATUS,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_VARIANTS,
  REQUEST_TYPE,
  REQUEST_TYPE_LABELS,
  REQUEST_TYPE_VARIANTS,
} from '../shared/constants';
import {
  extractApiError, formatDateTime, isLeaveStartDatePast, formatLeaveRange,
} from '../shared/utils';
import SectionHeading from '../shared/SectionHeading';
import DatepickerControl from '../shared/date-picker-control/DatepickerControl';
import './requests.scss';
import RequestDetailCell from './RequestDetailCell';
import CreateRequestModal from './CreateRequestModal';
import useModalParams from '../shared/useModalParams';
import LeaveUsagePanel from './LeaveUsagePanel';
import SessionLeavesPanel from './SessionLeavesPanel';
import { MobileRowCard, MobileRowCardsList, MobileRowField } from '../shared/MobileRowCards';
import useIsBelowLg from '../shared/useIsBelowLg';

const PAGE_SIZE = 15;

const TRUNCATE_AT = 40;

// Past-dated (leave_start_date < today) warnings, per action.
const PAST_LEAVE_APPROVE_WARNING = "Leave date has passed. Check the trainee wasn't marked present before approving.";
const PAST_LEAVE_WITHDRAWAL_WARNING = "Leave date has passed. Approving cancels the leave and returns it to the trainee's balance. Add a note to say why.";
const PAST_LEAVE_SHORT_WARNING = 'Leave date has already passed.';

const SUBMITTER_ROLE_BADGES = {
  instructor: 'Instructor',
  learner: 'Trainee',
  admin: 'Admin',
};

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
      <Button
        variant="link"
        onClick={() => setExpanded((p) => !p)}
        className="requests-view__collapsible-toggle"
      >
        {expanded ? 'less' : 'more'}
      </Button>
    </span>
  );
};
CollapsibleText.propTypes = { text: PropTypes.string, muted: PropTypes.bool };
CollapsibleText.defaultProps = { text: '', muted: false };

const AdminRequestsView = ({ readOnly, showNewRequest, lockedType }) => {
  const isBelowLg = useIsBelowLg();
  const { programId } = useParams();
  const { modal, openModal, closeModal } = useModalParams();
  const isCreateOpen = modal === 'new-request';
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
  const [actioningId, setActioningId] = useState(null);
  const [noteModal, setNoteModal] = useState(null);
  const [noteText, setNoteText] = useState('');

  // Bulk selection — leaves tab only; driven by a single Select All checkbox
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);
  // When set, a confirm dialog lists the selected leaves whose date has already passed.
  const [bulkPastLeaves, setBulkPastLeaves] = useState(null);

  // Clear selection on filter/page change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [pageIndex, filterState, filterType, filterQ, filterStartDate, filterEndDate]);

  // Pending IDs on the current page — used for Select All
  const pendingIds = useMemo(
    () => requests.filter((r) => r.state === REQUEST_STATUS.PENDING).map((r) => r.id),
    [requests],
  );

  const allPendingSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedIds.has(id));

  const handleSelectAll = (checked) => {
    setSelectedIds(checked ? new Set(pendingIds) : new Set());
  };

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
  const handleApproveWithdrawal = (request) => applyReview(request, REQUEST_STATUS.WITHDRAWN);

  // Approving the withdrawal of a past-dated leave reverses an approved leave, so it
  // needs a deliberate confirmation + justification note (also enforced server-side).
  // Forward approvals (pending) stay one-click; they only show an inline warning.
  const handleOpenWithdrawalModal = (request) => {
    setNoteText('');
    setNoteModal({
      request,
      targetState: REQUEST_STATUS.WITHDRAWN,
      title: 'Approve withdrawal',
      confirmLabel: 'Approve withdrawal',
      confirmVariant: 'success',
      noteRequired: true,
      warning: PAST_LEAVE_WITHDRAWAL_WARNING,
    });
  };

  const handleApproveWithdrawalClick = (request) => (
    isLeaveStartDatePast(request)
      ? handleOpenWithdrawalModal(request)
      : handleApproveWithdrawal(request)
  );

  const handleOpenRejectModal = (request, targetState) => {
    setNoteText('');
    const isWithdrawal = targetState === REQUEST_STATUS.WITHDRAWAL_REJECTED;
    setNoteModal({
      request,
      targetState,
      title: isWithdrawal ? 'Reject withdrawal' : 'Reject request',
      confirmLabel: isWithdrawal ? 'Reject withdrawal' : 'Reject request',
    });
  };

  const handleConfirmNoteModal = async () => {
    if (!noteModal) { return; }
    await applyReview(noteModal.request, noteModal.targetState, noteText.trim());
    setNoteModal(null);
  };

  const doBulkApprove = async () => {
    setBulkApproving(true);
    try {
      const result = await bulkApproveLeaves({
        program_key: programId,
        leave_ids: [...selectedIds],
      });
      setSelectedIds(new Set());
      fetchData({ pageIndex: 0 });
      if (result.ignored_count > 0) {
        setError(`Approved ${result.approved_count}. ${result.ignored_count} could not be approved.`);
      }
    } catch (err) {
      setError(extractApiError(err, 'Bulk approve failed'));
    } finally {
      setBulkApproving(false);
    }
  };

  const handleBulkApprove = () => {
    // Warn once, listing the selected leaves whose date has already passed.
    const pastLeaves = [...selectedIds]
      .map((id) => requests.find((r) => r.id === id))
      .filter((r) => r && isLeaveStartDatePast(r));
    if (pastLeaves.length > 0) {
      setBulkPastLeaves(pastLeaves);
      return;
    }
    doBulkApprove();
  };

  const handleConfirmBulkApprove = () => {
    setBulkPastLeaves(null);
    doBulkApprove();
  };

  const renderActions = useCallback((request) => {
    if (readOnly) { return null; }
    const isPending = request.state === REQUEST_STATUS.PENDING;
    const isWithdrawalPending = request.state === REQUEST_STATUS.WITHDRAWAL_PENDING;
    if (!isPending && !isWithdrawalPending) { return null; }
    const busy = actioningId === request.id;
    const datePassed = isLeaveStartDatePast(request);

    if (isWithdrawalPending) {
      return (
        <div>
          {datePassed && (
            <small className="text-danger d-block mb-1">{PAST_LEAVE_SHORT_WARNING}</small>
          )}
          <div className="requests-view__row-actions">
            <Button variant="primary" size="sm" onClick={() => handleApproveWithdrawalClick(request)} disabled={busy}>
              Approve Withdrawal
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => handleOpenRejectModal(request, REQUEST_STATUS.WITHDRAWAL_REJECTED)}
              disabled={busy}
            >
              Reject Withdrawal
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div>
        {datePassed && (
          <small className="text-danger d-block mb-1">{PAST_LEAVE_APPROVE_WARNING}</small>
        )}
        <div className="requests-view__row-actions">
          <Button variant="primary" size="sm" onClick={() => handleApprove(request)} disabled={busy}>
            Approve
          </Button>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={() => handleOpenRejectModal(request, REQUEST_STATUS.REJECTED)}
            disabled={busy}
          >
            Reject
          </Button>
        </div>
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, actioningId]);

  /* eslint-disable react/no-unstable-nested-components, react/prop-types */
  const columns = useMemo(() => {
    const base = [
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
        Header: 'Submitter',
        id: 'submitter',
        Cell: ({ row }) => {
          const req = row.original;
          const displayName = req.submitter_name || req.submitter_email;
          if (!displayName) { return <span className="text-muted">—</span>; }
          return (
            <div>
              <UserIdentity
                name={displayName}
                badges={[SUBMITTER_ROLE_BADGES[req.submitter_role]]}
                size="compact"
              />
              {req.submitter_name && req.submitter_email && (
                <small className="text-muted d-block mt-1">{req.submitter_email}</small>
              )}
              {lockedType === REQUEST_TYPE.LEAVE && req.would_exceed_threshold === true && (
                <small className="text-danger d-block mt-1">
                  Approval would exceed threshold
                </small>
              )}
              {lockedType === REQUEST_TYPE.LEAVE && req.has_session_conflict === true && (
                <small className="requests-view__conflict-note d-block mt-1">
                  Sessions scheduled during leave period
                </small>
              )}
            </div>
          );
        },
      },
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
        Header: 'Submitted',
        accessor: 'created',
        Cell: ({ value }) => <span className="text-nowrap">{formatDateTime(value)}</span>,
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
            <a href={attachment} target="_blank" rel="noopener noreferrer" className="requests-view__attachment-link">
              {filename}
            </a>
          );
        },
      },
      {
        Header: 'Audit log',
        id: 'audit-log',
        Cell: ({ row }) => (
          <Button
            as={Link}
            variant="outline-primary"
            size="sm"
            className="text-nowrap"
            to={`?view=audit-log&record_id=${row.original.id}`}
          >
            History
          </Button>
        ),
      },
    ];

    if (!readOnly) {
      base.push({
        Header: 'Actions',
        id: 'actions',
        Cell: ({ row }) => renderActions(row.original),
      });
    }

    return base;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actioningId, readOnly, lockedType, renderActions]);
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

      {/* ── Requests ──────────────────────────────────────────────── */}
      <div className="mb-5">
        <SectionHeading>Requests</SectionHeading>

        <Row className="requests-filters align-items-end">
          <Col xs={12} sm={6} lg={3} className="mb-2">
            <Form.Label htmlFor="admin-requests-search" className="requests-filters__label">
              Search
            </Form.Label>
            <Form.Control
              id="admin-requests-search"
              type="text"
              value={filterQ}
              onChange={(e) => setFilterQ(e.target.value)}
              placeholder="Search..."
            />
          </Col>

          <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
            <Form.Label htmlFor="admin-requests-status" className="requests-filters__label">
              Status
            </Form.Label>
            <Form.Control
              id="admin-requests-status"
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
              <Form.Label htmlFor="admin-requests-type" className="requests-filters__label">
                Type
              </Form.Label>
              <Form.Control
                id="admin-requests-type"
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
                <Form.Label htmlFor="admin-requests-date-from" className="requests-filters__date-label">
                  From
                </Form.Label>
                <DatepickerControl
                  id="admin-requests-date-from"
                  value={filterStartDate}
                  onChange={setFilterStartDate}
                  className="requests-filters__date"
                />
              </div>
              <div className="requests-filters__date-field">
                <Form.Label htmlFor="admin-requests-date-to" className="requests-filters__date-label">
                  To
                </Form.Label>
                <DatepickerControl
                  id="admin-requests-date-to"
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

        {(showNewRequest || (lockedType === REQUEST_TYPE.LEAVE && pendingIds.length > 0)) && (
          <div className="requests-view__inline-status requests-view__bulk-bar flex-wrap mb-3">
            {lockedType === REQUEST_TYPE.LEAVE && pendingIds.length > 0 && (
              <>
                <Form.Checkbox
                  id="select-all-pending"
                  checked={allPendingSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                >
                  {`Select all pending (${pendingIds.length})`}
                </Form.Checkbox>
                {/* Always rendered (disabled until something is selected) so the
                    layout never shifts when the selection changes. */}
                <Button
                  variant="warning"
                  size="sm"
                  className="requests-view__bulk-approve"
                  onClick={handleBulkApprove}
                  disabled={bulkApproving || selectedIds.size === 0}
                >
                  {bulkApproving && <Spinner animation="border" size="sm" className="mr-1" />}
                  {selectedIds.size > 0 ? `Bulk Approve (${selectedIds.size})` : 'Bulk Approve'}
                </Button>
              </>
            )}
            {showNewRequest && (
              <Button
                variant="primary"
                size="sm"
                iconBefore={Add}
                className="ml-sm-auto flex-shrink-0"
                onClick={() => openModal('new-request')}
              >
                New request
              </Button>
            )}
          </div>
        )}

        {showNewRequest && (
          <CreateRequestModal
            isOpen={isCreateOpen}
            onClose={closeModal}
            programKey={programId || ''}
            lockedType={lockedType || null}
            onSuccess={() => { closeModal(); fetchData({ pageIndex: 0 }); }}
          />
        )}

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
            {!isBelowLg && (
              <div className="sticky-header-table sessions-table-scroll">
                <DataTable.Table />
                <DataTable.EmptyTable content="No requests" />
              </div>
            )}
            {isBelowLg && requests.length > 0 && (
              <MobileRowCardsList>
                  {requests.map((req) => {
                    const displayName = req.submitter_name || req.submitter_email;
                    const { attachment } = req;
                    const filename = attachment ? decodeURIComponent(attachment.split('/').pop() || 'file') : null;
                    const actions = renderActions(req);
                    return (
                      <MobileRowCard
                        key={req.id}
                        title={<RequestDetailCell req={req} programKey={programId || ''} />}
                        subtitle={req.created ? formatDateTime(req.created) : null}
                        footer={(
                          <div className="d-flex flex-wrap gap-2 w-100 justify-content-end">
                            <Button
                              as={Link}
                              variant="outline-primary"
                              size="sm"
                              className="text-nowrap"
                              to={`?view=audit-log&record_id=${req.id}`}
                            >
                              History
                            </Button>
                            {actions}
                          </div>
                        )}
                      >
                        {!lockedType && (
                          <MobileRowField label="Type">
                            <Badge variant={REQUEST_TYPE_VARIANTS[req.request_type_label] || 'secondary'}>
                              {REQUEST_TYPE_LABELS[req.request_type_label] || req.request_type_label}
                            </Badge>
                          </MobileRowField>
                        )}
                        {displayName && (
                          <MobileRowField label="Submitter">
                            <div>
                              <UserIdentity
                                name={displayName}
                                badges={[SUBMITTER_ROLE_BADGES[req.submitter_role]]}
                                size="compact"
                              />
                              {req.submitter_name && req.submitter_email && (
                                <small className="text-muted d-block mt-1">{req.submitter_email}</small>
                              )}
                              {lockedType === REQUEST_TYPE.LEAVE && req.would_exceed_threshold === true && (
                                <small className="text-danger d-block mt-1">
                                  Approval would exceed threshold
                                </small>
                              )}
                              {lockedType === REQUEST_TYPE.LEAVE && req.has_session_conflict === true && (
                                <small className="requests-view__conflict-note d-block mt-1">
                                  Sessions scheduled during leave period
                                </small>
                              )}
                            </div>
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
      </div>

      {/* ── Leave Summaries ───────────────────────────────────────── */}
      {lockedType === REQUEST_TYPE.LEAVE && (
        <div className="mb-5">
          <SectionHeading>Leave Summaries</SectionHeading>
          <LeaveUsagePanel programKey={programId} />
        </div>
      )}

      {/* ── Sessions & Approved Leaves ────────────────────────────── */}
      {lockedType === REQUEST_TYPE.LEAVE && (
        <div>
          <SessionLeavesPanel programKey={programId} />
        </div>
      )}

      {!readOnly && (
        <StandardModal
          isOpen={Boolean(noteModal)}
          onClose={() => setNoteModal(null)}
          title={noteModal?.title ?? 'Reject request'}
          isFullscreenOnMobile
          footerNode={(
            <>
              <Button variant="tertiary" onClick={() => setNoteModal(null)}>Cancel</Button>
              <Button
                variant={noteModal?.confirmVariant ?? 'danger'}
                onClick={handleConfirmNoteModal}
                disabled={
                  actioningId === noteModal?.request?.id
                  || (noteModal?.noteRequired && !noteText.trim())
                }
                className="ml-2"
              >
                {noteModal?.confirmLabel ?? 'Reject request'}
              </Button>
            </>
          )}
        >
          {noteModal?.warning && (
            <Alert variant="warning" className="py-2 px-3 mb-2">{noteModal.warning}</Alert>
          )}
          <Form.Group>
            <Form.Label>
              {noteModal?.noteRequired ? 'Justification note (required)' : 'Note for the learner (optional)'}
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={noteModal?.noteRequired
                ? 'Explain why this withdrawal is being approved after the leave date.'
                : "Let them know why you couldn't approve this request."}
              maxLength={500}
            />
          </Form.Group>
        </StandardModal>
      )}

      {!readOnly && (
        <StandardModal
          isOpen={bulkPastLeaves !== null}
          onClose={() => setBulkPastLeaves(null)}
          title={`Approve past-dated ${(bulkPastLeaves?.length ?? 0) === 1 ? 'leave' : 'leaves'}?`}
          isFullscreenOnMobile
          footerNode={(
            <>
              <Button variant="tertiary" onClick={() => setBulkPastLeaves(null)}>Cancel</Button>
              <Button variant="success" onClick={handleConfirmBulkApprove} className="ml-2">
                {`Approve all (${selectedIds.size})`}
              </Button>
            </>
          )}
        >
          <p className="mb-2">
            {`You are approving ${selectedIds.size} `
              + `${selectedIds.size === 1 ? 'leave' : 'leaves'}; `
              + `${bulkPastLeaves?.length ?? 0} of them `
              + `${(bulkPastLeaves?.length ?? 0) === 1
                ? 'is for a date that has'
                : 'are for dates that have'} already passed (listed below):`}
          </p>
          <ul className="pl-3 mb-2">
            {(bulkPastLeaves ?? []).map((lv) => (
              <li key={lv.id}>
                {lv.submitter_name || lv.submitter_email}
                {' — '}
                {formatLeaveRange(lv)}
                {lv.reason ? ` (${lv.reason})` : ''}
              </li>
            ))}
          </ul>
          <p className="mb-0">
            {(bulkPastLeaves?.length ?? 0) === 1 ? 'Approve it anyway?' : 'Approve them anyway?'}
          </p>
        </StandardModal>
      )}
    </Container>
  );
};

AdminRequestsView.propTypes = {
  readOnly: PropTypes.bool,
  showNewRequest: PropTypes.bool,
  lockedType: PropTypes.string,
};

AdminRequestsView.defaultProps = {
  readOnly: false,
  showNewRequest: false,
  lockedType: null,
};

export default AdminRequestsView;
