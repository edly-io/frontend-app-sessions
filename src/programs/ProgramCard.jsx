import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Badge } from '@openedx/paragon';

const STATUS_VARIANTS = {
  active: 'success',
  draft: 'secondary',
  archived: 'danger',
  freezed: 'warning',
};

const STATUS_LABELS = {
  active: 'Active',
  draft: 'Draft',
  archived: 'Archived',
  freezed: 'Frozen',
};

const formatDate = (dateStr) => {
  if (!dateStr) { return null; }
  return new Date(dateStr).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

const ProgramCard = ({ program, isAdmin = false, studioBaseUrl = null }) => {
  const {
    id, name, programType, org, batch, status, startDate, endDate, description, cardImage,
  } = program;

  const statusKey = (status || '').toLowerCase();
  const dateRange = [formatDate(startDate), formatDate(endDate)].filter(Boolean).join(' – ');
  const studioUrl = isAdmin && studioBaseUrl
    ? `${studioBaseUrl.replace(/\/$/, '')}/authoring/programs/${id}`
    : null;

  const bannerStyle = cardImage
    ? { backgroundImage: `url(${cardImage})` }
    : undefined;

  return (
    <div className="program-card">
      <Link to={`/${id}/courses`} className="program-card__link">
        <div className="program-card__banner" style={bannerStyle}>
          {!cardImage && (
            <div className="program-card__banner-placeholder">
              {(name || '?').split(' ').slice(0, 2)
                .map((w) => w[0]).join('')
                .toUpperCase()}
            </div>
          )}
          <div className="program-card__badges">
            {org && <span className="program-card__badge">{org}</span>}
            {programType && <span className="program-card__badge">{programType}</span>}
            {batch && <span className="program-card__badge">{batch}</span>}
          </div>
          {statusKey && (
            <div className="program-card__status">
              <Badge variant={STATUS_VARIANTS[statusKey] || 'light'}>
                {STATUS_LABELS[statusKey] || status}
              </Badge>
            </div>
          )}
        </div>

        <div className="program-card__body">
          <h5 className="program-card__title">{name}</h5>
          {dateRange && <p className="program-card__meta">{dateRange}</p>}
          {description
            ? <p className="program-card__description">{description}</p>
            : <div className="program-card__spacer" />}
        </div>
      </Link>

      {isAdmin && studioUrl && (
        <div className="program-card__footer">
          <a
            href={studioUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline-secondary btn-sm w-100"
            onClick={(e) => e.stopPropagation()}
          >
            Manage in Studio ↗
          </a>
        </div>
      )}
    </div>
  );
};

ProgramCard.propTypes = {
  program: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    programType: PropTypes.string,
    org: PropTypes.string,
    batch: PropTypes.string,
    status: PropTypes.string,
    startDate: PropTypes.string,
    endDate: PropTypes.string,
    description: PropTypes.string,
    cardImage: PropTypes.string,
  }).isRequired,
  isAdmin: PropTypes.bool,
  studioBaseUrl: PropTypes.string,
};

export default ProgramCard;
