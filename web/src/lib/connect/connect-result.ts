/** An account a creator can connect (IN-FR-09). */
export type ConnectPlatform = "youtube" | "instagram";

const NAME: Record<ConnectPlatform, string> = { youtube: "YouTube", instagram: "Instagram" };
const READS: Record<ConnectPlatform, string> = { youtube: "your channel", instagram: "your Reels" };
const PLATFORMS = Object.keys(NAME) as ConnectPlatform[];
// Ours (which card), and the backend's two (the result).
const KEYS = ["connecting", "connected", "connect"];

/**
 * The link that connects an account: the backend's connect route, which
 * leaves for Google or Instagram and comes back to `path`, marked with the
 * platform so the page knows which card a result is for.
 *
 * @param apiBaseUrl - the API's address
 * @param platform - the account to connect
 * @param path - this page's path, without a query
 * @see docs/specs/creator-invite-frd.md IN-FR-11 (1.3)
 */
export function connectHref(apiBaseUrl: string, platform: ConnectPlatform, path: string) {
  return `${apiBaseUrl}/connect/${platform}?next=${encodeURIComponent(`${path}?connecting=${platform}`)}`;
}

/**
 * What came back from connecting, read from the page's query: which card,
 * the message to show on it (null when it connected), and the query with the
 * result taken out, so a reload doesn't repeat it.
 *
 * @param search - `location.search`
 * @returns null when the query holds no result for a known platform
 * @see docs/specs/creator-invite-frd.md IN-FR-11 (1.3)
 */
export function readConnectResult(search: string): { platform: ConnectPlatform; message: string | null; rest: string } | null {
  const params = new URLSearchParams(search);
  const platform = PLATFORMS.find((p) => p === params.get("connecting"));
  const connected = params.get("connected");
  const failed = params.get("connect");
  if (!platform || (!connected && !failed)) return null;
  for (const k of KEYS) params.delete(k);
  const rest = params.size ? `?${params}` : "";
  return { platform, message: failed ? problem(platform, failed) : null, rest };
}

function problem(platform: ConnectPlatform, reason: string) {
  const name = NAME[platform];
  if (reason === "declined") return `${name} isn’t connected, because access wasn’t allowed. Sponing only reads ${READS[platform]}.`;
  if (reason === "no_channel" && platform === "youtube") return "That Google account has no YouTube channel. Connect the account that owns your channel.";
  if (reason === "not_professional" && platform === "instagram")
    return "That Instagram account isn’t a professional account. Switch it to Creator or Business in Instagram, then connect again.";
  return `We couldn’t connect ${name}. Try again.`;
}
