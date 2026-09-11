import React from 'react';
import {
  render, screen, waitFor, fireEvent,
} from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PerCourseView from './PerCourseView';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('./api', () => ({
  getCourseSessionsList: jest.fn(),
  getNoCourseSessionsList: jest.fn(),
}));

jest.mock('../calendar/api', () => ({
  fetchProgramCourses: jest.fn(),
}));

const { getCourseSessionsList, getNoCourseSessionsList } = require('./api');
const { fetchProgramCourses } = require('../calendar/api');

const PROGRAM_ID = 'program-v1:Org+Test+2026';
const COURSE_KEY = 'course-v1:Org+CS101+Run';
const COURSE_LABEL = 'Python Basics Course';

const wrap = () => render(
  <IntlProvider locale="en" messages={{}}>
    <MemoryRouter initialEntries={[`/${PROGRAM_ID}/attendance/by-course`]}>
      <Routes>
        <Route path="/:programId/attendance/by-course" element={<PerCourseView />} />
      </Routes>
    </MemoryRouter>
  </IntlProvider>,
);

// Wait for the course list then open the dropdown and pick a course.
const selectCourse = async () => {
  await waitFor(() => expect(screen.getByLabelText('Course')).toBeInTheDocument());
  fireEvent.focus(screen.getByLabelText('Course'));
  await waitFor(() => expect(
    screen.getByRole('option', { name: COURSE_LABEL }),
  ).toBeInTheDocument());
  fireEvent.mouseDown(screen.getByRole('option', { name: COURSE_LABEL }));
};

const sessionRow = (n) => ({
  id: `session-${n}`,
  title: `Session ${n}`,
  scheduled_start_time: '2026-06-01T10:00:00Z',
  status: 'completed',
  marking_window_open: false,
});

beforeEach(() => {
  jest.clearAllMocks();
  fetchProgramCourses.mockResolvedValue([
    { course_key: COURSE_KEY, display_name: COURSE_LABEL },
  ]);
  getNoCourseSessionsList.mockResolvedValue({ count: 0, results: [] });
});

// The no-course option is the second entry in the dropdown, before the courses.
const selectNoCourse = async () => {
  await waitFor(() => expect(screen.getByLabelText('Course')).toBeInTheDocument());
  fireEvent.focus(screen.getByLabelText('Course'));
  await waitFor(() => expect(
    screen.getByRole('option', { name: 'Sessions without a course' }),
  ).toBeInTheDocument());
  fireEvent.mouseDown(screen.getByRole('option', { name: 'Sessions without a course' }));
};

it('requests the selected course from the paginated endpoint', async () => {
  getCourseSessionsList.mockResolvedValue({
    count: 1, next: null, previous: null, results: [sessionRow(1)],
  });
  wrap();
  await selectCourse();
  await waitFor(() => expect(screen.getByText('Session 1')).toBeInTheDocument());
  expect(getCourseSessionsList).toHaveBeenCalledWith(COURSE_KEY, PROGRAM_ID, { page: 1, pageSize: 25 });
});

it('pages on the server rather than in the browser', async () => {
  getCourseSessionsList.mockImplementation(
    (courseKey, programKey, { page } = {}) => Promise.resolve({
      count: 30,
      next: page > 1 ? null : 'http://test/next',
      previous: page > 1 ? 'http://test/previous' : null,
      results: [sessionRow(page)],
    }),
  );
  wrap();
  await selectCourse();
  await waitFor(() => expect(screen.getByText('Session 1')).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: /^next/i }));

  await waitFor(() => expect(screen.getByText('Session 2')).toBeInTheDocument());
  expect(getCourseSessionsList).toHaveBeenLastCalledWith(COURSE_KEY, PROGRAM_ID, { page: 2, pageSize: 25 });
});

it('leaves the next-page control disabled when everything fits on one page', async () => {
  getCourseSessionsList.mockResolvedValue({
    count: 1, next: null, previous: null, results: [sessionRow(1)],
  });
  wrap();
  await selectCourse();
  await waitFor(() => expect(screen.getByText('Session 1')).toBeInTheDocument());
  // Paragon's footer always renders the Previous/Next pair; with one page both
  // are disabled, so there is no second page to request.
  expect(screen.getByRole('button', { name: /^next/i })).toBeDisabled();
  expect(getCourseSessionsList).toHaveBeenCalledTimes(1);
});

it('uses the dedicated no-course endpoint for the no-course option', async () => {
  getNoCourseSessionsList.mockResolvedValue({
    count: 1, next: null, previous: null, results: [sessionRow(9)],
  });
  wrap();
  await selectNoCourse();
  await waitFor(() => expect(screen.getByText('Session 9')).toBeInTheDocument());
  expect(getNoCourseSessionsList).toHaveBeenCalledWith(PROGRAM_ID, { page: 1, pageSize: 25 });
  expect(getCourseSessionsList).not.toHaveBeenCalled();
});

it('pages the no-course option on the server', async () => {
  getNoCourseSessionsList.mockImplementation(
    (programKey, { page } = {}) => Promise.resolve({
      count: 30,
      next: page > 1 ? null : 'http://test/next',
      previous: page > 1 ? 'http://test/previous' : null,
      results: [sessionRow(page)],
    }),
  );
  wrap();
  await selectNoCourse();
  await waitFor(() => expect(screen.getByText('Session 1')).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: /^next/i }));

  await waitFor(() => expect(screen.getByText('Session 2')).toBeInTheDocument());
  expect(getNoCourseSessionsList).toHaveBeenLastCalledWith(PROGRAM_ID, { page: 2, pageSize: 25 });
});

it('shows the empty state when the course has no sessions', async () => {
  getCourseSessionsList.mockResolvedValue({
    count: 0, next: null, previous: null, results: [],
  });
  wrap();
  await selectCourse();
  await waitFor(() => expect(
    screen.getByText(/no completed sessions found/i),
  ).toBeInTheDocument());
});

it('shows the empty state when the programme has no course-less sessions', async () => {
  getNoCourseSessionsList.mockResolvedValue({
    count: 0, next: null, previous: null, results: [],
  });
  wrap();
  await selectNoCourse();
  await waitFor(() => expect(
    screen.getByText(/no completed sessions found/i),
  ).toBeInTheDocument());
});
