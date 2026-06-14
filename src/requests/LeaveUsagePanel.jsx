import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Button, Form, Spinner,
} from '@openedx/paragon';
import { getLeaveUsage } from './api';
import { extractApiError } from '../shared/utils';

const FILTER_OPTIONS = [
  { value: '', label: 'All learners' },
  { value: 'threshold_exceeded', label: 'At risk learners' },
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

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Leave Usage</h3>

      <div className="d-flex align-items-center mb-3 flex-wrap" style={{ gap: 8 }}>
        <Form.Control
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search by name or email…"
          style={{ width: 220 }}
        />
        {searchQ && (
          <Button variant="tertiary" size="sm" onClick={() => setSearchQ('')}>
            Clear
          </Button>
        )}
        <Form.Control
          as="select"
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          style={{ width: 'auto' }}
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Form.Control>
      </div>

      {loading && (
        <div className="text-center py-3">
          <Spinner animation="border" size="sm" />
        </div>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      {!loading && !error && usage && (
        usage.leaves.length === 0
          ? <p className="text-muted" style={{ fontSize: 13 }}>No learners found.</p>
          : (
            <div style={{
              maxHeight: 300,
              overflowY: 'auto',
              border: '1px solid #dee2e6',
              borderRadius: 4,
            }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{
                  position: 'sticky',
                  top: 0,
                  background: '#f8f9fa',
                  borderBottom: '2px solid #dee2e6',
                }}
                >
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Name</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Email</th>
                    <th style={{
                      padding: '8px 12px', textAlign: 'left', fontWeight: 600, minWidth: 160,
                    }}
                    >
                      Leaves Used
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Full-day</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Session-specific</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.leaves.map((l) => {
                    const isOver = l.total_leaves_availed > usage.threshold;
                    const pct = usage.threshold > 0
                      ? Math.min(100, (l.total_leaves_availed / usage.threshold) * 100)
                      : 0;
                    const barColor = isOver ? '#ef4444' : '#3b82f6';
                    return (
                      <tr
                        key={l.user_id}
                        style={{
                          backgroundColor: isOver ? '#fee2e2' : undefined,
                          borderBottom: '1px solid #dee2e6',
                        }}
                      >
                        <td style={{ padding: '8px 12px', fontWeight: isOver ? 600 : undefined }}>
                          {l.full_name || l.username}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#6b7280' }}>{l.email}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{
                            fontWeight: 600,
                            color: isOver ? '#dc2626' : undefined,
                            marginBottom: 4,
                          }}
                          >
                            {l.total_leaves_availed} / {usage.threshold}
                          </div>
                          <div style={{
                            width: 120,
                            height: 6,
                            background: '#e5e7eb',
                            borderRadius: 3,
                            overflow: 'hidden',
                          }}
                          >
                            <div style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: barColor,
                              borderRadius: 3,
                            }}
                            />
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {l.breakdown?.full_day_leaves ?? '—'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {l.breakdown?.session_specific_leaves ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
      )}
    </div>
  );
};

LeaveUsagePanel.propTypes = {
  programKey: PropTypes.string.isRequired,
};

export default LeaveUsagePanel;
