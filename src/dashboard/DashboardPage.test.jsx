import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';

import DashboardPage from './DashboardPage';
import useMyFbrRoles from '../app/useMyFbrRoles';
import { useConfig } from '../app/useConfig';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('../plugin-slots/HeaderSlot', () => () => null);
jest.mock('@edx/frontend-component-footer', () => ({ FooterSlot: () => null }));
jest.mock('../app/useMyFbrRoles');
jest.mock('../app/useConfig');
jest.mock('../admin-dashboard/AdminDashboardView', () => function MockAdmin() { return <div>Admin dashboard</div>; });
jest.mock('../instructor-dashboard/InstructorDashboardPage', () => function MockInstructor() { return <div>Instructor dashboard</div>; });
jest.mock('../trainee-dashboard/TraineeDashboardPage', () => function MockTrainee() { return <div>Trainee dashboard</div>; });

const setUp = ({ roles = [], userRole = 'learner', ...rest } = {}) => {
  useMyFbrRoles.mockReturnValue({ roles, isLoading: false });
  useConfig.mockReturnValue({
    data: { user_role: userRole }, isLoading: false, isError: false, ...rest,
  });
};

const wrap = () => render(
  <IntlProvider locale="en" messages={{}}>
    <DashboardPage />
  </IntlProvider>,
);

beforeEach(() => jest.clearAllMocks());

describe('DashboardPage', () => {
  it('shows a single dashboard without a role switcher for one role', () => {
    setUp({ roles: ['instructor'] });
    wrap();

    expect(screen.getByText('Instructor dashboard')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'As Instructor' })).not.toBeInTheDocument();
  });

  it('offers both views and opens on the instructor one when the user holds both roles', () => {
    setUp({ roles: ['instructor', 'trainee'] });
    wrap();

    expect(screen.getByRole('button', { name: 'As Instructor' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'As Trainee' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Instructor dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Trainee dashboard')).not.toBeInTheDocument();
  });

  it('swaps the dashboard and the pressed state when the other view is chosen', async () => {
    const user = userEvent.setup();
    setUp({ roles: ['instructor', 'trainee'] });
    wrap();

    await user.click(screen.getByRole('button', { name: 'As Trainee' }));

    expect(screen.getByText('Trainee dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Instructor dashboard')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'As Trainee' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'As Instructor' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'As Instructor' }));

    expect(screen.getByText('Instructor dashboard')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'As Instructor' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the admin dashboard for an admin', () => {
    setUp({ roles: ['instructor', 'trainee'], userRole: 'admin' });
    wrap();

    expect(screen.getByText('Admin dashboard')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'As Trainee' })).not.toBeInTheDocument();
  });
});
