import React from 'react';
import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import ScheduleMeetingModal from './ScheduleMeetingModal';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('./api', () => ({
  createSession: jest.fn(),
  updateSession: jest.fn(),
  correctSession: jest.fn(),
  fetchProgramCourses: jest.fn(),
  fetchProgramInstructors: jest.fn(),
  getSessionsConfig: jest.fn(),
}));
jest.mock('../locations/api', () => ({ getLocations: jest.fn() }));
jest.mock('../requests/api', () => ({ getApprovedLeaves: jest.fn() }));

const {
  createSession, updateSession, correctSession,
  fetchProgramCourses, fetchProgramInstructors, getSessionsConfig,
} = require('./api');
const { getLocations } = require('../locations/api');
const { getApprovedLeaves } = require('../requests/api');

// jsdom has no layout, so the modal's scroll-into-view calls would throw.
Element.prototype.scrollIntoView = jest.fn();

const COURSE = { course_key: 'course-v1:X+Y+Z', display_name: 'Intro to Python' };
const INSTRUCTOR = {
  id: 7, first_name: 'Alice', last_name: 'Smith', username: 'alice', email: 'alice@example.com',
};
const LOCATION = { id: 3, name: 'Room A' };

const wrap = (props = {}) => render(
  <IntlProvider locale="en" messages={{}}>
    <ScheduleMeetingModal
      isOpen
      onClose={jest.fn()}
      onSuccess={jest.fn()}
      programKey="prog-1"
      session={null}
      holidays={[]}
      {...props}
    />
  </IntlProvider>,
);

beforeEach(() => {
  jest.clearAllMocks();
  fetchProgramCourses.mockResolvedValue([COURSE]);
  fetchProgramInstructors.mockResolvedValue([INSTRUCTOR]);
  getLocations.mockResolvedValue({ results: [LOCATION] });
  getSessionsConfig.mockResolvedValue({
    session_types: [
      { value: 'session', label: 'Session' },
      { value: 'orientation', label: 'Orientation' },
    ],
  });
  getApprovedLeaves.mockResolvedValue([]);
  createSession.mockResolvedValue({ id: 1 });
  updateSession.mockResolvedValue({ id: 1 });
  correctSession.mockResolvedValue({ id: 1 });
});

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** A local YYYY-MM-DD at least two weeks ahead, landing on the given JS weekday (0=Sun). */
const futureDateOn = (jsWeekday) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 14);
  d.setDate(d.getDate() + ((jsWeekday - d.getDay() + 7) % 7));
  return d.toLocaleDateString('en-CA');
};

const MONDAY = futureDateOn(1);
const SATURDAY = futureDateOn(6);
const SUNDAY = futureDateOn(0);

const isoAt = (date, time) => new Date(`${date}T${time}`).toISOString();

// ─── Form helpers ─────────────────────────────────────────────────────────────

// Paragon's Form.Group rewrites the id of a Form.Control, so the single-select
// inputs are reachable by label and the multi-select (a bare input) by its id.
const courseInput = () => screen.getByLabelText(/^Course/);
const locationInput = () => screen.getByLabelText(/^Location/);
const instructorInput = () => document.getElementById('session-instructor');

const selectFromSearchable = async (getInput, optionLabel) => {
  fireEvent.focus(getInput());
  const option = await screen.findByText(optionLabel);
  fireEvent.mouseDown(option);
};

const dateInputs = () => document.querySelectorAll('input[type="date"]');

const fillRequiredFields = async ({
  startDate = MONDAY, startTime = '10:00', endDate = startDate, endTime = '11:00',
} = {}) => {
  fireEvent.change(screen.getByPlaceholderText('e.g., Week 5 Live Session'), {
    target: { name: 'title', value: 'Week 5 Live Session' },
  });
  await selectFromSearchable(courseInput, COURSE.display_name);
  await selectFromSearchable(instructorInput, 'Alice Smith');
  await selectFromSearchable(locationInput, LOCATION.name);
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: startDate } });
  fireEvent.change(screen.getByLabelText('Start time'), { target: { value: startTime } });
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: endDate } });
  fireEvent.change(screen.getByLabelText('End time'), { target: { value: endTime } });
};

