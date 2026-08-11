import React from 'react';
import { render, screen } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';

import SessionsLanding from './SessionsLanding';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('./useMyFbrRoles', () => ({ useMyFbrRoles: jest.fn() }));
jest.mock('../programs/ProgramsListPage', () => {
  const ProgramsListPage = () => <div>Programs list page</div>;
  return ProgramsListPage;
});
jest.mock('../trainee-dashboard/TraineeDashboardPage', () => {
  const TraineeDashboardPage = () => <div>Trainee dashboard page</div>;
  return TraineeDashboardPage;
});

const { useMyFbrRoles } = require('./useMyFbrRoles');

const renderLanding = () => render(
  <IntlProvider locale="en" messages={{}}>
    <SessionsLanding />
  </IntlProvider>,
);

beforeEach(() => {
  jest.clearAllMocks();
});

it('renders the trainee dashboard when FBR roles include trainee', () => {
  useMyFbrRoles.mockReturnValue({
    data: ['trainee'],
    isLoading: false,
    isError: false,
  });

  renderLanding();

  expect(screen.getByText('Trainee dashboard page')).toBeInTheDocument();
  expect(screen.queryByText('Programs list page')).not.toBeInTheDocument();
});

it('preserves the programs page for a non-trainee', () => {
  useMyFbrRoles.mockReturnValue({
    data: ['instructor'],
    isLoading: false,
    isError: false,
  });

  renderLanding();

  expect(screen.getByText('Programs list page')).toBeInTheDocument();
  expect(screen.queryByText('Trainee dashboard page')).not.toBeInTheDocument();
});

it('renders the trainee dashboard for a multi-role user who is also a trainee', () => {
  useMyFbrRoles.mockReturnValue({
    data: ['data_admin', 'trainee', 'instructor'],
    isLoading: false,
    isError: false,
  });

  renderLanding();

  expect(screen.getByText('Trainee dashboard page')).toBeInTheDocument();
});

it('renders only an accessible loading state until roles are known', () => {
  useMyFbrRoles.mockReturnValue({
    data: undefined,
    isLoading: true,
    isError: false,
  });

  renderLanding();

  expect(screen.getByText('Loading dashboard')).toBeInTheDocument();
  expect(screen.queryByText('Trainee dashboard page')).not.toBeInTheDocument();
  expect(screen.queryByText('Programs list page')).not.toBeInTheDocument();
});

it('fails closed with an alert when roles cannot be loaded', () => {
  useMyFbrRoles.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: true,
  });

  renderLanding();

  expect(screen.getByRole('alert')).toHaveTextContent('We could not load your dashboard');
  expect(screen.queryByText('Trainee dashboard page')).not.toBeInTheDocument();
  expect(screen.queryByText('Programs list page')).not.toBeInTheDocument();
});
