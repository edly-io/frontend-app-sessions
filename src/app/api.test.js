import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';

import {
  getFeedbackDetail,
  getInstructorDashboard,
  getMyFbrRoles,
  getTraineeDashboard,
  submitFeedback,
} from './api';

jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: jest.fn(),
}));
jest.mock('@edx/frontend-platform', () => ({
  getConfig: jest.fn(),
}));

const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  getConfig.mockReturnValue({ LMS_BASE_URL: 'http://localhost:18000' });
  getAuthenticatedHttpClient.mockReturnValue(mockClient);
});

describe('getMyFbrRoles', () => {
  it('loads the current profile roles from the LMS biodata endpoint', async () => {
    mockClient.get.mockResolvedValue({
      data: { roles: ['data_admin', 'trainee'] },
    });

    await expect(getMyFbrRoles()).resolves.toEqual(['data_admin', 'trainee']);
    expect(mockClient.get).toHaveBeenCalledWith(
      'http://localhost:18000/fbr/api/biodata/v1/users/me/',
    );
  });

  it('normalizes a missing roles value to an empty array', async () => {
    mockClient.get.mockResolvedValue({ data: {} });

    await expect(getMyFbrRoles()).resolves.toEqual([]);
  });
});

describe('getTraineeDashboard', () => {
  it('loads the default trainee dashboard summary from the LMS', async () => {
    const response = { state: 'ready', selected_program_key: 'program-v1:FBR+STP+2026' };
    mockClient.get.mockResolvedValue({ data: response });

    await expect(getTraineeDashboard()).resolves.toEqual(response);
    expect(mockClient.get).toHaveBeenCalledWith(
      'http://localhost:18000/fbr/api/trainee-dashboard/v1/summary/',
    );
  });

  it('adds only the encoded program_key when a programme is selected', async () => {
    mockClient.get.mockResolvedValue({ data: { state: 'ready' } });

    await getTraineeDashboard('program-v1:FBR+STP/2026 A');

    expect(mockClient.get).toHaveBeenCalledWith(
      'http://localhost:18000/fbr/api/trainee-dashboard/v1/summary/?program_key=program-v1%3AFBR%2BSTP%2F2026%20A',
    );
  });
});

describe('getInstructorDashboard', () => {
  it('loads the instructor dashboard summary from the LMS', async () => {
    const response = { state: 'ready', upcoming_sessions: [] };
    mockClient.get.mockResolvedValue({ data: response });

    await expect(getInstructorDashboard()).resolves.toEqual(response);
    expect(mockClient.get).toHaveBeenCalledWith(
      'http://localhost:18000/fbr/api/instructor-dashboard/v1/summary/',
    );
  });
});

describe('instructor feedback', () => {
  it('loads a feedback request detail from the LMS', async () => {
    const response = { id: 602, feedback_name: 'Faculty evaluation' };
    mockClient.get.mockResolvedValue({ data: response });

    await expect(getFeedbackDetail(602)).resolves.toEqual(response);
    expect(mockClient.get).toHaveBeenCalledWith(
      'http://localhost:18000/fbr/api/feedback/602/',
    );
  });

  it('submits feedback answers to the LMS', async () => {
    const payload = {
      answers: [
        { question_id: 1, star_value: 4 },
        { question_id: 2, text_value: 'Clear and helpful.' },
      ],
    };
    const response = { detail: 'Feedback submitted successfully.' };
    mockClient.post.mockResolvedValue({ data: response });

    await expect(submitFeedback(602, payload)).resolves.toEqual(response);
    expect(mockClient.post).toHaveBeenCalledWith(
      'http://localhost:18000/fbr/api/feedback/602/submit/',
      payload,
    );
  });
});
