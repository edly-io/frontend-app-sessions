import React from 'react';
import {
  render, screen, waitFor, within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';

import SubstituteRequestsView from './SubstituteRequestsView';
import { USER_ROLE } from '../shared/constants';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('./api', () => ({
  getSubstituteRequests: jest.fn(),
  getSubstituteRequest: jest.fn(),
  closeSubstituteRequest: jest.fn(),
}));
jest.mock('../calendar/api', () => ({ cancelSession: jest.fn() }));
jest.mock('../app/useConfig', () => ({ useConfig: jest.fn() }));

const { getSubstituteRequests, closeSubstituteRequest } = require('./api');
const { cancelSession } = require('../calendar/api');
const { useConfig } = require('../app/useConfig');

const PROGRAM = 'program-v1:FBR+STP+2026-A';

const substituteRequest = (overrides = {}) => ({
  id: 14,
  status: 'open',
  substitute_instructor_email: '',
  program_key: PROGRAM,
  leave_request: {
    id: 'abc',
    submitter_email: 'instructor1@fbr.test',
    leave_start_date: '2026-09-02',
    leave_end_date: '2026-09-02',
  },
  session: {
    id: 'sess-1',
    title: 'Course 1 — Session 17',
    scheduled_start_time: '2026-09-02T09:00:00Z',
    status: 'scheduled',
    location: null,
    ...overrides.session,
  },
  ...overrides,
});

const renderView = () => render(
  <IntlProvider locale="en">
    <MemoryRouter initialEntries={[`/${PROGRAM}/requests/substitute-requests`]}>
      <Routes>
        <Route
          path="/:programId/requests/substitute-requests"
          element={<SubstituteRequestsView />}
        />
      </Routes>
    </MemoryRouter>
  </IntlProvider>,
);

beforeEach(() => {
  jest.clearAllMocks();
  useConfig.mockReturnValue({ data: { user_role: USER_ROLE.ADMIN } });
  closeSubstituteRequest.mockResolvedValue({});
  cancelSession.mockResolvedValue({});
});

describe('SubstituteRequestsView — a live session', () => {
  it('offers both actions', async () => {
    getSubstituteRequests.mockResolvedValue({ results: [substituteRequest()], count: 1 });
    renderView();

    expect(await screen.findByRole('button', { name: 'Assign Substitute' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel Session' })).toBeInTheDocument();
    expect(screen.queryByText('Cancelled')).not.toBeInTheDocument();
  });
});

describe('SubstituteRequestsView — a cancelled session', () => {
  const cancelled = () => substituteRequest({ session: { status: 'cancelled' } });

  it('marks the row as cancelled', async () => {
    getSubstituteRequests.mockResolvedValue({ results: [cancelled()], count: 1 });
    renderView();

    // The Status column shows the *request's* status ("Open"), so without this
    // badge a cancelled session is indistinguishable from a live one and an
    // admin arranges cover for a class that is not happening.
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    // Scoped to the table: the status filter also offers an "Open" option, and
    // the distinction is the point — "Open" is the *request*, "Cancelled" the
    // session, and the row must show both.
    expect(within(screen.getByRole('table')).getByText('Open')).toBeInTheDocument();
  });

  it('withdraws both actions, since neither is possible', async () => {
    getSubstituteRequests.mockResolvedValue({ results: [cancelled()], count: 1 });
    renderView();

    // Assigning is refused by the backend (`session_cancelled`) and cancelling
    // again returns `already_cancelled` — offering either only invites an error.
    await waitFor(() => expect(screen.getByText('Cancelled')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Assign Substitute' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel Session' })).not.toBeInTheDocument();
  });

  it('offers Close so the row is not stranded', async () => {
    getSubstituteRequests.mockResolvedValue({ results: [cancelled()], count: 1 });
    renderView();

    // Closing is otherwise only reachable as a side effect of "Cancel Session",
    // which is now hidden — so without this the row could never be cleared.
    const close = await screen.findByRole('button', { name: 'Close' });
    await userEvent.click(close);

    await waitFor(() => expect(closeSubstituteRequest).toHaveBeenCalledWith(14));
    expect(cancelSession).not.toHaveBeenCalled();
  });
});
