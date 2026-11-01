// Supabase's auth errors are written for developers ("Invalid login
// credentials", "AuthApiError: ..."). The learner gets a sentence that says
// what to do; anything unrecognised falls back to the screen's own line.
const KNOWN: [RegExp, string][] = [
  [/invalid login credentials|invalid_credentials/i, 'That email and password do not match. Check both, or reset your password below.'],
  [/email not confirmed/i, 'Confirm your email first: there is a link in the message we sent you.'],
  [/user already registered|already been registered|already exists/i, 'There is already an account with that email. Sign in instead.'],
  [/password should be at least|password is too short|weak password/i, 'Choose a longer password: at least 8 characters.'],
  [/rate limit|too many requests|over_email_send_rate_limit/i, 'Too many attempts in a row. Wait a minute and try again.'],
  [/unable to validate email|invalid email|is invalid/i, 'That does not look like an email address.'],
  [/same as the old password|should be different/i, 'Choose a password you have not used here before.'],
  [/expired|otp_expired/i, 'That link has expired. Ask for a new one.'],
  [/network|fetch|failed to fetch|timeout|timed out/i, 'Could not reach the server. Check your connection and try again.'],
];

export function authErrorCopy(e: unknown, fallback: string): string {
  const message = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  for (const [re, copy] of KNOWN) if (re.test(message)) return copy;
  return fallback;
}
