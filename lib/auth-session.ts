import type { Session, User } from '@supabase/supabase-js';

/** Whether Supabase has marked the user's email as confirmed. */
export function isEmailConfirmed(user: User | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.email_confirmed_at ?? user.confirmed_at);
}

/** A session that is allowed into the main app (any signed-in user). */
export function isAppSession(session: Session | null | undefined): boolean {
  return Boolean(session?.user);
}
