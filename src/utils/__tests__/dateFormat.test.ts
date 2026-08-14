import {describe, expect, it} from 'vitest';

import {formatDateLabel} from '../dateFormat';

/**
 * formatDateLabel renders the console-wide time label in Asia/Shanghai
 * (UTC+8, no DST), independent of the test process' local timezone —
 * Intl.DateTimeFormat with an explicit timeZone guarantees determinism.
 */
describe('formatDateLabel', () => {
  it('renders fixed UTC timestamps as Asia/Shanghai (UTC+8) labels', () => {
    expect(formatDateLabel('2026-06-16T10:14:15Z')).toBe('2026-06-16 18:14 UTC+8');
  });

  it('rolls over to the next day when UTC+8 crosses midnight', () => {
    expect(formatDateLabel('2026-06-16T16:30:00Z')).toBe('2026-06-17 00:30 UTC+8');
  });

  it('strips seconds and keeps minute precision like the previous UTC label', () => {
    expect(formatDateLabel('2026-06-16T10:14:59Z')).toBe('2026-06-16 18:14 UTC+8');
  });

  it('zero-pads month, day, hour and minute', () => {
    expect(formatDateLabel('2026-01-05T04:05:00Z')).toBe('2026-01-05 12:05 UTC+8');
  });

  it('passes through empty and invalid values unchanged', () => {
    expect(formatDateLabel(undefined)).toBe('-');
    expect(formatDateLabel('')).toBe('-');
    expect(formatDateLabel('not-a-date')).toBe('not-a-date');
  });
});