const toggleRecurring = () => fireEvent.click(document.getElementById('recurring-meeting-toggle'));
const toggleZoom = () => fireEvent.click(document.getElementById('create-zoom-meeting-toggle'));
const submitCreate = () => fireEvent.click(screen.getByRole('button', { name: /^create session$/i }));
const submitUpdate = () => fireEvent.click(screen.getByRole('button', { name: /^update session$/i }));

const lastCreatePayload = () => createSession.mock.calls[createSession.mock.calls.length - 1][0];

// ─── Create: non-recurring ────────────────────────────────────────────────────

describe('create mode — non-recurring', () => {
  it('sends a single-session payload with is_recurring false and no recurrence', async () => {
    wrap();
    await fillRequiredFields();
    submitCreate();

    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    const payload = lastCreatePayload();
    expect(payload).toMatchObject({
      program_key: 'prog-1',
      session_type: 'session',
      course_id: COURSE.course_key,
      title: 'Week 5 Live Session',
      scheduled_start_time: isoAt(MONDAY, '10:00'),
      scheduled_end_time: isoAt(MONDAY, '11:00'),
      instructor_emails: [INSTRUCTOR.email],
      location_id: LOCATION.id,
      create_zoom_meeting: false,
      is_recurring: false,
    });
    expect(payload).not.toHaveProperty('recurrence');
  });

  it('calls onSuccess with the created session', async () => {
    const onSuccess = jest.fn();
    createSession.mockResolvedValue({ id: 42, title: 'Week 5 Live Session' });
    wrap({ onSuccess });
    await fillRequiredFields();
    submitCreate();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ id: 42, title: 'Week 5 Live Session' }));
  });
});

// ─── Create: recurring ────────────────────────────────────────────────────────

describe('create mode — recurring', () => {
  it('sends recurrence rules for an in-person series (Zoom off)', async () => {
    wrap();
    await fillRequiredFields();
    toggleRecurring();
    submitCreate();

    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    expect(lastCreatePayload()).toMatchObject({
      create_zoom_meeting: false,
      is_recurring: true,
      recurrence: {
        repeat_interval: 1, type: 2, weekly_days: '2', end_times: 10,
      },
    });
  });

  it('sends the same recurrence rules when Zoom is on', async () => {
    wrap();
    await fillRequiredFields();
    toggleZoom();
    toggleRecurring();
    submitCreate();

    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    expect(lastCreatePayload()).toMatchObject({
      create_zoom_meeting: true,
      is_recurring: true,
      recurrence: {
        repeat_interval: 1, type: 2, weekly_days: '2', end_times: 10,
      },
    });
  });

  it('seeds weekly_days to Saturday (7) from a Saturday start date', async () => {
    wrap();
    await fillRequiredFields({ startDate: SATURDAY });
    toggleRecurring();
    submitCreate();

    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    expect(lastCreatePayload().recurrence.weekly_days).toBe('7');
  });

  it('seeds weekly_days to Sunday (1) from a Sunday start date', async () => {
    wrap();
    await fillRequiredFields({ startDate: SUNDAY });
    toggleRecurring();
    submitCreate();

    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    expect(lastCreatePayload().recurrence.weekly_days).toBe('1');
  });

  it('sends multiple weekdays sorted and comma-joined', async () => {
    wrap();
    await fillRequiredFields(); // Monday start seeds [2]
    toggleRecurring();
    // Add Friday (6) then Wednesday (4) — out of order on purpose.
    fireEvent.click(screen.getByRole('button', { name: 'F' }));
    fireEvent.click(screen.getByRole('button', { name: 'W' }));
    submitCreate();

    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    expect(lastCreatePayload().recurrence.weekly_days).toBe('2,4,6');
  });

  it('sends type 1 with no weekly_days for a daily series', async () => {
    wrap();
    await fillRequiredFields();
    toggleRecurring();
    fireEvent.change(screen.getByDisplayValue('week'), { target: { value: 'daily' } });
    submitCreate();

    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    const { recurrence } = lastCreatePayload();
    expect(recurrence.type).toBe(1);
    expect(recurrence).not.toHaveProperty('weekly_days');
  });

  it('sends type 3 with monthly_day for a monthly day-of-month series', async () => {
    const startDate = futureDateOn(1);
    wrap();
    await fillRequiredFields({ startDate });
    toggleRecurring();
    fireEvent.change(screen.getByDisplayValue('week'), { target: { value: 'monthly' } });
    submitCreate();

    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    const { recurrence } = lastCreatePayload();
    expect(recurrence.type).toBe(3);
    const dayOfMonth = Number(startDate.slice(8, 10));
    if (dayOfMonth <= 28) {
      expect(recurrence.monthly_day).toBe(dayOfMonth);
    } else {
      // Day 29-31 forces the weekday pattern — it does not exist in every month.
      expect(recurrence).not.toHaveProperty('monthly_day');
      expect(recurrence.monthly_week_day).toBe(2);
    }
  });

  it('sends end_date_time instead of end_times when Ends-on is chosen', async () => {
    const endDate = futureDateOn(1); // a Monday ~2 weeks out; within the 2-month cap
    wrap();
    await fillRequiredFields();
    toggleRecurring();
    fireEvent.change(dateInputs()[2], { target: { value: endDate } });
    submitCreate();

    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    const { recurrence } = lastCreatePayload();
    expect(recurrence.end_date_time).toBe(new Date(`${endDate}T23:59:59`).toISOString());
    expect(recurrence).not.toHaveProperty('end_times');
  });

  it('clamps the occurrence count to 30', async () => {
    wrap();
    await fillRequiredFields();
    toggleRecurring();
    const countInput = screen.getByDisplayValue('10');
    fireEvent.change(countInput, { target: { value: '45' } });
    expect(countInput.value).toBe('30');
  });
});

