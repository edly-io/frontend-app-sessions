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
}));

jest.mock('../calendar/api', () => ({
  fetchProgramCourses: jest.fn(),
}));

const { getMyAttendanceRecords, getCourseSessionsList } = require('./api');
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
  getCourseSessionsList.mockResolvedValue({ results: [] });
});

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

it('shows error message when API call fails', async () => {
  getMyAttendanceRecords.mockRejectedValue({ message: 'Network error' });
  wrap();
  await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
});
