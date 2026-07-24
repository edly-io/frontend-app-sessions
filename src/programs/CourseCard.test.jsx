import React from 'react';
import { render, screen } from '@testing-library/react';
import CourseCard from './CourseCard';

jest.mock('@edx/frontend-platform', () => ({
  getConfig: () => ({ LMS_BASE_URL: 'http://lms.test' }),
}));

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

const FUTURE_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const PAST_DATE = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const SOON_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const baseCourse = {
  course_key: 'course-v1:Org+Course+Run',
  display_name: 'Advanced Taxation',
  org: 'IRSA',
  run: '2026',
  target_audience: { name: 'Grade-17' },
  course_url: 'http://lms.test/courses/course-v1:Org+Course+Run/course/',
  course_image_url: null,
  short_description: 'A comprehensive course on advanced taxation.',
  start: null,
  end: null,
};

const baseLearnerData = {
  courseRun: {
    isStarted: true,
    isArchived: false,
    startDate: PAST_DATE,
    endDate: FUTURE_DATE,
    minPassingGrade: '70',
    resumeUrl: 'http://lms.test/courses/course-v1:Org+Course+Run/resume/',
    progressUrl: 'http://lms.test/courses/course-v1:Org+Course+Run/progress/',
  },
  enrollment: {
    hasStarted: true,
    isAuditAccessExpired: false,
    coursewareAccess: { isTooEarly: false },
  },
  gradeData: { isPassing: true, completionSummary: 45 },
  certificate: { isDownloadable: false, certPreviewUrl: null },
};

const renderCard = (courseOverrides = {}, learnerOverrides = null, isInstructor = false) => {
  const course = { ...baseCourse, ...courseOverrides };
  const learnerData = learnerOverrides === null
    ? null
    : { ...baseLearnerData, ...learnerOverrides };
  render(<CourseCard course={course} isInstructor={isInstructor} learnerData={learnerData} />);
};

describe('CourseCard — basic rendering', () => {
  it('renders course title', () => {
    renderCard();
    expect(screen.getByText('Advanced Taxation')).toBeInTheDocument();
  });

  it('renders meta parts joined with dot separator', () => {
    renderCard();
    expect(screen.getByText('IRSA · 2026 · Grade-17')).toBeInTheDocument();
  });

  it('renders short description when present', () => {
    renderCard();
    expect(screen.getByText('A comprehensive course on advanced taxation.')).toBeInTheDocument();
  });

  it('does not render description when absent', () => {
    renderCard({ short_description: null });
    expect(screen.queryByText('A comprehensive course on advanced taxation.')).not.toBeInTheDocument();
  });

  it('shows Instructing badge when isInstructor is true', () => {
    renderCard({}, null, true);
    expect(screen.getByText('Instructing')).toBeInTheDocument();
  });

  it('does not show Instructing badge when isInstructor is false', () => {
    renderCard({}, null, false);
    expect(screen.queryByText('Instructing')).not.toBeInTheDocument();
  });
});

describe('CourseCard — image resolution', () => {
  it('renders image with absolute URL unchanged', () => {
    const { container } = render(
      <CourseCard course={{ ...baseCourse, course_image_url: 'http://cdn.test/image.jpg' }} />,
    );
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'http://cdn.test/image.jpg');
  });

  it('prepends LMS_BASE_URL for relative image paths', () => {
    const { container } = render(
      <CourseCard
        course={{ ...baseCourse, course_image_url: '/asset-v1:Org+Course+Run+type@asset+block/image.jpg' }}
      />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toContain('http://lms.test');
  });

  it('renders initials placeholder when course_image_url is null', () => {
    const { container } = render(<CourseCard course={{ ...baseCourse, course_image_url: null }} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('AT')).toBeInTheDocument();
  });
});

describe('CourseCard — date range', () => {
  it('shows formatted date range from learnerData courseRun dates', () => {
    renderCard({}, baseLearnerData);
    const dateRange = screen.getByText(/–/);
    expect(dateRange).toBeInTheDocument();
  });

  it('falls back to course start/end when no learnerData', () => {
    renderCard({ start: PAST_DATE, end: FUTURE_DATE }, null);
    expect(screen.getByText(/–/)).toBeInTheDocument();
  });

  it('shows no date range when neither source has dates', () => {
    renderCard({ start: null, end: null }, null);
    expect(screen.queryByText(/–/)).not.toBeInTheDocument();
  });
});

describe('CourseCard — completion progress', () => {
  it('shows 0% complete when no learnerData', () => {
    renderCard();
    expect(screen.getByText('0% complete')).toBeInTheDocument();
  });

  it('shows correct completion percentage from gradeData.completionSummary', () => {
    renderCard({}, baseLearnerData);
    expect(screen.getByText('45% complete')).toBeInTheDocument();
  });

  it('rounds completion percentage', () => {
    renderCard({}, {
      ...baseLearnerData,
      gradeData: { isPassing: true, completionSummary: 33.7 },
    });
    expect(screen.getByText('34% complete')).toBeInTheDocument();
  });
});

