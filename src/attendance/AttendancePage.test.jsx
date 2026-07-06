import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import AttendancePage from './AttendancePage';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('../app/useConfig', () => ({ useConfig: jest.fn() }));

const { useConfig } = require('../app/useConfig');

const wrap = (userRole) => {
  useConfig.mockReturnValue({ data: { user_role: userRole } });
  return render(
    <MemoryRouter initialEntries={['/test-prog/attendance/by-course']}>
      <Routes>
        <Route
          path="/:programId/attendance"
          element={(
            <IntlProvider locale="en" messages={{}}>
              <AttendancePage />
            </IntlProvider>
          )}
        >
          <Route path="by-course" element={<div>By Course Outlet</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => jest.clearAllMocks());

it('renders the admin sub-nav for admin users', () => {
  wrap('admin');
  expect(screen.getByRole('navigation', { name: /attendance sub-sections/i })).toBeInTheDocument();
  expect(screen.getByText('By Course')).toBeInTheDocument();
});

it('does not render sub-nav for learner', () => {
  wrap('learner');
  expect(screen.queryByRole('navigation', { name: /attendance sub-sections/i })).not.toBeInTheDocument();
});

it('renders the outlet content', () => {
  wrap('admin');
  expect(screen.getByText('By Course Outlet')).toBeInTheDocument();
});
