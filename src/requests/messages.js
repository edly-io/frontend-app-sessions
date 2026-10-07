import { defineMessages } from '@edx/frontend-platform/i18n';

const messages = defineMessages({
  leaveThresholdHelp: {
    id: 'sessions.requests.leaveSettings.threshold.help',
    defaultMessage: 'Learners who go over this many days are flagged as at risk, and approving their leave shows a warning.',
    description: 'Help text under the leave threshold field in the Leave settings modal, explaining what the threshold does.',
  },
});

export default messages;
