import React from 'react';
import { Badge, Card } from '@openedx/paragon';
import { useIntl } from '@edx/frontend-platform/i18n';
import { attendance, attendancePercentage } from '../dashboardData';
import messages from '../messages';
import AccessibleProgressBar from './AccessibleProgressBar';

const STATUS_VARIANTS = { Present: 'success', Absent: 'danger', 'On leave': 'warning' };

const AttendanceCard = () => {
  const intl = useIntl();
  const total = attendance.present + attendance.absent + attendance.leave;
  const counts = [
    { label: intl.formatMessage(messages.present), value: attendance.present, variant: 'success' },
    { label: intl.formatMessage(messages.absent), value: attendance.absent, variant: 'danger' },
    { label: intl.formatMessage(messages.onLeave), value: attendance.leave, variant: 'warning' },
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
              <strong>{attendancePercentage}%</strong>
              <span>{intl.formatMessage(messages.sessionsAttended, {
                present: attendance.present,
                total,
              })}
              </span>
            </div>
            <Badge variant="success">
              {intl.formatMessage(messages.aboveRequirement, { threshold: attendance.threshold })}
            </Badge>
          </div>
          <AccessibleProgressBar
            now={attendancePercentage}
            variant="success"
            label={intl.formatMessage(messages.progressLabel, {
              context: intl.formatMessage(messages.myAttendance),
              percentage: attendancePercentage,
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
          <div className="trainee-dashboard__attendance-history">
            {attendance.history.map(item => (
              <div className="trainee-dashboard__attendance-row" key={`${item.date}-${item.name}`}>
                <time>{item.date}</time>
                <span>{item.name}</span>
                <Badge variant={STATUS_VARIANTS[item.status]}>{item.status}</Badge>
              </div>
            ))}
          </div>
        </Card.Section>
      </Card>
    </section>
  );
};

export default AttendanceCard;
