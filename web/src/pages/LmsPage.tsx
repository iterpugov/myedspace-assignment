import { useQuery } from '@tanstack/react-query';
import { fetchMyCourses } from '../api/lms';
import { useSessionExpiry } from '../use-session-expiry';
import { lmsKeys, useStudent } from '../use-student';
import { Card } from '../ui/Card';
import { Notice } from '../ui/Notice';
import { TextLink } from '../ui/TextLink';

/** The student's dashboard: their courses, each with its lessons. Rendered inside RequireSession. */
export function LmsPage() {
  const student = useStudent();
  const { data: courses, error } = useQuery({
    queryKey: lmsKeys.courses(student.id),
    queryFn: fetchMyCourses,
    // A refusal is an answer: an ended session must reach the sign-in page at once.
    retry: false,
  });
  const sessionExpired = useSessionExpiry(error);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="type-heading text-brand">Welcome, {student.firstName}</h1>
      {courses ? (
        courses.length === 0 ? (
          <Notice>You have no courses yet. Add one with the activation code from your parent.</Notice>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {courses.map((course) => (
              <Card key={course.courseId} label="Your course">
                <h2 className="type-subheading text-brand">
                  {course.subject} · Year {course.year}
                </h2>
                <ol className="flex flex-col gap-4 pt-2">
                  {course.lessons.map((lesson) => (
                    <li key={lesson.id} className="flex flex-col">
                      <TextLink to={`/lms/courses/${course.courseId}/lessons/${lesson.id}`}>
                        {lesson.position}. {lesson.title}
                      </TextLink>
                      <p className="type-small text-ink/70">{lesson.summary}</p>
                    </li>
                  ))}
                </ol>
              </Card>
            ))}
          </div>
        )
      ) : error && !sessionExpired ? (
        <Notice variant="error">We could not load your courses. Please try again.</Notice>
      ) : (
        <Notice live>Loading…</Notice>
      )}
      <TextLink to="/lms/add-course">Add a course</TextLink>
    </div>
  );
}
