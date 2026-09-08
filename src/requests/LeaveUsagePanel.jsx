import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Button, Col, DataTable, Form, Row, Spinner,
} from '@openedx/paragon';
import { getLeaveUsage } from './api';
import { extractApiError } from '../shared/utils';
import './requests.scss';

const FILTER_OPTIONS = [
  { value: '', label: 'All learners' },
  { value: 'threshold_exceeded', label: 'At risk learners' },
];

const rowShape = PropTypes.shape({
  original: PropTypes.shape({
    full_name: PropTypes.string,
    username: PropTypes.string,
    total_leaves_availed: PropTypes.number,
    threshold: PropTypes.number,
    breakdown: PropTypes.shape({
      full_day_leaves: PropTypes.number,
      session_specific_leaves: PropTypes.number,
    }),
  }),
});

const NameCell = ({ row }) => {
  const {
    full_name: fullName, username, total_leaves_availed: used, threshold,
  } = row.original;
  return (
    <span className={used > threshold ? 'font-weight-bold' : undefined}>
      {fullName || username}
    </span>
  );
};
NameCell.propTypes = { row: rowShape.isRequired };

const EmailCell = ({ value }) => <span className="text-muted">{value}</span>;
EmailCell.propTypes = { value: PropTypes.string };
EmailCell.defaultProps = { value: '' };

const LeavesUsedCell = ({ row }) => {
  const { total_leaves_availed: used, threshold } = row.original;
  const isOver = used > threshold;
  const pct = threshold > 0 ? Math.min(100, (used / threshold) * 100) : 0;
  return (
    <>
      <div className={`requests-view__usage-count${isOver ? ' requests-view__usage-count--over' : ''}`}>
        {used} / {threshold}
      </div>
      <div
        className="requests-view__usage-meter"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={threshold}
        aria-label={`${used} of ${threshold} leaves used`}
      >
        <div
          className={`requests-view__usage-meter-fill${isOver ? ' requests-view__usage-meter-fill--over' : ''}`}
          style={{ width: `${pct}%` }} // eslint-disable-line react/forbid-dom-props
        />
      </div>
    </>
  );
};
LeavesUsedCell.propTypes = { row: rowShape.isRequired };

const FullDayCell = ({ row }) => row.original.breakdown?.full_day_leaves ?? '—';
FullDayCell.propTypes = { row: rowShape.isRequired };

const SessionSpecificCell = ({ row }) => row.original.breakdown?.session_specific_leaves ?? '—';
SessionSpecificCell.propTypes = { row: rowShape.isRequired };

const CENTERED = { cellClassName: 'text-center', headerClassName: 'justify-content-center' };

const COLUMNS = [
  { Header: 'Name', accessor: 'full_name', Cell: NameCell },
  { Header: 'Email', accessor: 'email', Cell: EmailCell },
  { Header: 'Leaves Used', accessor: 'total_leaves_availed', Cell: LeavesUsedCell },
  {
    Header: 'Full-day', accessor: 'breakdown.full_day_leaves', Cell: FullDayCell, ...CENTERED,
  },
  {
    Header: 'Session-specific', accessor: 'breakdown.session_specific_leaves', Cell: SessionSpecificCell, ...CENTERED,
  },
];

const LeaveUsagePanel = ({ programKey }) => {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [riskFilter, setRiskFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    getLeaveUsage({
      program_key: programKey,
      ...(searchQ ? { q: searchQ } : {}),
      ...(riskFilter === 'threshold_exceeded' ? { threshold_exceeded: true } : {}),
    })
      .then(setUsage)
      .catch((err) => setError(extractApiError(err, 'Failed to load leave usage')))
      .finally(() => setLoading(false));
  }, [programKey, searchQ, riskFilter]);

  // The threshold is a property of the response, but each cell needs it, so it
  // rides along on the row rather than closing over render scope.
  const rows = useMemo(
    () => (usage?.leaves ?? []).map((l) => ({ ...l, threshold: usage?.threshold ?? 0 })),
    [usage],
  );

  return (
    <div>
      <h3 className="requests-view__subheading">Leave Usage</h3>

      <Row className="requests-filters align-items-end">
        <Col xs={12} sm={6} lg={4} className="mb-2">
          <Form.Label htmlFor="leave-usage-search" className="requests-filters__label">
            Search learners
          </Form.Label>
          <Form.Control
            id="leave-usage-search"
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search by name or email…"
          />
        </Col>
        {searchQ && (
          <Col xs="auto" className="mb-2">
            <Button variant="tertiary" size="sm" onClick={() => setSearchQ('')}>
              Clear
            </Button>
          </Col>
        )}
        <Col xs={12} sm={6} md={4} lg={3} className="mb-2">
          <Form.Label htmlFor="leave-usage-risk" className="requests-filters__label">
            Learners
          </Form.Label>
          <Form.Control
            id="leave-usage-risk"
            as="select"
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Form.Control>
        </Col>
      </Row>

      {loading && (
        <div className="text-center py-3">
          <Spinner animation="border" size="sm" screenReaderText="Loading leave usage" />
        </div>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      {!loading && !error && usage && (
        <div className="sticky-header-table sessions-table-scroll">
          <DataTable isSortable data={rows} columns={COLUMNS} itemCount={rows.length}>
            <DataTable.Table />
            <DataTable.EmptyTable content="No learners found." />
          </DataTable>
        </div>
      )}
    </div>
  );
};

LeaveUsagePanel.propTypes = {
  programKey: PropTypes.string.isRequired,
};

export default LeaveUsagePanel;
