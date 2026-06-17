import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Spinner } from '@openedx/paragon';
import { getLeaveUsage } from './api';
import { extractApiError } from '../shared/utils';
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
      <div className="d-flex align-items-center" style={{ gap: 8 }}>
        <Spinner animation="border" size="sm" />
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
  const barColor = isOver ? '#ef4444' : '#3b82f6';

  return (
    <div style={{
      border: '1px solid #e5e7eb', borderRadius: 6, padding: '12px 16px',
    }}
    >
      <div className="d-flex justify-content-between align-items-baseline mb-1">
        <span style={{ fontWeight: 600, fontSize: 14 }}>Your Leave Usage</span>
        {hasThreshold ? (
          <span style={{ fontSize: 13, color: isOver ? '#dc2626' : undefined, fontWeight: isOver ? 600 : undefined }}>
            {availed} / {threshold}
          </span>
        ) : (
          <span style={{ fontSize: 13 }}>{availed} taken</span>
        )}
      </div>
      {hasThreshold && (
        <div style={{
          height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: 6,
        }}
        >
          <div style={{
            width: `${pct}%`, height: '100%', background: barColor, borderRadius: 4,
          }}
          />
        </div>
      )}
      {own.breakdown && (
        <small className="text-muted" style={{ fontSize: 12 }}>
          {own.breakdown.full_day_leaves} full-day · {own.breakdown.session_specific_leaves} session-specific
        </small>
      )}
      {isOver && (
        <div style={{ color: '#b91c1c', fontSize: 13, marginTop: 6 }}>
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
