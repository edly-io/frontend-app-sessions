import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import {
  getLocations, createLocation, updateLocation, deleteLocation,
} from './api';

jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: jest.fn(),
}));
jest.mock('@edx/frontend-platform', () => ({
  getConfig: jest.fn().mockReturnValue({ LMS_BASE_URL: 'http://localhost:18000' }),
}));

const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
};

beforeAll(() => {
  getAuthenticatedHttpClient.mockReturnValue(mockClient);
});

beforeEach(() => jest.clearAllMocks());

describe('getLocations', () => {
  it('fetches from /locations/ with pagination params', async () => {
    mockClient.get.mockResolvedValue({ data: { count: 0, results: [] } });
    await getLocations({ page: 1, pageSize: 20 });
    const [url] = mockClient.get.mock.calls[0];
    expect(url).toContain('/locations/');
    expect(url).toContain('page=1');
    expect(url).toContain('page_size=20');
  });

  it('includes search param when provided', async () => {
    mockClient.get.mockResolvedValue({ data: { count: 0, results: [] } });
    await getLocations({ search: 'lab' });
    const [url] = mockClient.get.mock.calls[0];
    expect(url).toContain('search=lab');
  });

  it('returns count and results', async () => {
    mockClient.get.mockResolvedValue({ data: { count: 2, results: [{ id: 'a' }, { id: 'b' }] } });
    const result = await getLocations();
    expect(result).toEqual({ count: 2, results: [{ id: 'a' }, { id: 'b' }] });
  });

  it('returns zeros for missing fields', async () => {
    mockClient.get.mockResolvedValue({ data: {} });
    const result = await getLocations();
    expect(result).toEqual({ count: 0, results: [] });
  });
});

describe('createLocation', () => {
  it('posts to /locations/ and returns data', async () => {
    mockClient.post.mockResolvedValue({ data: { id: 'loc1', name: 'Lab' } });
    const result = await createLocation({ name: 'Lab', description: '' });
    expect(mockClient.post).toHaveBeenCalledWith(
      expect.stringContaining('/locations/'),
      { name: 'Lab', description: '' },
    );
    expect(result).toEqual({ id: 'loc1', name: 'Lab' });
  });
});

describe('updateLocation', () => {
  it('patches the location by id', async () => {
    mockClient.patch.mockResolvedValue({ data: { id: 'loc1', name: 'Lab B' } });
    const result = await updateLocation('loc1', { name: 'Lab B' });
    expect(mockClient.patch).toHaveBeenCalledWith(
      expect.stringContaining('/locations/loc1/'),
      { name: 'Lab B' },
    );
    expect(result).toEqual({ id: 'loc1', name: 'Lab B' });
  });
});

describe('deleteLocation', () => {
  it('sends DELETE to the location endpoint', async () => {
    mockClient.delete.mockResolvedValue({});
    await deleteLocation('loc1');
    expect(mockClient.delete).toHaveBeenCalledWith(
      expect.stringContaining('/locations/loc1/'),
    );
  });
});
