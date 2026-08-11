import React from 'react';
import { Card } from '@openedx/paragon';
import { useIntl } from '@edx/frontend-platform/i18n';
import { holidays } from '../dashboardData';
import messages from '../messages';

const HolidaysCard = () => {
  const intl = useIntl();

  return (
    <section aria-labelledby="holidays-heading">
      <Card>
        <Card.Header
          title={<h2 id="holidays-heading">{intl.formatMessage(messages.holidays)}</h2>}
          subtitle={intl.formatMessage(messages.noSessions)}
        />
        <Card.Section className="trainee-dashboard__compact-list">
          {holidays.map(holiday => (
            <article className="trainee-dashboard__holiday-row" key={`${holiday.day}-${holiday.month}-${holiday.name}`}>
              <time className={`trainee-dashboard__holiday-date${holiday.observed ? ' trainee-dashboard__holiday-date--observed' : ''}`}>
                <strong>{holiday.day}</strong><span>{holiday.month}</span>
              </time>
              <div><h3>{holiday.name}</h3><p>{holiday.note}</p></div>
            </article>
          ))}
        </Card.Section>
      </Card>
    </section>
  );
};

export default HolidaysCard;
