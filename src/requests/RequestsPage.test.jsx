import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import RequestsPage from './RequestsPage';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('../app/useConfig', () => ({ useConfig: jest.fn() }));
jest.mock('./AdminRequestsView', () => () => <div>AdminView</div>);
jest.mock('./LearnerRequestsView', () => () => <div>LearnerView</div>);
jest.mock('./InstructorRequestsView', () => () => <div>InstructorView</div>);

const { useConfig } = require('../app/useConfig');

const renderPage = () => render(
  <MemoryRouter>
    <IntlProvider locale="en" messages={{}}>
      <RequestsPage />
    </IntlProvider>
  </MemoryRouter>,
);

beforeEach(() => jest.clearAllMocks());

it('renders AdminRequestsView for admin role', () => {
  useConfig.mockReturnValue({ data: { user_role: 'admin' } });
  renderPage();
  expect(screen.getByText('AdminView')).toBeInTheDocument();
});

it('renders LearnerRequestsView for learner role', () => {
  useConfig.mockReturnValue({ data: { user_role: 'learner' } });
  renderPage();
  expect(screen.getByText('LearnerView')).toBeInTheDocument();
});

it('renders InstructorRequestsView for instructor role', () => {
  useConfig.mockReturnValue({ data: { user_role: 'instructor' } });
  renderPage();
  expect(screen.getByText('InstructorView')).toBeInTheDocument();
});

it('defaults to LearnerRequestsView when config data is null', () => {
  useConfig.mockReturnValue({ data: null });
  renderPage();
  expect(screen.getByText('LearnerView')).toBeInTheDocument();
});

it('defaults to LearnerRequestsView when config is loading (undefined)', () => {
  useConfig.mockReturnValue({ data: undefined });
  renderPage();
  expect(screen.getByText('LearnerView')).toBeInTheDocument();
});
