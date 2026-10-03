/* eslint-disable react/prop-types */
/* eslint-disable react/no-unstable-nested-components */
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  ActionRow, Alert, Badge, Button, DataTable, Form, ModalDialog, Pagination, Spinner,
} from '@openedx/paragon';
import { Difference, History } from '@openedx/paragon/icons';
import { UserIdentity } from '@edly-io/frontend-component-fbr';
import { getAuditLogs } from './auditLogApi';
import DatepickerControl from './date-picker-control/DatepickerControl';
import './AuditLogTable.scss';

const PAGE_SIZE = 20;

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  middle_admin: 'Middle Admin',
  data_admin: 'Data Admin',
  instructor: 'Instructor',
  trainee: 'Trainee',
};

const ActorBadge = ({ name, role }) => {
  const label = ROLE_LABELS[role] || '';
  return <UserIdentity name={name} badges={label ? [label] : []} size="compact" />;
};

const ACTION_VARIANT = {
  created: 'success',
  updated: 'primary',
  deleted: 'danger',
};

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: '0', label: 'Created' },
  { value: '1', label: 'Updated' },
  { value: '2', label: 'Deleted' },
];

const MODEL_ACTION_LABELS = {
  session: { created: 'Scheduled', deleted: 'Deleted' },
  sessioninstructor: { created: 'Assigned', deleted: 'Removed' },
  leaverequest: { created: 'Submitted', updated: 'Status Changed' },
  remotesessionrequest: { created: 'Requested', updated: 'Status Changed' },
  substituterequest: { created: 'Assigned', deleted: 'Removed' },
  attendancerecord: { created: 'Marked', updated: 'Updated' },
};

// Filter dropdown options per model — shown when a single model is active.
const MODEL_FILTER_LABELS = {
  session: { 0: 'Scheduled', 1: 'Updated', 2: 'Deleted' },
  sessioninstructor: { 0: 'Assigned', 1: 'Updated', 2: 'Removed' },
  leaverequest: { 0: 'Submitted', 1: 'Status Changed', 2: 'Deleted' },
};

// Filter dropdown options for known multi-model combinations (keyed by sorted, comma-joined model names).
const MULTI_MODEL_FILTER_LABELS = {
  'session,sessioninstructor': { 0: 'Scheduled / Assigned', 1: 'Updated', 2: 'Deleted / Removed' },
  'leaverequest,remotesessionrequest,substituterequest': { 0: 'Submitted / Requested', 1: 'Status Changed', 2: 'Deleted / Removed' },
};

const getFilterOptions = (models) => {
  if (!models || models.length === 0) { return ACTION_OPTIONS; }
  if (models.length === 1 && MODEL_FILTER_LABELS[models[0]]) {
    const labels = MODEL_FILTER_LABELS[models[0]];
    return [
      { value: '', label: 'All actions' },
      { value: '0', label: labels[0] },
      { value: '1', label: labels[1] },
      { value: '2', label: labels[2] },
    ];
  }
  const multiKey = [...models].sort().join(',');
  const multiLabels = MULTI_MODEL_FILTER_LABELS[multiKey];
  if (multiLabels) {
    return [
      { value: '', label: 'All actions' },
      { value: '0', label: multiLabels[0] },
      { value: '1', label: multiLabels[1] },
      { value: '2', label: multiLabels[2] },
    ];
  }
  return ACTION_OPTIONS;
};

// Change-aware label resolver for session cancellations and leave state transitions.
const getActionLabel = (action, recordType, changes) => {
  if (recordType === 'session' && action === 'updated') {
    if (changes?.status?.[1] === 'cancelled') { return 'Cancelled'; }
  }
  if (recordType === 'leaverequest' && action === 'updated') {
    if (changes?.state?.[1] === 'cancelled') { return 'Cancelled'; }
    if (changes?.state?.[1] === 'approved') { return 'Approved'; }
    if (changes?.state?.[1] === 'rejected') { return 'Rejected'; }
    if (changes?.state?.[1] === 'withdrawn') { return 'Withdrawn'; }
    if (changes?.state?.[1] === 'withdrawal_pending') { return 'Withdrawal Requested'; }
  }
  const overrides = MODEL_ACTION_LABELS[recordType];
  return (overrides && overrides[action]) || action;
};

