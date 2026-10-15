import React from 'react';
import { render, screen } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';

import RequireAdmin from './RequireAdmin';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('./useConfig', () => ({ useConfig: jest.fn() }));

const { useConfig } = require('./useConfig');

const wrap = () => render(
  <MemoryRouter>
    <IntlProvider locale="en" messages={{}}>
      <RequireAdmin>
        <div data-testid="protected-children">Secret admin area</div>
      </RequireAdmin>
    </IntlProvider>
  </MemoryRouter>,
);

beforeEach(() => jest.clearAllMocks());

describe('RequireAdmin', () => {
  it('shows a spinner while the config is loading', () => {
    useConfig.mockReturnValue({ data: undefined, isLoading: true });
    wrap();
    expect(document.querySelector('.spinner-border')).not.toBeNull();
    expect(screen.queryByTestId('protected-children')).not.toBeInTheDocument();
  });

  it('renders the unauthorized page for a learner', () => {
    useConfig.mockReturnValue({ data: { user_role: 'learner' }, isLoading: false });
    wrap();
    expect(screen.queryByTestId('protected-children')).not.toBeInTheDocument();
    expect(screen.getByText(/You are not authorized to view this page/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Return to dashboard/i })).toBeInTheDocument();
  });

  it('renders the unauthorized page for an instructor', () => {
    useConfig.mockReturnValue({ data: { user_role: 'instructor' }, isLoading: false });
    wrap();
    expect(screen.queryByTestId('protected-children')).not.toBeInTheDocument();
    expect(screen.getByText(/You are not authorized to view this page/i)).toBeInTheDocument();
  });

  it('renders children for an admin', () => {
    useConfig.mockReturnValue({ data: { user_role: 'admin' }, isLoading: false });
    wrap();
    expect(screen.getByTestId('protected-children')).toBeInTheDocument();
    expect(screen.queryByText(/You are not authorized/i)).not.toBeInTheDocument();
  });
});
