import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import RequestsSubNav from './RequestsSubNav';
import { USER_ROLE } from '../shared/constants';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('./api', () => ({ getRequestCounts: jest.fn() }));
jest.mock('../app/useConfig', () => ({ useConfig: jest.fn() }));

const { getRequestCounts } = require('./api');
const { useConfig } = require('../app/useConfig');

const PROGRAM = 'program-v1:FBR+STP+2026-A';

const renderSubNav = () => render(
  <MemoryRouter initialEntries={[`/${PROGRAM}/requests/leaves`]}>
    <Routes>
      <Route path="/:programId/requests/*" element={<RequestsSubNav />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  jest.clearAllMocks();
  useConfig.mockReturnValue({ data: { user_role: USER_ROLE.ADMIN } });
  getRequestCounts.mockResolvedValue({
    leaves: 5, remote_sessions: 2, substitute_requests: 1,
  });
});

describe('RequestsSubNav badges', () => {
  it('shows how much work each tab holds', async () => {
    renderSubNav();

    // The point of the badges: an admin arriving from the dashboard knowing
    // "8 pending" can see which tab to open without trying all three.
    expect(await screen.findByLabelText('5 awaiting action')).toHaveTextContent('5');
    expect(screen.getByLabelText('2 awaiting action')).toHaveTextContent('2');
    expect(screen.getByLabelText('1 awaiting action')).toHaveTextContent('1');
  });

  it('renders no badge for an empty queue', async () => {
    getRequestCounts.mockResolvedValue({
      leaves: 0, remote_sessions: 3, substitute_requests: 0,
    });
    renderSubNav();

    // An empty queue is not news, and a row of "0" badges trains the eye to
    // skip all of them — including the one that matters.
    expect(await screen.findByLabelText('3 awaiting action')).toBeInTheDocument();
    expect(screen.queryByLabelText('0 awaiting action')).not.toBeInTheDocument();
  });

  it('still renders the tabs when the count request fails', async () => {
    getRequestCounts.mockRejectedValue(new Error('boom'));
    renderSubNav();

    // A badge is decoration on a working page: losing it must not take the
    // navigation with it.
    expect(await screen.findByText('Leaves')).toBeInTheDocument();
    expect(screen.getByText('Remote Sessions')).toBeInTheDocument();
    expect(screen.getByText('Substitute Requests')).toBeInTheDocument();
  });

  it('does not fetch counts for a learner', async () => {
    useConfig.mockReturnValue({ data: { user_role: USER_ROLE.LEARNER } });
    renderSubNav();

    // Learners see only their own requests, where a count adds nothing — and
    // the endpoint is admin-only, so calling it would just 403.
    await waitFor(() => expect(screen.getByText('Leaves')).toBeInTheDocument());
    expect(getRequestCounts).not.toHaveBeenCalled();
    expect(screen.queryByText('Substitute Requests')).not.toBeInTheDocument();
  });
});
