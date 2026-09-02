import React from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Badge, Card, Col, Row,
} from '@openedx/paragon';
import { useIntl } from '@edx/frontend-platform/i18n';
import AccessibleProgressBar from '../../dashboard/AccessibleProgressBar';
import messages from '../messages';

const STATUS_MESSAGES = {
  completed: messages.completed,
  in_progress: messages.inProgress,
  not_started: messages.notStarted,
  unavailable: messages.progressUnavailable,
};

const getStatusVariant = status => {
  if (status === 'completed') { return 'success'; }
  if (status === 'unavailable') { return 'light'; }
  return 'info';
};

const InstructorCoursesSection = ({ courses }) => {
  const intl = useIntl();

  return (
    <section className="instructor-dashboard__section" aria-labelledby="instructor-courses-heading">
      <div className="instructor-dashboard__section-heading">
        <h2 id="instructor-courses-heading">{intl.formatMessage(messages.myCourses)}</h2>
        <span>{intl.formatMessage(messages.coursesSubtitle)}</span>
      </div>
      {!courses.length ? <Alert variant="info">{intl.formatMessage(messages.noCourses)}</Alert> : (
        <Row>
          {courses.map(course => {
            const progress = course.average_progress_percentage;
            const metadata = [course.programme_name, course.campus?.name].filter(Boolean).join(' · ');
            const hasProgress = Number.isFinite(progress) && course.status !== 'unavailable';
            return (
              <Col xs={12} lg={4} className="mb-3" key={`${course.program_key}:${course.course_id}`}>
                <Card className="instructor-dashboard__course-card">
                  <Card.Section>
                    <div className="instructor-dashboard__course-header">
                      {course.course_code && (
                        <span className="instructor-dashboard__course-code">{course.course_code}</span>
                      )}
                      <div>
                        <h3>{course.name}</h3>
                        {metadata && <p>{metadata}</p>}
                      </div>
                      <Badge variant={getStatusVariant(course.status)}>
                        {intl.formatMessage(STATUS_MESSAGES[course.status])}
                      </Badge>
                    </div>
                    <dl className="instructor-dashboard__course-stats">
                      <div>
                        <dt>{intl.formatMessage(messages.traineesEnrolled)}</dt>
                        <dd>{course.trainee_count}</dd>
                      </div>
                      <div>
                        <dt>{intl.formatMessage(messages.hoursDelivered)}</dt>
                        <dd>{intl.formatMessage(messages.hoursShort, { hours: course.delivered_hours })}</dd>
                      </div>
                    </dl>
                    {hasProgress ? (
                      <AccessibleProgressBar
                        now={progress}
                        label={intl.formatMessage(messages.courseAverageProgress, {
                          course: course.name,
                          percentage: progress,
                        })}
                      />
                    ) : (
                      <span className="text-muted">{intl.formatMessage(messages.progressUnavailable)}</span>
                    )}
                    <div className="instructor-dashboard__course-footer">
                      <span>{intl.formatMessage(messages.averageLearnerProgress)}</span>
                      {hasProgress && <strong>{progress}%</strong>}
                    </div>
                  </Card.Section>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </section>
  );
};

InstructorCoursesSection.propTypes = {
  courses: PropTypes.arrayOf(PropTypes.shape({
    course_id: PropTypes.string.isRequired,
    program_key: PropTypes.string.isRequired,
    course_code: PropTypes.string,
    name: PropTypes.string.isRequired,
    programme_name: PropTypes.string,
    campus: PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      name: PropTypes.string.isRequired,
    }),
    trainee_count: PropTypes.number.isRequired,
    average_progress_percentage: PropTypes.number,
    delivered_hours: PropTypes.number.isRequired,
    status: PropTypes.oneOf(['completed', 'in_progress', 'not_started', 'unavailable']).isRequired,
    can_manage: PropTypes.bool,
  })).isRequired,
};

export default InstructorCoursesSection;
