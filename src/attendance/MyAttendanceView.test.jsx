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
  getMyCourseAttendance: jest.fn(),
}));

jest.mock('../calendar/api', () => ({
  fetchProgramCourses: jest.fn(),
}));

const { getMyCourseAttendance } = require('./api');
const { fetchProgramCourses } = require('../calendar/api');

const PROGRAM_ID = 'program-v1:Org+Test+2026';
const COURSE_KEY = 'course-v1:Org+CS101+Run';
const COURSE_LABEL = 'Python Basics Course';

const row = (overrides = {}) => ({
  id: 1,
  session: 'session-uuid-1',
  session_title: 'Python Basics',
  session_date: '2026-06-01T10:00:00Z',
  course_id: COURSE_KEY,
  status: 'present',
  is_overridden: false,
  override_reason: '',
  ...overrides,
});

const wrap = () => render(
  <IntlProvider locale="en" messages={{}}>
    <MemoryRouter initialEntries={[`/${PROGRAM_ID}/attendance/me`]}>
      <Routes>
        <Route path="/:programId/attendance/me" element={<MyAttendanceView />} />
      </Routes>
    </MemoryRouter>
  </IntlProvider>,
);

// Wait for the spinner to disappear then open the dropdown and pick an option.
const selectOption = async (label) => {
  await waitFor(() => expect(screen.getByLabelText('Course')).toBeInTheDocument());
  fireEvent.focus(screen.getByLabelText('Course'));
  await waitFor(() => expect(
    screen.getByRole('option', { name: label }),
  ).toBeInTheDocument());
  fireEvent.mouseDown(screen.getByRole('option', { name: label }));
};

const selectCourse = () => selectOption(COURSE_LABEL);
// The no-course option sits before the courses in the dropdown.
const selectNoCourse = () => selectOption('Sessions without a course');

beforeEach(() => {
  jest.clearAllMocks();
  fetchProgramCourses.mockResolvedValue([
    { course_key: COURSE_KEY, display_name: COURSE_LABEL },
  ]);
  getMyCourseAttendance.mockResolvedValue({ count: 0, results: [] });
});

it('shows loading spinner initially', () => {
  fetchProgramCourses.mockReturnValue(new Promise(() => {}));
  wrap();
  expect(screen.getByText(/loading your attendance/i)).toBeInTheDocument();
});

it('shows course selector prompt before a course is picked', async () => {
  wrap();
  await waitFor(() => expect(
    screen.getByText(/select a course above to see your attendance/i),
  ).toBeInTheDocument());
});

it('renders the derived rows for the selected course', async () => {
  getMyCourseAttendance.mockResolvedValue({ count: 1, results: [row()] });
  wrap();
  await selectCourse();
  await waitFor(() => expect(screen.getByText('Python Basics')).toBeInTheDocument());
  expect(screen.getByText('Present')).toBeInTheDocument();
  expect(getMyCourseAttendance).toHaveBeenCalledWith(PROGRAM_ID, COURSE_KEY, { page: 1, pageSize: 25 });
});

it('shows absent badge for absent status', async () => {
  getMyCourseAttendance.mockResolvedValue({
    count: 1,
    results: [row({ status: 'absent' })],
  });
  wrap();
  await selectCourse();
  await waitFor(() => expect(screen.getByText('Absent')).toBeInTheDocument());
});

it('shows a pending badge for a session the learner was never marked on', async () => {
  // Issue #400: an unmarked session carries a derived status of its own, so it
  // is never confused with a row the page failed to fetch.
  getMyCourseAttendance.mockResolvedValue({
    count: 1,
    results: [row({ id: null, status: 'pending' })],
  });
  wrap();
  await selectCourse();
  await waitFor(() => expect(screen.getByText('Pending')).toBeInTheDocument());
});

it('shows override reason note when record is overridden', async () => {
  getMyCourseAttendance.mockResolvedValue({
    count: 1,
    results: [row({ is_overridden: true, override_reason: 'Manual override by instructor' })],
  });
  wrap();
  await selectCourse();
  await waitFor(() => expect(
    screen.getByText('Manual override by instructor'),
  ).toBeInTheDocument());
});

it('pages the history on the server instead of fetching it all at once', async () => {
  // Issue #400: the page asks for one page at a time and trusts `count` for the
  // total, so a long history stays reachable rather than being silently cut.
  getMyCourseAttendance.mockImplementation(
    (programKey, courseKey, { page } = {}) => Promise.resolve({
      count: 30,
      next: null,
      previous: null,
      results: [row({ session: `session-page-${page}`, session_title: `Session ${page}` })],
    }),
  );
  wrap();
  await selectCourse();
  await waitFor(() => expect(screen.getByText('Session 1')).toBeInTheDocument());
  expect(getMyCourseAttendance).toHaveBeenCalledWith(PROGRAM_ID, COURSE_KEY, { page: 1, pageSize: 25 });

  fireEvent.click(screen.getByRole('button', { name: /^next/i }));

  await waitFor(() => expect(screen.getByText('Session 2')).toBeInTheDocument());
  expect(getMyCourseAttendance).toHaveBeenLastCalledWith(PROGRAM_ID, COURSE_KEY, { page: 2, pageSize: 25 });
});

it('asks for the programme course-less sessions with an empty course key', async () => {
  getMyCourseAttendance.mockResolvedValue({
    count: 2,
    results: [
      row({ session: 'seminar-1', session_title: 'Opening Seminar', course_id: '' }),
      row({
        session: 'workshop-1',
        session_title: 'Robotics Workshop',
        course_id: '',
        id: null,
        status: 'pending',
      }),
    ],
  });
  wrap();
  await selectNoCourse();

  await waitFor(() => expect(screen.getByText('Opening Seminar')).toBeInTheDocument());
  expect(screen.getByText('Robotics Workshop')).toBeInTheDocument();
  expect(screen.getByText('Pending')).toBeInTheDocument();
  expect(getMyCourseAttendance).toHaveBeenCalledWith(PROGRAM_ID, '', { page: 1, pageSize: 25 });
});

it('shows the empty state when the programme has no course-less sessions', async () => {
  wrap();
  await selectNoCourse();
  await waitFor(() => expect(
    screen.getByText(/no sessions found yet/i),
  ).toBeInTheDocument());
});

it('shows an error message when the attendance call fails', async () => {
  getMyCourseAttendance.mockRejectedValue({ message: 'Network error' });
  wrap();
  await selectCourse();
  await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
});

it('shows an error message when the course list fails to load', async () => {
  fetchProgramCourses.mockRejectedValue({ message: 'Courses unavailable' });
  wrap();
  await waitFor(() => expect(screen.getByText('Courses unavailable')).toBeInTheDocument());
});
