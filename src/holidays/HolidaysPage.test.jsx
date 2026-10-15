import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import HolidaysPage from './HolidaysPage';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('./api', () => ({
  getHolidays: jest.fn(),
  deleteHoliday: jest.fn(),
}));

const { getHolidays } = require('./api');

const wrap = () => render(
  <MemoryRouter>
    <IntlProvider locale="en" messages={{}}>
      <HolidaysPage />
    </IntlProvider>
  </MemoryRouter>,
);

beforeEach(() => jest.clearAllMocks());

// Role gating lives in src/app/RequireAdmin.jsx (see RequireAdmin.test.jsx).
// This suite assumes the user is already an admin — the page is never rendered
// otherwise.
describe('admin', () => {
  it('shows loading spinner initially', () => {
    getHolidays.mockReturnValue(new Promise(() => {}));
    wrap();
    expect(document.querySelector('.spinner-border')).not.toBeNull();
  });

  it('renders holidays table after data loads', async () => {
    getHolidays.mockResolvedValue({
      count: 1,
      results: [{
        id: 1, name: 'Eid al-Fitr', start_date: '2026-04-01', end_date: '2026-04-01', description: '',
      }],
    });
    wrap();
    await waitFor(() => expect(screen.getByText('Eid al-Fitr')).toBeInTheDocument());
  });

  it('shows empty state when no holidays exist', async () => {
    getHolidays.mockResolvedValue({ count: 0, results: [] });
    wrap();
    await waitFor(() => expect(screen.getByText(/no holidays found/i)).toBeInTheDocument());
  });

  it('shows "New holiday" button for admin', async () => {
    getHolidays.mockResolvedValue({ count: 0, results: [] });
    wrap();
    await waitFor(() => expect(screen.getByRole('button', { name: /new holiday/i })).toBeInTheDocument());
  });

  it('shows error message when fetch fails', async () => {
    getHolidays.mockRejectedValue({ response: { data: { detail: 'Server error' } } });
    wrap();
    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
  });
});
