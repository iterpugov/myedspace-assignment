import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { fetchLesson, LmsError } from '../api/lms';
import { useSessionExpiry } from '../use-session-expiry';
import { lmsKeys, useStudent } from '../use-student';
import { Notice } from '../ui/Notice';
import { TextLink } from '../ui/TextLink';

/** One lesson of a course the student is enrolled in. Rendered inside RequireSession. */
export function LessonPage() {
  const student = useStudent();
  const { courseId = '', lessonId = '' } = useParams();
  const { data: lesson, error } = useQuery({
    queryKey: lmsKeys.lesson(student.id, courseId, lessonId),
    queryFn: () => fetchLesson(courseId, lessonId),
    // "Not available" is an answer, not a failure to retry.
    retry: false,
  });
  const sessionExpired = useSessionExpiry(error);
  // The API answers the same for a lesson that does not exist and one of a course the
  // student does not have (ADR 025); a malformed address is no different to the student.
  const notAvailable = error instanceof LmsError && (error.status === 404 || error.status === 400);

  return (
    <div className="flex max-w-prose flex-col gap-6">
      {notAvailable ? (
        // Checked first: a lesson kept from an earlier answer must not outlive a refusal.
        <Notice>This lesson is not available.</Notice>
      ) : lesson ? (
        <article className="flex flex-col gap-4">
          <p className="type-label text-ink/70">
            {lesson.subject} · Lesson {lesson.position}
          </p>
          <h1 className="type-heading text-brand">{lesson.title}</h1>
          {/* Plain text, one paragraph per blank-line-separated block; never rendered as HTML. */}
          {lesson.body.split(/\n\s*\n/).map((paragraph, index) => (
            <p key={index} className="type-body">
              {paragraph}
            </p>
          ))}
        </article>
      ) : error && !sessionExpired ? (
        <Notice variant="error">We could not load this lesson. Please try again.</Notice>
      ) : (
        <Notice live>Loading…</Notice>
      )}
      <TextLink to="/lms">← Back to my courses</TextLink>
    </div>
  );
}
