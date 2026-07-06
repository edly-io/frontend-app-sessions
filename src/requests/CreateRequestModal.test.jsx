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
  getProgramDates: jest.fn().mockResolvedValue([]),
}));
jest.mock('./api', () => ({
  createRequest: jest.fn().mockResolvedValue({}),
  getLeaveUsage: jest.fn().mockResolvedValue({ threshold: 7, leaves: [] }),
}));
jest.mock('../app/useConfig', () => ({
  useConfig: jest.fn(() => ({ data: { user_role: 'learner' } })),
}));

const { createRequest } = require('./api');
const { useConfig } = require('../app/useConfig');

const scrollIntoViewMock = jest.fn();

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

beforeEach(() => {
  jest.clearAllMocks();
  useConfig.mockReturnValue({ data: { user_role: 'learner' } });
  scrollIntoViewMock.mockReset();
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoViewMock,
  });
});

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

  it('enables Submit once dates and reason are entered (no sessions required)', () => {
    renderModal();
    switchToLeave();
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-07-03' } });
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

// ─── Attachment required for MED / EMER ───────────────────────────────────

describe('attachment requirement for MED/EMER categories', () => {
  const switchToLeave = () => {
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'leave' } });
  };

  const selectCategory = (value) => {
    // After switching to leave: combobox[1] = leave category selector
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value } });
  };

  const fillDatesAndReason = () => {
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-07-03' } });
    fireEvent.change(
      screen.getByPlaceholderText(/explain why you are making this request/i),
      { target: { value: 'Medical visit' } },
    );
  };

  it('keeps Submit disabled for MED category when no attachment is provided', () => {
    renderModal();
    switchToLeave();
    selectCategory('MED');
    fillDatesAndReason();
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('keeps Submit disabled for EMER category when no attachment is provided', () => {
    renderModal();
    switchToLeave();
    selectCategory('EMER');
    fillDatesAndReason();
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('enables Submit for CASUAL category without attachment', () => {
    renderModal();
    switchToLeave();
    selectCategory('CASUAL');
    fillDatesAndReason();
    expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
  });

  it('shows required asterisk for MED category attachment label', () => {
    renderModal();
    switchToLeave();
    selectCategory('MED');
    expect(screen.getByText('Attachment')).toBeInTheDocument();
    expect(document.querySelector('.text-danger')).toBeInTheDocument();
  });

  it('shows (optional) text for CASUAL category attachment label', () => {
    renderModal();
    switchToLeave();
    selectCategory('CASUAL');
    expect(screen.getByText('(optional)')).toBeInTheDocument();
  });
});

// ─── Threshold exceeded (422) ─────────────────────────────────────────────

describe('threshold exceeded confirmation', () => {
  const switchToLeaveAndFill = () => {
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'leave' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-07-03' } });
    fireEvent.change(
      screen.getByPlaceholderText(/explain why you are making this request/i),
      { target: { value: 'Sick leave' } },
    );
  };

  it('shows threshold warning when backend returns 422 threshold_exceeded', async () => {
    createRequest.mockRejectedValue({
      response: {
        status: 422,
        data: {
          error: 'threshold_exceeded',
          detail: 'This request would exceed your leave threshold of 5 days.',
          current_usage: 4,
          prospective_usage: 2,
          threshold: 5,
        },
      },
    });
    renderModal();
    switchToLeaveAndFill();
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));
    expect(await screen.findByText(/leave threshold would be exceeded/i)).toBeInTheDocument();
    expect(screen.getByText(/This request would exceed your leave threshold/i)).toBeInTheDocument();
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('shows Go back and Submit anyway buttons after 422', async () => {
    createRequest.mockRejectedValue({
      response: {
        status: 422,
        data: {
          error: 'threshold_exceeded',
          detail: 'Threshold exceeded.',
          current_usage: 4,
          prospective_usage: 2,
          threshold: 5,
        },
      },
    });
    renderModal();
    switchToLeaveAndFill();
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));
    expect(await screen.findByRole('button', { name: /go back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit anyway/i })).toBeInTheDocument();
  });

  it('Go back dismisses the warning and restores normal footer', async () => {
    createRequest.mockRejectedValue({
      response: {
        status: 422,
        data: {
          error: 'threshold_exceeded',
          detail: 'Threshold exceeded.',
          current_usage: 4,
          prospective_usage: 2,
          threshold: 5,
        },
      },
    });
    renderModal();
    switchToLeaveAndFill();
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /go back/i }));
    expect(screen.queryByText(/leave threshold would be exceeded/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^submit$/i })).toBeInTheDocument();
  });

  it('Submit anyway calls createRequest with override: true', async () => {
    createRequest
      .mockRejectedValueOnce({
        response: {
          status: 422,
          data: {
            error: 'threshold_exceeded',
            detail: 'Threshold exceeded.',
            current_usage: 4,
            prospective_usage: 2,
            threshold: 5,
          },
        },
      })
      .mockResolvedValueOnce({});
    renderModal();
    switchToLeaveAndFill();
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /submit anyway/i }));
    expect(createRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({ override: true }),
    );
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
