// Stadia Maps basemap. Authentication is domain-based in production (Origin /
// Referer checked against the property's allowed domains in the Stadia client
// dashboard). Where that does not apply — localhost, previews, or a domain not
// yet registered — the API key is appended to every Stadia request instead.
// Both mechanisms are accepted by Stadia; the key is simply ignored when the
// domain is already allowed.
export const MAP_STYLE = "https://tiles.stadiamaps.com/styles/alidade_smooth.json"

const STADIA_HOST = /^https:\/\/([a-z0-9-]+\.)?stadiamaps\.com\//i

export function withStadiaKey(
  url: string,
  key: string | undefined = process.env.NEXT_PUBLIC_STADIA_API_KEY,
): string {
  if (!key || !STADIA_HOST.test(url)) return url
  if (/[?&]api_key=/.test(url)) return url
  return `${url}${url.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(key)}`
}
