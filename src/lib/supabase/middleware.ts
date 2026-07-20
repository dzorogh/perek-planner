import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isAuthSessionMissingError } from "@/lib/supabase/auth-errors";

const AUTH_PATH_PREFIX = "/auth";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function isPublicPath(pathname: string) {
  return pathname === AUTH_PATH_PREFIX || pathname.startsWith(`${AUTH_PATH_PREFIX}/`);
}

function envReady() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
}

function redirectWithCookies(
  request: NextRequest,
  pathname: string,
  cookiesToSet: CookieToSet[],
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const redirectResponse = NextResponse.redirect(url);
  // Preserve refreshed session cookies on redirect (including attributes).
  for (const { name, value, options } of cookiesToSet) {
    redirectResponse.cookies.set(name, value, options);
  }
  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });
  let cookiesToSet: CookieToSet[] = [];

  const bypassAuth =
    process.env.KEPLO_DEV_BYPASS_AUTH === "true" &&
    process.env.NODE_ENV !== "production";

  if (process.env.KEPLO_DEV_BYPASS_AUTH === "true" && process.env.NODE_ENV === "production") {
    console.error(
      "KEPLO_DEV_BYPASS_AUTH is enabled in production; ignoring bypass.",
    );
  }

  if (!envReady()) {
    if (!bypassAuth && !isPublicPath(request.nextUrl.pathname)) {
      return redirectWithCookies(request, "/auth/login", cookiesToSet);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(nextCookiesToSet) {
          cookiesToSet = nextCookiesToSet;
          nextCookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          nextCookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  let user: Awaited<
    ReturnType<typeof supabase.auth.getUser>
  >["data"]["user"] = null;
  let authCheckFailed = false;

  try {
    const { data, error } = await supabase.auth.getUser();
    user = data.user;
    // No cookie/session is signed-out, not a transient outage.
    if (error && !isAuthSessionMissingError(error)) {
      authCheckFailed = true;
    }
  } catch {
    authCheckFailed = true;
  }

  // True transient auth failures (network / 5xx): do not bounce a possibly-valid session.
  if (authCheckFailed) {
    return supabaseResponse;
  }

  // Bypass: allow shell without a session, but still refresh cookies when present
  // and send signed-in operators away from /auth/login.
  if (!bypassAuth && !user && !isPublicPath(request.nextUrl.pathname)) {
    return redirectWithCookies(request, "/auth/login", cookiesToSet);
  }

  if (user && request.nextUrl.pathname.startsWith("/auth/login")) {
    return redirectWithCookies(request, "/", cookiesToSet);
  }

  return supabaseResponse;
}
