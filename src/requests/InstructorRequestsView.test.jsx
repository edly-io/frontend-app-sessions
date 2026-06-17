import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import InstructorRequestsView from './InstructorRequestsView';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('./api', () => ({
  getMyRequests: jest.fn(),
  deleteRequest: jest.fn(),
  withdrawRequest: jest.fn(),
  getLeaveUsage: jest.fn(),
  getSessions: jest.fn(),
  getApprovedLeaves: jest.fn(),
  getSessionApprovedLeaves: jest.fn(),
}));

jest.mock('../app/useConfig', () => ({
  useConfig: jest.fn().mockReturnValue({ data: { user_role: 'instructor' } }),
}));

const {
  getMyRequests, getLeaveUsage, getSessions, getApprovedLeaves, getSessionApprovedLeaves,
} = require('./api');

const wrap = (lockedType = null) => render(
  <IntlProvider locale="en" messages={{}}>
    <MemoryRouter initialEntries={['/test-program/requests']}>
      <Routes>
        <Route
          path="/:programId/requests"
          element={<InstructorRequestsView lockedType={lockedType} />}
        />
      </Routes>
    </MemoryRouter>
  </IntlProvider>,
);

beforeEach(() => {
  jest.clearAllMocks();
  getMyRequests.mockResolvedValue({ results: [], count: 0 });
  getLeaveUsage.mockResolvedValue({ threshold: 0, leaves: [] });
  getSessions.mockResolvedValue([]);
  getApprovedLeaves.mockResolvedValue([]);
  getSessionApprovedLeaves.mockResolvedValue({ count: 0, results: [] });
});

describe('InstructorRequestsView', () => {
  it('renders the requests table', async () => {
    wrap();
    await waitFor(() => expect(getMyRequests).toHaveBeenCalled());
  });

  it('renders SessionLeavesPanel when lockedType is leave', async () => {
    wrap('leave');
    await waitFor(() => expect(screen.getByText('Sessions & Approved Leaves')).toBeInTheDocument());
  });

  it('does NOT render SessionLeavesPanel when lockedType is remote_session', async () => {
    wrap('remote_session');
    await waitFor(() => expect(getMyRequests).toHaveBeenCalled());
    expect(screen.queryByText('Sessions & Approved Leaves')).not.toBeInTheDocument();
  });
});
