/**
 * Fetching a Reel's video (Instagram Reels spec IG-FR-20). It is the one place the service fetches an
 * address it was handed, so it is strict about which (IG-BR-08): only the address Instagram's own API
 * returned is ever passed here, and even that must be https, on a named host, and is never followed
 * anywhere else. The address is signed by Instagram and reads the video for anyone who has it, so it
 * is never logged or put in an error (IG-BR-12). The caller stores the stream with a limit on its size.
 *
 * Not yet proven against Instagram: whether its video addresses are served directly, with no
 * redirect, is to be seen on a real Reel.
 */

/** The video could not be fetched just now. Nothing was decided; the live check tries again (IG-FR-26). */
export class VideoUnavailable extends Error {
  constructor(why: string) {
    super(`A Reel's video could not be fetched: ${why}`);
    this.name = "VideoUnavailable";
  }
}

/** Fetches the video at an address as a stream. Throws `VideoUnavailable` when it cannot be fetched. */
export type Download = (address: string) => Promise<ReadableStream<Uint8Array>>;

/** For the whole video, not only its first byte. Under the time a job may hold its claim, so a slow fetch is never run twice at once. */
const TIMEOUT_MS = 4 * 60_000;

/** Whether an address may be fetched at all: https, no user name in it, and a host that is a name with a dot, not a number. */
function allowed(address: string): boolean {
  if (!URL.canParse(address)) return false;
  const url = new URL(address);
  if (url.protocol !== "https:" || url.username || url.password) return false;
  const host = url.hostname;
  // An address by number, IPv4 or IPv6, could be one inside the network. So could a bare name.
  if (host.includes(":") || host.startsWith("[") || /^[\d.]+$/.test(host) || !host.includes(".")) return false;
  return host !== "localhost" && !host.endsWith(".localhost") && !host.endsWith(".local") && !host.endsWith(".internal");
}

export function createDownload(
  config: {
    /** Told how each fetch went: a status and a timing. Never the address. */
    log?: (message: string, details: Record<string, unknown>) => void;
    /** The network. Tests pass a stand-in. */
    fetch?: typeof fetch;
  } = {},
): Download {
  const send = config.fetch ?? fetch;

  return async (address) => {
    if (!allowed(address)) throw new VideoUnavailable("its address is not one that may be fetched");
    const started = Date.now();
    let response: Response | undefined;
    try {
      // No cookie and no token go with it, and it is not followed to any other address.
      response = await send(address, { method: "GET", redirect: "manual", credentials: "omit", signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      // Nothing of the error is kept: its message can repeat the address.
    }
    config.log?.(response?.status === 200 ? "A Reel's video was fetched" : "A Reel's video could not be fetched", { status: response?.status ?? "unreachable", ms: Date.now() - started });
    if (!response) throw new VideoUnavailable("it could not be reached");
    if (response.status !== 200 || !response.body) throw new VideoUnavailable(`the answer was ${response.status}`);
    return response.body;
  };
}
