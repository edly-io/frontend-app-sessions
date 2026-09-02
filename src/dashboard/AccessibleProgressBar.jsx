import React from 'react';
import PropTypes from 'prop-types';
import { ProgressBar } from '@openedx/paragon';

const AccessibleProgressBar = ({ label, now, variant = undefined }) => (
  <div
    role="progressbar"
    aria-label={label}
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={now}
  >
    <ProgressBar now={now} variant={variant} aria-hidden="true" />
  </div>
);

AccessibleProgressBar.propTypes = {
  label: PropTypes.string.isRequired,
  now: PropTypes.number.isRequired,
  variant: PropTypes.string,
};

export default AccessibleProgressBar;
