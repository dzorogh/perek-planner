/** Supabase returns this from getUser() when there is simply no session cookie. */
export function isAuthSessionMissingError(
  error: { name?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  return (
    error.name === "AuthSessionMissingError" ||
    /auth session missing/i.test(error.message ?? "")
  );
}
