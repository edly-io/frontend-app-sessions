jest.mock('@edx/frontend-platform', () => ({
  getConfig: jest.fn(() => ({ LMS_BASE_URL: 'http://localhost:18000' })),
}));

jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: jest.fn(),
}));

const { getAuthenticatedHttpClient } = require('@edx/frontend-platform/auth');
const { getAuditLogs } = require('./auditLogApi');

const mockGet = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  getAuthenticatedHttpClient.mockReturnValue({ get: mockGet });
});

describe('getAuditLogs', () => {
  it('sends correct app_label and model params', async () => {
    mockGet.mockResolvedValue({ data: { results: [], count: 0 } });

    await getAuditLogs({ appLabel: 'attendance', models: ['location'] });

    expect(mockGet).toHaveBeenCalledTimes(1);
    const url = mockGet.mock.calls[0][0];
    expect(url).toContain('app_label=attendance');
    expect(url).toContain('model=location');
  });

  it('includes date_from and date_to when provided', async () => {
    mockGet.mockResolvedValue({ data: { results: [], count: 0 } });

    await getAuditLogs({
      appLabel: 'attendance',
      models: [],
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    });

    const url = mockGet.mock.calls[0][0];
    expect(url).toContain('date_from=2026-01-01');
    expect(url).toContain('date_to=2026-12-31');
  });

  it('returns results and count', async () => {
    const fakeResults = [
      {
        id: 1,
        timestamp: '2026-09-01T10:00:00Z',
        actor_name: 'admin',
        action: 'created',
        record_type: 'location',
        object_repr: 'Main Office',
        changes: {},
        object_pk: '42',
      },
    ];
    mockGet.mockResolvedValue({ data: { results: fakeResults, count: 1 } });

    const result = await getAuditLogs({ appLabel: 'attendance', models: [] });

    expect(result.results).toEqual(fakeResults);
    expect(result.count).toBe(1);
  });
});
