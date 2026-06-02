import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import CreateRequestModal from './CreateRequestModal';

// jest-dom v6 doesn't auto-extend when imported via babel-jest; extend manually.
// eslint-disable-next-line import/no-extraneous-dependencies
const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('../calendar/api', () => ({
  getCalendarSessions: jest.fn().mockResolvedValue({ sessions: [] }),
}));
jest.mock('./api', () => ({
  createRequest: jest.fn().mockResolvedValue({}),
}));

const renderModal = (props = {}) => render(
  <IntlProvider locale="en" messages={{}}>
    <CreateRequestModal
      isOpen
      onClose={jest.fn()}
      programKey="program-v1:TEST+PROG+2026"
      onSuccess={jest.fn()}
      {...props}
    />
  </IntlProvider>,
);

beforeEach(() => jest.clearAllMocks());

// ─── Full-day leave ────────────────────────────────────────────────────────

describe('full-day leave', () => {
  const switchToLeave = () => {
    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: 'leave' },
    });
    // Default leave mode is full_day — no further action needed
  };

  it('hides the session picker', () => {
    renderModal();
    switchToLeave();
    expect(screen.queryByText('Select sessions')).not.toBeInTheDocument();
  });

  it('enables Submit once a reason is entered (no sessions required)', () => {
    renderModal();
    switchToLeave();
    fireEvent.change(
      screen.getByPlaceholderText(/explain why you are making this request/i),
      { target: { value: 'Travelling' } },
    );
    expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
  });

  it('keeps Submit disabled when reason is empty', () => {
    renderModal();
    switchToLeave();
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });
});

// ─── Session-specific leave ────────────────────────────────────────────────

describe('session-specific leave', () => {
  it('shows the session picker', () => {
    renderModal();
    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: 'leave' },
    });
    fireEvent.click(screen.getByLabelText('Session-specific'));
    expect(screen.getByText('Select sessions')).toBeInTheDocument();
  });

  it('keeps Submit disabled with no sessions selected even when reason is filled', () => {
    renderModal();
    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: 'leave' },
    });
    fireEvent.click(screen.getByLabelText('Session-specific'));
    fireEvent.change(
      screen.getByPlaceholderText(/explain why you are making this request/i),
      { target: { value: 'Reason given' } },
    );
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });
});

// ─── Remote session (default) ──────────────────────────────────────────────

describe('remote session (default type)', () => {
  it('shows the session picker by default', () => {
    renderModal();
    expect(screen.getByText('Select sessions')).toBeInTheDocument();
  });

  it('keeps Submit disabled when no sessions are selected even with reason filled', () => {
    renderModal();
    fireEvent.change(
      screen.getByPlaceholderText(/explain why you are making this request/i),
      { target: { value: 'Need remote access' } },
    );
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });
});
