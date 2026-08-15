/**
 * The client half of the double-submit CSRF pattern.
 *
 * lib/csrf.ts sets a `csrf-token` cookie on every response with
 * `httpOnly: false` — "Client JS needs to read this" — and rejects any
 * mutating /api/ request whose `x-csrf-token` header does not match it. No
 * client ever sent that header, so once the cookie existed every POST from the
 * browser came back 403. The export is where this surfaced: the request never
 * reached the route, which is why the server log showed nothing at all.
 *
 * Reading the cookie and echoing it back is the whole protocol — an attacker's
 * page cannot read our cookie, so only our own origin can produce the header.
 */
const CSRF_COOKIE_NAME = "csrf-token"
const CSRF_HEADER_NAME = "x-csrf-token"

export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`)
  )
  return match ? decodeURIComponent(match[1]) : null
}

/** fetch(), with the CSRF header attached. Use for any mutating /api/ call. */
export function csrfFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = getCsrfToken()
  const headers = new Headers(init.headers)
  if (token) headers.set(CSRF_HEADER_NAME, token)
  return fetch(input, { ...init, headers })
}
