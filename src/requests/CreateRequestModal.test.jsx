import React from 'react';
import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import CreateRequestModal from './CreateRequestModal';
import { formatDateTime } from '../shared/utils';

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
  useConfig: () => ({ data: { user_role: 'learner' } }),
}));

const { createRequest } = require('./api');
const { getCalendarSessions } = require('../calendar/api');
const useConfigModule = require('../app/useConfig');

const formatDateTimeWithAt = (value) => (
  formatDateTime(value).replace(/, (?=\d{1,2}:\d{2} [AP]M$)/, ' at ')
);

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

// ─── Session fetch window (exclusive end) ─────────────────────────────────

describe('session fetch window', () => {
  const switchToSessionSpecific = () => {
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'leave' } });
    fireEvent.click(screen.getByLabelText('Session-specific'));
  };

  it('sends end_date as an exclusive bound (+1 day) for a single-day selection', async () => {
    renderModal();
    switchToSessionSpecific();
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-07-13' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-07-13' } });
    await waitFor(() => expect(getCalendarSessions).toHaveBeenCalledWith('2026-07-13', '2026-07-14', 'program-v1:TEST+PROG+2026'));
  });

  it('advances the exclusive end across a month boundary', async () => {
    renderModal();
    switchToSessionSpecific();
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-07-30' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-07-31' } });
    await waitFor(() => expect(getCalendarSessions).toHaveBeenCalledWith('2026-07-30', '2026-08-01', 'program-v1:TEST+PROG+2026'));
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

  it('shows the attachment-required message for MED/EMER but not CASUAL', () => {
    renderModal();
    switchToLeave();
    selectCategory('MED');
    expect(screen.getByText(/require a supporting attachment/i)).toBeInTheDocument();
    selectCategory('CASUAL');
    expect(screen.queryByText(/require a supporting attachment/i)).not.toBeInTheDocument();
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
    const submitButton = await screen.findByRole('button', { name: /^submit$/i });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    fireEvent.click(submitButton);
    expect(await screen.findByText(/leave threshold would be exceeded/i)).toBeInTheDocument();
    expect(screen.getByText(/This request would exceed your leave threshold/i)).toBeInTheDocument();
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
    const submitButton = await screen.findByRole('button', { name: /^submit$/i });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    fireEvent.click(submitButton);
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

describe('instructor full-day leave warning', () => {
  beforeEach(() => {
    useConfigModule.useConfig = () => ({ data: { user_role: 'instructor' } });
    getCalendarSessions.mockResolvedValue({
      sessions: [
        {
          id: 'session-1',
          title: 'Remote Session',
          status: 'scheduled',
          scheduled_start_time: '2026-07-02T10:00:00Z',
        },
      ],
    });
  });

  afterEach(() => {
    useConfigModule.useConfig = () => ({ data: { user_role: 'learner' } });
  });

  it('shows a warning and submit anyway action before creating the leave', async () => {
    renderModal();
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'leave' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-07-02' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-07-02' } });
    fireEvent.change(
      screen.getByPlaceholderText(/explain why you are making this request/i),
      { target: { value: 'Need a day off' } },
    );

    const submitButton = await screen.findByRole('button', { name: /^submit$/i });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    fireEvent.click(submitButton);

    expect(await screen.findByText(/scheduled sessions during leave/i)).toBeInTheDocument();
    expect(screen.getByText(/you have a scheduled session during this leave period/i)).toBeInTheDocument();
    expect(screen.getAllByText(/remote session/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/you can still submit this leave request if needed/i)).toBeInTheDocument();
    expect(createRequest).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /submit anyway/i }));

    expect(createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'leave',
        leave_type: 'full_day',
      }),
    );
  });
});

// ─── Overlapping leave rejection (400) ─────────────────────────────────────

describe('overlapping leave rejection', () => {
  const switchToLeaveAndFill = () => {
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'leave' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-08-05' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-08-10' } });
    fireEvent.change(
      screen.getByPlaceholderText(/explain why you are making this request/i),
      { target: { value: 'Need leave' } },
    );
  };

  it('shows overlapping leave details using mapped labels', async () => {
    createRequest.mockRejectedValue({
      response: {
        status: 400,
        data: {
          error: 'overlapping_leave',
          detail: 'Your applied leave dates overlap with the following leave(s).',
          overlapping_leaves: [
            {
              id: 'leave-1',
              category: 'MED',
              leave_type: 'full_day',
              leave_start_date: '2026-08-01',
              leave_end_date: '2026-08-07',
              applied_on: '2026-07-28T09:15:00Z',
              status: 'APPROVED',
            },
            {
              id: 'leave-2',
              category: 'EMER',
              leave_type: 'session_specific',
              leave_start_date: '2026-08-05',
              leave_end_date: '2026-08-05',
              applied_on: '2026-07-29T10:00:00Z',
              status: 'WITHDRAWAL_PENDING',
            },
          ],
        },
      },
    });

    renderModal();
    switchToLeaveAndFill();
    const submitButton = await screen.findByRole('button', { name: /^submit$/i });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    fireEvent.click(submitButton);
    await waitFor(() => expect(createRequest).toHaveBeenCalled());

    expect(await screen.findByText('Leave dates overlap', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/your selected leave dates overlap with an existing leave request/i)).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/Medical Leave/);
    expect(items[0]).toHaveTextContent(/Full day/);
    expect(items[0]).toHaveTextContent(/Approved/);
    expect(items[0]).toHaveTextContent(/Date: Aug 1, 2026 - Aug 7, 2026/);
    expect(items[0]).toHaveTextContent(`Applied on: ${formatDateTimeWithAt('2026-07-28T09:15:00Z')}`);
    expect(items[1]).toHaveTextContent(/Emergency Leave/);
    expect(items[1]).toHaveTextContent(/Session-specific/);
    expect(items[1]).toHaveTextContent(/Withdrawal Under Review/);
    expect(items[1]).toHaveTextContent(/Date: Aug 5, 2026/);
    expect(items[1]).toHaveTextContent(`Applied on: ${formatDateTimeWithAt('2026-07-29T10:00:00Z')}`);
  });

  it('keeps the normal submit footer for overlap errors', async () => {
    createRequest.mockRejectedValue({
      response: {
        status: 400,
        data: {
          error: 'overlapping_leave',
          detail: 'Your applied leave dates overlap with the following leave(s).',
          overlapping_leaves: [],
        },
      },
    });

    renderModal();
    switchToLeaveAndFill();
    const submitButton = await screen.findByRole('button', { name: /^submit$/i });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    fireEvent.click(submitButton);
    await waitFor(() => expect(createRequest).toHaveBeenCalled());

    expect(await screen.findByText('Leave dates overlap', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit anyway/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^submit$/i })).toBeInTheDocument();
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
