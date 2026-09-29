import React from 'react';
import PropTypes from 'prop-types';
import { Badge, Icon } from '@openedx/paragon';
import { LocationOn, MenuBook, Person } from '@openedx/paragon/icons';
import { Link } from 'react-router-dom';
import { useIntl } from '@edx/frontend-platform/i18n';
import AccessibleProgressBar from '../../dashboard/AccessibleProgressBar';
import { getCityHero } from '../../dashboard/cityHero';
import messages from '../messages';
import { formatDate } from '../utils';

const DashboardHero = ({ trainee, programme, programKey = undefined }) => {
  const intl = useIntl();
  const { timeline } = programme;
  const cityHero = getCityHero(programme.campus?.name);

  return (
    <section
      className={`trainee-dashboard__hero dashboard-city-hero ${cityHero.className}`}
      aria-labelledby="trainee-dashboard-heading"
    >
      <span className="dashboard-city-hero__glow" aria-hidden="true" />
      {cityHero.artwork && (
        <img className="dashboard-city-hero__art" src={cityHero.artwork} alt="" aria-hidden="true" />
      )}
      <div className="trainee-dashboard__hero-copy">
        <h1 id="trainee-dashboard-heading">
          {intl.formatMessage(messages.greeting, { name: trainee.full_name || trainee.first_name })}
        </h1>
        <p>{intl.formatMessage(messages.standing, { batch: programme.batch || programme.name })}</p>
        <div className="trainee-dashboard__identity" aria-label={intl.formatMessage(messages.traineeDetails)}>
          {trainee.roll_number && <Badge variant="light"><Icon src={Person} />{trainee.roll_number}</Badge>}
          <span className="trainee-dashboard__active-label">Active Programme:</span>
          <Badge variant="light"><Icon src={MenuBook} />{programme.name}</Badge>
          {programme.campus?.name && <Badge variant="light"><Icon src={LocationOn} />{programme.campus.name}</Badge>}
          {programKey && (
            <Link to={`/${programKey}/courses`} className="trainee-dashboard__hero-program-link">
              View My Program →
            </Link>
          )}
        </div>
      </div>
      <div className="trainee-dashboard__timeline">
        <div className="trainee-dashboard__timeline-label">
          <span>{intl.formatMessage(messages.timeline)}</span>
          <strong>{intl.formatMessage(messages.dayCount, {
            day: timeline.current_day,
            total: timeline.total_days,
          })}
          </strong>
        </div>
        <AccessibleProgressBar
          now={timeline.percentage}
          variant="warning"
          label={intl.formatMessage(messages.progressLabel, {
            context: intl.formatMessage(messages.timeline),
            percentage: timeline.percentage,
          })}
        />
        <small>{intl.formatMessage(messages.daysRemaining, {
          count: timeline.days_remaining,
          date: formatDate(intl, programme.end_date),
        })}
        </small>
      </div>
      {cityHero.monumentMessage && (
        <span className="dashboard-city-hero__caption" aria-hidden="true">
          {intl.formatMessage(cityHero.monumentMessage)}
        </span>
      )}
    </section>
  );
};

DashboardHero.propTypes = {
  trainee: PropTypes.shape({
    first_name: PropTypes.string,
    full_name: PropTypes.string.isRequired,
    roll_number: PropTypes.string,
  }).isRequired,
  programme: PropTypes.shape({
    name: PropTypes.string.isRequired,
    batch: PropTypes.string,
    end_date: PropTypes.string.isRequired,
    campus: PropTypes.shape({ name: PropTypes.string }),
    timeline: PropTypes.shape({
      current_day: PropTypes.number.isRequired,
      total_days: PropTypes.number.isRequired,
      days_remaining: PropTypes.number.isRequired,
      percentage: PropTypes.number.isRequired,
    }).isRequired,
  }).isRequired,
  programKey: PropTypes.string,
};

export default DashboardHero;
