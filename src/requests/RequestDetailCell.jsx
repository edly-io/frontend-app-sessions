import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { REQUEST_TYPE } from '../shared/constants';

const formatDate = (val) => {
  if (!val) { return null; }
  // Handle both date-only (YYYY-MM-DD) and full ISO strings safely.
  const d = val.includes('T') ? new Date(val) : new Date(`${val}T12:00:00`);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

const deriveDateRange = (sessions) => {
  const times = sessions.map((s) => s.scheduled_start_time).filter(Boolean).sort();
  if (!times.length) { return null; }
  const start = formatDate(times[0]);
  const end = formatDate(times[times.length - 1]);
  return start === end ? start : `${start} – ${end}`;
};

const TOGGLE_STYLE = {
  background: 'none',
  border: 'none',
  padding: 0,
  fontSize: 13,
  color: '#374151',
  cursor: 'pointer',
  display: 'block',
  textAlign: 'left',
};

const PANEL_STYLE = {
  marginTop: 6,
  paddingLeft: 8,
  borderLeft: '2px solid #e5e7eb',
};

const ITEM_STYLE = {
  fontSize: 12,
  color: '#374151',
  lineHeight: 1.7,
};

const ModeBadge = ({ mode }) => {
  if (!mode) { return null; }
  const isFullDay = mode === 'full_day';
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: isFullDay ? '#0f766e' : '#1d4ed8',
        background: isFullDay ? '#ccfbf1' : '#dbeafe',
        borderRadius: 3,
        padding: '2px 6px',
        display: 'inline-block',
        marginBottom: 4,
        whiteSpace: 'nowrap',
      }}
    >
      {isFullDay ? 'Full Day' : 'Session-specific'}
    </span>
  );
};

ModeBadge.propTypes = { mode: PropTypes.string };
ModeBadge.defaultProps = { mode: null };

const RequestDetailCell = ({ req }) => {
  const [expanded, setExpanded] = useState(false);
  const sessions = req.sessions || [];
  const isLeave = req.request_type_label === REQUEST_TYPE.LEAVE;

  // Full-day leave: both dates present AND no linked sessions.
  // Session-specific leave: sessions non-empty (dates may also be present).
  const isFullDay = isLeave && !!(req.leave_start_date || req.leave_end_date) && sessions.length === 0;
  let dateRange = null;
  if (isFullDay) {
    const s = formatDate(req.leave_start_date);
    const e = formatDate(req.leave_end_date);
    if (s === e) {
      dateRange = s;
    } else if (s && e) {
      dateRange = `${s} – ${e}`;
    } else {
      dateRange = s || e;
    }
  } else if (isLeave) {
    dateRange = deriveDateRange(sessions);
  }

  // Badge mode: derived from structure, not a stored field.
  let badgeMode = null;
  if (isLeave) {
    badgeMode = isFullDay ? 'full_day' : 'session_specific';
  }

  const toggle = () => setExpanded((p) => !p);

  const panel = expanded ? (
    <div style={PANEL_STYLE}>
      {dateRange && (
        <div style={{ ...ITEM_STYLE, fontWeight: 500, marginBottom: 2 }}>
          {dateRange}
        </div>
      )}
      {isFullDay && (
        <div style={{ ...ITEM_STYLE, color: '#6b7280' }}>
          {sessions.length > 0
            ? `${sessions.length} session${sessions.length === 1 ? '' : 's'} in this range`
            : 'No sessions in this range'}
        </div>
      )}
      {!isFullDay && sessions.length > 0 && (
        <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
          {sessions.map((s) => (
            <li key={s.id} style={ITEM_STYLE}>
              {formatDate(s.scheduled_start_time)} · {s.title}
            </li>
          ))}
        </ul>
      )}
      {!isFullDay && sessions.length === 0 && (
        <span style={{ ...ITEM_STYLE, color: '#9ca3af' }}>No sessions</span>
      )}
    </div>
  ) : null;

  return (
    <div>
      {isLeave && <ModeBadge mode={badgeMode} />}
      <button type="button" onClick={toggle} style={TOGGLE_STYLE}>
        Details {expanded ? '▲' : '▼'}
      </button>
      {panel}
    </div>
  );
};

RequestDetailCell.propTypes = {
  req: PropTypes.shape({
    request_type_label: PropTypes.string,
    leave_start_date: PropTypes.string,
    leave_end_date: PropTypes.string,
    sessions: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string,
      scheduled_start_time: PropTypes.string,
    })),
  }).isRequired,
};

export default RequestDetailCell;
