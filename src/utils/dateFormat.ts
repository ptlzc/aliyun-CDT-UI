// Shared formatter: Asia/Shanghai (UTC+8, no DST) — the zh-CN console timezone.
// Module-level so list/detail/modal labels never rebuild the Intl formatter.
const shanghaiFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * Formats an ISO timestamp as the console-wide Asia/Shanghai (UTC+8) label
 * 'YYYY-MM-DD HH:mm UTC+8'. Backend timestamps stay UTC RFC3339 (correct
 * storage); only the rendered label shifts to the zh-CN console timezone.
 * Invalid or empty values pass through unchanged so a malformed backend value
 * is never silently hidden.
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
  // formatToParts with h23 emits zero-padded 'YYYY', 'MM', 'DD', 'HH', 'mm'
  // parts in zh-CN; assemble them into the same 'YYYY-MM-DD HH:mm' shape the
  // previous UTC label used.
  const parts = Object.fromEntries(
    shanghaiFormatter.formatToParts(parsed).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} UTC+8`;
}
