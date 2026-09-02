import React from 'react';
import PropTypes from 'prop-types';
import { defineMessages, useIntl } from '@edx/frontend-platform/i18n';
import { Tab, Tabs } from '@openedx/paragon';

import { FBR_ROLE } from '../shared/constants';

const messages = defineMessages({
  traineeProfile: {
    id: 'sessions.dashboard.profileSwitcher.trainee',
    defaultMessage: 'Your trainee profile',
    description: 'Tab that opens the trainee version of the Sessions dashboard.',
  },
  instructorProfile: {
    id: 'sessions.dashboard.profileSwitcher.instructor',
    defaultMessage: 'Your instructor profile',
    description: 'Tab that opens the instructor version of the Sessions dashboard.',
  },
  moreProfiles: {
    id: 'sessions.dashboard.profileSwitcher.more',
    defaultMessage: 'More profiles',
    description: 'Label for the overflow menu when profile tabs do not fit on screen.',
  },
});

const ProfileSwitcher = ({ activeProfile, onSelect }) => {
  const intl = useIntl();

  return (
    <Tabs
      id="sessions-dashboard-profile-switcher"
      activeKey={activeProfile}
      onSelect={onSelect}
      moreTabText={intl.formatMessage(messages.moreProfiles)}
      className="mb-4"
    >
      <Tab
        eventKey={FBR_ROLE.TRAINEE}
        title={intl.formatMessage(messages.traineeProfile)}
      />
      <Tab
        eventKey={FBR_ROLE.INSTRUCTOR}
        title={intl.formatMessage(messages.instructorProfile)}
      />
    </Tabs>
  );
};

ProfileSwitcher.propTypes = {
  activeProfile: PropTypes.oneOf([FBR_ROLE.TRAINEE, FBR_ROLE.INSTRUCTOR]).isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default ProfileSwitcher;
