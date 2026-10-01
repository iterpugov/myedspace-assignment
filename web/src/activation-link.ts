/**
 * The link a student opens to activate a course. The code travels in the fragment,
 * which browsers do not send to the server, so it stays out of access logs.
 */
export function activationLink(code: string): string {
  return `${window.location.origin}/activate#code=${code}`;
}