describe('CourseCard — action button', () => {
  it('shows Begin Course button when course has not started', () => {
    renderCard({}, null);
    expect(screen.getByRole('link', { name: 'Begin Course' })).toBeInTheDocument();
  });

  it('shows Resume button when hasStarted and resumeUrl available', () => {
    renderCard({}, baseLearnerData);
    expect(screen.getByRole('link', { name: 'Resume' })).toBeInTheDocument();
  });

  it('Resume button links to resumeUrl', () => {
    renderCard({}, baseLearnerData);
    const btn = screen.getByRole('link', { name: 'Resume' });
    expect(btn).toHaveAttribute('href', 'http://lms.test/courses/course-v1:Org+Course+Run/resume/');
  });

  it('shows View Course button for archived courses', () => {
    renderCard({}, {
      ...baseLearnerData,
      courseRun: { ...baseLearnerData.courseRun, isArchived: true, endDate: PAST_DATE },
      enrollment: { ...baseLearnerData.enrollment, hasStarted: true },
    });
    expect(screen.getByRole('link', { name: 'View Course' })).toBeInTheDocument();
  });

  it('shows no action button when course_url is absent', () => {
    renderCard({ course_url: null }, null);
    expect(screen.queryByRole('link', { name: /Begin|Resume|View/i })).not.toBeInTheDocument();
  });
});

describe('CourseCard — status banners', () => {
  it('shows "Course starts …" banner when isTooEarly is true', () => {
    renderCard({}, {
      ...baseLearnerData,
      courseRun: { ...baseLearnerData.courseRun, isStarted: false, startDate: FUTURE_DATE },
      enrollment: {
        ...baseLearnerData.enrollment,
        hasStarted: false,
        coursewareAccess: { isTooEarly: true },
      },
    });
    expect(screen.getByText(/Course starts/i)).toBeInTheDocument();
  });

  it('does not show course-starts banner when isTooEarly is false', () => {
    renderCard({}, baseLearnerData);
    expect(screen.queryByText(/Course starts/i)).not.toBeInTheDocument();
  });

  it('shows "Course ended …" banner when isArchived is true', () => {
    renderCard({}, {
      ...baseLearnerData,
      courseRun: { ...baseLearnerData.courseRun, isArchived: true, endDate: PAST_DATE },
    });
    expect(screen.getByText(/Course ended/i)).toBeInTheDocument();
  });

  it('shows "Course ends …" warning banner when end date within 30 days', () => {
    renderCard({}, {
      ...baseLearnerData,
      courseRun: { ...baseLearnerData.courseRun, isArchived: false, endDate: SOON_DATE },
    });
    expect(screen.getByText(/Course ends/i)).toBeInTheDocument();
  });

  it('does not show course-ends banner when end date is far in the future', () => {
    const farFuture = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    renderCard({}, {
      ...baseLearnerData,
      courseRun: { ...baseLearnerData.courseRun, isArchived: false, endDate: farFuture },
    });
    expect(screen.queryByText(/Course ends/i)).not.toBeInTheDocument();
  });

  it('shows "Audit access expired" banner when isAuditAccessExpired is true', () => {
    renderCard({}, {
      ...baseLearnerData,
      enrollment: {
        ...baseLearnerData.enrollment,
        isAuditAccessExpired: true,
      },
    });
    expect(screen.getByText(/Audit access expired/i)).toBeInTheDocument();
  });
});

describe('CourseCard — certificate banner', () => {
  it('shows "Certificate ready" success banner when certificate is downloadable', () => {
    renderCard({}, {
      ...baseLearnerData,
      certificate: { isDownloadable: true, certPreviewUrl: 'http://lms.test/cert/123' },
    });
    expect(screen.getByText(/Certificate ready/i)).toBeInTheDocument();
  });

  it('shows "View certificate" link when certPreviewUrl is present', () => {
    renderCard({}, {
      ...baseLearnerData,
      certificate: { isDownloadable: true, certPreviewUrl: 'http://lms.test/cert/123' },
    });
    const link = screen.getByRole('link', { name: 'View certificate' });
    expect(link).toHaveAttribute('href', 'http://lms.test/cert/123');
  });

  it('does not show cert link when certPreviewUrl is null', () => {
    renderCard({}, {
      ...baseLearnerData,
      certificate: { isDownloadable: true, certPreviewUrl: null },
    });
    expect(screen.queryByRole('link', { name: 'View certificate' })).not.toBeInTheDocument();
  });

  it('cert banner takes priority over course-starts banner', () => {
    renderCard({}, {
      ...baseLearnerData,
      courseRun: { ...baseLearnerData.courseRun, startDate: FUTURE_DATE },
      enrollment: {
        ...baseLearnerData.enrollment,
        coursewareAccess: { isTooEarly: true },
      },
      certificate: { isDownloadable: true, certPreviewUrl: 'http://lms.test/cert/123' },
    });
    expect(screen.getByText(/Certificate ready/i)).toBeInTheDocument();
    expect(screen.queryByText(/Course starts/i)).not.toBeInTheDocument();
  });

  it('does not show cert banner when certificate is not downloadable', () => {
    renderCard({}, baseLearnerData);
    expect(screen.queryByText(/Certificate ready/i)).not.toBeInTheDocument();
  });
});

describe('CourseCard — grade banner', () => {
  it('shows passing grade requirement when not passing and has minPassingGrade', () => {
    renderCard({}, {
      ...baseLearnerData,
      gradeData: { isPassing: false, completionSummary: 20 },
    });
    expect(screen.getByText(/Passing grade: 70% required/i)).toBeInTheDocument();
  });

  it('does not show grade banner when passing', () => {
    renderCard({}, baseLearnerData);
    expect(screen.queryByText(/Passing grade/i)).not.toBeInTheDocument();
  });

  it('does not show grade banner when certificate is already downloadable', () => {
    renderCard({}, {
      ...baseLearnerData,
      gradeData: { isPassing: false, completionSummary: 20 },
      certificate: { isDownloadable: true, certPreviewUrl: null },
    });
    expect(screen.queryByText(/Passing grade/i)).not.toBeInTheDocument();
  });

  it('does not show grade banner when learnerData is null', () => {
    renderCard({}, null);
    expect(screen.queryByText(/Passing grade/i)).not.toBeInTheDocument();
  });
});
