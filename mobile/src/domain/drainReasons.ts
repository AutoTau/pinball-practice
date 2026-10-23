// One-tap drain chips. Stored as text codes and validated here rather than by the database, because the
// list will change with tester feedback (decision 23). Codes are permanent once shipped: rename labels,
// never codes.

export const DRAIN_REASONS = [
  { code: 'left_outlane', label: 'Left outlane' },
  { code: 'right_outlane', label: 'Right outlane' },
  { code: 'center_drain', label: 'Center drain' },
  { code: 'other', label: 'Other' },
] as const;

export type DrainReason = (typeof DRAIN_REASONS)[number]['code'];

export function isDrainReason(code: string): code is DrainReason {
  return DRAIN_REASONS.some((r) => r.code === code);
}
