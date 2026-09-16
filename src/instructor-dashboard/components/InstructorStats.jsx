import React from 'react';
import PropTypes from 'prop-types';
import {
  Card, Col, Icon, Row,
} from '@openedx/paragon';
import {
  AccessTime, Feedback, MenuBook,
} from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';
import messages from '../messages';

const InstructorStats = ({ summary, onFeedbackClick = undefined }) => {
  const intl = useIntl();
  const stats = [
    {
      icon: MenuBook,
      value: summary.courses,
      label: intl.formatMessage(messages.coursesAcrossProgrammes, { programmes: summary.programmes }),
      variant: 'primary',
    },
    {
      icon: AccessTime,
      value: intl.formatMessage(messages.hoursShort, { hours: summary.delivered_hours }),
      label: intl.formatMessage(messages.sessionsDelivered, { sessions: summary.delivered_sessions }),
      variant: 'violet',
    },
    {
      icon: Feedback,
      value: summary.pending_feedback,
      label: intl.formatMessage(messages.feedbackFormsToSubmit),
      variant: 'warning',
      onClick: summary.pending_feedback > 0 ? onFeedbackClick : undefined,
    },
  ];

  return (
    <section className="instructor-dashboard__stats instructor-dashboard__section" aria-label={intl.formatMessage(messages.dashboardSummary)}>
      <Row>
        {stats.map(stat => (
          <Col xs={12} sm={4} className="mb-3" key={stat.label}>
            <Card
              className={`instructor-dashboard__stat-card${stat.onClick ? ' dashboard-stat-card--clickable' : ''}`}
              onClick={stat.onClick}
            >
              <Card.Section>
                <span className={`instructor-dashboard__stat-icon instructor-dashboard__stat-icon--${stat.variant}`}>
                  <Icon src={stat.icon} />
                </span>
                <span>
                  <strong className="instructor-dashboard__stat-value">{stat.value}</strong>
                  <span className="instructor-dashboard__stat-label">{stat.label}</span>
                  {stat.onClick && <span className="dashboard-stat-scroll-arrow" aria-hidden="true">↓ View below</span>}
                </span>
              </Card.Section>
            </Card>
          </Col>
        ))}
      </Row>
    </section>
  );
};

InstructorStats.propTypes = {
  onFeedbackClick: PropTypes.func,
  summary: PropTypes.shape({
    courses: PropTypes.number.isRequired,
    programmes: PropTypes.number.isRequired,
    delivered_hours: PropTypes.number.isRequired,
    delivered_sessions: PropTypes.number.isRequired,
    pending_feedback: PropTypes.number.isRequired,
  }).isRequired,
};

export default InstructorStats;
