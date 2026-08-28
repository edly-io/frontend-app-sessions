import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';

import InstructorDashboardPage from './InstructorDashboardPage';
import useInstructorDashboard from './useInstructorDashboard';
import useInstructorFeedback from './useInstructorFeedback';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('../plugin-slots/HeaderSlot', () => () => null);
jest.mock('@edx/frontend-component-footer', () => ({ FooterSlot: () => null }));
jest.mock('./useInstructorDashboard');
jest.mock('./useInstructorFeedback');

const dashboard = {
  state: 'ready',
  generated_at: '2026-08-24T10:30:00+00:00',
  timezone: 'Asia/Karachi',
  instructor: {
    id: 9,
    first_name: 'Zubair',
    full_name: 'Dr. Zubair Hussain',
    designation: null,
    department: null,
    employee_id: null,
    campus: { id: 1, name: 'Karachi' },
    roles: ['instructor'],
  },
  week: {
    start_date: '2026-08-24', end_date: '2026-08-30', sessions: 4, scheduled_hours: 8,
  },
  summary: {
    courses: 2,
    programmes: 1,
    distinct_trainees: 2,
    enrolments: 6,
    delivered_hours: 36,
    delivered_sessions: 18,
    pending_feedback: 7,
  },
  upcoming_sessions: [{
    id: 'session-1',
    program_key: 'program-v1:FBR+STP+2026',
    program_name: '50th STP',
    course_id: 'course-v1:FBR+TX101+2026',
    course_code: 'TX-101',
    course_name: 'Income Tax Law',
    title: 'Withholding Tax Regime',
    scheduled_start: '2026-08-28T09:30:00+05:00',
    scheduled_end: '2026-08-28T11:30:00+05:00',
    duration_minutes: 120,
    mode: 'on_site',
    location: null,
    trainee_count: 32,
    meeting_start_url: null,
    can_view_details: true,
    can_start_session: false,
    can_mark_attendance: false,
  }],
  courses: [{
    course_id: 'course-v1:FBR+TX101+2026',
    program_key: 'program-v1:FBR+STP+2026',
    course_code: 'TX-101',
    name: 'Income Tax Law',
    programme_name: '50th STP',
    campus: { id: 1, name: 'Karachi' },
    trainee_count: 32,
    average_progress_percentage: 63,
    delivered_hours: 24,
    status: 'in_progress',
    can_manage: true,
  }, {
    course_id: 'course-v1:FBR+TX102+2026',
    program_key: 'program-v1:FBR+STP+2026',
    course_code: 'TX-102',
    name: 'Sales Tax',
    programme_name: '50th STP',
    campus: null,
    trainee_count: 0,
    average_progress_percentage: null,
    delivered_hours: 12,
    status: 'unavailable',
    can_manage: true,
  }],
  delivery: {
    delivered_hours: 36,
    delivered_sessions: 18,
    change_from_last_month_hours: -2,
    this_month_sessions: 5,
    average_attendance_percentage: 89,
    rescheduled_sessions: 1,
    weekly_hours: Array.from({ length: 8 }, (_, index) => ({
      week_start: `2026-07-${String(index + 1).padStart(2, '0')}`,
      week_end: `2026-07-${String(index + 7).padStart(2, '0')}`,
      hours: index,
    })),
    recent_sessions: [{
      id: 'past-1',
      program_key: 'program-v1:FBR+STP+2026',
      course_id: 'course-v1:FBR+TX101+2026',
      course_code: 'TX-101',
      title: 'Income Tax Basics',
      scheduled_start: '2026-08-23T09:30:00+05:00',
      duration_minutes: 120,
      present: 31,
      trainee_count: 32,
    }],
  },
  feedback: [{
    id: 602,
    feedback_name: 'Faculty evaluation',
    form_name: 'Instructor review',
    type: 'trainee',
    subject: { id: 245, full_name: 'Ifrah Saleem' },
    course_id: null,
    course_code: null,
    course_name: null,
    deadline: '2026-08-30',
    status: 'pending',
    urgent: true,
    submitted_at: null,
    can_submit: true,
  }],
  attendance_to_mark: [{
    session_id: 'past-1',
    program_key: 'program-v1:FBR+STP+2026',
    course_id: 'course-v1:FBR+TX101+2026',
    course_code: 'TX-101',
    title: 'Income Tax Basics',
    session_start: '2026-08-23T09:30:00+05:00',
    trainee_count: 32,
    unmarked_count: 4,
    age_days: 1,
    can_mark: false,
  }],
  holidays: [{
    id: 17,
    type: 'public_holiday',
    name: 'Public holiday',
    description: 'Campus closed',
    start_date: '2026-09-01',
    end_date: '2026-09-01',
    no_sessions: true,
    campus_ids: [1],
  }],
};

const feedbackDetail = {
  id: 602,
  feedback_name: 'Faculty evaluation',
  form_name: 'Instructor review',
  subject_name: 'Ifrah Saleem',
  program_name: '50th STP',
  deadline: '2026-08-30',
  status: 'pending',
  questions: [{
    id: 1, question: 'Rate the learner', question_type: 'star_rating', required: true,
  }, {
    id: 2, question: 'Comments', question_type: 'textarea', required: true,
  }],
};

