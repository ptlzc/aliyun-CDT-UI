/**
 * Formats an ISO timestamp as the console-wide UTC label 'YYYY-MM-DD HH:mm
 * UTC'. Invalid or empty values pass through unchanged so a malformed backend
 * value is never silently hidden.
 *
 * @when 任意列表/详情/弹窗需要展示时间标签时
 */
export function formatDateLabel(value?: string): string {
  if (!value) {
    return '-';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  // toISOString() emits 'YYYY-MM-DDTHH:mm:ss.sssZ' — strip seconds and the
  // millisecond fraction whatever its length ('.000Z', '.930Z', …) so real
  // timestamps render as a clean 'YYYY-MM-DD HH:mm UTC'.
  return parsed.toISOString().replace('T', ' ').replace(/:\d{2}\.\d{3}Z$/, ' UTC');
}
