import React from 'react';
import PropTypes from 'prop-types';
import './mobile-row-cards.scss';

export const MobileRowCardsList = ({ children }) => (
  <div className="mobile-row-cards">{children}</div>
);
MobileRowCardsList.propTypes = { children: PropTypes.node.isRequired };

export const MobileRowCard = ({
  title, subtitle = null, footer = null, children = null,
}) => (
  <article className="mobile-row-card">
    <header className="mobile-row-card__header">
      <div className="mobile-row-card__title">{title}</div>
      {subtitle && <div className="mobile-row-card__subtitle">{subtitle}</div>}
    </header>
    {children && <div className="mobile-row-card__body">{children}</div>}
    {footer && <div className="mobile-row-card__footer">{footer}</div>}
  </article>
);
MobileRowCard.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  footer: PropTypes.node,
  children: PropTypes.node,
};

export const MobileRowField = ({ label, children }) => (
  <div className="mobile-row-card__field">
    <span className="mobile-row-card__label">{label}</span>
    <span className="mobile-row-card__value">{children}</span>
  </div>
);
MobileRowField.propTypes = {
  label: PropTypes.node.isRequired,
  children: PropTypes.node.isRequired,
};
