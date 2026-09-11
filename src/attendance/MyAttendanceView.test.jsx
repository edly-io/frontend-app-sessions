import React from 'react';
import {
  render, screen, waitFor, fireEvent,
} from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MyAttendanceView from './MyAttendanceView';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('./api', () => ({
  getMyAttendanceRecords: jest.fn(),
  getCourseSessionsList: jest.fn(),
  getNoCourseSessionsList: jest.fn(),
}));

jest.mock('../calendar/api', () => ({
  fetchProgramCourses: jest.fn(),
}));

const {
  getMyAttendanceRecords, getCourseSessionsList, getNoCourseSessionsList,
} = require('./api');
const { fetchProgramCourses } = require('../calendar/api');

const PROGRAM_ID = 'program-v1:Org+Test+2026';
const COURSE_KEY = 'course-v1:Org+CS101+Run';
const COURSE_LABEL = 'Python Basics Course';

const wrap = () => render(
  <IntlProvider locale="en" messages={{}}>
    <MemoryRouter initialEntries={[`/${PROGRAM_ID}/attendance/me`]}>
      <Routes>
        <Route path="/:programId/attendance/me" element={<MyAttendanceView />} />
      </Routes>
    </MemoryRouter>
  </IntlProvider>,
);

// Wait for the spinner to disappear then open the dropdown and pick a course.
const selectCourse = async () => {
  await waitFor(() => expect(screen.getByLabelText('Course')).toBeInTheDocument());
  fireEvent.focus(screen.getByLabelText('Course'));
  await waitFor(() => expect(
    screen.getByRole('option', { name: COURSE_LABEL }),
  ).toBeInTheDocument());
  fireEvent.mouseDown(screen.getByRole('option', { name: COURSE_LABEL }));
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchProgramCourses.mockResolvedValue([
    { course_key: COURSE_KEY, display_name: COURSE_LABEL },
  ]);
  getCourseSessionsList.mockResolvedValue({ count: 0, results: [] });
  getNoCourseSessionsList.mockResolvedValue({ count: 0, results: [] });
});

// The no-course option sits before the courses in the dropdown.
const selectNoCourse = async () => {
  await waitFor(() => expect(screen.getByLabelText('Course')).toBeInTheDocument());
  fireEvent.focus(screen.getByLabelText('Course'));
  await waitFor(() => expect(
    screen.getByRole('option', { name: 'Sessions without a course' }),
  ).toBeInTheDocument());
  fireEvent.mouseDown(screen.getByRole('option', { name: 'Sessions without a course' }));
};

it('shows loading spinner initially', () => {
  getMyAttendanceRecords.mockReturnValue(new Promise(() => {}));
  fetchProgramCourses.mockReturnValue(new Promise(() => {}));
  wrap();
  expect(screen.getByText(/loading your attendance/i)).toBeInTheDocument();
});

it('shows course selector prompt after loading with no records', async () => {
  getMyAttendanceRecords.mockResolvedValue({ results: [], count: 0 });
  wrap();
  await waitFor(() => expect(
    screen.getByText(/select a course above to see your attendance/i),
  ).toBeInTheDocument());
});

it('renders attendance records table when data is available', async () => {
  getMyAttendanceRecords.mockResolvedValue({
    results: [{
      id: 1,
      session: 'session-uuid-1',
      session_title: 'Python Basics',
      session_date: '2026-06-01T10:00:00Z',
      course_id: COURSE_KEY,
      status: 'present',
      is_overridden: false,
      override_reason: '',
    }],
    count: 1,
  });
  getCourseSessionsList.mockResolvedValue({
    results: [{
      id: 'session-uuid-1',
      title: 'Python Basics',
      scheduled_start_time: '2026-06-01T10:00:00Z',
      status: 'completed',
      marking_window_open: false,
    }],
  });
  wrap();
  await selectCourse();
  await waitFor(() => expect(screen.getByText('Python Basics')).toBeInTheDocument());
  expect(screen.getByText('Present')).toBeInTheDocument();
});

it('shows absent badge for absent status', async () => {
  getMyAttendanceRecords.mockResolvedValue({
    results: [{
      id: 2,
      session: 'session-uuid-2',
      session_title: 'Session 2',
      session_date: '2026-06-02T10:00:00Z',
      course_id: COURSE_KEY,
      status: 'absent',
      is_overridden: false,
      override_reason: '',
    }],
    count: 1,
  });
  getCourseSessionsList.mockResolvedValue({
    results: [{
      id: 'session-uuid-2',
      title: 'Session 2',
      scheduled_start_time: '2026-06-02T10:00:00Z',
      status: 'completed',
      marking_window_open: false,
    }],
  });
  wrap();
  await selectCourse();
  await waitFor(() => expect(screen.getByText('Absent')).toBeInTheDocument());
});

