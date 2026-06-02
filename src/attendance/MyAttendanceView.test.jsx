import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import MyAttendanceView from './MyAttendanceView';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('./api', () => ({
  getMyAttendanceRecords: jest.fn(),
}));

const { getMyAttendanceRecords } = require('./api');

const wrap = () => render(
  <IntlProvider locale="en" messages={{}}>
    <MyAttendanceView />
  </IntlProvider>,
);

beforeEach(() => jest.clearAllMocks());

it('shows loading spinner initially', () => {
  getMyAttendanceRecords.mockReturnValue(new Promise(() => {}));
  wrap();
  expect(screen.getByText(/loading your attendance/i)).toBeInTheDocument();
});

it('shows empty state message when there are no records', async () => {
  getMyAttendanceRecords.mockResolvedValue({ results: [], count: 0 });
  wrap();
  await waitFor(() => expect(screen.getByText(/no attendance records yet/i)).toBeInTheDocument());
});

it('renders attendance records table when data is available', async () => {
  getMyAttendanceRecords.mockResolvedValue({
    results: [
      {
        id: 1,
        session_title: 'Python Basics',
        session_date: '2026-06-01T10:00:00Z',
        course_id: 'course-v1:Org+CS101+Run',
        status: 'present',
        is_overridden: false,
        override_reason: '',
      },
    ],
    count: 1,
  });
  wrap();
  await waitFor(() => expect(screen.getByText('Python Basics')).toBeInTheDocument());
  expect(screen.getByText('Present')).toBeInTheDocument();
});

it('shows absent badge for absent status', async () => {
  getMyAttendanceRecords.mockResolvedValue({
    results: [
      {
        id: 2,
        session_title: 'Session 2',
        session_date: '2026-06-02T10:00:00Z',
        course_id: 'course-v1:Org+CS101+Run',
        status: 'absent',
        is_overridden: false,
        override_reason: '',
      },
    ],
    count: 1,
  });
  wrap();
  await waitFor(() => expect(screen.getByText('Absent')).toBeInTheDocument());
});

it('shows override reason note when record is overridden', async () => {
  getMyAttendanceRecords.mockResolvedValue({
    results: [
      {
        id: 3,
        session_title: 'Session 3',
        session_date: '2026-06-03T10:00:00Z',
        course_id: 'course-v1:Org+CS101+Run',
        status: 'present',
        is_overridden: true,
        override_reason: 'Manual override by instructor',
      },
    ],
    count: 1,
  });
  wrap();
  await waitFor(() => expect(screen.getByText('Manual override by instructor')).toBeInTheDocument());
});

it('shows error message when API call fails', async () => {
  getMyAttendanceRecords.mockRejectedValue({ message: 'Network error' });
  wrap();
  await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
});
