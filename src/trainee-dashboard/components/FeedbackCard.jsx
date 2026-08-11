import React from 'react';
import {
  Badge, Button, Card, Icon,
} from '@openedx/paragon';
import { CheckCircle, Feedback } from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';
import { feedback, totals } from '../dashboardData';
import messages from '../messages';

const initials = name => name.split(' ').map(part => part[0]).slice(0, 2).join('');

const FeedbackCard = () => {
  const intl = useIntl();

  return (
    <section aria-labelledby="feedback-heading">
      <Card>
        <Card.Header
          title={<h2 id="feedback-heading">{intl.formatMessage(messages.feedback)}</h2>}
          subtitle={intl.formatMessage(messages.pending, { count: totals.pendingFeedback })}
        />
        <Card.Section className="trainee-dashboard__compact-list">
          {feedback.map(item => (
            <article className="trainee-dashboard__feedback-row" key={`${item.instructor}-${item.course}`}>
              <span className={`trainee-dashboard__avatar${item.submitted ? ' trainee-dashboard__avatar--complete' : ''}`} aria-hidden="true">
                {item.submitted ? <Icon src={CheckCircle} /> : initials(item.instructor)}
              </span>
              <div><h3>{item.instructor}</h3><p>{item.course}</p></div>
              {item.submitted ? (
                <Badge variant="success">{intl.formatMessage(messages.submitted)}</Badge>
              ) : (
                <div className="trainee-dashboard__feedback-action">
                  <small className={item.urgent ? 'text-danger' : ''}>{intl.formatMessage(messages.due, { date: item.due })}</small>
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
              )}
            </article>
          ))}
        </Card.Section>
      </Card>
    </section>
  );
};

export default FeedbackCard;
