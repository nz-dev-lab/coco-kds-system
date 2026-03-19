/**
 * Format a delivery man's name as "FirstName L" (first name + first letter of last name).
 * Matches the format produced by the backend in delivery_man_name.
 */
export function formatDmName(fName?: string | null, lName?: string | null): string {
  const first = fName?.trim() ?? '';
  const lastInitial = lName?.trim()?.[0] ?? '';
  return [first, lastInitial].filter(Boolean).join(' ');
}