// ─── Create: recurrence validation ────────────────────────────────────────────

describe('recurrence validation', () => {
  it('blocks a weekly series with no weekday selected', async () => {
    wrap();
    await fillRequiredFields();
    toggleRecurring();
    fireEvent.click(screen.getByRole('button', { name: 'M' })); // deselect the seeded Monday
    submitCreate();

    await waitFor(() => expect(screen.getByText('Select at least one weekday')).toBeInTheDocument());
    expect(createSession).not.toHaveBeenCalled();
  });

  it('blocks an end date earlier than the start date', async () => {
    const past = '2020-01-01';
    wrap();
    await fillRequiredFields();
    toggleRecurring();
    fireEvent.change(dateInputs()[2], { target: { value: past } });
    submitCreate();

    await waitFor(() => expect(screen.getByText('End date must be after the start date')).toBeInTheDocument());
    expect(createSession).not.toHaveBeenCalled();
  });

  it('blocks an end date more than 2 months past the start date', async () => {
    const far = new Date(`${MONDAY}T12:00:00`);
    far.setMonth(far.getMonth() + 4);
    wrap();
    await fillRequiredFields();
    toggleRecurring();
    fireEvent.change(dateInputs()[2], { target: { value: far.toLocaleDateString('en-CA') } });
    submitCreate();

    await waitFor(() => expect(
      screen.getByText('End date cannot be more than 2 months from the start date.'),
    ).toBeInTheDocument());
    expect(createSession).not.toHaveBeenCalled();
  });
});

// ─── Create: base validation ──────────────────────────────────────────────────

describe('base validation', () => {
  it('requires a title', async () => {
    wrap();
    await fillRequiredFields();
    fireEvent.change(screen.getByPlaceholderText('e.g., Week 5 Live Session'), {
      target: { name: 'title', value: '' },
    });
    submitCreate();

    await waitFor(() => expect(screen.getByText('Title is required')).toBeInTheDocument());
    expect(createSession).not.toHaveBeenCalled();
  });

  it('rejects a duration that is not 60, 90 or 120 minutes', async () => {
    wrap();
    await fillRequiredFields({ endTime: '10:45' });
    submitCreate();

    await waitFor(() => expect(
      screen.getByText('Session duration must be 1 hour, 1 hour 30 minutes, or 2 hours'),
    ).toBeInTheDocument());
    expect(createSession).not.toHaveBeenCalled();
  });

  it('rejects a start time in the past', async () => {
    wrap();
    await fillRequiredFields({ startDate: '2020-01-06' });
    submitCreate();

    await waitFor(() => expect(screen.getByText('Start time must be in the future')).toBeInTheDocument());
    expect(createSession).not.toHaveBeenCalled();
  });
});

