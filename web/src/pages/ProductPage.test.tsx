import type { CourseResponse } from '@mes/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { ProductPage } from './ProductPage';

const english: CourseResponse = {
  id: '0b9f6f0e-5d0a-4c58-9d0e-2f1c4a7b8e01',
  subject: 'English',
  yearFrom: 5,
  yearTo: 13,
  pricePence: 19900,
};
const maths: CourseResponse = {
  id: '4c1d2e3f-6a7b-4c8d-9e0f-1a2b3c4d5e02',
  subject: 'Maths',
  yearFrom: 5,
  yearTo: 13,
  pricePence: 19900,
};
const science: CourseResponse = {
  id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c03',
  subject: 'Science',
  yearFrom: 5,
  yearTo: 11,
  pricePence: 19900,
};

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname + location.search}</p>;
}

function renderProductPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<ProductPage />} />
          <Route path="/checkout" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function stubCourses() {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify([english, maths, science])));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const courseRadio = (subject: RegExp) => screen.findByRole('radio', { name: subject });
const yearSelect = () => screen.getByRole('combobox', { name: /year/i });
const continueButton = () => screen.getByRole('button', { name: /continue to checkout/i });

/** Year options offered to the parent; an empty-valued placeholder is not one of them. */
function offeredYears(): string[] {
  return within(yearSelect())
    .getAllByRole<HTMLOptionElement>('option')
    .filter((option) => option.value !== '')
    .map((option) => option.textContent ?? '');
}

function yearsBetween(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, index) => `Year ${from + index}`);
}

describe('ProductPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists the courses from GET /api/courses with subject, year range and price (PUR-1, CAT-1)', async () => {
    const fetchMock = stubCourses();

    renderProductPage();

    const expected = [
      { subject: /english/i, years: 'Years 5–13' },
      { subject: /maths/i, years: 'Years 5–13' },
      { subject: /science/i, years: 'Years 5–11' },
    ];
    for (const { subject, years } of expected) {
      const card = within((await courseRadio(subject)).closest('label')!);
      expect(card.getByText(years)).toBeInTheDocument();
      expect(card.getByText('£199')).toBeInTheDocument();
    }
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/courses');
  });

  it('keeps the year and Continue disabled until a course is selected', async () => {
    stubCourses();

    renderProductPage();
    await courseRadio(/maths/i);

    expect(screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
    expect(yearSelect()).toBeDisabled();
    expect(continueButton()).toBeDisabled();
  });

  it("offers only the selected course's years (PUR-2, CAT-2)", async () => {
    const user = userEvent.setup();
    stubCourses();
    renderProductPage();

    await user.click(await courseRadio(/science/i));
    expect(yearSelect()).toBeEnabled();
    expect(offeredYears()).toEqual(yearsBetween(5, 11));

    await user.click(await courseRadio(/maths/i));
    expect(offeredYears()).toEqual(yearsBetween(5, 13));
  });

  it('clears the year and disables Continue when the course changes', async () => {
    const user = userEvent.setup();
    stubCourses();
    renderProductPage();

    await user.click(await courseRadio(/maths/i));
    await user.selectOptions(yearSelect(), 'Year 12');
    expect(continueButton()).toBeEnabled();

    await user.click(await courseRadio(/science/i));

    expect(yearSelect()).toHaveValue('');
    expect(continueButton()).toBeDisabled();
  });

  it('continues to the checkout with the course id and year in the URL', async () => {
    const user = userEvent.setup();
    stubCourses();
    renderProductPage();

    await user.click(await courseRadio(/maths/i));
    await user.selectOptions(yearSelect(), 'Year 7');
    await user.click(continueButton());

    expect(await screen.findByTestId('location')).toHaveTextContent(`/checkout?courseId=${maths.id}&year=7`);
  });

  it('shows an alert and no course controls when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));

    renderProductPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});
