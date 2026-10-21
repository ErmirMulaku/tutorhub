import type { Transaction } from '../../core/api/models';
import { csvField, transactionsCsv } from './transactions-csv';

const row = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  date: '2026-10-21T14:00:00.000Z',
  studentName: 'Mia Chen',
  subjectName: 'Physics',
  netCents: 4675,
  feeCents: 825,
  status: 'PAID',
  ...overrides,
});

describe('transactions CSV', () => {
  it('writes the same columns and number format as the React export', () => {
    expect(transactionsCsv([row()])).toBe(
      'Date,Student,Subject,Net,Fee,Status\n2026-10-21,Mia Chen,Physics,46.75,8.25,PAID',
    );
  });

  it('quotes fields with commas, quotes or line breaks (RFC 4180)', () => {
    expect(csvField('Chen, Mia')).toBe('"Chen, Mia"');
    expect(csvField('Mia "the pro" Chen')).toBe('"Mia ""the pro"" Chen"');
    expect(csvField('line\nbreak')).toBe('"line\nbreak"');
    // A comma in a name no longer shifts the row's columns.
    const line = transactionsCsv([row({ studentName: 'Chen, Mia' })]).split('\n')[1];
    expect(line).toBe('2026-10-21,"Chen, Mia",Physics,46.75,8.25,PAID');
  });

  it('defuses spreadsheet formulas', () => {
    expect(csvField('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvField('+1234')).toBe("'+1234");
    expect(csvField('Plain')).toBe('Plain');
  });
});
