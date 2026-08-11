import React from 'react';
import PropTypes from 'prop-types';
import {
  Badge, Button, Card, Icon,
} from '@openedx/paragon';
import {
  AccessTime, LocationOn, Person, Videocam,
} from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';
import { sessions } from '../dashboardData';
import messages from '../messages';

const ModeBadge = ({ mode }) => (
  <Badge variant={mode === 'Online' ? 'success' : 'info'}>
    {mode === 'Online' && <Icon src={Videocam} />}
    {mode}
  </Badge>
);

ModeBadge.propTypes = {
  mode: PropTypes.string.isRequired,
};

const UpcomingSessionsCard = () => {
  const intl = useIntl();
  const [nextSession, ...laterSessions] = sessions;

  return (
    <section aria-labelledby="upcoming-sessions-heading" className="trainee-dashboard__section">
      <Card>
        <Card.Header
          title={<h2 id="upcoming-sessions-heading">{intl.formatMessage(messages.upcomingSessions)}</h2>}
          subtitle={intl.formatMessage(messages.scheduledClasses)}
        />
        <Card.Section>
          <article className="trainee-dashboard__next-session">
            <div className="trainee-dashboard__date-tile" aria-label={`${nextSession.day} ${nextSession.month}`}>
              <strong>{nextSession.day}</strong><span>{nextSession.month}</span>
            </div>
            <div className="trainee-dashboard__session-copy">
              <div className="trainee-dashboard__badges">
                <Badge variant="warning">{nextSession.dayLabel} · {nextSession.time}</Badge>
                <ModeBadge mode={nextSession.mode} />
                <Badge variant="info">{nextSession.course}</Badge>
              </div>
              <h3>{nextSession.title}</h3>
              <div className="trainee-dashboard__session-meta">
                <span><Icon src={Person} />{nextSession.instructor}</span>
                <span><Icon src={AccessTime} />{nextSession.duration}</span>
                <span><Icon src={LocationOn} />{nextSession.location}</span>
              </div>
            </div>
            <div className="trainee-dashboard__session-actions">
              <strong>{intl.formatMessage(messages.startsIn)}</strong>
              <Button disabled title={intl.formatMessage(messages.detailsUnavailable)}>
                {intl.formatMessage(messages.viewDetails)}
              </Button>
            </div>
          </article>
          <div className="trainee-dashboard__session-list">
            {laterSessions.map(session => (
              <article className="trainee-dashboard__session-row" key={`${session.day}-${session.time}`}>
                <div className="trainee-dashboard__date-compact"><strong>{session.day}</strong><span>{session.month}</span></div>
                <div><h3>{session.title}</h3><p>{session.instructor} · {session.course} · {session.location}</p></div>
                <div className="trainee-dashboard__session-time"><strong>{session.time} · {session.duration}</strong><ModeBadge mode={session.mode} /></div>
              </article>
            ))}
          </div>
        </Card.Section>
      </Card>
    </section>
  );
};

export default UpcomingSessionsCard;