function groupLogs(logs, expandedBatches) {
  const rows = [];
  let i = 0;
  while (i < logs.length) {
    const entry = logs[i];
    const batchId = entry.additional_data?.batch_id;
    let advanced = false;
    if (batchId) {
      const batchEntries = [entry];
      let j = i + 1;
      while (j < logs.length && logs[j].additional_data?.batch_id === batchId) {
        batchEntries.push(logs[j]);
        j++;
      }
      if (batchEntries.length > 1) {
        const first = batchEntries[0];
        rows.push({
          ...first,
          id: `batch-${batchId}`,
          rowType: 'batch',
          batchId,
          batchCount: batchEntries.length,
          batchEntries,
          action: 'batch',
        });
        if (expandedBatches.has(batchId)) {
          batchEntries.forEach((e) => rows.push({ ...e, rowType: 'batch-child', batchId }));
        }
        i = j;
        advanced = true;
      }
    }
    if (!advanced) {
      rows.push({ ...entry, rowType: 'entry' });
      i += 1;
    }
  }
  return rows;
}

const RECORD_TYPE_LABELS = {
  fbrprofile: 'User Profile',
  fbrprofilerole: 'User Role',
  instructorprofile: 'Instructor Profile',
  traineeprofile: 'Trainee Profile',
  biodataeditrequest: 'Edit Request',
  session: 'Session',
  sessioninstructor: 'Session Instructor',
  attendancerecord: 'Attendance Record',
  leaverequest: 'Leave Request',
  remotesessionrequest: 'Remote Session Request',
  substituterequest: 'Substitute Request',
  location: 'Location',
  publicholiday: 'Public Holiday',
};

// ─── Changes detail modal ─────────────────────────────────────────────────────

