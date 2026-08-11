import React from 'react';
import { Alert, Card } from '@openedx/paragon';
import { Lock } from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';
import { courseProgress, courses } from '../dashboardData';
import messages from '../messages';
import AccessibleProgressBar from './AccessibleProgressBar';

const ProgressCard = () => {
  const intl = useIntl();

  return (
    <section aria-labelledby="progress-heading" className="trainee-dashboard__section">
      <Card>
        <Card.Header
          title={<h2 id="progress-heading">{intl.formatMessage(messages.myProgress)}</h2>}
          subtitle={intl.formatMessage(messages.progressSubtitle)}
        />
        <Card.Section>
          <div className="trainee-dashboard__progress-layout">
            <div className="trainee-dashboard__progress-summary" aria-label={`${courseProgress}% complete`}>
              <strong>{courseProgress}%</strong>
              <span>{intl.formatMessage(messages.complete)}</span>
            </div>
            <div className="trainee-dashboard__progress-courses">
              {courses.map(course => {
                const percentage = Math.round((course.completed / course.total) * 100);
                return (
                  <div className="trainee-dashboard__progress-row" key={course.code}>
                    <span>{course.name}</span>
                    <AccessibleProgressBar
                      now={percentage}
                      variant={percentage === 100 ? 'success' : 'warning'}
                      label={intl.formatMessage(messages.progressLabel, { context: course.name, percentage })}
                    />
                    <strong>{course.completed}/{course.total}</strong>
                  </div>
                );
              })}
            </div>
          </div>
          <Alert variant="info" icon={Lock} className="mb-0">
            <Alert.Heading>{intl.formatMessage(messages.resultsLocked)}</Alert.Heading>
            <p className="mb-0">{intl.formatMessage(messages.resultsExplanation)}</p>
          </Alert>
        </Card.Section>
      </Card>
    </section>
  );
};

export default ProgressCard;
