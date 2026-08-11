import React from 'react';
import {
  Card, Col, Icon, Row,
} from '@openedx/paragon';
import {
  CalendarToday, CheckCircle, Feedback, WorkspacePremium,
} from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';
import {
  attendancePercentage, courseProgress, totals,
} from '../dashboardData';
import messages from '../messages';

const DashboardStats = () => {
  const intl = useIntl();
  const stats = [
    {
      value: `${courseProgress}%`, label: intl.formatMessage(messages.moduleProgress, { completed: totals.completedModules, total: totals.modules }), icon: CheckCircle, variant: 'primary',
    },
    {
      value: `${attendancePercentage}%`, label: intl.formatMessage(messages.attendanceRequirement), icon: CalendarToday, variant: 'success',
    },
    {
      value: totals.pendingFeedback, label: intl.formatMessage(messages.feedbackForms), icon: Feedback, variant: 'warning',
    },
    {
      value: totals.certificates, label: intl.formatMessage(messages.certificatesEarned), icon: WorkspacePremium, variant: 'gold',
    },
  ];

  return (
    <section aria-label={intl.formatMessage(messages.dashboardSummary)} className="trainee-dashboard__stats">
      <Row>
        {stats.map(stat => (
          <Col xs={12} sm={6} lg={3} key={stat.label} className="mb-3">
            <Card className="trainee-dashboard__stat-card h-100">
              <Card.Section>
                <span className={`trainee-dashboard__stat-icon trainee-dashboard__stat-icon--${stat.variant}`} aria-hidden="true">
                  <Icon src={stat.icon} />
                </span>
                <span>
                  <strong className="trainee-dashboard__stat-value">{stat.value}</strong>
                  <span className="trainee-dashboard__stat-label">{stat.label}</span>
                </span>
              </Card.Section>
            </Card>
          </Col>
        ))}
      </Row>
    </section>
  );
};

export default DashboardStats;
