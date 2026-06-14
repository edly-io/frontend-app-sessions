import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Button, DataTable, Form, Spinner, StandardModal,
} from '@openedx/paragon';
import { getSessionApprovedLeaves } from './api';
import { extractApiError, formatDateTime } from '../shared/utils';

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
SectionHeading.propTypes = { children: PropTypes.node.isRequired };

const PAGE_SIZE = 15;

const SessionLeavesPanel = ({ programKey }) => {
  const [sessions, setSessions] = useState([]);
  const [count, setCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [searchQ, setSearchQ] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSession, setSelectedSession] = useState(null);

  const fetchData = useCallback(async ({ pageIndex: nextIndex = 0 } = {}) => {
    setError('');
    try {
      const data = await getSessionApprovedLeaves({
        program_key: programKey,
        page: nextIndex + 1,
        page_size: PAGE_SIZE,
        ...(searchQ ? { q: searchQ } : {}),
      });
      setSessions(data.results ?? []);
      setCount(data.count ?? 0);
      setPageIndex(nextIndex);
    } catch (err) {
      setError(extractApiError(err, 'Failed to load sessions'));
    } finally {
      setInitialLoading(false);
    }
  }, [programKey, searchQ]);

  useEffect(() => { fetchData({ pageIndex: 0 }); }, [fetchData]);

  /* eslint-disable react/no-unstable-nested-components, react/prop-types */
  const columns = useMemo(() => [
    {
      Header: 'Session',
      accessor: 'title',
    },
    {
      Header: 'Date & Time',
      accessor: 'scheduled_start_time',
      Cell: ({ value }) => (value ? formatDateTime(value) : '—'),
    },
    {
      Header: 'Approved Leaves',
      id: 'leaveCount',
      Cell: ({ row }) => {
        const n = row.original.students_on_leave?.length ?? 0;
        return (
          <span style={{
            fontWeight: 600,
            color: n > 0 ? '#d97706' : '#6b7280',
          }}
          >
            {n}
          </span>
        );
      },
    },
    {
      Header: 'Actions',
      id: 'actions',
      Cell: ({ row }) => {
        const session = row.original;
        const n = session.students_on_leave?.length ?? 0;
        return (
          <Button
            size="sm"
            variant="outline-primary"
            onClick={() => setSelectedSession(session)}
            disabled={n === 0}
          >
            View approved leaves
          </Button>
        );
      },
    },
  ], []);
  /* eslint-enable react/no-unstable-nested-components, react/prop-types */

  return (
    <div>
      <SectionHeading>Sessions &amp; Approved Leaves</SectionHeading>

      <div className="d-flex align-items-center mb-3" style={{ gap: 8 }}>
        <Form.Control
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search sessions..."
          style={{ width: 220 }}
        />
        {searchQ && (
          <Button variant="tertiary" size="sm" onClick={() => setSearchQ('')}>
            Clear
          </Button>
        )}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {initialLoading ? (
        <div className="d-flex align-items-center py-3" style={{ gap: 8 }}>
          <Spinner animation="border" size="sm" />
          <small className="text-muted">Loading sessions…</small>
        </div>
      ) : (
        !error && (
          <div className="sticky-header-table">
            <DataTable
              key={searchQ}
              isPaginated
              manualPagination
              fetchData={fetchData}
              pageCount={Math.max(1, Math.ceil(count / PAGE_SIZE))}
              itemCount={count}
              data={sessions}
              columns={columns}
              initialState={{ pageIndex, pageSize: PAGE_SIZE }}
            >
              <DataTable.Table />
              <DataTable.EmptyTable content="No sessions found" />
              <DataTable.TableFooter />
            </DataTable>
          </div>
        )
      )}

      {selectedSession && (
        <StandardModal
          isOpen
          onClose={() => setSelectedSession(null)}
          title={`Approved Leaves — ${selectedSession.title}`}
          hasCloseButton
          size="lg"
          footerNode={(
            <Button onClick={() => setSelectedSession(null)}>Close</Button>
          )}
        >
          {(selectedSession.students_on_leave?.length ?? 0) === 0 ? (
            <p className="text-muted">No approved leaves for this session.</p>
          ) : (
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {selectedSession.students_on_leave.map((student) => (
                <li key={student.leave_request_id ?? student.user_id} style={{ marginBottom: 10 }}>
                  <span style={{ fontWeight: 600 }}>
                    {student.username || student.email}
                  </span>
                  <small className="text-muted ml-2">{student.email}</small>
                  <small className="text-muted ml-2">
                    {student.leave_start_date === student.leave_end_date
                      ? student.leave_start_date
                      : `${student.leave_start_date} – ${student.leave_end_date}`}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </StandardModal>
      )}
    </div>
  );
};

SessionLeavesPanel.propTypes = {
  programKey: PropTypes.string.isRequired,
};

export default SessionLeavesPanel;
