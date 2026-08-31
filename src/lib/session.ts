import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export const SESSION_COOKIE_NAME = 't4m_session';

/**
 * Gets the current session ID from cookies, creating one if it doesn't exist.
 * Note: Must be called within a request context (Server Components or API routes).
 */
export async function getSessionId(): Promise<string> {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    sessionId = uuidv4();
    cookieStore.set({
      name: SESSION_COOKIE_NAME,
      value: sessionId as string,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  }

  return sessionId as string;
}


