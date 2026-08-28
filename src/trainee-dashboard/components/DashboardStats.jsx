import React from 'react';
import PropTypes from 'prop-types';
import {
  Card, Col, Icon, Row,
} from '@openedx/paragon';
import {
  CalendarToday, CheckCircle, Feedback, WorkspacePremium,
} from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';
import messages from '../messages';

const DashboardStats = ({ summary }) => {
  const intl = useIntl();
  const stats = [
    {
      value: `${summary.course_progress.percentage}%`,
      label: intl.formatMessage(messages.moduleProgress, {
        completed: summary.course_progress.completed_modules,
        total: summary.course_progress.total_modules,
      }),
      icon: CheckCircle,
      variant: 'primary',
    },
    {
      value: `${Math.round(summary.attendance.percentage)}%`,
      label: intl.formatMessage(summary.attendance.meets_requirement
        ? messages.attendanceRequirementMet : messages.attendanceRequirementNotMet),
      icon: CalendarToday,
      variant: summary.attendance.meets_requirement ? 'success' : 'warning',
    },
    {
      value: summary.pending_feedback,
      label: intl.formatMessage(messages.feedbackForms),
      icon: Feedback,
      variant: 'warning',
    },
    {
      value: summary.earned_certificates,
      label: intl.formatMessage(messages.certificatesEarned),
      icon: WorkspacePremium,
      variant: 'gold',
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

DashboardStats.propTypes = {
  summary: PropTypes.shape({
    course_progress: PropTypes.shape({
      completed_modules: PropTypes.number.isRequired,
      total_modules: PropTypes.number.isRequired,
      percentage: PropTypes.number.isRequired,
    }).isRequired,
    attendance: PropTypes.shape({
      percentage: PropTypes.number.isRequired,
      meets_requirement: PropTypes.bool.isRequired,
    }).isRequired,
    pending_feedback: PropTypes.number.isRequired,
    earned_certificates: PropTypes.number.isRequired,
  }).isRequired,
};

export default DashboardStats;