it('shows override reason note when record is overridden', async () => {
  getMyAttendanceRecords.mockResolvedValue({
    results: [{
      id: 3,
      session: 'session-uuid-3',
      session_title: 'Session 3',
      session_date: '2026-06-03T10:00:00Z',
      course_id: COURSE_KEY,
      status: 'present',
      is_overridden: true,
      override_reason: 'Manual override by instructor',
    }],
    count: 1,
  });
  getCourseSessionsList.mockResolvedValue({
    results: [{
      id: 'session-uuid-3',
      title: 'Session 3',
      scheduled_start_time: '2026-06-03T10:00:00Z',
      status: 'completed',
      marking_window_open: false,
    }],
  });
  wrap();
  await selectCourse();
  await waitFor(() => expect(
    screen.getByText('Manual override by instructor'),
  ).toBeInTheDocument());
});

it('pages course sessions on the server', async () => {
  getMyAttendanceRecords.mockResolvedValue({ results: [], count: 0 });
  getCourseSessionsList.mockImplementation(
    (courseKey, programKey, { page } = {}) => Promise.resolve({
      count: 30,
      next: null,
      previous: null,
      results: [{
        id: `session-page-${page}`,
        title: `Session ${page}`,
        scheduled_start_time: '2026-06-01T10:00:00Z',
        status: 'completed',
        marking_window_open: false,
      }],
    }),
  );
  wrap();
  await selectCourse();
  await waitFor(() => expect(screen.getByText('Session 1')).toBeInTheDocument());
  expect(getCourseSessionsList).toHaveBeenCalledWith(COURSE_KEY, PROGRAM_ID, { page: 1, pageSize: 25 });

  fireEvent.click(screen.getByRole('button', { name: /^next/i }));

  await waitFor(() => expect(screen.getByText('Session 2')).toBeInTheDocument());
  expect(getCourseSessionsList).toHaveBeenLastCalledWith(COURSE_KEY, PROGRAM_ID, { page: 2, pageSize: 25 });
});

it('lists no-course sessions and marks unrecorded ones as not marked', async () => {
  // A seminar the learner was never marked on must still appear — previously
  // the no-course option listed records only, so this row was invisible.
  getMyAttendanceRecords.mockResolvedValue({ results: [], count: 0 });
  getNoCourseSessionsList.mockResolvedValue({
    count: 2,
    results: [
      {
        id: 'seminar-1',
        title: 'Opening Seminar',
        scheduled_start_time: '2026-06-01T10:00:00Z',
        status: 'completed',
        marking_window_open: false,
      },
      {
        id: 'workshop-1',
        title: 'Robotics Workshop',
        scheduled_start_time: '2026-06-02T10:00:00Z',
        status: 'completed',
        marking_window_open: false,
      },
    ],
  });
  wrap();
  await selectNoCourse();

  await waitFor(() => expect(screen.getByText('Opening Seminar')).toBeInTheDocument());
  expect(screen.getByText('Robotics Workshop')).toBeInTheDocument();
  expect(screen.getAllByText('Not marked')).toHaveLength(2);
  expect(getNoCourseSessionsList).toHaveBeenCalledWith(PROGRAM_ID, { page: 1, pageSize: 25 });
});

it('merges a record onto a no-course session', async () => {
  getMyAttendanceRecords.mockResolvedValue({
    results: [{
      id: 9,
      session: 'seminar-1',
      session_title: 'Opening Seminar',
      session_date: '2026-06-01T10:00:00Z',
      course_id: '',
      status: 'present',
      is_overridden: false,
      override_reason: '',
    }],
    count: 1,
  });
  getNoCourseSessionsList.mockResolvedValue({
    count: 1,
    results: [{
      id: 'seminar-1',
      title: 'Opening Seminar',
      scheduled_start_time: '2026-06-01T10:00:00Z',
      status: 'completed',
      marking_window_open: false,
    }],
  });
  wrap();
  await selectNoCourse();

  await waitFor(() => expect(screen.getByText('Opening Seminar')).toBeInTheDocument());
  expect(screen.getByText('Present')).toBeInTheDocument();
  expect(screen.queryByText('Not marked')).not.toBeInTheDocument();
});

it('shows the empty state when the programme has no course-less sessions', async () => {
  getMyAttendanceRecords.mockResolvedValue({ results: [], count: 0 });
  getNoCourseSessionsList.mockResolvedValue({ count: 0, results: [] });
  wrap();
  await selectNoCourse();
  await waitFor(() => expect(
    screen.getByText(/no sessions found yet/i),
  ).toBeInTheDocument());
});

it('shows error message when API call fails', async () => {
  getMyAttendanceRecords.mockRejectedValue({ message: 'Network error' });
  wrap();
  await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
});
