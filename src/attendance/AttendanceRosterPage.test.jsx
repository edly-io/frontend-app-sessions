import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AttendanceRosterPage from './AttendanceRosterPage';
import { USER_ROLE } from '../shared/constants';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('./api', () => ({
  getAttendanceRoster: jest.fn(),
  markAttendance: jest.fn(),
  syncSessionAttendance: jest.fn(),
}));

jest.mock('../app/useConfig', () => ({
  useConfig: jest.fn(),
}));

const { getAttendanceRoster } = require('./api');
const { useConfig } = require('../app/useConfig');

const PROGRAM_ID = 'program-v1:Org+Test+2026';
const SESSION_ID = 'session-uuid-1';
const SYNC_LABEL = 'Sync attendance from Zoom';

const HOUR = 3600 * 1000;
const past = (ms) => new Date(Date.now() - ms).toISOString();
const future = (ms) => new Date(Date.now() + ms).toISOString();

const mockRoster = (session) => {
  getAttendanceRoster.mockResolvedValue({ results: [], session });
};

const wrap = () => render(
  <IntlProvider locale="en" messages={{}}>
    <MemoryRouter initialEntries={[`/${PROGRAM_ID}/attendance/${SESSION_ID}`]}>
      <Routes>
        <Route path="/:programId/attendance/:sessionId" element={<AttendanceRosterPage />} />
      </Routes>
    </MemoryRouter>
  </IntlProvider>,
);

beforeEach(() => {
  jest.clearAllMocks();
  useConfig.mockReturnValue({ data: { user_role: USER_ROLE.ADMIN } });
});

it('shows the sync button for an ended Zoom session inside the marking window', async () => {
  mockRoster({
    meeting_id: '93',
    marking_window_open: true,
    scheduled_end_time: past(HOUR),
  });
  wrap();
  await waitFor(() => expect(screen.getByText(/marking window open/i)).toBeInTheDocument());
  expect(screen.getByText(SYNC_LABEL)).toBeInTheDocument();
});

it('hides the sync button before the session has ended', async () => {
  mockRoster({
    meeting_id: '93',
    marking_window_open: true,
    scheduled_end_time: future(HOUR),
  });
  wrap();
  await waitFor(() => expect(screen.getByText(/marking window open/i)).toBeInTheDocument());
  expect(screen.queryByText(SYNC_LABEL)).not.toBeInTheDocument();
});

it('hides the sync button once the marking window is closed', async () => {
  mockRoster({
    meeting_id: '93',
    marking_window_open: false,
    scheduled_end_time: past(HOUR),
  });
  wrap();
  await waitFor(() => expect(screen.getByText(/marking window closed/i)).toBeInTheDocument());
  expect(screen.queryByText(SYNC_LABEL)).not.toBeInTheDocument();
});

it('hides the sync button when the session has no Zoom meeting', async () => {
  mockRoster({
    meeting_id: '',
    marking_window_open: true,
    scheduled_end_time: past(HOUR),
  });
  wrap();
  await waitFor(() => expect(screen.getByText(/marking window open/i)).toBeInTheDocument());
  expect(screen.queryByText(SYNC_LABEL)).not.toBeInTheDocument();
});
