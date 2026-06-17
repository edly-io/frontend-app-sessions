import {
  formatDateTime,
  toISOString,
  toDateTimeLocal,
  formatDuration,
  getStatusVariant,
  extractApiError,
  bucketSessionsByDay,
} from './utils';

describe('formatDateTime', () => {
  it('returns empty string for empty string', () => {
    expect(formatDateTime('')).toBe('');
  });

  it('returns empty string for null', () => {
    expect(formatDateTime(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatDateTime(undefined)).toBe('');
  });

  it('formats a valid ISO date string', () => {
    const result = formatDateTime('2026-06-01T10:00:00.000Z');
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/2026/);
  });
});

describe('toISOString', () => {
  it('returns empty string for empty string', () => {
    expect(toISOString('')).toBe('');
  });

  it('returns empty string for null', () => {
    expect(toISOString(null)).toBe('');
  });

  it('converts a datetime-local string to ISO', () => {
    const result = toISOString('2026-06-01T10:00');
    expect(result).toMatch(/2026-06-01/);
  });
});

describe('toDateTimeLocal', () => {
  it('returns empty string for empty string', () => {
    expect(toDateTimeLocal('')).toBe('');
  });

  it('returns empty string for null', () => {
    expect(toDateTimeLocal(null)).toBe('');
  });

  it('returns a YYYY-MM-DDTHH:MM formatted string', () => {
    const result = toDateTimeLocal('2026-06-01T10:00:00.000Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe('formatDuration', () => {
  it('returns 0m for zero', () => {
    expect(formatDuration(0)).toBe('0m');
  });

  it('returns 0m for null', () => {
    expect(formatDuration(null)).toBe('0m');
  });

  it('formats seconds into minutes only', () => {
    expect(formatDuration(1800)).toBe('30m');
  });

  it('formats seconds into hours and minutes', () => {
    expect(formatDuration(3661)).toBe('1h 1m');
  });

  it('formats exact hours with 0 minutes', () => {
    expect(formatDuration(7200)).toBe('2h 0m');
  });

  it('formats 59 minutes', () => {
    expect(formatDuration(3540)).toBe('59m');
  });
});

describe('getStatusVariant', () => {
  it('returns success for present', () => {
    expect(getStatusVariant('present')).toBe('success');
  });

  it('returns danger for absent', () => {
    expect(getStatusVariant('absent')).toBe('danger');
  });

  it('returns warning for late', () => {
    expect(getStatusVariant('late')).toBe('warning');
  });

  it('returns warning for left_early', () => {
    expect(getStatusVariant('left_early')).toBe('warning');
  });

  it('returns info for partial', () => {
    expect(getStatusVariant('partial')).toBe('info');
  });

  it('returns success for completed', () => {
    expect(getStatusVariant('completed')).toBe('success');
  });

  it('returns danger for cancelled', () => {
    expect(getStatusVariant('cancelled')).toBe('danger');
  });

  it('returns secondary for unknown status', () => {
    expect(getStatusVariant('unknown_status')).toBe('secondary');
  });
});

describe('extractApiError', () => {
  it('extracts detail from response data', () => {
    expect(extractApiError({ response: { data: { detail: 'Not found' } } })).toBe('Not found');
  });

  it('extracts error from response data when no detail', () => {
    expect(extractApiError({ response: { data: { error: 'Bad request' } } })).toBe('Bad request');
  });

  it('falls back to err.message when no response', () => {
    expect(extractApiError({ message: 'Network error' })).toBe('Network error');
  });

  it('uses provided fallback when nothing is available', () => {
    expect(extractApiError({}, 'fallback msg')).toBe('fallback msg');
  });

  it('uses default fallback when nothing is available', () => {
    expect(extractApiError({})).toBe('An unexpected error occurred');
  });

  it('prefers detail over error', () => {
    expect(extractApiError({ response: { data: { detail: 'detail msg', error: 'err msg' } } })).toBe('detail msg');
  });

  it('joins DRF field-level validation errors', () => {
    const err = { response: { data: { name: ['This field is required.'], reason: ['Too short.'] } } };
    const result = extractApiError(err);
    expect(result).toContain('name: This field is required.');
    expect(result).toContain('reason: Too short.');
  });

  it('extracts non_field_errors without prefixing the field name', () => {
    const err = { response: { data: { non_field_errors: ['Duplicate entry.'] } } };
    expect(extractApiError(err)).toBe('Duplicate entry.');
  });

  it('handles a plain string response body', () => {
    expect(extractApiError({ response: { data: 'Internal server error' } })).toBe('Internal server error');
  });
});

describe('bucketSessionsByDay', () => {
  it('returns an empty Map for an empty array', () => {
    const result = bucketSessionsByDay([]);
    expect(result.size).toBe(0);
  });

  it('groups sessions on the same day together', () => {
    const sessions = [
      { id: 1, scheduled_start_time: '2026-06-01T10:00:00' },
      { id: 2, scheduled_start_time: '2026-06-01T14:00:00' },
      { id: 3, scheduled_start_time: '2026-06-02T09:00:00' },
    ];
    const result = bucketSessionsByDay(sessions);
    expect(result.size).toBe(2);
    expect(result.get('2026-06-01')).toHaveLength(2);
    expect(result.get('2026-06-02')).toHaveLength(1);
  });

  it('ignores sessions without scheduled_start_time', () => {
    const sessions = [
      { id: 1 },
      { id: 2, scheduled_start_time: '2026-06-01T10:00:00' },
    ];
    const result = bucketSessionsByDay(sessions);
    expect(result.size).toBe(1);
  });

  it('preserves session order within a day', () => {
    const sessions = [
      { id: 1, scheduled_start_time: '2026-06-01T10:00:00' },
      { id: 2, scheduled_start_time: '2026-06-01T08:00:00' },
    ];
    const result = bucketSessionsByDay(sessions);
    const day = result.get('2026-06-01');
    expect(day[0].id).toBe(1);
    expect(day[1].id).toBe(2);
  });
});
