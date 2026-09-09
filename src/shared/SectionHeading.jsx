import React from 'react';
import PropTypes from 'prop-types';

const SectionHeading = ({ children }) => (
  <h3 className="sessions-section-heading">{children}</h3>
);

SectionHeading.propTypes = { children: PropTypes.node.isRequired };

export default SectionHeading;
