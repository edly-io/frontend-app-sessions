import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Spinner } from '@openedx/paragon';
import { getLeaveUsage } from './api';
import { extractApiError } from '../shared/utils';
import './requests.scss';
import { useConfig } from '../app/useConfig';
import { USER_ROLE } from '../shared/constants';

const LeaveUsageSummary = ({ programKey }) => {
  const { data: config } = useConfig();
  const userRole = config?.user_role ?? USER_ROLE.LEARNER;
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    getLeaveUsage({ program_key: programKey })
      .then(setUsage)
      .catch((err) => setError(extractApiError(err, 'Failed to load leave usage')))
      .finally(() => setLoading(false));
  }, [programKey]);

  if (loading) {
    return (
      <div className="requests-view__inline-status">
        <Spinner animation="border" size="sm" screenReaderText="Loading leave usage" />
        <small className="text-muted">Loading leave usage…</small>
      </div>
    );
  }

  if (error) { return <Alert variant="danger">{error}</Alert>; }
  if (!usage || !usage.leaves || usage.leaves.length === 0) { return null; }

  const own = usage.leaves[0];
  const { threshold } = usage;
  const availed = own.total_leaves_availed;
  const hasThreshold = threshold > 0 && userRole !== USER_ROLE.INSTRUCTOR;
  const isOver = hasThreshold && availed >= threshold;
  const pct = hasThreshold ? Math.min(100, (availed / threshold) * 100) : 0;

  return (
    <div className="requests-view__usage-card">
      <div className="d-flex justify-content-between align-items-baseline mb-1">
        <span className="requests-view__usage-card-title">Your Leave Usage</span>
        {hasThreshold ? (
          <span className={`requests-view__usage-card-value${isOver ? ' requests-view__usage-card-value--over' : ''}`}>
            {availed} / {threshold}
          </span>
        ) : (
          <span className="requests-view__usage-card-value">{availed} taken</span>
        )}
      </div>
      {hasThreshold && (
        <div
          className="requests-view__usage-card-meter"
          role="progressbar"
          aria-valuenow={availed}
          aria-valuemin={0}
          aria-valuemax={threshold}
          aria-label={`${availed} of ${threshold} leaves used`}
        >
          <div
            className={`requests-view__usage-meter-fill${isOver ? ' requests-view__usage-meter-fill--over' : ''}`}
            style={{ width: `${pct}%` }} // eslint-disable-line react/forbid-dom-props
          />
        </div>
      )}
      {own.breakdown && (
        <small className="text-muted requests-view__cell-meta">
          {own.breakdown.full_day_leaves} full-day · {own.breakdown.session_specific_leaves} session-specific
        </small>
      )}
      {isOver && (
        <div className="requests-view__usage-card-warning">
          You have reached or exceeded your leave threshold.
        </div>
      )}
    </div>
  );
};

LeaveUsageSummary.propTypes = {
  programKey: PropTypes.string.isRequired,
};

export default LeaveUsageSummary;
