import React from 'react';
import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import LocationModal from './LocationModal';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('./api', () => ({
  createLocation: jest.fn(),
  updateLocation: jest.fn(),
}));

const { createLocation, updateLocation } = require('./api');

const wrap = (props = {}) => render(
  <IntlProvider locale="en" messages={{}}>
    <LocationModal
      isOpen
      onClose={jest.fn()}
      onSuccess={jest.fn()}
      location={null}
      {...props}
    />
  </IntlProvider>,
);

beforeEach(() => jest.clearAllMocks());

// ─── Create mode ──────────────────────────────────────────────────────────────

describe('create mode', () => {
  it('shows "New location" title', () => {
    wrap();
    expect(screen.getByText('New location')).toBeInTheDocument();
  });

  it('shows an error when name is empty on Save', async () => {
    wrap();
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText('Name is required')).toBeInTheDocument());
  });

  it('calls createLocation and onSuccess on valid submit', async () => {
    const onSuccess = jest.fn();
    createLocation.mockResolvedValue({ id: 'loc1', name: 'IRSA 1' });
    wrap({ onSuccess });
    fireEvent.change(screen.getByPlaceholderText(/irsa 1/i), { target: { value: 'IRSA 1' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(createLocation).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'IRSA 1' }),
    ));
    expect(onSuccess).toHaveBeenCalledWith({ id: 'loc1', name: 'IRSA 1' });
  });

  it('includes description and biometric serial in payload', async () => {
    createLocation.mockResolvedValue({ id: 'loc1', name: 'Lab' });
    wrap();
    fireEvent.change(screen.getByPlaceholderText(/irsa 1/i), { target: { value: 'Lab' } });
    fireEvent.change(screen.getByPlaceholderText(/optional — building/i), { target: { value: '2nd floor' } });
    fireEvent.change(screen.getByPlaceholderText(/optional — serial/i), { target: { value: 'BIO-123' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(createLocation).toHaveBeenCalledWith({
      name: 'Lab',
      description: '2nd floor',
      biometric_machine_serial_number: 'BIO-123',
    }));
  });
});

// ─── Edit mode ────────────────────────────────────────────────────────────────

describe('edit mode', () => {
  const existingLocation = {
    id: 'loc2',
    name: 'Hall A',
    description: 'Main hall',
    biometric_machine_serial_number: 'SN-999',
  };

  it('shows "Edit location" title', () => {
    wrap({ location: existingLocation });
    expect(screen.getByText('Edit location')).toBeInTheDocument();
  });

  it('pre-fills the name field', () => {
    wrap({ location: existingLocation });
    expect(screen.getByDisplayValue('Hall A')).toBeInTheDocument();
  });

  it('calls updateLocation on save', async () => {
    updateLocation.mockResolvedValue({ ...existingLocation });
    const onSuccess = jest.fn();
    wrap({ location: existingLocation, onSuccess });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(updateLocation).toHaveBeenCalledWith('loc2', expect.objectContaining({ name: 'Hall A' })));
    expect(onSuccess).toHaveBeenCalled();
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('API error handling', () => {
  it('displays error message when createLocation fails', async () => {
    createLocation.mockRejectedValue({ response: { data: { detail: 'Conflict' } } });
    wrap();
    fireEvent.change(screen.getByPlaceholderText(/irsa 1/i), { target: { value: 'Lab' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText('Conflict')).toBeInTheDocument());
  });
});

// ─── Cancel ───────────────────────────────────────────────────────────────────

it('calls onClose when Cancel is clicked', () => {
  const onClose = jest.fn();
  wrap({ onClose });
  fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
  expect(onClose).toHaveBeenCalled();
});
