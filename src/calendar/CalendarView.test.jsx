import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';

import CalendarView from './CalendarView';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

const baseProps = {
  view: 'month',
  currentDate: new Date('2026-07-15T12:00:00Z'),
  onViewChange: jest.fn(),
  onNavigate: jest.fn(),
  onGoToToday: jest.fn(),
  onScheduleNew: jest.fn(),
  onEditSession: jest.fn(),
  onDeleteSession: jest.fn(),
  onCancelSession: jest.fn(),
  onSessionDetail: jest.fn(),
  loading: false,
  canManageSessions: true,
  isInstructor: false,
  isLearner: false,
  studentRequestMap: new Map(),
  leaveDateMap: new Map(),
  holidays: [],
  programDates: [],
  sessionTypeColors: {},
  sessionTypeLabels: {
    ceremony: 'Ceremony',
  },
};

const buildSession = (overrides = {}) => ({
  id: overrides.id ?? 1,
  title: overrides.title ?? 'Session title',
  status: overrides.status ?? 'scheduled',
  course_id: overrides.course_id ?? 'program-1',
  course_name: overrides.course_name ?? 'Calendar Course',
  instructor_names: overrides.instructor_names ?? ['Instructor Example'],
  scheduled_start_time: overrides.scheduled_start_time ?? '2026-07-15T09:00:00Z',
  scheduled_end_time: overrides.scheduled_end_time ?? '2026-07-15T10:00:00Z',
  meeting_start_url: overrides.meeting_start_url,
  meeting_join_url: overrides.meeting_join_url,
  create_zoom_meeting: overrides.create_zoom_meeting ?? false,
  user_role: overrides.user_role ?? 'admin',
  session_type: overrides.session_type ?? 'session',
  ...overrides,
});

const wrap = (sessions) => render(
  <IntlProvider locale="en" messages={{}}>
    <CalendarView {...baseProps} sessions={sessions} />
  </IntlProvider>,
);

const findPopoverTitle = async (title) => {
  const matches = await screen.findAllByText(title);
  return matches.find((node) => node.closest('button'));
};

it('shows scope and backend session type badges in the popup only, not on the month tile', async () => {
  wrap([
    buildSession({
      title: 'Ceremony session',
      meeting_join_url: '',
      meeting_start_url: '',
      meeting_id: '',
      create_zoom_meeting: false,
      session_type: 'ceremony',
    }),
  ]);

  expect(screen.queryByText('Ceremony')).not.toBeInTheDocument();
  expect(screen.queryByText('In-person')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /ceremony session/i }));

  expect(await screen.findByText('Scheduled')).toBeInTheDocument();
  expect(screen.getByText('In-person')).toBeInTheDocument();
  expect(screen.getByText('Ceremony')).toBeInTheDocument();
});

it('shows cancelled strike-through styling in the single-session popover', async () => {
  wrap([
    buildSession({
      id: 2,
      title: 'Cancelled single session',
      status: 'cancelled',
    }),
  ]);

  fireEvent.click(screen.getByRole('button', { name: /cancelled single session/i }));

  const title = await findPopoverTitle('Cancelled single session');
  expect(title).toBeTruthy();
  expect(title.getAttribute('style')).toContain('text-decoration: line-through');
  expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0);
});

it('shows cancelled badge and strike-through styling in the multiple-events popup', async () => {
  wrap([
    buildSession({ id: 3, title: 'Morning session', scheduled_start_time: '2026-07-15T09:00:00Z' }),
    buildSession({ id: 4, title: 'Afternoon session', scheduled_start_time: '2026-07-15T13:00:00Z' }),
    buildSession({
      id: 5,
      title: 'Cancelled grouped session',
      status: 'cancelled',
      scheduled_start_time: '2026-07-15T16:00:00Z',
    }),
  ]);

  fireEvent.click(screen.getByRole('button', { name: /\+1 more/i }));

  const title = await findPopoverTitle('Cancelled grouped session');
  expect(title).toBeTruthy();
  expect(title.getAttribute('style')).toContain('text-decoration: line-through');
  expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0);
});
