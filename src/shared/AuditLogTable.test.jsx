import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import AuditLogTable from './AuditLogTable';

jest.mock('./auditLogApi', () => ({ getAuditLogs: jest.fn() }));

const { getAuditLogs } = require('./auditLogApi');

const wrap = (props = {}) => render(
  <IntlProvider locale="en" messages={{}}>
    <AuditLogTable appLabel="attendance" {...props} />
  </IntlProvider>,
);

beforeEach(() => jest.clearAllMocks());

describe('AuditLogTable', () => {
  it('renders empty state when no logs returned', async () => {
    getAuditLogs.mockResolvedValue({ results: [], count: 0 });
    wrap();
    await waitFor(() => expect(
      screen.getByText(/no activity recorded yet/i),
    ).toBeInTheDocument());
  });

  it('renders a log entry actor name', async () => {
    getAuditLogs.mockResolvedValue({
      results: [
        {
          id: 1,
          timestamp: '2026-09-01T10:00:00Z',
          actor_name: 'admin',
          actor_email: 'admin@fbr.gov',
          actor_role: undefined,
          action: 'created',
          record_type: 'session',
          object_repr: 'Session 1',
          changes: {},
          object_pk: '1',
        },
      ],
      count: 1,
    });
    wrap();
    await waitFor(() => expect(screen.getByText('admin')).toBeInTheDocument());
  });

  it('action filter dropdown is rendered', async () => {
    getAuditLogs.mockResolvedValue({ results: [], count: 0 });
    wrap();
    // The select is rendered immediately (before the async load resolves).
    const select = document.querySelector('select');
    expect(select).not.toBeNull();
  });
});
