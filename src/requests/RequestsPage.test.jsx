import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import RequestsPage, { RequestsTabPage } from './RequestsPage';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ programId: 'test-program' }),
}));

jest.mock('../app/useConfig', () => ({ useConfig: jest.fn() }));
jest.mock('./AdminRequestsView', () => function MockAdminView() {
  return <div>AdminView</div>;
});
jest.mock('./LearnerRequestsView', () => function MockLearnerView() {
  return <div>LearnerView</div>;
});
jest.mock('../shared/AuditLogTable', () => function MockAuditLogTable() {
  return <div data-testid="audit-log-table">Audit Log</div>;
});

const { useConfig } = require('../app/useConfig');

const renderLayout = () => render(
  <IntlProvider locale="en" messages={{}}>
    <MemoryRouter initialEntries={['/test-program/requests/leaves']}>
      <Routes>
        <Route path="/:programId/requests" element={<RequestsPage />}>
          <Route path="leaves" element={<div>Leaves content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  </IntlProvider>,
);

const renderTabPage = (lockedType = 'leave') => render(
  <IntlProvider locale="en" messages={{}}>
    <MemoryRouter>
      <RequestsTabPage lockedType={lockedType} />
    </MemoryRouter>
  </IntlProvider>,
);

beforeEach(() => {
  jest.clearAllMocks();
  useConfig.mockReturnValue({ data: { user_role: 'learner' } });
});

// ─── RequestsPage layout ──────────────────────────────────────────────────────

describe('RequestsPage layout', () => {
  it('renders the Leaves tab link', () => {
    renderLayout();
    expect(screen.getByRole('link', { name: 'Leaves' })).toBeInTheDocument();
  });

  it('renders the Remote Sessions tab link', () => {
    renderLayout();
    expect(screen.getByRole('link', { name: 'Remote Sessions' })).toBeInTheDocument();
  });

  it('renders outlet content for the active sub-route', () => {
    renderLayout();
    expect(screen.getByText('Leaves content')).toBeInTheDocument();
  });
});

// ─── RequestsTabPage role gating ─────────────────────────────────────────────

describe('RequestsTabPage', () => {
  it('renders AdminRequestsView for admin role', () => {
    useConfig.mockReturnValue({ data: { user_role: 'admin' } });
    renderTabPage('leave');
    expect(screen.getByText('AdminView')).toBeInTheDocument();
  });

  it('renders LearnerRequestsView for learner role', () => {
    useConfig.mockReturnValue({ data: { user_role: 'learner' } });
    renderTabPage('leave');
    expect(screen.getByText('LearnerView')).toBeInTheDocument();
  });

  it('renders LearnerRequestsView for instructor role', () => {
    useConfig.mockReturnValue({ data: { user_role: 'instructor' } });
    renderTabPage('leave');
    expect(screen.getByText('LearnerView')).toBeInTheDocument();
  });

  it('defaults to LearnerRequestsView when config data is null', () => {
    useConfig.mockReturnValue({ data: null });
    renderTabPage('leave');
    expect(screen.getByText('LearnerView')).toBeInTheDocument();
  });
});

// ─── Admin audit log tab toggle ───────────────────────────────────────────────

describe('RequestsPage admin audit log toggle', () => {
  beforeEach(() => {
    useConfig.mockReturnValue({ data: { user_role: 'admin' } });
  });

  it('shows Requests and Audit Log tabs for admin', () => {
    renderLayout();
    expect(screen.getByRole('tab', { name: /^requests$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^audit log$/i })).toBeInTheDocument();
  });

  it('does not show tab toggle for non-admin', () => {
    useConfig.mockReturnValue({ data: { user_role: 'learner' } });
    renderLayout();
    expect(screen.queryByRole('button', { name: /^audit log$/i })).not.toBeInTheDocument();
  });

  it('switches to audit log view when Audit Log tab is clicked', () => {
    renderLayout();
    fireEvent.click(screen.getByRole('tab', { name: /^audit log$/i }));
    expect(screen.getByTestId('audit-log-table')).toBeInTheDocument();
    // Sub-nav links should no longer be visible
    expect(screen.queryByRole('link', { name: 'Leaves' })).not.toBeInTheDocument();
  });
});
