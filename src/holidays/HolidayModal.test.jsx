import React from 'react';
import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import HolidayModal from './HolidayModal';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('./api', () => ({
  createHoliday: jest.fn(),
  updateHoliday: jest.fn(),
}));

const { createHoliday, updateHoliday } = require('./api');

const wrap = (props = {}) => render(
  <IntlProvider locale="en" messages={{}}>
    <HolidayModal
      isOpen
      onClose={jest.fn()}
      onSuccess={jest.fn()}
      holiday={null}
      {...props}
    />
  </IntlProvider>,
);

beforeEach(() => jest.clearAllMocks());

// ─── Create mode ──────────────────────────────────────────────────────────────

describe('create mode', () => {
  it('shows "New holiday" title', () => {
    wrap();
    expect(screen.getByText('New holiday')).toBeInTheDocument();
  });

  it('shows an error when name is empty on Save', async () => {
    wrap();
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText('Name is required')).toBeInTheDocument());
  });

  it('shows an error when start date is missing', async () => {
    wrap();
    fireEvent.change(screen.getByPlaceholderText(/eid al-fitr/i), { target: { value: 'Eid' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText('Start date is required')).toBeInTheDocument());
  });

  it('shows an error when end date is missing', async () => {
    wrap();
    fireEvent.change(screen.getByPlaceholderText(/eid al-fitr/i), { target: { value: 'Eid' } });
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-04-01' } });
    // Clear end date to simulate missing end date (it auto-syncs, so clear it)
    fireEvent.change(dateInputs[1], { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText('End date is required')).toBeInTheDocument());
  });

  it('calls createHoliday and onSuccess on valid form', async () => {
    const onSuccess = jest.fn();
    createHoliday.mockResolvedValue({ id: 1, name: 'Eid' });
    wrap({ onSuccess });
    fireEvent.change(screen.getByPlaceholderText(/eid al-fitr/i), { target: { value: 'Eid' } });
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-04-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-04-02' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(createHoliday).toHaveBeenCalledWith({
      name: 'Eid',
      start_date: '2026-04-01',
      end_date: '2026-04-02',
      description: '',
    }));
    expect(onSuccess).toHaveBeenCalledWith({ id: 1, name: 'Eid' });
  });

  it('auto-syncs end date to start date when start is set later', () => {
    wrap();
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-04-10' } });
    // End date should auto-advance to match start date
    expect(dateInputs[1].value).toBe('2026-04-10');
  });
});

// ─── Edit mode ────────────────────────────────────────────────────────────────

describe('edit mode', () => {
  const existingHoliday = {
    id: 5,
    name: 'National Day',
    start_date: '2026-08-14',
    end_date: '2026-08-14',
    description: 'Independence',
  };

  it('shows "Edit holiday" title', () => {
    wrap({ holiday: existingHoliday });
    expect(screen.getByText('Edit holiday')).toBeInTheDocument();
  });

  it('pre-fills the form with existing holiday data', () => {
    wrap({ holiday: existingHoliday });
    expect(screen.getByDisplayValue('National Day')).toBeInTheDocument();
  });

  it('calls updateHoliday on save', async () => {
    updateHoliday.mockResolvedValue({ ...existingHoliday, name: 'National Day' });
    const onSuccess = jest.fn();
    wrap({ holiday: existingHoliday, onSuccess });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(updateHoliday).toHaveBeenCalledWith(5, expect.objectContaining({ name: 'National Day' })));
    expect(onSuccess).toHaveBeenCalled();
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('API error handling', () => {
  it('shows API error message when createHoliday fails', async () => {
    createHoliday.mockRejectedValue({ response: { data: { detail: 'Server error' } } });
    wrap();
    fireEvent.change(screen.getByPlaceholderText(/eid al-fitr/i), { target: { value: 'Eid' } });
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-04-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-04-01' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
  });
});
