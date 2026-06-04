import {
  REQUEST_TYPE,
  REQUEST_TYPE_VARIANTS,
  REQUEST_STATUS,
  REQUEST_STATUS_VARIANTS,
} from './constants';

describe('REQUEST_TYPE_VARIANTS', () => {
  it('has a variant for every REQUEST_TYPE value', () => {
    Object.values(REQUEST_TYPE).forEach((type) => {
      expect(REQUEST_TYPE_VARIANTS[type]).toBeDefined();
    });
  });

  it('maps remote_session to info', () => {
    expect(REQUEST_TYPE_VARIANTS[REQUEST_TYPE.REMOTE_SESSION]).toBe('info');
  });

  it('maps leave to secondary', () => {
    expect(REQUEST_TYPE_VARIANTS[REQUEST_TYPE.LEAVE]).toBe('secondary');
  });
});

describe('REQUEST_STATUS_VARIANTS', () => {
  it('has a variant for every REQUEST_STATUS value', () => {
    Object.values(REQUEST_STATUS).forEach((s) => {
      expect(REQUEST_STATUS_VARIANTS[s]).toBeDefined();
    });
  });

  it('maps APPROVED to success', () => {
    expect(REQUEST_STATUS_VARIANTS[REQUEST_STATUS.APPROVED]).toBe('success');
  });

  it('maps REJECTED to danger', () => {
    expect(REQUEST_STATUS_VARIANTS[REQUEST_STATUS.REJECTED]).toBe('danger');
  });

  it('maps PENDING to warning', () => {
    expect(REQUEST_STATUS_VARIANTS[REQUEST_STATUS.PENDING]).toBe('warning');
  });
});
