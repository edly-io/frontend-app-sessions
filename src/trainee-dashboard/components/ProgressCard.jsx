import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Badge, Card } from '@openedx/paragon';
import { Lock } from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';
import AccessibleProgressBar from '../../dashboard/AccessibleProgressBar';
import messages from '../messages';
import { formatDate } from '../utils';

const resultHeading = state => ({
  not_configured: messages.resultsNotConfigured,
  not_published: messages.resultsNotPublished,
  unavailable: messages.resultsUnavailable,
}[state] || messages.resultsNotPublished);

const ProgressCard = ({ courses, summary, results }) => {
  const intl = useIntl();
  const courseProgress = summary.course_progress.percentage;
  const hasVisibleResult = results.state === 'finalized' && results.is_visible;

  return (
    <section aria-labelledby="progress-heading" className="trainee-dashboard__section">
      <Card>
        <Card.Header
          title={<h2 id="progress-heading">{intl.formatMessage(messages.myProgress)}</h2>}
          subtitle={intl.formatMessage(messages.progressSubtitle)}
        />
        <Card.Section>
          <div className="trainee-dashboard__progress-layout">
            <div className="trainee-dashboard__progress-summary" aria-label={intl.formatMessage(messages.progressLabel, { context: intl.formatMessage(messages.myProgress), percentage: courseProgress })}>
              <strong>{courseProgress}%</strong>
              <span>{intl.formatMessage(messages.complete)}</span>
            </div>
            <div className="trainee-dashboard__progress-courses">
              {courses.length === 0 && <p>{intl.formatMessage(messages.noCourses)}</p>}
              {courses.map(course => (
                <div className="trainee-dashboard__progress-row" key={course.course_id}>
                  <span>{course.name}</span>
                  {course.status === 'unavailable' ? (
                    <span>{intl.formatMessage(messages.progressUnavailable)}</span>
                  ) : (
                    <AccessibleProgressBar
                      now={course.progress_percentage}
                      variant={course.progress_percentage === 100 ? 'success' : 'warning'}
                      label={intl.formatMessage(messages.progressLabel, {
                        context: course.name,
                        percentage: course.progress_percentage,
                      })}
                    />
                  )}
                  <strong>{course.status === 'unavailable'
                    ? '—'
                    : `${course.completed_modules}/${course.total_modules}`}
                  </strong>
                </div>
              ))}
            </div>
          </div>
          {hasVisibleResult ? (
            <Alert variant={results.grade === 'pass' ? 'success' : 'danger'} className="mb-0">
              <Alert.Heading>{intl.formatMessage(messages.finalResult)}</Alert.Heading>
              <p>
                <strong>{results.percentage}%</strong>{' '}
                <Badge variant={results.grade === 'pass' ? 'success' : 'danger'}>
                  {intl.formatMessage(results.grade === 'pass' ? messages.passed : messages.failed)}
                </Badge>
              </p>
              {results.total_score !== null && results.maximum_score !== null && (
                <p>{intl.formatMessage(messages.score, {
                  score: results.total_score,
                  maximum: results.maximum_score,
                })}
                </p>
              )}
              {results.finalized_at && <p className="mb-0">{intl.formatMessage(messages.finalizedOn, { date: formatDate(intl, results.finalized_at) })}</p>}
            </Alert>
          ) : (
            <Alert variant="info" icon={Lock} className="mb-0">
              <Alert.Heading>{intl.formatMessage(resultHeading(results.state))}</Alert.Heading>
              <p className="mb-0">{intl.formatMessage(messages.resultsPendingExplanation)}</p>
            </Alert>
          )}
        </Card.Section>
      </Card>
    </section>
  );
};

const courseShape = PropTypes.shape({
  course_id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  completed_modules: PropTypes.number.isRequired,
  total_modules: PropTypes.number.isRequired,
  progress_percentage: PropTypes.number.isRequired,
  status: PropTypes.oneOf(['not_started', 'in_progress', 'completed', 'unavailable']).isRequired,
});

ProgressCard.propTypes = {
  courses: PropTypes.arrayOf(courseShape).isRequired,
  summary: PropTypes.shape({
    course_progress: PropTypes.shape({ percentage: PropTypes.number.isRequired }).isRequired,
  }).isRequired,
  results: PropTypes.shape({
    state: PropTypes.oneOf(['not_configured', 'not_published', 'finalized', 'unavailable']).isRequired,
    is_visible: PropTypes.bool.isRequired,
    maximum_score: PropTypes.number,
    total_score: PropTypes.number,
    percentage: PropTypes.number,
    grade: PropTypes.oneOf(['pass', 'fail']),
    finalized_at: PropTypes.string,
  }).isRequired,
};

export default ProgressCard;