const refetch = jest.fn();
const submit = jest.fn();

const renderDashboard = (props = {}) => render(
  <MemoryRouter>
    <IntlProvider locale="en" messages={{}}>
      <InstructorDashboardPage {...props} />
    </IntlProvider>
  </MemoryRouter>,
);

beforeEach(() => {
  jest.clearAllMocks();
  submit.mockResolvedValue({ detail: 'Feedback submitted successfully.' });
  useInstructorDashboard.mockReturnValue({
    data: dashboard,
    isLoading: false,
    isError: false,
    error: null,
    refetch,
  });
  useInstructorFeedback.mockImplementation(requestId => ({
    feedback: requestId === null ? null : feedbackDetail,
    isLoading: false,
    loadError: null,
    submit,
  }));
});

it('renders the live instructor contract without exposing locked actions', () => {
  renderDashboard();

  const main = screen.getByRole('main');
  expect(within(main).getByRole('heading', { level: 1, name: 'Assalam-o-Alaikum, Zubair' })).toBeInTheDocument();
  expect(within(main).getByText('Karachi')).toBeInTheDocument();
  expect(within(main).queryByText(/null/i)).not.toBeInTheDocument();
  expect(within(main).getByText('7 pending')).toBeInTheDocument();
  expect(within(main).getByText('4 unmarked')).toBeInTheDocument();
  expect(within(main).getAllByText('Progress unavailable')).toHaveLength(2);
  expect(within(main).getByText('−2 hrs vs last month')).toBeInTheDocument();
  expect(within(main).getByRole('progressbar', {
    name: 'Income Tax Law: 63% average learner progress',
  })).toHaveAttribute('aria-valuenow', '63');
  expect(within(main).getByRole('link', { name: 'View details' })).toHaveAttribute(
    'href',
    '/program-v1:FBR+STP+2026/calendar?modal=session&id=session-1',
  );
  expect(within(main).queryByRole('button', { name: 'Start session' })).not.toBeInTheDocument();
  expect(within(main).queryByRole('button', { name: 'Mark attendance' })).not.toBeInTheDocument();
  expect(within(main).queryByRole('button', { name: 'Manage' })).not.toBeInTheDocument();
});

it('opens, validates, and submits a feedback form', async () => {
  const user = userEvent.setup();
  renderDashboard();

  await user.click(screen.getByRole('button', { name: 'Fill form' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Submit feedback' }));
  expect(screen.getAllByText('This question is required.')).toHaveLength(2);

  await user.click(screen.getByRole('radio', { name: '5 stars' }));
  await user.type(screen.getByPlaceholderText('Enter your response'), 'Strong progress.');
  await user.click(screen.getByRole('button', { name: 'Submit feedback' }));

  expect(submit).toHaveBeenCalledWith(602, {
    answers: [
      { question_id: 1, star_value: 5 },
      { question_id: 2, text_value: 'Strong progress.' },
    ],
  });
  expect(await screen.findByText('Feedback submitted')).toBeInTheDocument();
});

it('shows loading and error states while preserving the profile switcher', async () => {
  const user = userEvent.setup();
  const profileSwitcher = <nav aria-label="Choose dashboard profile">Profiles</nav>;
  useInstructorDashboard.mockReturnValueOnce({
    data: undefined, isLoading: true, isError: false, error: null, refetch,
  });
  const { unmount } = renderDashboard({ profileSwitcher });
  expect(screen.getByText('Profiles')).toBeInTheDocument();
  expect(screen.getByText('Loading instructor dashboard')).toBeInTheDocument();
  unmount();

  useInstructorDashboard.mockReturnValueOnce({
    data: undefined,
    isLoading: false,
    isError: true,
    error: { response: { data: { error: { detail: 'Dashboard unavailable.' } } } },
    refetch,
  });
  renderDashboard({ profileSwitcher });
  expect(screen.getByText('Dashboard unavailable.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalledTimes(1);
});

it('keeps feedback and holidays visible when there are no assignments', () => {
  useInstructorDashboard.mockReturnValue({
    data: {
      ...dashboard,
      state: 'no_assignments',
      upcoming_sessions: [],
      courses: [],
      attendance_to_mark: [],
      delivery: {
        ...dashboard.delivery,
        delivered_hours: 0,
        delivered_sessions: 0,
        recent_sessions: [],
        weekly_hours: dashboard.delivery.weekly_hours.map(week => ({ ...week, hours: 0 })),
      },
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch,
  });

  renderDashboard();

  expect(screen.getByText('No teaching assignments yet')).toBeInTheDocument();
  expect(screen.getByText('Ifrah Saleem')).toBeInTheDocument();
  expect(screen.getByText('Public holiday')).toBeInTheDocument();
  expect(screen.getByText('You have no upcoming sessions.')).toBeInTheDocument();
});
