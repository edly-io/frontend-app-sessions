import React from 'react';
import PropTypes from 'prop-types';
import { Badge, Card } from '@openedx/paragon';
import { useIntl } from '@edx/frontend-platform/i18n';
import AccessibleProgressBar from '../../dashboard/AccessibleProgressBar';
import messages from '../messages';
import { formatDate } from '../utils';

const STATUS_VARIANTS = {
  present: 'success', absent: 'danger', leave: 'warning', pending: 'light',
};
const STATUS_MESSAGES = {
  present: messages.present,
  absent: messages.absent,
  leave: messages.onLeave,
  pending: messages.attendancePending,
};

const AttendanceCard = ({ attendance }) => {
  const intl = useIntl();
  const percentage = Math.round(attendance.percentage);
  const counts = [
    { label: intl.formatMessage(messages.present), value: attendance.present, variant: 'success' },
    { label: intl.formatMessage(messages.absent), value: attendance.absent, variant: 'danger' },
    { label: intl.formatMessage(messages.onLeave), value: attendance.leave, variant: 'warning' },
    { label: intl.formatMessage(messages.attendancePending), value: attendance.pending, variant: 'primary' },
  ];

  return (
    <section aria-labelledby="attendance-heading" className="h-100">
      <Card className="h-100">
        <Card.Header
          title={<h2 id="attendance-heading">{intl.formatMessage(messages.myAttendance)}</h2>}
          subtitle={intl.formatMessage(messages.againstRequirement, { threshold: attendance.threshold })}
        />
        <Card.Section>
          <div className="trainee-dashboard__attendance-summary">
            <div>
              <strong>{percentage}%</strong>
              <span>{intl.formatMessage(messages.sessionsAttended, {
                present: attendance.present,
                total: attendance.total,
              })}
              </span>
            </div>
            {attendance.total > 0 && (
              <Badge variant={attendance.meets_requirement ? 'success' : 'danger'}>
                {intl.formatMessage(
                  attendance.meets_requirement ? messages.meetsRequirement : messages.belowRequirement,
                  { threshold: attendance.threshold },
                )}
              </Badge>
            )}
          </div>
          <AccessibleProgressBar
            now={percentage}
            variant={attendance.meets_requirement ? 'success' : 'danger'}
            label={intl.formatMessage(messages.progressLabel, {
              context: intl.formatMessage(messages.myAttendance),
              percentage,
            })}
          />
          <div className="trainee-dashboard__attendance-counts">
            {counts.map(count => (
              <div
                key={count.label}
                className={`trainee-dashboard__attendance-count trainee-dashboard__attendance-count--${count.variant}`}
              >
                <strong>{count.value}</strong><span>{count.label}</span>
              </div>
            ))}
          </div>
          <h3 className="trainee-dashboard__subheading">{intl.formatMessage(messages.recentAttendance)}</h3>
          {attendance.history.length === 0 ? <p>{intl.formatMessage(messages.noAttendanceHistory)}</p> : (
            <div className="trainee-dashboard__attendance-history">
              {attendance.history.map(item => (
                <div className="trainee-dashboard__attendance-row" key={item.session_id}>
                  <time dateTime={item.session_start}>{formatDate(intl, item.session_start, { year: undefined })}</time>
                  <span>{item.session_title}{item.course_name ? ` · ${item.course_name}` : ''}</span>
                  <Badge variant={STATUS_VARIANTS[item.status]}>
                    {intl.formatMessage(STATUS_MESSAGES[item.status])}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card.Section>
      </Card>
    </section>
  );
};

AttendanceCard.propTypes = {
  attendance: PropTypes.shape({
    present: PropTypes.number.isRequired,
    absent: PropTypes.number.isRequired,
    leave: PropTypes.number.isRequired,
    pending: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired,
    percentage: PropTypes.number.isRequired,
    threshold: PropTypes.number.isRequired,
    meets_requirement: PropTypes.bool.isRequired,
    history: PropTypes.arrayOf(PropTypes.shape({
      session_id: PropTypes.string.isRequired,
      session_title: PropTypes.string.isRequired,
      session_start: PropTypes.string.isRequired,
      course_name: PropTypes.string,
      status: PropTypes.oneOf(['present', 'absent', 'leave', 'pending']).isRequired,
    })).isRequired,
  }).isRequired,
};

export default AttendanceCard;
