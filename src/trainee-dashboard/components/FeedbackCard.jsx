import React from 'react';
import PropTypes from 'prop-types';
import {
  Badge, Button, Card, Icon,
} from '@openedx/paragon';
import { CheckCircle, Feedback } from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';
import messages from '../messages';
import { formatDate } from '../utils';

const initials = name => name.split(' ').map(part => part[0]).slice(0, 2).join('');

const FeedbackCard = ({ feedback, pendingCount }) => {
  const intl = useIntl();

  return (
    <section aria-labelledby="feedback-heading">
      <Card>
        <Card.Header
          title={<h2 id="feedback-heading">{intl.formatMessage(messages.feedback)}</h2>}
          subtitle={intl.formatMessage(messages.pending, { count: pendingCount })}
        />
        <Card.Section className="trainee-dashboard__compact-list">
          {feedback.length === 0 && <p>{intl.formatMessage(messages.noFeedback)}</p>}
          {feedback.map(item => {
            const displayName = item.subject?.full_name || item.feedback_name;
            let action;
            if (item.status === 'submitted') {
              action = <Badge variant="success">{intl.formatMessage(messages.submitted)}</Badge>;
            } else if (item.status === 'expired') {
              action = <Badge variant="light">{intl.formatMessage(messages.expired)}</Badge>;
            } else {
              action = (
                <div className="trainee-dashboard__feedback-action">
                  <small className={item.urgent ? 'text-danger' : ''}>
                    {intl.formatMessage(messages.due, { date: formatDate(intl, item.deadline) })}
                  </small>
                  <Button
                    size="sm"
                    variant="outline-primary"
                    iconBefore={Feedback}
                    disabled
                    title={intl.formatMessage(messages.formUnavailable)}
                  >
                    {intl.formatMessage(messages.giveFeedback)}
                  </Button>
                </div>
              );
            }
            return (
              <article className="trainee-dashboard__feedback-row" key={item.id}>
                <span className={`trainee-dashboard__avatar${item.status === 'submitted' ? ' trainee-dashboard__avatar--complete' : ''}`} aria-hidden="true">
                  {item.status === 'submitted' ? <Icon src={CheckCircle} /> : initials(displayName)}
                </span>
                <div><h3>{displayName}</h3><p>{item.course_name || item.form_name}</p></div>
                {action}
              </article>
            );
          })}
        </Card.Section>
      </Card>
    </section>
  );
};

FeedbackCard.propTypes = {
  feedback: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    feedback_name: PropTypes.string.isRequired,
    form_name: PropTypes.string.isRequired,
    subject: PropTypes.shape({ full_name: PropTypes.string.isRequired }),
    course_name: PropTypes.string,
    deadline: PropTypes.string.isRequired,
    status: PropTypes.oneOf(['pending', 'submitted', 'expired']).isRequired,
    urgent: PropTypes.bool.isRequired,
  })).isRequired,
  pendingCount: PropTypes.number.isRequired,
};

export default FeedbackCard;