const ChangesModal = ({ entry, onClose }) => {
  const {
    changes, object_repr: repr, timestamp, actor_name: actorName, actor_email: actorEmail, action,
  } = entry;
  const date = new Date(timestamp);

  const changeRows = Object.entries(changes || {}).map(([field, [oldVal, newVal]]) => ({
    field, oldValue: String(oldVal ?? '—'), newValue: String(newVal ?? '—'),
  }));

  return (
    <ModalDialog
      isOpen
      onClose={onClose}
      title={`Change Details — ${repr}`}
      size="lg"
      hasCloseButton
      isFullscreenOnMobile
      className="audit-modal"
    >
      <ModalDialog.Header>
        <ModalDialog.Title>Change Details — {repr}</ModalDialog.Title>
        <small className="audit-modal__subtitle">
          {date.toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
          {' · '}
          <Badge variant={ACTION_VARIANT[action] || 'light'}>{action}</Badge>
          {' · '}
          {actorName || 'System'}
          {actorEmail && ` (${actorEmail})`}
        </small>
      </ModalDialog.Header>

      <ModalDialog.Body>
        {changeRows.length === 0 ? (
          <p className="audit-modal__empty">No field-level diff recorded for this entry.</p>
        ) : (
          <div className="audit-log__table-scroll audit-log__table-scroll--narrow">
            <DataTable
              data={changeRows}
              itemCount={changeRows.length}
              columns={[
                { Header: 'Field', accessor: 'field', cellClassName: 'audit-modal__td--field' },
                { Header: 'Old value', accessor: 'oldValue', cellClassName: 'audit-modal__td--old' },
                { Header: 'New value', accessor: 'newValue', cellClassName: 'audit-modal__td--new' },
              ]}
            >
              <DataTable.Table />
            </DataTable>
          </div>
        )}
      </ModalDialog.Body>

      <ModalDialog.Footer>
        <ActionRow>
          <Button variant="outline-primary" onClick={onClose}>Close</Button>
        </ActionRow>
      </ModalDialog.Footer>
    </ModalDialog>
  );
};

ChangesModal.propTypes = {
  entry: PropTypes.shape({
    changes: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.any)),
    object_repr: PropTypes.string,
    timestamp: PropTypes.string,
    actor_name: PropTypes.string,
    actor_email: PropTypes.string,
    actor_role: PropTypes.string,
    action: PropTypes.string,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};

// ─── Record history modal ─────────────────────────────────────────────────────

const RecordHistoryModal = ({
  appLabel, recordType, objectId, objectRepr, onClose,
}) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [changesEntry, setChangesEntry] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result = await getAuditLogs({
          appLabel,
          models: recordType ? [recordType] : [],
          objectId,
          page,
          pageSize: PAGE_SIZE,
        });
        if (!cancelled) { setLogs(result.results); setCount(result.count); }
      } catch (err) {
        if (!cancelled) { setError(err?.message || 'Failed to load history.'); }
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [appLabel, recordType, objectId, page]);

  const pageCount = Math.ceil(count / PAGE_SIZE);

  return (
    <ModalDialog
      isOpen
      onClose={onClose}
      title="Full History"
      size="lg"
      hasCloseButton
      isFullscreenOnMobile
      className="audit-modal"
    >
      <ModalDialog.Header>
        <ModalDialog.Title>Full History</ModalDialog.Title>
        <small className="audit-modal__subtitle">{objectRepr}</small>
      </ModalDialog.Header>

      <ModalDialog.Body>
        {loading && (
          <div className="text-center py-4">
            <Spinner animation="border" screenReaderText="Loading history" />
          </div>
        )}
        {!loading && error && <Alert variant="danger">{error}</Alert>}
        {!loading && !error && (
          <>
            <div className="audit-log__table-scroll audit-log__table-scroll--narrow">
              <DataTable
                data={logs}
                itemCount={count}
                columns={[
                  {
                    Header: 'Timestamp',
                    id: 'timestamp',
                    Cell: ({ row }) => new Date(row.original.timestamp).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  },
                  {
                    Header: 'Actor',
                    id: 'actor',
                    Cell: ({ row }) => (row.original.actor_name ? (
                      <ActorBadge name={row.original.actor_name} role={row.original.actor_role} />
                    ) : <span className="text-muted">System</span>),
                  },
                  {
                    Header: 'Action',
                    id: 'action',
                    Cell: ({ row }) => (
                      <Badge variant={ACTION_VARIANT[row.original.action] || 'light'}>
                        {row.original.action}
                      </Badge>
                    ),
                  },
                  {
                    Header: 'Fields changed',
                    id: 'fields',
                    Cell: ({ row }) => {
                      const fieldCount = row.original.changes
                        ? Object.keys(row.original.changes).length : 0;
                      if (fieldCount === 0) { return '—'; }
                      return (
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => setChangesEntry(row.original)}
                          className="audit-log__changes-btn"
                          iconBefore={Difference}
                        >
                          {fieldCount} field{fieldCount !== 1 ? 's' : ''} changed
                        </Button>
                      );
                    },
                  },
                ]}
              >
                <DataTable.Table />
                <DataTable.EmptyTable content="No history recorded yet." />
              </DataTable>
            </div>
            {pageCount > 1 && (
              <Pagination
                paginationLabel="History pagination"
                pageCount={pageCount}
                currentPage={page}
                onPageSelect={setPage}
                size="small"
                className="mt-3"
              />
            )}
          </>
        )}
      </ModalDialog.Body>

      <ModalDialog.Footer>
        <ActionRow>
          <Button variant="outline-primary" onClick={onClose}>Close</Button>
        </ActionRow>
      </ModalDialog.Footer>

      {changesEntry && <ChangesModal entry={changesEntry} onClose={() => setChangesEntry(null)} />}
    </ModalDialog>
  );
};

RecordHistoryModal.propTypes = {
  appLabel: PropTypes.string.isRequired,
  recordType: PropTypes.string,
  objectId: PropTypes.string.isRequired,
  objectRepr: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};
RecordHistoryModal.defaultProps = { recordType: undefined };

// ─── Main table ───────────────────────────────────────────────────────────────

