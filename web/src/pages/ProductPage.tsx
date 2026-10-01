import type { CourseResponse } from '@mes/contracts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { fetchCourses } from '../api/courses';
import { Button } from '../ui/Button';
import { ChoiceCard } from '../ui/ChoiceCard';
import { Notice } from '../ui/Notice';
import { PageShell } from '../ui/PageShell';
import { Select } from '../ui/Select';

function formatPrice(pricePence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: pricePence % 100 === 0 ? 0 : 2,
  }).format(pricePence / 100);
}

function yearsOf(course: CourseResponse): number[] {
  return Array.from({ length: course.yearTo - course.yearFrom + 1 }, (_, index) => course.yearFrom + index);
}

function CourseSelection({ courses }: { courses: CourseResponse[] }) {
  const navigate = useNavigate();
  const [courseId, setCourseId] = useState('');
  const [year, setYear] = useState('');
  const course = courses.find((candidate) => candidate.id === courseId);

  function selectCourse(id: string) {
    setCourseId(id);
    // The year belongs to the course's range, so a new course starts without one.
    setYear('');
  }

  function continueToCheckout() {
    navigate(`/checkout?${new URLSearchParams({ courseId, year })}`);
  }

  return (
    <div className="flex flex-col gap-12">
      <fieldset>
        <legend className="type-heading mb-6 text-brand">Select a course</legend>
        <div className="grid gap-4 md:grid-cols-3">
          {courses.map((option) => (
            <ChoiceCard
              key={option.id}
              name="course"
              value={option.id}
              checked={option.id === courseId}
              onSelect={selectCourse}
            >
              <span className="type-subheading">{option.subject}</span>
              <span className="type-body">
                Years {option.yearFrom}–{option.yearTo}
              </span>
              <span className="type-subheading mt-2">{formatPrice(option.pricePence)}</span>
            </ChoiceCard>
          ))}
        </div>
      </fieldset>

      <section className="flex flex-col gap-6">
        <h2 className="type-heading text-brand">Who is it for?</h2>
        <Select
          label="Student's school year"
          hint={course ? `${course.subject} runs for Years ${course.yearFrom} to ${course.yearTo}.` : 'Select a course first.'}
          value={year}
          disabled={!course}
          onChange={(event) => setYear(event.target.value)}
        >
          <option value="">Choose a year</option>
          {course &&
            yearsOf(course).map((option) => (
              <option key={option} value={option}>
                Year {option}
              </option>
            ))}
        </Select>
      </section>

      <div>
        <Button disabled={!course || year === ''} onClick={continueToCheckout}>
          Continue to checkout
        </Button>
      </div>
    </div>
  );
}

export function ProductPage() {
  const { data: courses, isError } = useQuery({ queryKey: ['courses'], queryFn: fetchCourses });

  return (
    <PageShell
      hero={
        <>
          <p className="type-eyebrow text-sky">Live online lessons</p>
          <h1 className="type-display mt-2">Choose a course</h1>
          <p className="type-body mt-6 max-w-xl">
            Buy access for your child, then pass them the activation link to start learning.
          </p>
        </>
      }
    >
      {courses ? (
        courses.length > 0 ? (
          <CourseSelection courses={courses} />
        ) : (
          <Notice>No courses are available right now.</Notice>
        )
      ) : isError ? (
        <Notice variant="error">We could not load the courses. Please try again in a moment.</Notice>
      ) : (
        <Notice live>Loading courses…</Notice>
      )}
    </PageShell>
  );
}
