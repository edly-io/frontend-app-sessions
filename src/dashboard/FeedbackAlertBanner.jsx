import React from 'react';
import PropTypes from 'prop-types';
import { Button, Icon } from '@openedx/paragon';
import { NotificationImportant } from '@openedx/paragon/icons';

const FeedbackAlertBanner = ({ pendingCount, feedback, onScrollToFeedback }) => {
  if (!pendingCount) { return null; }

  const pendingItems = feedback.filter(f => f.status === 'pending');
  const hasUrgent = pendingItems.some(f => f.urgent);
  const nearest = pendingItems.reduce(
    (min, f) => (!min || f.deadline < min.deadline ? f : min),
    null,
  );

  const formatDeadline = (isoDate) => new Date(isoDate).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div
      className={`dashboard-feedback-alert${hasUrgent ? ' dashboard-feedback-alert--urgent' : ''}`}
      role="note"
    >
      <span className="dashboard-feedback-alert__icon">
        <Icon src={NotificationImportant} />
      </span>
      <div className="dashboard-feedback-alert__body">
        <strong>
          {pendingCount} pending feedback form{pendingCount !== 1 ? 's' : ''} waiting for you
        </strong>
        {nearest && (
          <p>
            {hasUrgent ? 'Deadline approaching — ' : 'Nearest deadline: '}
            <strong>{formatDeadline(nearest.deadline)}</strong>
            {hasUrgent ? ' — submit soon!' : ''}
          </p>
        )}
      </div>
      <Button
        variant={hasUrgent ? 'brand' : 'outline-primary'}
        size="sm"
        onClick={onScrollToFeedback}
        className="flex-shrink-0"
      >
        View Feedback ↓
      </Button>
    </div>
  );
};

FeedbackAlertBanner.propTypes = {
  pendingCount: PropTypes.number.isRequired,
  feedback: PropTypes.arrayOf(PropTypes.shape({
    status: PropTypes.string.isRequired,
    urgent: PropTypes.bool,
    deadline: PropTypes.string,
  })).isRequired,
  onScrollToFeedback: PropTypes.func.isRequired,
};

export default FeedbackAlertBanner;