const AuditLogTable = ({
  appLabel, models, objectId, programKey, recordFilter, onClearFilter,
}) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);

  const [actionFilter, setActionFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [changesModal, setChangesModal] = useState(null);
  const [historyModal, setHistoryModal] = useState(null);
  const [expandedBatches, setExpandedBatches] = useState(new Set());

  const hasActiveFilters = actionFilter !== '' || searchText !== '' || dateFrom !== '' || dateTo !== '' || !!recordFilter;
  const handleClearFilters = () => {
    setActionFilter('');
    setSearchText('');
    setDebouncedSearch('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    onClearFilter?.();
  };

  const activeObjectId = objectId || recordFilter;

  const searchTimer = useRef(null);
  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(e.target.value);
      setPage(1);
    }, 400);
  };

  const handleActionChange = (e) => {
    setActionFilter(e.target.value);
    setPage(1);
  };

  const handleDateFromChange = (value) => {
    setDateFrom(value);
    setPage(1);
  };

  const handleDateToChange = (value) => {
    setDateTo(value);
    setPage(1);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const result = await getAuditLogs({
          appLabel,
          models,
          objectId: activeObjectId,
          programKey: programKey || undefined,
          action: actionFilter || undefined,
          search: debouncedSearch || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          page,
          pageSize: PAGE_SIZE,
        });
        if (!cancelled) { setLogs(result.results); setCount(result.count); }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.detail || err?.message || 'Failed to load audit log.');
        }
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appLabel, models, activeObjectId, programKey, actionFilter, debouncedSearch, dateFrom, dateTo, page]);

  const isPageLevel = !objectId;
  const pageCount = Math.ceil(count / PAGE_SIZE);
  const displayRows = groupLogs(logs, expandedBatches);

  const columns = [
    {
      Header: 'Timestamp',
      accessor: 'timestamp',
      Cell: ({ row }) => {
        const date = new Date(row.original.timestamp);
        return (
          <span className="audit-log__timestamp">
            {date.toLocaleString('en-GB', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </span>
        );
      },
    },
    {
      Header: 'Actor',
      accessor: 'actor_name',
      Cell: ({ row }) => {
        const { actor_name: name, actor_role: role } = row.original;
        if (!name) { return <span className="text-muted">System</span>; }
        return <ActorBadge name={name} role={role} />;
      },
    },
    {
      Header: 'Action',
      accessor: 'action',
      Cell: ({ row }) => {
        const {
          action, record_type: rt, changes, rowType, batchId: entryBatchId, batchCount,
        } = row.original;
        if (rowType === 'batch') {
          return (
            <Button
              variant="link"
              size="sm"
              onClick={() => setExpandedBatches((prev) => {
                const next = new Set(prev);
                if (next.has(entryBatchId)) { next.delete(entryBatchId); } else { next.add(entryBatchId); }
                return next;
              })}
              className="audit-log__batch-toggle"
            >
              <Badge variant="light">{batchCount} entries</Badge>
              {' '}{expandedBatches.has(entryBatchId) ? '▲' : '▼'}
            </Button>
          );
        }
        return (
          <Badge variant={ACTION_VARIANT[action] || 'light'}>
            {getActionLabel(action, rt, changes)}
          </Badge>
        );
      },
    },
    ...(isPageLevel ? [{
      Header: 'Record Type',
      accessor: 'record_type',
      Cell: ({ row }) => {
        const { record_type: rt } = row.original;
        return (
          <span className="audit-log__record-type">
            {RECORD_TYPE_LABELS[rt] || rt || '—'}
          </span>
        );
      },
    }] : []),
    {
      Header: 'Record',
      accessor: 'object_repr',
      Cell: ({ row }) => {
        const entry = row.original;
        if (entry.rowType === 'batch') {
          return (
            <div>
              <div className="audit-log__record-repr audit-log__batch-summary">
                {entry.batchCount} records created together
              </div>
            </div>
          );
        }
        const prefix = entry.rowType === 'batch-child' ? '↳ ' : '';
        return (
          <div className={entry.rowType === 'batch-child' ? 'audit-log__record--child' : ''}>
            <div className="audit-log__record-repr">{prefix}{entry.object_repr || '—'}</div>
            <div className="audit-log__record-meta">
              {entry.object_pk && (
                <span className="audit-log__record-id">ID: {entry.object_pk}</span>
              )}
              {entry.rowType !== 'batch-child' && (
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => setHistoryModal(entry)}
                  className="audit-log__history-btn"
                  iconBefore={History}
                  aria-label={`Full history for ${entry.object_repr || `record ${entry.object_pk}`}`}
                >
                  Full history
                </Button>
              )}
            </div>
          </div>
        );
      },
    },
    {
      Header: 'Changes',
      accessor: 'changes',
      disableSortBy: true,
      Cell: ({ row }) => {
        const { changes } = row.original;
        const fieldCount = changes ? Object.keys(changes).length : 0;
        if (fieldCount === 0) {
          return <span className="text-muted audit-log__record-type">—</span>;
        }
        return (
          <div className="audit-log__changes">
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => setChangesModal(row.original)}
              className="audit-log__changes-btn"
              iconBefore={Difference}
              aria-label={`${fieldCount} field${fieldCount !== 1 ? 's' : ''} changed`
                + `, view details for ${row.original.object_repr || 'this record'}`}
            >
              {fieldCount} field{fieldCount !== 1 ? 's' : ''} changed
            </Button>
            <span className="audit-log__changes-fields">
              {Object.keys(changes).slice(0, 3).join(', ')}
              {fieldCount > 3 ? ` +${fieldCount - 3} more` : ''}
            </span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="audit-log">
      {recordFilter && (
        <div className="audit-log__filter-banner">
          <span>Showing full history for record <strong>#{recordFilter}</strong></span>
          {onClearFilter && (
            <Button
              variant="link"
              onClick={onClearFilter}
              className="audit-log__filter-banner-clear"
            >
              ← Show all records
            </Button>
          )}
        </div>
      )}

      <div className="audit-log__filters d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center flex-sm-wrap">
        <Form.Control
          type="text"
          value={searchText}
          onChange={handleSearchChange}
          placeholder="Search by record name…"
          aria-label="Search audit log by record name"
          className="audit-log__search-input"
        />
        <Form.Control
          as="select"
          value={actionFilter}
          onChange={handleActionChange}
          aria-label="Filter by action"
          className="audit-log__action-select"
        >
          {getFilterOptions(models).map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Form.Control>
        <div className="audit-log__date-range d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center">
          <div className="audit-log__date-field d-flex align-items-center">
            <Form.Label htmlFor="audit-date-from-sessions" className="audit-log__date-label">From</Form.Label>
            <DatepickerControl
              id="audit-date-from-sessions"
              value={dateFrom}
              onChange={handleDateFromChange}
              className="audit-log__date-input"
            />
          </div>
          <div className="audit-log__date-field d-flex align-items-center">
            <Form.Label htmlFor="audit-date-to-sessions" className="audit-log__date-label">To</Form.Label>
            <DatepickerControl
              id="audit-date-to-sessions"
              value={dateTo}
              minDate={dateFrom}
              onChange={handleDateToChange}
              className="audit-log__date-input"
            />
          </div>
        </div>
        <span className="audit-log__count">
          {count} result{count !== 1 ? 's' : ''}
        </span>
        {hasActiveFilters && (
          <Button
            variant="tertiary"
            size="sm"
            onClick={handleClearFilters}
            className="audit-log__clear-btn"
          >
            Clear filters
          </Button>
        )}
      </div>

      {loading && (
        <div className="text-center py-4">
          <Spinner animation="border" screenReaderText="Loading audit log" />
        </div>
      )}
      {!loading && error && <Alert variant="danger">{error}</Alert>}
      {!loading && !error && (
        <>
          <DataTable
            className="sessions-table-scroll"
            isSortable
            data={displayRows}
            columns={columns}
            itemCount={count}
          >
            <DataTable.Table />
            <DataTable.EmptyTable content="No activity recorded yet." />
          </DataTable>
          {pageCount > 1 && (
            <Pagination
              paginationLabel="Audit log pagination"
              pageCount={pageCount}
              currentPage={page}
              onPageSelect={setPage}
              size="small"
              className="mt-3"
            />
          )}
        </>
      )}

      {changesModal && (
        <ChangesModal entry={changesModal} onClose={() => setChangesModal(null)} />
      )}
      {historyModal && (
        <RecordHistoryModal
          appLabel={appLabel}
          recordType={historyModal.record_type}
          objectId={String(historyModal.object_pk)}
          objectRepr={historyModal.object_repr || ''}
          onClose={() => setHistoryModal(null)}
        />
      )}
    </div>
  );
};

AuditLogTable.propTypes = {
  appLabel: PropTypes.string.isRequired,
  models: PropTypes.arrayOf(PropTypes.string),
  objectId: PropTypes.string,
  programKey: PropTypes.string,
  recordFilter: PropTypes.string,
  onClearFilter: PropTypes.func,
};

AuditLogTable.defaultProps = {
  models: [],
  objectId: undefined,
  programKey: undefined,
  recordFilter: undefined,
  onClearFilter: undefined,
};

export default AuditLogTable;
