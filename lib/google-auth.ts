import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';

import { isAppSession } from '@/lib/auth-session';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

/** Redirect URI — add this exact value to Supabase Auth → URL Configuration. */
export function getAuthRedirectUri(): string {
  return Linking.createURL('auth/callback');
}

export class AuthCancelledError extends Error {
  constructor() {
    super('Sign-in was cancelled');
    this.name = 'AuthCancelledError';
  }
}

function parseOAuthParams(url: string): { params: Record<string, string>; errorCode?: string } {
  const hashIndex = url.indexOf('#');
  const queryStart = url.indexOf('?');
  const paramString =
    hashIndex >= 0
      ? url.slice(hashIndex + 1)
      : queryStart >= 0
        ? url.slice(queryStart + 1).split('#')[0]
        : '';

  const params: Record<string, string> = {};
  for (const part of paramString.split('&')) {
    if (!part) continue;
    const [rawKey, rawValue = ''] = part.split('=');
    const key = decodeURIComponent(rawKey);
    params[key] = decodeURIComponent(rawValue);
  }

  return { params, errorCode: params.error_code ?? params.error };
}

async function createSessionFromUrl(url: string): Promise<Session | null> {
  const { params, errorCode } = parseOAuthParams(url);
  if (errorCode) throw new Error(errorCode);

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  const code = params.code;

  if (accessToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return data.session;
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }

  return null;
}

/** Finish OAuth from a deep-link callback URL (cold start). */
export async function completeOAuthFromUrl(url: string): Promise<Session> {
  const session = await createSessionFromUrl(url);
  if (!session || !isAppSession(session)) {
    await supabase.auth.signOut();
    throw new Error('Could not establish a signed-in session');
  }
  return session;
}

/** Opens Google OAuth via Supabase and returns an app session on success. */
export async function signInWithGoogle(): Promise<Session> {
  const redirectTo = getAuthRedirectUri();

  if (__DEV__) {
    console.log('[Auth] OAuth redirect URI:', redirectTo);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('Could not start Google sign-in');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new AuthCancelledError();
  }

  if (result.type !== 'success') {
    throw new Error('Google sign-in was not completed');
  }

  return completeOAuthFromUrl(result.url);
}
