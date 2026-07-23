import React from 'react';
import PropTypes from 'prop-types';
import { getConfig } from '@edx/frontend-platform';

const resolveImageUrl = (url) => {
  if (!url) { return null; }
  if (url.startsWith('http')) { return url; }
  return `${getConfig().LMS_BASE_URL}${url}`;
};

const fmtDate = (dateStr) => {
  if (!dateStr) { return null; }
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const CourseCard = ({ course, isInstructor = false, learnerData = null }) => {
  const {
    display_name: displayName,
    org,
    run,
    target_audience: targetAudience,
    course_url: courseUrl,
    course_image_url: courseImageUrl,
    short_description: shortDescription,
    start,
    end,
  } = course;

  const resolvedImageUrl = resolveImageUrl(courseImageUrl);
  const metaParts = [org, run, targetAudience?.name].filter(Boolean);

  // Enrichment from learner_home/init — all optional
  const now = new Date();
  const rawStart = learnerData?.courseRun?.startDate || start;
  const rawEnd = learnerData?.courseRun?.endDate || end;
  const startDateObj = rawStart ? new Date(rawStart) : null;
  const endDateObj = rawEnd ? new Date(rawEnd) : null;

  const isTooEarly = learnerData?.enrollment?.coursewareAccess?.isTooEarly
    ?? (startDateObj ? startDateObj > now : false);
  const isArchived = learnerData?.courseRun?.isArchived
    ?? (endDateObj ? endDateObj < now : false);
  const hasStarted = learnerData?.enrollment?.hasStarted ?? false;
  const isAuditAccessExpired = learnerData?.enrollment?.isAuditAccessExpired ?? false;
  const completionPct = learnerData?.gradeData?.completionSummary ?? 0;
  const isPassing = learnerData?.gradeData?.isPassing ?? null;
  const minPassingGrade = learnerData?.courseRun?.minPassingGrade ?? null;
  const certDownloadable = learnerData?.certificate?.isDownloadable ?? false;
  const certUrl = learnerData?.certificate?.certPreviewUrl ?? null;
  const resumeUrl = learnerData?.courseRun?.resumeUrl || courseUrl;

  // Date range label
  const dateRange = [fmtDate(rawStart), fmtDate(rawEnd)].filter(Boolean).join(' – ');

  // Status banner — highest priority first
  const getStatusBanner = () => {
    if (certDownloadable) {
      return {
        variant: 'success',
        text: 'Certificate ready',
        link: certUrl ? { href: certUrl, label: 'View certificate' } : null,
      };
    }
    if (isAuditAccessExpired) {
      return { variant: 'warning', text: 'Audit access expired' };
    }
    if (isTooEarly && startDateObj) {
      return { variant: 'info', text: `Course starts ${fmtDate(rawStart)}` };
    }
    if (isArchived && endDateObj) {
      return { variant: 'secondary', text: `Course ended ${fmtDate(rawEnd)}` };
    }
    const daysLeft = endDateObj ? (endDateObj - now) / (1000 * 60 * 60 * 24) : null;
    if (daysLeft !== null && daysLeft > 0 && daysLeft <= 30) {
      return { variant: 'warning', text: `Course ends ${fmtDate(rawEnd)}` };
    }
    return null;
  };

  // Grade banner — shown separately from status
  const getGradeBanner = () => {
    if (learnerData === null) { return null; }
    if (certDownloadable) { return null; }
    if (isPassing === false && minPassingGrade) {
      return { variant: 'warning', text: `Passing grade: ${minPassingGrade}% required` };
    }
    return null;
  };

  const statusBanner = getStatusBanner();
  const gradeBanner = getGradeBanner();

  // Action button
  const getActionButton = () => {
    if (!courseUrl && !resumeUrl) { return null; }
    if (isArchived) {
      return { href: courseUrl || resumeUrl, label: 'View Course' };
    }
    if (hasStarted && resumeUrl) {
      return { href: resumeUrl, label: 'Resume' };
    }
    if (courseUrl) {
      return { href: courseUrl, label: isTooEarly ? 'View Course' : 'Begin Course' };
    }
    return null;
  };

  const actionButton = getActionButton();

  return (
    <div className="course-card">
      <div className="course-card__thumbnail">
        {resolvedImageUrl ? (
          <img src={resolvedImageUrl} alt="" className="course-card__thumbnail-img" />
        ) : (
          <div className="course-card__thumbnail-placeholder">
            {(displayName || '?').split(' ').slice(0, 2)
              .map((w) => w[0]).join('')
              .toUpperCase()}
          </div>
        )}
      </div>

      <div className="course-card__content">
        <div>
          <div className="course-card__header">
            <h5 className="course-card__title">{displayName}</h5>
            {isInstructor && (
              <span className="badge badge-info course-card__badge">Instructing</span>
            )}
          </div>

          {metaParts.length > 0 && (
            <p className="course-card__meta">{metaParts.join(' · ')}</p>
          )}

          {shortDescription && (
            <p className="course-card__description">{shortDescription}</p>
          )}

          {dateRange && (
            <p className="course-card__dates">{dateRange}</p>
          )}

          <div className="course-card__progress-bar">
            <div
              className="course-card__progress-fill"
              style={{ width: `${completionPct}%` }} // eslint-disable-line react/forbid-component-props
            />
          </div>
          <p className="course-card__progress-pct">{Math.round(completionPct)}% complete</p>
        </div>

        <div className="course-card__footer">
          <div className="course-card__banners">
            {statusBanner && (
              <div className={`course-card__banner course-card__banner--${statusBanner.variant}`}>
                {statusBanner.text}
                {statusBanner.link && (
                  <>
                    {' — '}
                    <a href={statusBanner.link.href} target="_blank" rel="noreferrer" className="course-card__banner-link">
                      {statusBanner.link.label}
                    </a>
                  </>
                )}
              </div>
            )}
            {gradeBanner && (
              <div className={`course-card__banner course-card__banner--${gradeBanner.variant}`}>
                {gradeBanner.text}
              </div>
            )}
          </div>

          {actionButton && (
            <div className="course-card__actions">
              <a
                href={actionButton.href}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary btn-sm"
              >
                {actionButton.label}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

CourseCard.propTypes = {
  course: PropTypes.shape({
    display_name: PropTypes.string,
    org: PropTypes.string,
    run: PropTypes.string,
    target_audience: PropTypes.shape({ name: PropTypes.string }),
    course_url: PropTypes.string,
    course_image_url: PropTypes.string,
    short_description: PropTypes.string,
    start: PropTypes.string,
    end: PropTypes.string,
  }).isRequired,
  isInstructor: PropTypes.bool,
  learnerData: PropTypes.shape({
    courseRun: PropTypes.shape({
      isStarted: PropTypes.bool,
      isArchived: PropTypes.bool,
      startDate: PropTypes.string,
      endDate: PropTypes.string,
      minPassingGrade: PropTypes.string,
      resumeUrl: PropTypes.string,
      progressUrl: PropTypes.string,
    }),
    enrollment: PropTypes.shape({
      hasStarted: PropTypes.bool,
      isAuditAccessExpired: PropTypes.bool,
      coursewareAccess: PropTypes.shape({ isTooEarly: PropTypes.bool }),
    }),
    gradeData: PropTypes.shape({
      isPassing: PropTypes.bool,
      completionSummary: PropTypes.number,
    }),
    certificate: PropTypes.shape({
      isDownloadable: PropTypes.bool,
      certPreviewUrl: PropTypes.string,
    }),
  }),
};

export default CourseCard;
