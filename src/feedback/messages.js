import { defineMessages } from '@edx/frontend-platform/i18n';

const messages = defineMessages({
  pendingCount: {
    id: 'sessions.myFeedback.pendingCount',
    defaultMessage: '{count, plural, =0 {No pending forms} one {# pending form} other {# pending forms}}',
  },
  due: {
    id: 'sessions.myFeedback.due',
    defaultMessage: 'Due {date}',
  },
  fillFeedback: {
    id: 'sessions.myFeedback.fillFeedback',
    defaultMessage: 'Fill feedback',
  },
  summaryTitle: {
    id: 'sessions.myFeedback.summaryTitle',
    defaultMessage: 'Feedback to fill',
  },
  viewFeedback: {
    id: 'sessions.myFeedback.viewFeedback',
    defaultMessage: 'View feedback',
  },
});

export default messages;
