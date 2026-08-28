import React from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Badge, Button, Card, Icon,
} from '@openedx/paragon';
import { CheckCircle, Feedback, MenuBook } from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';
import messages from '../messages';
import { formatDate } from '../utils';

const FeedbackToSubmitCard = ({ feedback, pendingCount, onOpenFeedback }) => {
  const intl = useIntl();
  const getIcon = item => {
    if (item.status === 'submitted') { return CheckCircle; }
    return item.type === 'course' ? MenuBook : Feedback;
  };
  const getTitle = item => item.subject?.full_name || item.course_name || item.feedback_name;
  const getContext = item => [item.form_name, item.course_code].filter(Boolean).join(' · ');
  const renderAction = (item) => {
    if (item.status === 'submitted') {
      return <Badge variant="success">{intl.formatMessage(messages.submitted)}</Badge>;
    }
    if (item.status === 'expired') {
      return <Badge variant="danger">{intl.formatMessage(messages.expired)}</Badge>;
    }
    return (
      <>
        <span>
          {item.urgent && <Badge variant="danger">{intl.formatMessage(messages.urgent)}</Badge>}
          <small>{intl.formatMessage(messages.due, { date: formatDate(intl, item.deadline) })}</small>
        </span>
        <Button
          size="sm"
          disabled={!item.can_submit}
          title={item.can_submit ? undefined : intl.formatMessage(messages.feedbackUnavailable)}
          onClick={() => onOpenFeedback(item.id)}
        >
          {intl.formatMessage(messages.fillForm)}
        </Button>
      </>
    );
  };

  return (
    <Card className="instructor-dashboard__fill-card">
      <Card.Header
        title={<h2 id="instructor-feedback-heading">{intl.formatMessage(messages.feedbackToSubmit)}</h2>}
        subtitle={intl.formatMessage(messages.pendingCount, { count: pendingCount })}
      />
      <Card.Section>
        {!feedback.length ? <Alert variant="success">{intl.formatMessage(messages.noFeedback)}</Alert> : (
          <div className="instructor-dashboard__compact-list">
            {feedback.map(item => (
              <article className="instructor-dashboard__feedback-row" key={item.id}>
                <span className={`instructor-dashboard__list-icon${item.status === 'submitted' ? ' instructor-dashboard__list-icon--complete' : ''}`}>
                  <Icon src={getIcon(item)} />
                </span>
                <div>
                  <strong>{getTitle(item)}</strong>
                  <p>{getContext(item)}</p>
                </div>
                <div className="instructor-dashboard__list-action">
                  {renderAction(item)}
                </div>
              </article>
            ))}
          </div>
        )}
      </Card.Section>
    </Card>
  );
};

FeedbackToSubmitCard.propTypes = {
  feedback: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    feedback_name: PropTypes.string.isRequired,
    form_name: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['trainee', 'course']).isRequired,
    subject: PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      full_name: PropTypes.string.isRequired,
    }),
    course_code: PropTypes.string,
    course_name: PropTypes.string,
    deadline: PropTypes.string.isRequired,
    status: PropTypes.oneOf(['pending', 'submitted', 'expired']).isRequired,
    urgent: PropTypes.bool.isRequired,
    submitted_at: PropTypes.string,
    can_submit: PropTypes.bool.isRequired,
  })).isRequired,
  pendingCount: PropTypes.number.isRequired,
  onOpenFeedback: PropTypes.func.isRequired,
};

export default FeedbackToSubmitCard;
