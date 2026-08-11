import React from 'react';
import { Badge, Icon } from '@openedx/paragon';
import { LocationOn, MenuBook, Person } from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';
import { trainee } from '../dashboardData';
import messages from '../messages';
import AccessibleProgressBar from './AccessibleProgressBar';

const DashboardHero = () => {
  const intl = useIntl();
  const percentage = Math.round((trainee.day / trainee.totalDays) * 100);

  return (
    <section className="trainee-dashboard__hero" aria-labelledby="trainee-dashboard-heading">
      <div className="trainee-dashboard__hero-copy">
        <h1 id="trainee-dashboard-heading">
          {intl.formatMessage(messages.greeting, { name: trainee.firstName })}
        </h1>
        <p>{intl.formatMessage(messages.standing, { batch: trainee.batch })}</p>
        <div className="trainee-dashboard__identity" aria-label={intl.formatMessage(messages.traineeDetails)}>
          <Badge variant="light"><Icon src={Person} />{trainee.rollNumber}</Badge>
          <Badge variant="light"><Icon src={MenuBook} />{trainee.programme}</Badge>
          <Badge variant="light"><Icon src={LocationOn} />{trainee.campus}</Badge>
        </div>
      </div>
      <div className="trainee-dashboard__timeline">
        <div className="trainee-dashboard__timeline-label">
          <span>{intl.formatMessage(messages.timeline)}</span>
          <strong>{intl.formatMessage(messages.dayCount, { day: trainee.day, total: trainee.totalDays })}</strong>
        </div>
        <AccessibleProgressBar
          now={percentage}
          variant="warning"
          label={intl.formatMessage(messages.progressLabel, {
            context: intl.formatMessage(messages.timeline),
            percentage,
          })}
        />
        <small>{intl.formatMessage(messages.daysRemaining, {
          count: trainee.totalDays - trainee.day,
          date: trainee.endDate,
        })}
        </small>
      </div>
    </section>
  );
};

export default DashboardHero;
