import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';

import {
  getMyFbrRoles,
  getTraineeDashboard,
} from './api';

jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: jest.fn(),
}));
jest.mock('@edx/frontend-platform', () => ({
  getConfig: jest.fn(),
}));

const mockClient = {
  get: jest.fn(),
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
