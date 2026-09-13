export const MAX_CORRELATION_ID_LENGTH = 128;

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const UNSAFE_CORRELATION_ID_CHARS = /[^A-Za-z0-9._-]/g;

export function isValidCorrelationId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_CORRELATION_ID_LENGTH &&
    CORRELATION_ID_PATTERN.test(value)
  );
}

export function sanitizeCorrelationId(
  value: string | undefined,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const sanitized = value
    .replace(UNSAFE_CORRELATION_ID_CHARS, '')
    .slice(0, MAX_CORRELATION_ID_LENGTH);
  return sanitized.length > 0 ? sanitized : undefined;
}
