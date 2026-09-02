import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';

import TraineeDashboardPage from './TraineeDashboardPage';
import useTraineeDashboard from './useTraineeDashboard';

jest.mock('../plugin-slots/HeaderSlot', () => () => null);
jest.mock('@edx/frontend-component-footer', () => ({ FooterSlot: () => null }));
jest.mock('./useTraineeDashboard');

const dashboard = {
  state: 'ready',
  generated_at: '2026-08-13T10:30:00+00:00',
  timezone: 'Asia/Karachi',
  selected_program_key: 'program-v1:FBR+STP+2026-A',
  available_programs: [
    { program_key: 'program-v1:FBR+STP+2026-A', name: 'Specialised Training Programme' },
    { program_key: 'program-v1:FBR+DST+2026-A', name: 'Domestic Tax Programme' },
  ],
  trainee: {
    id: 245,
    first_name: 'Ayesha',
    full_name: 'Ayesha Ahmed',
    roll_number: 'EMP-1042',
    roles: ['trainee'],
  },
  programme: {
    program_key: 'program-v1:FBR+STP+2026-A',
    name: 'Specialised Training Programme',
    program_type: 'STP',
    batch: '2026-A',
    campus: { id: 2, name: 'Karachi' },
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    timeline: {
      current_day: 80, total_days: 365, days_remaining: 285, percentage: 22,
    },
  },
  summary: {
    course_progress: { completed_modules: 5, total_modules: 8, percentage: 63 },
    attendance: {
      present: 38, total: 44, percentage: 86.36, threshold: 75, meets_requirement: true,
    },
    pending_feedback: 1,
    earned_certificates: 1,
  },
  upcoming_sessions: [{
    id: 'session-1',
    title: 'Withholding Tax Regime',
    course_id: 'course-v1:FBR+TX101+2026',
    course_code: 'TX-101',
    course_name: 'Income Tax Law',
    scheduled_start: '2026-08-14T09:30:00+05:00',
    scheduled_end: '2026-08-14T11:30:00+05:00',
    duration_minutes: 120,
    mode: 'on_site',
    location: { id: 'room-1', name: 'Lecture Hall B' },
    instructors: [{ id: 91, full_name: 'Ayesha Khan' }],
    meeting_join_url: null,
    can_view_details: true,
  }],
  courses: [{
    course_id: 'course-v1:FBR+TX101+2026',
    course_code: 'TX-101',
    name: 'Income Tax Law',
    instructors: [{ id: 91, full_name: 'Ayesha Khan' }],
    completed_modules: 5,
    total_modules: 8,
    progress_percentage: 63,
    status: 'in_progress',
  }],
  results: {
    state: 'not_published',
    is_visible: false,
    maximum_score: null,
    total_score: null,
    percentage: null,
    grade: null,
    finalized_at: null,
  },
  attendance: {
    present: 38,
    absent: 4,
    leave: 2,
    pending: 0,
    total: 44,
    percentage: 86.36,
    threshold: 75,
    meets_requirement: true,
    history: [{
      session_id: 'session-0',
      session_title: 'Federal Excise Duty',
      session_start: '2026-08-13T09:30:00+05:00',
      course_id: 'course-v1:FBR+TX101+2026',
      course_name: 'Income Tax Law',
      status: 'present',
    }],
  },
  feedback: [{
    id: 602,
    feedback_name: 'Instructor feedback',
    form_name: 'Session feedback',
    subject: { id: 91, full_name: 'Ayesha Khan' },
    course_id: 'course-v1:FBR+TX101+2026',
    course_name: 'Income Tax Law',
    deadline: '2026-08-15',
    status: 'pending',
    urgent: true,
    submitted_at: null,
    can_submit: true,
  }],
  holidays: [{
    id: 17,
    type: 'public_holiday',
    name: 'Independence Day',
    description: 'Campus closed',
    start_date: '2026-08-14',
    end_date: '2026-08-14',
    no_sessions: true,
  }],
  certificates: [{
    id: 'FBR-CERT-500141',
    type: 'programme_completion',
    title: 'Programme Completion Certificate',
    course_id: null,
    programme_key: 'program-v1:FBR+STP+2026-A',
    certificate_number: 'FBR-CERT-500141',
    status: 'earned',
    issued_at: '2026-08-01T10:00:00+05:00',
    can_download: true,
    eligibility_message: '',
  }],
};

const renderDashboard = () => render(
  <MemoryRouter>
    <IntlProvider locale="en" messages={{}}>
      <TraineeDashboardPage />
    </IntlProvider>
  </MemoryRouter>,
);

beforeEach(() => {
  useTraineeDashboard.mockReturnValue({
    data: dashboard,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
});

it('renders backend dashboard data and links existing detail flows', () => {
  renderDashboard();

  const main = screen.getByRole('main');
  expect(within(main).getByRole('heading', { level: 1, name: 'Assalam-o-Alaikum, Ayesha' })).toBeInTheDocument();
  expect(within(main).getByText('EMP-1042')).toBeInTheDocument();
  expect(within(main).getByText('Withholding Tax Regime')).toBeInTheDocument();
  expect(within(main).getByText('Results not published yet')).toBeInTheDocument();

  expect(within(main).getByRole('link', { name: 'View details' })).toHaveAttribute(
    'href',
    '/program-v1:FBR+STP+2026-A/calendar?modal=session&id=session-1',
  );
  expect(within(main).getByRole('link', { name: 'View certificate' })).toHaveAttribute(
    'href',
    '/program-v1:FBR+STP+2026-A/certificate',
  );
});

it('uses API-provided percentages for accessible progress indicators', () => {
  renderDashboard();

  expect(screen.getByRole('progressbar', {
    name: 'Programme timeline: 22% complete',
  })).toHaveAttribute('aria-valuenow', '22');
  expect(screen.getByRole('progressbar', {
    name: 'My attendance: 86% complete',
  })).toHaveAttribute('aria-valuenow', '86');
  expect(screen.getAllByRole('progressbar', {
    name: 'Income Tax Law: 63% complete',
  })).toHaveLength(2);
});

it('requests the selected programme when the switcher changes', async () => {
  const user = userEvent.setup();
  renderDashboard();

  await user.selectOptions(screen.getByRole('combobox', { name: 'Programme' }), 'program-v1:FBR+DST+2026-A');

  expect(useTraineeDashboard).toHaveBeenLastCalledWith('program-v1:FBR+DST+2026-A');
});

it('renders no_programme as an onboarding empty state', () => {
  useTraineeDashboard.mockReturnValue({
    data: {
      ...dashboard, state: 'no_programme', programme: null, holidays: [],
    },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });

  renderDashboard();

  expect(screen.getByRole('heading', { name: 'No active programme yet' })).toBeInTheDocument();
  expect(screen.getByText(/after you are enrolled in an active programme/)).toBeInTheDocument();
});

it('shows finalized results without inventing a hidden score', () => {
  useTraineeDashboard.mockReturnValue({
    data: {
      ...dashboard,
      results: {
        state: 'finalized',
        is_visible: true,
        maximum_score: 600,
        total_score: 492,
        percentage: 82,
        grade: 'pass',
        finalized_at: '2026-09-30T12:00:00+05:00',
      },
    },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });

  renderDashboard();

  expect(screen.getByText('Final result')).toBeInTheDocument();
  expect(screen.getByText('492 of 600')).toBeInTheDocument();
  expect(screen.getByText('Passed')).toBeInTheDocument();
});
