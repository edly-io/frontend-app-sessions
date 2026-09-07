/* eslint-disable react/prop-types */
/* eslint-disable react/no-unstable-nested-components */
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Badge, Button, DataTable, Pagination, Spinner,
} from '@openedx/paragon';
import { getAuditLogs } from './auditLogApi';
import './AuditLogTable.scss';

const PAGE_SIZE = 20;

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  middle_admin: 'Middle Admin',
  data_admin: 'Data Admin',
  instructor: 'Instructor',
  trainee: 'Trainee',
};

const ROLE_TONES = {
  'Super Admin': 'super-admin',
  'Middle Admin': 'middle-admin',
  'Data Admin': 'data-admin',
  Instructor: 'instructor',
  Trainee: 'trainee',
};

const ROLE_CODES = {
  'Super Admin': 'SA',
  'Middle Admin': 'MA',
  'Data Admin': 'DA',
  Instructor: 'IN',
  Trainee: 'TR',
};

const getInitials = (name) => (name || '?')
  .split(/\s+/).filter(Boolean).slice(0, 2)
  .map(p => p[0])
  .join('')
  .toUpperCase();

const ActorBadge = ({ name, role }) => {
  const label = ROLE_LABELS[role] || '';
  const tone = ROLE_TONES[label] || 'default';
  const code = ROLE_CODES[label] || '';
  const initials = getInitials(name);
  return (
    <div className="user-identity user-identity--compact">
      <div className="user-identity__avatar-wrap user-identity__avatar-wrap--compact">
        <div className={`user-identity__avatar-shell user-identity__avatar-shell--compact user-identity__avatar-shell--${tone}`}>
          <span className="user-identity__avatar-initials">{initials}</span>
        </div>
        {code && (
          <span className={`user-identity__corner-badge user-identity__corner-badge--${tone}`}>{code}</span>
        )}
      </div>
      <div className="user-identity__content">
        <div className="user-identity__name">{name}</div>
        {label && (
          <div className={`user-identity__role-label user-identity__role-label--${tone}`}>{label}</div>
        )}
      </div>
    </div>
  );
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
  session: { created: 'Scheduled', deleted: 'Cancelled' },
  leaverequest: { created: 'Submitted', updated: 'Status Changed' },
  remotesessionrequest: { created: 'Requested', updated: 'Status Changed' },
  substituterequest: { created: 'Assigned', deleted: 'Removed' },
  attendancerecord: { created: 'Marked', updated: 'Updated' },
};

