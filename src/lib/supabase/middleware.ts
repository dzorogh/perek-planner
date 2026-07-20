import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
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
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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
    if (error) {
      authCheckFailed = true;
    } else {
      user = data.user;
    }
  } catch {
    authCheckFailed = true;
  }

  // Transient auth failures: do not treat as signed-out (avoids login bounce / 500).
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
