// SessionDetailModal — read-only session info. Does NOT show attendance data;
// attendance lives on its own tab. Edit / Cancel / Delete actions live on the
// calendar popover, not here.

import React from 'react';
import PropTypes from 'prop-types';
import {
  Badge, Button, StandardModal,
} from '@openedx/paragon';
import { Launch } from '@openedx/paragon/icons';

import ScopeBadge from '../ScopeBadge';
import InstructingBadge from '../InstructingBadge';
import RequestStatusBadge from '../RequestStatusBadge';
import { formatDateTime, getStatusVariant } from '../utils';
import {
  SESSION_STATUS_LABELS, SESSION_PLATFORM_LABELS, USER_ROLE,
} from '../constants';

const RECURRENCE_TYPE_LABEL = { 1: 'Daily', 2: 'Weekly', 3: 'Monthly' };

const formatRecurrence = (recurrence) => {
  if (!recurrence) { return ''; }
  const base = RECURRENCE_TYPE_LABEL[recurrence.type] || 'Repeats';
  const interval = recurrence.repeat_interval && recurrence.repeat_interval > 1
    ? ` every ${recurrence.repeat_interval}`
    : '';
  if (recurrence.end_times) {
    return `${base}${interval} · ${recurrence.end_times} occurrences`;
  }
  if (recurrence.end_date_time) {
    return `${base}${interval} · ends ${formatDateTime(recurrence.end_date_time)}`;
  }
  return `${base}${interval}`;
};

const Field = ({ label, children }) => (
  <div className="d-flex mb-2" style={{ gap: 12 }}>
    <div className="text-muted" style={{ minWidth: 110, fontSize: 13 }}>{label}</div>
    <div style={{ fontSize: 13 }}>{children}</div>
  </div>
);
Field.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

const openInNewTab = (url) => window.open(url, '_blank', 'noopener,noreferrer');

const SessionDetailModal = ({ session, isOpen, onClose }) => {
  if (!session) { return null; }

  const hasMeeting = Boolean(session.meeting_id || session.meeting_join_url);
  let scope = 'in_person';
  if (hasMeeting) { scope = session.create_zoom_meeting ? 'public' : 'gated'; }
  const recurrenceSummary = session.is_recurring ? formatRecurrence(session.recurrence) : '';
  const platformLabel = SESSION_PLATFORM_LABELS[session.platform] || session.platform;
  const instructorList = (session.instructor_names || []).filter(Boolean).join(', ');

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title={session.title}
      footerNode={(
        <Button variant="tertiary" onClick={onClose}>Close</Button>
      )}
    >
      {/* First section: structured key/value rows + badges as the final row. */}
      {session.course_name && <Field label="Course">{session.course_name}</Field>}
      {session.location && (
        <Field label="Location">
          <span>{session.location.name}</span>
          {session.location.biometric_machine_serial_number && (
            <span className="text-muted ml-2" style={{ fontSize: 12 }}>
              (biometric: <code>{session.location.biometric_machine_serial_number}</code>)
            </span>
          )}
        </Field>
      )}
      <Field label="Start">{formatDateTime(session.scheduled_start_time)}</Field>
      <Field label="End">{formatDateTime(session.scheduled_end_time)}</Field>
      {session.duration_minutes != null && (
        <Field label="Duration">{`${session.duration_minutes} min`}</Field>
      )}
      {session.timezone && <Field label="Timezone">{session.timezone}</Field>}
      {platformLabel && <Field label="Platform">{platformLabel}</Field>}
      {recurrenceSummary && <Field label="Recurrence">{recurrenceSummary}</Field>}
      {instructorList && <Field label="Instructors">{instructorList}</Field>}
      <Field label="Status">
        <div className="d-flex" style={{ gap: 6, flexWrap: 'wrap' }}>
          <Badge variant={getStatusVariant(session.status)}>
            {SESSION_STATUS_LABELS[session.status] || session.status}
          </Badge>
          {/* Cancelled session = dead end; suppress scope/instructor/request
              noise. Status badge alone tells the story. */}
          {session.status !== 'cancelled' && (
            <>
              <ScopeBadge scope={scope} />
              {session.user_role === USER_ROLE.INSTRUCTOR && <InstructingBadge />}
              {session.my_request && <RequestStatusBadge request={session.my_request} />}
            </>
          )}
        </div>
      </Field>

      {/* Second section: description (own block, separated). */}
      {session.description && (
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid #dee2e6' }}>
          <div className="text-muted mb-1" style={{ fontSize: 13 }}>Description</div>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginBottom: 0 }}>
            {session.description}
          </p>
        </div>
      )}

      {/* Third section: meeting (own block, separated). */}
      {hasMeeting && (session.meeting_join_url || session.meeting_start_url) && (
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid #dee2e6' }}>
          <div className="text-muted mb-2" style={{ fontSize: 13 }}>Meeting</div>
          <div className="d-flex flex-wrap" style={{ gap: 8 }}>
            {session.meeting_start_url ? (
              <Button
                variant="success"
                size="sm"
                iconAfter={Launch}
                onClick={() => openInNewTab(session.meeting_start_url)}
              >
                Start as host
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                iconAfter={Launch}
                onClick={() => openInNewTab(session.meeting_join_url)}
              >
                Join meeting
              </Button>
            )}
          </div>
          {session.meeting_password && (
            <div className="mt-2" style={{ fontSize: 13 }}>
              <span className="text-muted">Password: </span>
              <code>{session.meeting_password}</code>
            </div>
          )}
        </div>
      )}
    </StandardModal>
  );
};

SessionDetailModal.propTypes = {
  session: PropTypes.shape({
    title: PropTypes.string,
    course_name: PropTypes.string,
    location: PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      description: PropTypes.string,
      biometric_machine_serial_number: PropTypes.string,
    }),
    status: PropTypes.string,
    scheduled_start_time: PropTypes.string,
    scheduled_end_time: PropTypes.string,
    duration_minutes: PropTypes.number,
    timezone: PropTypes.string,
    platform: PropTypes.string,
    description: PropTypes.string,
    is_recurring: PropTypes.bool,
    recurrence: PropTypes.shape({
      type: PropTypes.number,
      repeat_interval: PropTypes.number,
      end_times: PropTypes.number,
      end_date_time: PropTypes.string,
    }),
    instructor_names: PropTypes.arrayOf(PropTypes.string),
    create_zoom_meeting: PropTypes.bool,
    meeting_id: PropTypes.string,
    meeting_join_url: PropTypes.string,
    meeting_start_url: PropTypes.string,
    meeting_password: PropTypes.string,
    user_role: PropTypes.string,
    my_request: PropTypes.shape({
      status: PropTypes.string,
      request_type: PropTypes.string,
    }),
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
SessionDetailModal.defaultProps = {
  session: null,
};

export default SessionDetailModal;
