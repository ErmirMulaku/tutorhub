import type { Transaction } from '../../core/api/models';

const HEADER = ['Date', 'Student', 'Subject', 'Net', 'Fee', 'Status'];

/**
 * One CSV field (RFC 4180): quoted when it contains a comma, quote or line
 * break, with inner quotes doubled. Text that a spreadsheet would run as a
 * formula (starting with = + - @) is prefixed with an apostrophe, so a student
 * named "=HYPERLINK(…)" stays text when the export is opened in Excel.
 */
export function csvField(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * The "Export CSV" file for the transactions table (port of EarningsScreen's
 * exportCsv). React joined raw values with commas, so a name containing a
 * comma or quote broke the row; every field now goes through `csvField`.
 */
export function transactionsCsv(rows: readonly Transaction[]): string {
  const lines = rows.map((r) =>
    [
      new Date(r.date).toISOString().slice(0, 10),
      r.studentName,
      r.subjectName,
      (r.netCents / 100).toFixed(2),
      (r.feeCents / 100).toFixed(2),
      r.status,
    ]
      .map(csvField)
      .join(','),
  );
  return [HEADER.join(','), ...lines].join('\n');
}
