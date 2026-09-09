import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Button, Col, DataTable, Form, Row, Spinner, StandardModal,
} from '@openedx/paragon';
import { getSessionApprovedLeaves } from './api';
import { extractApiError, formatDateTime } from '../shared/utils';
import SectionHeading from '../shared/SectionHeading';
import './requests.scss';

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
          <span className={`font-weight-bold requests-view__leave-count--${n > 0 ? 'some' : 'none'}`}>
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

      <Row className="requests-filters align-items-end">
        <Col xs={12} sm={6} lg={4} className="mb-2">
          <Form.Label htmlFor="session-leaves-search" className="requests-filters__label">
            Search sessions
          </Form.Label>
          <Form.Control
            id="session-leaves-search"
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search sessions..."
          />
        </Col>
        {searchQ && (
          <Col xs="auto" className="mb-2">
            <Button variant="tertiary" size="sm" onClick={() => setSearchQ('')}>
              Clear
            </Button>
          </Col>
        )}
      </Row>

      {error && <Alert variant="danger">{error}</Alert>}

      {initialLoading ? (
        <div className="requests-view__inline-status py-3">
          <Spinner animation="border" size="sm" />
          <small className="text-muted">Loading sessions…</small>
        </div>
      ) : (
        !error && (
          <div className="sticky-header-table sessions-table-scroll">
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
          isFullscreenOnMobile
          size="lg"
          footerNode={(
            <Button onClick={() => setSelectedSession(null)}>Close</Button>
          )}
        >
          {(selectedSession.students_on_leave?.length ?? 0) === 0 ? (
            <p className="text-muted">No approved leaves for this session.</p>
          ) : (
            <ul className="requests-view__leave-list">
              {selectedSession.students_on_leave.map((student) => (
                <li key={student.leave_request_id ?? student.user_id} className="requests-view__leave-item">
                  <span className="font-weight-bold">
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