const getActionLabel = (action, recordType) => {
  const overrides = MODEL_ACTION_LABELS[recordType];
  return (overrides && overrides[action]) || action;
};

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

  return (
    <div
      role="button"
      tabIndex={0}
      className="audit-modal__overlay"
      onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }}
      onKeyDown={(e) => { if (e.key === 'Escape') { onClose(); } }}
    >
      <div className="audit-modal__panel">
        <div className="audit-modal__header">
          <div>
            <h5 className="audit-modal__title">Change Details — {repr}</h5>
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
          </div>
          <Button variant="tertiary" onClick={onClose} className="audit-modal__close-btn">×</Button>
        </div>

        {!changes || Object.keys(changes).length === 0 ? (
          <p className="audit-modal__empty">No field-level diff recorded for this entry.</p>
        ) : (
          <table className="audit-modal__table">
            <thead>
              <tr>
                {['Field', 'Old Value', 'New Value'].map(h => (
                  <th key={h} className="audit-modal__th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(changes).map(([field, [oldVal, newVal]], i) => (
                <tr key={field} className={i % 2 === 0 ? 'audit-modal__tr--even' : 'audit-modal__tr--odd'}>
                  <td className="audit-modal__td audit-modal__td--field">{field}</td>
                  <td className="audit-modal__td audit-modal__td--old">{String(oldVal ?? '—')}</td>
                  <td className="audit-modal__td audit-modal__td--new">{String(newVal ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
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
    <div
      role="button"
      tabIndex={0}
      className="audit-modal__overlay"
      onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }}
      onKeyDown={(e) => { if (e.key === 'Escape') { onClose(); } }}
    >
      <div className="audit-modal__panel audit-modal__panel--wide">
        <div className="audit-modal__header">
          <div>
            <h5 className="audit-modal__title">Full History</h5>
            <small className="audit-modal__subtitle">{objectRepr}</small>
          </div>
          <Button variant="tertiary" onClick={onClose} className="audit-modal__close-btn">×</Button>
        </div>

        {loading && (
          <div className="text-center py-4">
            <Spinner animation="border" screenReaderText="Loading history" />
          </div>
        )}
        {!loading && error && <Alert variant="danger">{error}</Alert>}
        {!loading && !error && (
          <>
            <table className="audit-modal__table">
              <thead>
                <tr>
                  {['Timestamp', 'Actor', 'Action', 'Fields changed'].map(h => (
                    <th key={h} className="audit-modal__th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr className="audit-modal__empty-row">
                    <td colSpan={4} className="audit-modal__td audit-modal__td--center">
                      No history recorded yet.
                    </td>
                  </tr>
                ) : logs.map((entry, i) => {
                  const date = new Date(entry.timestamp);
                  const fieldCount = entry.changes ? Object.keys(entry.changes).length : 0;
                  return (
                    <tr key={entry.id} className={i % 2 === 0 ? 'audit-modal__tr--even' : 'audit-modal__tr--odd'}>
                      <td className="audit-modal__td">
                        {date.toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="audit-modal__td">
                        {entry.actor_name ? (
                          <ActorBadge name={entry.actor_name} role={entry.actor_role} />
                        ) : (
                          <span className="text-muted">System</span>
                        )}
                      </td>
                      <td className="audit-modal__td">
                        <Badge variant={ACTION_VARIANT[entry.action] || 'light'}>{entry.action}</Badge>
                      </td>
                      <td className="audit-modal__td">
                        {fieldCount > 0 ? (
                          <Button
                            variant="link"
                            onClick={() => setChangesEntry(entry)}
                            className="audit-modal__fields-btn"
                          >
                            {fieldCount} field{fieldCount !== 1 ? 's' : ''} changed
                          </Button>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
      </div>
      {changesEntry && <ChangesModal entry={changesEntry} onClose={() => setChangesEntry(null)} />}
    </div>
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

  const handleDateFromChange = (e) => {
    setDateFrom(e.target.value);
    setPage(1);
  };

  const handleDateToChange = (e) => {
    setDateTo(e.target.value);
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
        const { action, record_type: rt } = row.original;
        return (
          <Badge variant={ACTION_VARIANT[action] || 'light'}>
            {getActionLabel(action, rt)}
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
        return (
          <div>
            <div className="audit-log__record-repr">{entry.object_repr || '—'}</div>
            {entry.object_pk && (
              <div className="audit-log__record-id">ID: {entry.object_pk}</div>
            )}
            <Button
              variant="link"
              onClick={() => setHistoryModal(entry)}
              className="audit-log__history-btn"
            >
              ⟳ Full history
            </Button>
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
          <div>
            <ul className="audit-log__changes-list">
              {Object.entries(changes).slice(0, 3).map(([field, [oldVal, newVal]]) => (
                <li key={field} className="audit-log__change-item">
                  <span className="audit-log__change-field">{field}:</span>{' '}
                  <span className="audit-log__change-old">{String(oldVal ?? '—')}</span>
                  {' → '}
                  <span className="audit-log__change-new">{String(newVal ?? '—')}</span>
                </li>
              ))}
              {fieldCount > 3 && (
                <li className="audit-log__changes-more">+{fieldCount - 3} more…</li>
              )}
            </ul>
            <Button
              variant="link"
              onClick={() => setChangesModal(row.original)}
              className="audit-log__view-changes-btn"
            >
              View all changes
            </Button>
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

      <div className="audit-log__filters">
        <input
          type="text"
          value={searchText}
          onChange={handleSearchChange}
          placeholder="Search by record name…"
          className="audit-log__search-input"
        />
        <select
          value={actionFilter}
          onChange={handleActionChange}
          className="audit-log__action-select"
        >
          {ACTION_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="audit-log__date-range">
          <label htmlFor="audit-date-from-sessions" className="audit-log__date-label">From</label>
          <input
            id="audit-date-from-sessions"
            type="date"
            value={dateFrom}
            onChange={handleDateFromChange}
            className="audit-log__date-input"
          />
          <label htmlFor="audit-date-to-sessions" className="audit-log__date-label">To</label>
          <input
            id="audit-date-to-sessions"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={handleDateToChange}
            className="audit-log__date-input"
          />
        </div>
        <span className="audit-log__count">
          {count} result{count !== 1 ? 's' : ''}
        </span>
      </div>

      {loading && (
        <div className="text-center py-4">
          <Spinner animation="border" screenReaderText="Loading audit log" />
        </div>
      )}
      {!loading && error && <Alert variant="danger">{error}</Alert>}
      {!loading && !error && (
        <>
          <DataTable isSortable data={logs} columns={columns} itemCount={count}>
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
