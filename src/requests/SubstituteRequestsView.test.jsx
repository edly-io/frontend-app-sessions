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

describe('SubstituteRequestsView — after a substitute is assigned', () => {
  // The fixture's `...overrides` spread replaces `session` wholesale, so the
  // override must carry every field the row cell reads (id, title, dates, etc.).
  const assigned = () => substituteRequest({
    status: 'assigned',
    substitute_instructor_email: 'sub@fbr.test',
    substitute_instructor_name: 'Sub One',
    session: {
      id: 'sess-1',
      title: 'Course 1 — Session 17',
      scheduled_start_time: '2026-09-02T09:00:00Z',
      status: 'scheduled',
      location: null,
      instructor_emails: ['instructor1@fbr.test', 'sub@fbr.test', 'sub2@fbr.test'],
      instructor_names: ['Instructor One', 'Sub One', 'Sub Two'],
    },
  });

  // "Assigned" also appears in the status filter dropdown; scope lookups to
  // the table so the badge in the row is what we're actually asserting on.
  const inTable = async () => within(await screen.findByRole('table'));

  it('drops the action buttons — the request is resolved', async () => {
    getSubstituteRequests.mockResolvedValue({ results: [assigned()], count: 1 });
    renderView();

    const table = await inTable();
    expect(table.getByText('Assigned')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assign Substitute' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel Session' })).not.toBeInTheDocument();
  });

  it('lists every current instructor except the one on leave in the Substitute column', async () => {
    getSubstituteRequests.mockResolvedValue({ results: [assigned()], count: 1 });
    renderView();

    const table = await inTable();
    // Both cover instructors appear; the original on-leave instructor does not.
    expect(table.getByText('Sub One')).toBeInTheDocument();
    expect(table.getByText('Sub Two')).toBeInTheDocument();
    expect(table.getByText('(sub@fbr.test)')).toBeInTheDocument();
    expect(table.getByText('(sub2@fbr.test)')).toBeInTheDocument();
    // The on-leave instructor stays in their own column but not as a substitute.
    const substituteCell = table.getAllByRole('cell')[3];
    expect(within(substituteCell).queryByText(/instructor1@fbr.test/)).not.toBeInTheDocument();
  });
});
