import { courseCoversYear } from './course-year';

describe('courseCoversYear (PUR-4)', () => {
  const science = { yearFrom: 5, yearTo: 11 };

  it('accepts both ends of the range and a year inside it', () => {
    expect(courseCoversYear(science, 5)).toBe(true);
    expect(courseCoversYear(science, 11)).toBe(true);
    expect(courseCoversYear(science, 8)).toBe(true);
  });

  it('rejects one below and one above the range', () => {
    expect(courseCoversYear(science, 4)).toBe(false);
    expect(courseCoversYear(science, 12)).toBe(false);
  });

  it.each([7.5, 5.000001, Number.NaN, Number.POSITIVE_INFINITY])('rejects the non-integer year %p', (year) => {
    expect(courseCoversYear(science, year)).toBe(false);
  });
});