// ─── Edit mode ────────────────────────────────────────────────────────────────

describe('edit mode', () => {
  const futureSession = () => ({
    id: 9,
    title: 'Week 5 Live Session',
    description: 'notes',
    session_type: 'session',
    course_id: COURSE.course_key,
    instructor_emails: [INSTRUCTOR.email],
    location: { id: LOCATION.id, name: LOCATION.name },
    scheduled_start_time: new Date(`${MONDAY}T10:00`).toISOString(),
    scheduled_end_time: new Date(`${MONDAY}T11:00`).toISOString(),
    is_recurring: true,
    recurrence: {
      type: 2, repeat_interval: 1, weekly_days: '2', end_times: 4,
    },
  });

  it('never resends recurrence rules — an edit applies to one occurrence', async () => {
    wrap({ session: futureSession() });
    await screen.findByText('Alice Smith'); // wait for the instructor prefill
    submitUpdate();

    await waitFor(() => expect(updateSession).toHaveBeenCalledTimes(1));
    const [sessionId, payload] = updateSession.mock.calls[0];
    expect(sessionId).toBe(9);
    expect(payload).not.toHaveProperty('is_recurring');
    expect(payload).not.toHaveProperty('recurrence');
    expect(payload).toMatchObject({
      title: 'Week 5 Live Session',
      course_id: COURSE.course_key,
      instructor_emails: [INSTRUCTOR.email],
      location_id: LOCATION.id,
    });
  });

  it('locks the Recurring checkbox on an existing series', async () => {
    wrap({ session: futureSession() });
    await screen.findByText('Alice Smith');
    const checkbox = document.getElementById('recurring-meeting-toggle');
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
  });

  it('prefills the recurrence panel from the session rules', async () => {
    wrap({ session: futureSession() });
    await screen.findByText('Alice Smith');
    expect(screen.getByDisplayValue('week')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
  });
});

// ─── Past session (correction mode) ───────────────────────────────────────────

describe('correction mode', () => {
  const pastSession = {
    id: 11,
    title: 'Old Session',
    session_type: 'session',
    course_id: COURSE.course_key,
    instructor_emails: [INSTRUCTOR.email],
    location: { id: LOCATION.id, name: LOCATION.name },
    scheduled_start_time: '2020-01-06T10:00:00.000Z',
    scheduled_end_time: '2020-01-06T11:00:00.000Z',
  };

  it('sends only the changed fields through correctSession', async () => {
    wrap({ session: pastSession });
    await screen.findByText('Alice Smith');
    // Drop the location — the only change.
    fireEvent.change(locationInput(), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /^save corrections$/i }));

    await waitFor(() => expect(correctSession).toHaveBeenCalledTimes(1));
    expect(correctSession).toHaveBeenCalledWith(11, { location_id: null });
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('refuses to save when nothing changed', async () => {
    wrap({ session: pastSession });
    await screen.findByText('Alice Smith');
    fireEvent.click(screen.getByRole('button', { name: /^save corrections$/i }));

    await waitFor(() => expect(
      screen.getByText('No changes detected. Update the course, instructors, or location before saving.'),
    ).toBeInTheDocument());
    expect(correctSession).not.toHaveBeenCalled();
  });
});

// ─── Description-only mode ────────────────────────────────────────────────────

describe('description-only mode', () => {
  it('sends only the description and skips the admin-only lookups', async () => {
    const session = {
      id: 12,
      title: 'Week 5 Live Session',
      description: 'old notes',
      course_id: COURSE.course_key,
      course_name: 'Intro to Python',
      instructor_names: ['Alice Smith'],
      instructor_emails: [INSTRUCTOR.email],
      scheduled_start_time: new Date(`${MONDAY}T10:00`).toISOString(),
      scheduled_end_time: new Date(`${MONDAY}T11:00`).toISOString(),
    };
    wrap({ session, descriptionOnly: true });
    fireEvent.change(screen.getByPlaceholderText('Add session details...'), {
      target: { name: 'description', value: 'new notes' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^update session$/i }));

    await waitFor(() => expect(updateSession).toHaveBeenCalledWith(12, { description: 'new notes' }));
    expect(fetchProgramCourses).not.toHaveBeenCalled();
    expect(fetchProgramInstructors).not.toHaveBeenCalled();
  });
});

// ─── Conflict handling (HTTP 409) ─────────────────────────────────────────────

describe('conflict handling', () => {
  const reject409 = (data) => {
    const err = new Error('conflict');
    err.response = { status: 409, data };
    return err;
  };

  it('shows a hard conflict and offers no override', async () => {
    createSession.mockRejectedValue(reject409({
      conflict_type: 'ROOM_DOUBLE_BOOKING',
      message: 'Room A is already booked (occurrence on 2026-10-05)',
      override_allowed: false,
      affected_entities: [{ type: 'room', name: 'Room A', session_title: 'Other Session' }],
      resolution_hints: [],
    }));
    wrap();
    await fillRequiredFields();
    toggleRecurring();
    submitCreate();

    await waitFor(() => expect(
      screen.getByText('Room A is already booked (occurrence on 2026-10-05)'),
    ).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /proceed anyway/i })).not.toBeInTheDocument();
  });

  it('resubmits with acknowledge:true when the admin proceeds past a soft conflict', async () => {
    createSession
      .mockRejectedValueOnce(reject409({
        conflict_type: 'PROTECTED_DATE',
        message: 'Eid al-Fitr is a public holiday on this date',
        override_allowed: true,
        affected_entities: [],
        resolution_hints: [],
      }))
      .mockResolvedValueOnce({ id: 77 });
    const onSuccess = jest.fn();
    wrap({ onSuccess });
    await fillRequiredFields();
    submitCreate();

    const proceed = await screen.findByRole('button', { name: /proceed anyway/i });
    fireEvent.click(proceed);

    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(2));
    expect(lastCreatePayload()).toMatchObject({ acknowledge: true });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ id: 77 }));
  });

  it('shows a plain error for a non-409 failure', async () => {
    createSession.mockRejectedValue({ response: { status: 500, data: { detail: 'Zoom unavailable' } } });
    wrap();
    await fillRequiredFields();
    submitCreate();

    await waitFor(() => expect(screen.getByText('Zoom unavailable')).toBeInTheDocument());
  });
});

// ─── Soft scheduling warnings ─────────────────────────────────────────────────

describe('scheduling warnings', () => {
  it('warns on a weekend start date without blocking', async () => {
    wrap();
    await fillRequiredFields({ startDate: SATURDAY });
    expect(screen.getByText(/Saturday is a weekend day/)).toBeInTheDocument();
    submitCreate();
    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
  });

  it('warns on a public holiday start date without blocking', async () => {
    wrap({
      holidays: [{
        id: 1, name: 'Eid al-Fitr', start_date: MONDAY, end_date: MONDAY,
      }],
    });
    await fillRequiredFields();
    expect(screen.getByText(/Eid al-Fitr is a public holiday/)).toBeInTheDocument();
    submitCreate();
    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
  });

  it('blocks an instructor who is on approved leave that day', async () => {
    getApprovedLeaves.mockResolvedValue([{
      submitter_email: INSTRUCTOR.email,
      leave_start_date: MONDAY,
      leave_end_date: MONDAY,
    }]);
    wrap();
    await fillRequiredFields();
    submitCreate();

    await waitFor(() => expect(createSession).not.toHaveBeenCalled());
    expect(screen.getAllByText(/is on approved leave on this date/).length).toBeGreaterThan(0);
  });
});
