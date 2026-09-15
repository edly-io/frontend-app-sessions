import { defineMessages } from '@edx/frontend-platform/i18n';

const messages = defineMessages({
  answerRequired: { id: 'sessions.feedback.answerRequired', defaultMessage: 'This question is required.' },
  submitError: { id: 'sessions.feedback.submitError', defaultMessage: 'We could not submit your feedback. Please try again.' },
  modalTitle: { id: 'sessions.feedback.modalTitle', defaultMessage: 'Submit feedback' },
  close: { id: 'sessions.feedback.close', defaultMessage: 'Close' },
  cancel: { id: 'sessions.feedback.cancel', defaultMessage: 'Cancel' },
  submitting: { id: 'sessions.feedback.submitting', defaultMessage: 'Submitting…' },
  submit: { id: 'sessions.feedback.submit', defaultMessage: 'Submit feedback' },
  loading: { id: 'sessions.feedback.loading', defaultMessage: 'Loading feedback form' },
  loadError: { id: 'sessions.feedback.loadError', defaultMessage: 'We could not load this feedback form. Please try again.' },
  submitted: { id: 'sessions.feedback.submitted', defaultMessage: 'Feedback submitted' },
  submittedBody: { id: 'sessions.feedback.submittedBody', defaultMessage: 'Thank you. Your feedback has been submitted successfully.' },
  ratingValue: { id: 'sessions.feedback.ratingValue', defaultMessage: '{value, plural, one {# star} other {# stars}}' },
  responsePlaceholder: { id: 'sessions.feedback.responsePlaceholder', defaultMessage: 'Enter your response' },
});

export default messages;
