import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Button, Form, Spinner, StandardModal,
} from '@openedx/paragon';
import { useIntl } from '@edx/frontend-platform/i18n';

import messages from '../messages';

const STAR_VALUES = [1, 2, 3, 4, 5];

const getErrorMessage = (error, fallback) => {
  if (!error) { return fallback; }
  const data = error.response?.data;
  if (typeof data?.error?.detail === 'string') { return data.error.detail; }
  if (typeof data?.detail === 'string') { return data.detail; }
  if (Array.isArray(data?.non_field_errors)) { return data.non_field_errors.join(' '); }
  if (typeof error.message === 'string') { return error.message; }
  if (typeof error === 'string') { return error; }
  return fallback;
};

const FeedbackFormModal = ({
  isOpen,
  feedback = null,
  isLoading,
  loadError = null,
  onClose,
  onSubmit,
}) => {
  const intl = useIntl();
  const [answers, setAnswers] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (!isOpen) { return; }
    setAnswers({});
    setValidationErrors({});
    setIsSubmitting(false);
    setSubmitError('');
    setIsSubmitted(false);
  }, [feedback?.id, isOpen]);

  const updateAnswer = (questionId, value) => {
    setAnswers(previous => ({ ...previous, [questionId]: value }));
    setValidationErrors(previous => ({ ...previous, [questionId]: undefined }));
  };

  const validate = () => {
    const errors = {};
    feedback.questions.forEach((question) => {
      if (!question.required) { return; }
      const value = answers[question.id];
      if (value === undefined || value === null || String(value).trim() === '') {
        errors[question.id] = intl.formatMessage(messages.feedbackAnswerRequired);
      }
    });
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildPayload = () => ({
    answers: feedback.questions.reduce((result, question) => {
      const value = answers[question.id];
      if (value === undefined || value === null || String(value).trim() === '') {
        return result;
      }
      if (question.question_type === 'star_rating') {
        result.push({ question_id: question.id, star_value: Number(value) });
      } else if (question.question_type === 'textarea') {
        result.push({ question_id: question.id, text_value: String(value).trim() });
      }
      return result;
    }, []),
  });

  const handleSubmit = async () => {
    if (!feedback || !validate()) { return; }
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(feedback.id, buildPayload());
      setIsSubmitted(true);
    } catch (error) {
      setSubmitError(getErrorMessage(
        error,
        intl.formatMessage(messages.feedbackSubmitError),
      ));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) { onClose(); }
  };

  const title = feedback?.feedback_name
    || feedback?.form_name
    || intl.formatMessage(messages.feedbackModalTitle);
  const canSubmit = Boolean(feedback) && !isLoading && !loadError && !isSubmitted;

  const footerNode = isSubmitted ? (
    <Button variant="primary" onClick={handleClose}>
      {intl.formatMessage(messages.close)}
    </Button>
  ) : (
    <>
      <Button variant="tertiary" onClick={handleClose} disabled={isSubmitting}>
        {intl.formatMessage(messages.cancel)}
      </Button>
      <Button
        variant="primary"
        onClick={handleSubmit}
        disabled={!canSubmit || isSubmitting}
        className="ml-2"
      >
        {isSubmitting
          ? intl.formatMessage(messages.submittingFeedback)
          : intl.formatMessage(messages.submitFeedback)}
      </Button>
    </>
  );

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      footerNode={footerNode}
      size="lg"
    >
      {isLoading && (
        <div className="py-5 text-center">
          <Spinner
            animation="border"
            screenReaderText={intl.formatMessage(messages.loadingFeedback)}
          />
        </div>
      )}

      {!isLoading && loadError && (
        <Alert variant="danger">
          {getErrorMessage(loadError, intl.formatMessage(messages.feedbackLoadError))}
        </Alert>
      )}

      {!isLoading && !loadError && isSubmitted && (
        <Alert variant="success">
          <Alert.Heading>{intl.formatMessage(messages.feedbackSubmitted)}</Alert.Heading>
          {intl.formatMessage(messages.feedbackSubmittedBody)}
        </Alert>
      )}

      {!isLoading && !loadError && !isSubmitted && feedback && (
        <Form onSubmit={(event) => { event.preventDefault(); handleSubmit(); }}>
          {(feedback.subject_name || feedback.program_name) && (
            <p className="text-muted">
              {[feedback.subject_name, feedback.program_name].filter(Boolean).join(' · ')}
            </p>
          )}

          {submitError && <Alert variant="danger">{submitError}</Alert>}

          {feedback.questions.map((question, index) => {
            const questionId = `instructor-feedback-question-${question.id}`;
            const error = validationErrors[question.id];
            return (
              <Form.Group key={question.id} controlId={questionId} isInvalid={Boolean(error)}>
                <Form.Label>
                  {index + 1}. {question.question}{question.required && ' *'}
                </Form.Label>

                {question.question_type === 'star_rating' && (
                  <Form.RadioSet
                    name={questionId}
                    value={answers[question.id] || ''}
                    onChange={event => updateAnswer(question.id, event.target.value)}
                    isInline
                  >
                    {STAR_VALUES.map(value => (
                      <Form.Radio key={value} value={String(value)}>
                        {intl.formatMessage(messages.feedbackRatingValue, { value })}
                      </Form.Radio>
                    ))}
                  </Form.RadioSet>
                )}

                {question.question_type === 'textarea' && (
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={answers[question.id] || ''}
                    onChange={event => updateAnswer(question.id, event.target.value)}
                    isInvalid={Boolean(error)}
                    placeholder={intl.formatMessage(messages.feedbackResponsePlaceholder)}
                  />
                )}

                {error && (
                  <Form.Control.Feedback type="invalid">
                    {error}
                  </Form.Control.Feedback>
                )}
              </Form.Group>
            );
          })}
        </Form>
      )}
    </StandardModal>
  );
};

FeedbackFormModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  feedback: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    feedback_name: PropTypes.string,
    form_name: PropTypes.string.isRequired,
    subject_name: PropTypes.string,
    program_name: PropTypes.string,
    questions: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      question: PropTypes.string.isRequired,
      question_type: PropTypes.oneOf(['star_rating', 'textarea']).isRequired,
      required: PropTypes.bool.isRequired,
    })).isRequired,
  }),
  isLoading: PropTypes.bool.isRequired,
  loadError: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default FeedbackFormModal;
