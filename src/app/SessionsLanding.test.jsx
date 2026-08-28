import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import { MemoryRouter, useLocation } from 'react-router-dom';

import SessionsLanding from './SessionsLanding';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('./useMyFbrRoles', () => ({ useMyFbrRoles: jest.fn() }));
jest.mock('../programs/ProgramsListPage', () => {
  const ProgramsListPage = () => <div>Programs list page</div>;
  return ProgramsListPage;
});
jest.mock('../trainee-dashboard/TraineeDashboardPage', () => {
  // eslint-disable-next-line react/prop-types
  const TraineeDashboardPage = ({ profileSwitcher }) => (
    <>
      {profileSwitcher}
      <div>Trainee dashboard page</div>
    </>
  );
  return TraineeDashboardPage;
});
jest.mock('../instructor-dashboard/InstructorDashboardPage', () => {
  // eslint-disable-next-line react/prop-types
  const InstructorDashboardPage = ({ profileSwitcher }) => (
    <>
      {profileSwitcher}
      <div>Instructor dashboard page</div>
    </>
  );
  return InstructorDashboardPage;
});

const { useMyFbrRoles } = require('./useMyFbrRoles');

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}

    unobserve() {}

    disconnect() {}
  };
});

const LocationDisplay = () => {
  const location = useLocation();
  return <output aria-label="Current location">{`${location.pathname}${location.search}`}</output>;
};

const renderLanding = (initialEntry = '/') => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <IntlProvider locale="en" messages={{}}>
      <SessionsLanding />
      <LocationDisplay />
    </IntlProvider>
  </MemoryRouter>,
);

beforeEach(() => {
  jest.clearAllMocks();
});

it('renders only the trainee dashboard for a trainee-only user', () => {
  useMyFbrRoles.mockReturnValue({
    data: ['trainee'],
    isLoading: false,
    isError: false,
  });

  renderLanding('/sessions/');

  expect(screen.getByText('Trainee dashboard page')).toBeInTheDocument();
  expect(screen.queryByText('Instructor dashboard page')).not.toBeInTheDocument();
  expect(screen.queryByText('Programs list page')).not.toBeInTheDocument();
  expect(screen.queryByText('Your trainee profile')).not.toBeInTheDocument();
  expect(screen.queryByText('Your instructor profile')).not.toBeInTheDocument();
});

it('renders only the instructor dashboard for an instructor-only user', () => {
  useMyFbrRoles.mockReturnValue({
    data: ['instructor'],
    isLoading: false,
    isError: false,
  });

  renderLanding('/sessions/');

  expect(screen.getByText('Instructor dashboard page')).toBeInTheDocument();
  expect(screen.queryByText('Trainee dashboard page')).not.toBeInTheDocument();
  expect(screen.queryByText('Programs list page')).not.toBeInTheDocument();
  expect(screen.queryByText('Your trainee profile')).not.toBeInTheDocument();
  expect(screen.queryByText('Your instructor profile')).not.toBeInTheDocument();
});

it('shows both profiles to a dual-role user and defaults to trainee', () => {
  useMyFbrRoles.mockReturnValue({
    data: ['data_admin', 'trainee', 'instructor'],
    isLoading: false,
    isError: false,
  });

  renderLanding('/sessions/');

  expect(screen.getByText('Your trainee profile')).toBeInTheDocument();
  expect(screen.getByText('Your instructor profile')).toBeInTheDocument();
  expect(screen.getByText('Trainee dashboard page')).toBeInTheDocument();
  expect(screen.queryByText('Instructor dashboard page')).not.toBeInTheDocument();
});

it('switches a dual-role user to their instructor profile and updates the URL', async () => {
  const user = userEvent.setup();
  useMyFbrRoles.mockReturnValue({
    data: ['trainee', 'instructor'],
    isLoading: false,
    isError: false,
  });

  renderLanding('/sessions/?profile=trainee');

  await user.click(screen.getByText('Your instructor profile'));

  expect(screen.getByText('Instructor dashboard page')).toBeInTheDocument();
  expect(screen.queryByText('Trainee dashboard page')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Current location')).toHaveTextContent('/sessions/?profile=instructor');
});

it('honors a valid instructor profile in the URL for a dual-role user', () => {
  useMyFbrRoles.mockReturnValue({
    data: ['trainee', 'instructor'],
    isLoading: false,
    isError: false,
  });

  renderLanding('/sessions/?profile=instructor');

  expect(screen.getByText('Instructor dashboard page')).toBeInTheDocument();
  expect(screen.queryByText('Trainee dashboard page')).not.toBeInTheDocument();
});

it('falls back safely when the requested profile is invalid', () => {
  useMyFbrRoles.mockReturnValue({
    data: ['trainee', 'instructor'],
    isLoading: false,
    isError: false,
  });

  renderLanding('/sessions/?profile=administrator');

  expect(screen.getByText('Trainee dashboard page')).toBeInTheDocument();
  expect(screen.queryByText('Instructor dashboard page')).not.toBeInTheDocument();
});

it('does not let the profile query override the user roles', () => {
  useMyFbrRoles.mockReturnValue({
    data: ['trainee'],
    isLoading: false,
    isError: false,
  });

  renderLanding('/sessions/?profile=instructor');

  expect(screen.getByText('Trainee dashboard page')).toBeInTheDocument();
  expect(screen.queryByText('Instructor dashboard page')).not.toBeInTheDocument();
});

it('preserves the programs page for users without a dashboard role', () => {
  useMyFbrRoles.mockReturnValue({
    data: ['data_admin'],
    isLoading: false,
    isError: false,
  });

  renderLanding('/sessions/');

  expect(screen.getByText('Programs list page')).toBeInTheDocument();
  expect(screen.queryByText('Trainee dashboard page')).not.toBeInTheDocument();
  expect(screen.queryByText('Instructor dashboard page')).not.toBeInTheDocument();
});

it('renders only an accessible loading state until roles are known', () => {
  useMyFbrRoles.mockReturnValue({
    data: undefined,
    isLoading: true,
    isError: false,
  });

  renderLanding('/sessions/');

  expect(screen.getByText('Loading dashboard')).toBeInTheDocument();
  expect(screen.queryByText('Trainee dashboard page')).not.toBeInTheDocument();
  expect(screen.queryByText('Instructor dashboard page')).not.toBeInTheDocument();
  expect(screen.queryByText('Programs list page')).not.toBeInTheDocument();
});

it('fails closed with an alert when roles cannot be loaded', () => {
  useMyFbrRoles.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: true,
  });

  renderLanding('/sessions/');

  expect(screen.getByRole('alert')).toHaveTextContent('We could not load your dashboard');
  expect(screen.queryByText('Trainee dashboard page')).not.toBeInTheDocument();
  expect(screen.queryByText('Instructor dashboard page')).not.toBeInTheDocument();
  expect(screen.queryByText('Programs list page')).not.toBeInTheDocument();
});
