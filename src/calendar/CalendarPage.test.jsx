import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  MemoryRouter, Route, Routes, useSearchParams,
} from 'react-router-dom';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import CalendarPage from './CalendarPage';
import * as calendarApi from './api';
import * as appApi from '../app/api';
import * as holidaysApi from '../holidays/api';
import * as requestsApi from '../requests/api';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

// Isolate CalendarPage's own modal/URL effect logic by stubbing the grid and
// the sections that are not under test. getMonthGridDays/getWeekDays must stay
// real enough for CalendarPage's computeFetchWindow, which imports them.
jest.mock('./CalendarView', () => {
  const toZero = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  return {
    __esModule: true,
    getMonthGridDays: (currentDate) => [toZero(currentDate)],
    getWeekDays: (currentDate) => [toZero(currentDate)],
    default: () => <div data-testid="calendar-view" />,
  };
});
jest.mock('../shared/AuditLogTable', () => function AuditLogTableStub() {
  return <div data-testid="audit-log" />;
});

// Mock every data dependency so no real network request fires.
jest.mock('./api', () => ({
  getSession: jest.fn(),
  getCalendarSessions: jest.fn(),
  getProgramDates: jest.fn(),
  deleteSession: jest.fn(),
  cancelSession: jest.fn(),
  getSessionStartLink: jest.fn(),
}));
jest.mock('../app/api', () => ({
  getProgram: jest.fn(),
}));
jest.mock('../holidays/api', () => ({
  getHolidays: jest.fn(),
}));
jest.mock('../requests/api', () => ({
  getApprovedLeaves: jest.fn(),
}));
jest.mock('../app/useConfig', () => ({
  useConfig: () => ({ data: { user_role: 'admin', session_types: [] } }),
}));

// A tiny visible readout of the current search params so tests can assert that
// calendar navigation did NOT strip ?modal=&id= (the bug being fixed).
const SearchParamsProbe = () => {
  const [searchParams] = useSearchParams();
  return (
    <div data-testid="search-params">
      modal={searchParams.get('modal')};id={searchParams.get('id')}
    </div>
  );
};

const SESSION_ID = '674f916a-e401-439e-b4ab-7e6bd487c97b';
const session = { id: SESSION_ID, title: 'Morning Lecture' };

const queryClient = new QueryClient();

const renderCalendar = (search = `?modal=session&id=${SESSION_ID}`) => render(
  <IntlProvider locale="en" messages={{}}>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/program-v1:FBR+STP+2026-A/calendar${search}`]}>
        <Routes>
          <Route
            path="/:programId/calendar"
            element={<><CalendarPage /><SearchParamsProbe /></>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  </IntlProvider>,
);

beforeEach(() => {
  jest.clearAllMocks();
  // Defaults: an empty visible window and harmless background fetches.
  calendarApi.getCalendarSessions.mockResolvedValue({ sessions: [] });
  calendarApi.getProgramDates.mockResolvedValue([]);
  appApi.getProgram.mockResolvedValue({});
  holidaysApi.getHolidays.mockResolvedValue({ results: [] });
  requestsApi.getApprovedLeaves.mockResolvedValue([]);
});

it('keeps modal/id params in the URL and surfaces an error when the direct session fetch fails', async () => {
  calendarApi.getSession.mockRejectedValue(new Error('boom'));

  renderCalendar();

  // The detail error is shown (not silently swallowed)…
  expect(await screen.findByText('Failed to load session details.')).toBeInTheDocument();

  // …and, crucially, closeModal() was NOT called: the URL still carries
  // ?modal=session&id=<id> so a later session load can still open the modal.
  expect(screen.getByTestId('search-params')).toHaveTextContent(`modal=session;id=${SESSION_ID}`);
});

it('opens the session detail modal from the URL on a successful direct fetch', async () => {
  calendarApi.getSession.mockResolvedValue(session);

  renderCalendar();

  expect(await screen.findByText('Morning Lecture')).toBeInTheDocument();
  expect(screen.getByTestId('search-params')).toHaveTextContent(`modal=session;id=${SESSION_ID}`);
});

it('still opens the modal on retry after a transient fetch failure (URL params survive)', async () => {
  // A transient in-app failure must not tear down ?modal=&id= — because it does,
  // the same URL can recover (e.g. re-navigation / refresh) and open the modal.
  calendarApi.getSession.mockRejectedValue(new Error('boom'));

  const first = renderCalendar();
  expect(await screen.findByText('Failed to load session details.')).toBeInTheDocument();
  expect(first.getByTestId('search-params')).toHaveTextContent(`modal=session;id=${SESSION_ID}`);

  // Now the backend recovers; re-rendering the SAME URL must open the modal,
  // which would be impossible if the previous failure had stripped the params.
  calendarApi.getSession.mockResolvedValue(session);
  renderCalendar();

  expect(await screen.findByText('Morning Lecture')).toBeInTheDocument();
  // Both the failed first render and the recovered second render kept ?modal=&id=.
  screen.getAllByTestId('search-params').forEach(
    (el) => expect(el).toHaveTextContent(`modal=session;id=${SESSION_ID}`),
  );
});
