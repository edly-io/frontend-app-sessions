import React, { useState } from 'react';
import {
  Button, Card, Icon, StandardModal,
} from '@openedx/paragon';
import { Feedback } from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';

import FeedbackFormModal from '../dashboard/FeedbackFormModal';
import useFeedback from '../dashboard/useFeedback';
import usePendingFeedback from './usePendingFeedback';
import messages from './messages';
import './my-feedback.scss';

const MyFeedbackSummaryCard = () => {
  const intl = useIntl();
  const [isListOpen, setIsListOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const { data: feedback = [], isLoading, isError } = usePendingFeedback();
  const feedbackForm = useFeedback(selectedRequestId);

  const openFeedbackForm = (requestId) => {
    setIsListOpen(false);
    setSelectedRequestId(requestId);
  };

  const formatDeadline = value => intl.formatDate(new Date(`${value}T00:00:00`), {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const hasPendingFeedback = !isLoading && !isError && feedback.length > 0;
  if (!hasPendingFeedback && selectedRequestId === null) {
    return null;
  }

  return (
    <>
      {hasPendingFeedback && (
        <>
          <Card className="my-feedback-summary mb-4">
            <Card.Section className="my-feedback-summary__content">
              <div className="my-feedback-summary__icon" aria-hidden="true">
                <Feedback />
              </div>
              <div className="my-feedback-summary__copy">
                <h2>{intl.formatMessage(messages.summaryTitle)}</h2>
                <strong>{intl.formatMessage(messages.pendingCount, { count: feedback.length })}</strong>
              </div>
              <Button
                variant="outline-primary"
                onClick={() => setIsListOpen(true)}
              >
                {intl.formatMessage(messages.viewFeedback)}
              </Button>
            </Card.Section>
          </Card>

          <StandardModal
            isOpen={isListOpen}
            onClose={() => setIsListOpen(false)}
            title={intl.formatMessage(messages.summaryTitle)}
            size="md"
            className="feedback-form-modal"
          >
            <div className="my-feedback-modal-list">
              {feedback.map(item => (
                <article className="my-feedback-modal-list__item" key={item.id}>
                  <span className="my-feedback-modal-list__icon" aria-hidden="true">
                    <Icon src={Feedback} />
                  </span>
                  <div className="my-feedback-modal-list__copy">
                    <h3>{item.feedback_name}</h3>
                    <p>{item.form_name}</p>
                    <small>
                      {intl.formatMessage(messages.due, { date: formatDeadline(item.deadline) })}
                    </small>
                  </div>
                  <Button size="sm" onClick={() => openFeedbackForm(item.id)}>
                    {intl.formatMessage(messages.fillFeedback)}
                  </Button>
                </article>
              ))}
            </div>
          </StandardModal>
        </>
      )}

      <FeedbackFormModal
        isOpen={selectedRequestId !== null}
        feedback={feedbackForm.feedback || null}
        isLoading={feedbackForm.isLoading}
        loadError={feedbackForm.loadError}
        onClose={() => setSelectedRequestId(null)}
        onSubmit={feedbackForm.submit}
      />
    </>
  );
};

export default MyFeedbackSummaryCard;
