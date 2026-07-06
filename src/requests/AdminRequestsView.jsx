import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import {
  Alert, Badge, Button, Container, DataTable, Form, Spinner, StandardModal,
} from '@openedx/paragon';

import { Add } from '@openedx/paragon/icons';
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
  USER_ROLE,
} from '../shared/constants';
import { extractApiError, formatDateTime } from '../shared/utils';
import RequestDetailCell from './RequestDetailCell';
import CreateRequestModal from './CreateRequestModal';
import ThresholdControl from './ThresholdControl';
import useModalParams from '../shared/useModalParams';
import LeaveUsagePanel from './LeaveUsagePanel';
import SessionLeavesPanel from './SessionLeavesPanel';
import { getProgram } from '../app/api';

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

const SUBMITTER_ROLE_BADGES = {
  [USER_ROLE.INSTRUCTOR]: { label: 'Instructor', variant: 'info' },
  [USER_ROLE.LEARNER]: { label: 'Learner', variant: 'secondary' },
  [USER_ROLE.ADMIN]: { label: 'Admin', variant: 'primary' },
};

const SubmitterRoleBadge = ({ role }) => {
  const def = SUBMITTER_ROLE_BADGES[role];
  if (!def) { return null; }
  return <Badge variant={def.variant}>{def.label}</Badge>;
};
SubmitterRoleBadge.propTypes = {
  role: PropTypes.string,
};
SubmitterRoleBadge.defaultProps = {
  role: '',
};

const AdminRequestsView = ({ readOnly, showNewRequest, lockedType }) => {
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

  // Threshold — leaves tab only (for ThresholdControl settings UI)
  const [threshold, setThreshold] = useState(null);
  const [thresholdLoading, setThresholdLoading] = useState(false);

  // Fetch threshold when in leaves tab
  useEffect(() => {
    if (lockedType !== REQUEST_TYPE.LEAVE) { return; }
    setThresholdLoading(true);
    getProgram(programId)
      .then((p) => setThreshold(p.threshold ?? null))
      .catch(() => {})
      .finally(() => setThresholdLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, lockedType]);

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

  const handleBulkApprove = async () => {
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
              <div>{displayName}</div>
              {req.submitter_role && (
                <div className="mt-1">
                  <SubmitterRoleBadge role={req.submitter_role} />
                </div>
              )}
              {req.submitter_name && req.submitter_email && (
                <small className="text-muted d-block mt-1">{req.submitter_email}</small>
              )}
              {lockedType === REQUEST_TYPE.LEAVE && req.would_exceed_threshold === true && (
                <small style={{ color: '#dc2626', display: 'block', fontSize: 11 }}>
                  ⚠ Approval would exceed threshold
                </small>
              )}
            </div>
          );
        },
      },
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
          const isPending = request.state === REQUEST_STATUS.PENDING;
          const isWithdrawalPending = request.state === REQUEST_STATUS.WITHDRAWAL_PENDING;
          if (!isPending && !isWithdrawalPending) { return null; }
          const busy = actioningId === request.id;

          if (isWithdrawalPending) {
            return (
              <div className="d-flex" style={{ gap: '0.4rem' }}>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => handleApproveWithdrawal(request)}
                  disabled={busy}
                >
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
            );
          }

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
                onClick={() => handleOpenRejectModal(request, REQUEST_STATUS.REJECTED)}
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actioningId, readOnly, lockedType]);
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

      {/* ── Settings ──────────────────────────────────────────────── */}
      {lockedType === REQUEST_TYPE.LEAVE && !thresholdLoading && threshold !== null && (
        <div className="mb-5">
          <SectionHeading>Settings</SectionHeading>
          <ThresholdControl
            programKey={programId}
            initialThreshold={threshold}
            onUpdate={(t) => setThreshold(t)}
          />
        </div>
      )}

      {/* ── Requests ──────────────────────────────────────────────── */}
      <div className="mb-5">
        <SectionHeading>Requests</SectionHeading>

        {/* Filter toolbar */}
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
            {/* Bulk approve controls — leaves tab only */}
            {lockedType === REQUEST_TYPE.LEAVE && pendingIds.length > 0 && (
              <div className="d-flex align-items-center" style={{ gap: 8 }}>
                <Form.Check
                  type="checkbox"
                  id="select-all-pending"
                  label={`Select all pending (${pendingIds.length})`}
                  checked={allPendingSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
                {selectedIds.size > 0 && (
                  <Button
                    variant="warning"
                    size="sm"
                    onClick={handleBulkApprove}
                    disabled={bulkApproving}
                  >
                    {bulkApproving && <Spinner animation="border" size="sm" className="mr-1" />}
                    Bulk Approve ({selectedIds.size})
                  </Button>
                )}
              </div>
            )}
            {showNewRequest && (
              <Button
                variant="primary"
                size="sm"
                iconBefore={Add}
                onClick={() => openModal('new-request')}
              >
                New request
              </Button>
            )}
          </div>
        </div>

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
          footerNode={(
            <>
              <Button variant="tertiary" onClick={() => setNoteModal(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={handleConfirmNoteModal}
                disabled={actioningId === noteModal?.request?.id}
                className="ml-2"
              >
                {noteModal?.confirmLabel ?? 'Reject request'}
              </Button>
            </>
          )}
        >
          <Form.Group>
            <Form.Label>Note for the learner (optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
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
  showNewRequest: PropTypes.bool,
  lockedType: PropTypes.string,
};

AdminRequestsView.defaultProps = {
  readOnly: false,
  showNewRequest: false,
  lockedType: null,
};

export default AdminRequestsView;
