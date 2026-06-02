import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import LocationsPage from './LocationsPage';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('../app/useConfig', () => ({ useConfig: jest.fn() }));
jest.mock('./api', () => ({
  getLocations: jest.fn(),
  deleteLocation: jest.fn(),
}));

const { useConfig } = require('../app/useConfig');
const { getLocations } = require('./api');

const wrap = () => render(
  <IntlProvider locale="en" messages={{}}>
    <LocationsPage />
  </IntlProvider>,
);

beforeEach(() => jest.clearAllMocks());

describe('non-admin', () => {
  it('shows admins-only message', async () => {
    useConfig.mockReturnValue({ data: { user_role: 'learner' } });
    wrap();
    await waitFor(() => expect(screen.getByText(/this page is for admins only/i)).toBeInTheDocument());
  });
});

describe('admin', () => {
  beforeEach(() => {
    useConfig.mockReturnValue({ data: { user_role: 'admin' } });
  });

  it('shows loading spinner initially', () => {
    getLocations.mockReturnValue(new Promise(() => {}));
    wrap();
    expect(document.querySelector('.spinner-border')).not.toBeNull();
  });

  it('renders locations table after data loads', async () => {
    getLocations.mockResolvedValue({
      count: 1,
      results: [{ id: 'loc1', name: 'IRSA 1', description: 'Ground floor', biometric_machine_serial_number: '' }],
    });
    wrap();
    await waitFor(() => expect(screen.getByText('IRSA 1')).toBeInTheDocument());
  });

  it('shows empty state when no locations exist', async () => {
    getLocations.mockResolvedValue({ count: 0, results: [] });
    wrap();
    await waitFor(() => expect(screen.getByText(/no locations found/i)).toBeInTheDocument());
  });

  it('shows "New location" button for admin', async () => {
    getLocations.mockResolvedValue({ count: 0, results: [] });
    wrap();
    await waitFor(() => expect(screen.getByRole('button', { name: /new location/i })).toBeInTheDocument());
  });

  it('shows error message when fetch fails', async () => {
    getLocations.mockRejectedValue({ response: { data: { detail: 'Server error' } } });
    wrap();
    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
  });

  it('renders description cell content', async () => {
    getLocations.mockResolvedValue({
      count: 1,
      results: [{ id: 'loc1', name: 'Lab', description: 'Science lab', biometric_machine_serial_number: 'SN-001' }],
    });
    wrap();
    await waitFor(() => expect(screen.getByText('Science lab')).toBeInTheDocument());
    expect(screen.getByText('SN-001')).toBeInTheDocument();
  });
});
