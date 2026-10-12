/**
 * Fetching a Reel's video (Instagram Reels spec IG-FR-20, IG-BR-08, IG-BR-12): from the address
 * Instagram's API returned and no other, over HTTPS, as a stream the caller stores with a size limit.
 */
import { describe, expect, test } from "bun:test";
import { createDownload, VideoUnavailable } from "./download";

const ADDRESS = "https://video.cdninstagram.com/v/t50/reel.mp4?sig=secret-signature";

function standIn(answer: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const logged: unknown[] = [];
  const download = createDownload({
    log: (...parts) => logged.push(parts),
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return answer(String(url), init ?? {});
    }) as typeof fetch,
  });
  return { download, calls, logged };
}
const bytesOf = async (stream: ReadableStream<Uint8Array>) => new Uint8Array(await new Response(stream).arrayBuffer());

describe("IG-FR-20 the video is fetched from the address Instagram gave", () => {
  test("its bytes come back as a stream, fetched with a plain GET that carries no token and no cookie", async () => {
    const { download, calls } = standIn(() => new Response(new Uint8Array([1, 2, 3, 4])));

    expect(await bytesOf(await download(ADDRESS))).toEqual(new Uint8Array([1, 2, 3, 4]));

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(ADDRESS);
    expect(calls[0]!.init.method ?? "GET").toBe("GET");
    expect(calls[0]!.init.credentials).toBe("omit");
    expect(new Headers(calls[0]!.init.headers).has("authorization")).toBe(false);
  });

  test("it is never sent on to another address: a redirect is a failure", async () => {
    const { download, calls } = standIn(() => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }));

    expect(download(ADDRESS)).rejects.toBeInstanceOf(VideoUnavailable);
    expect(calls[0]!.init.redirect).toBe("manual");
  });

  test.each([403, 404, 410, 500, 503])("an answer of %i is a failure, to be tried again", async (status) => {
    expect(standIn(() => new Response("gone", { status })).download(ADDRESS)).rejects.toBeInstanceOf(VideoUnavailable);
  });

  test("an address that cannot be reached is a failure too", async () => {
    const { download } = standIn(() => {
      throw new Error(`could not connect to ${ADDRESS}`);
    });

    expect(download(ADDRESS)).rejects.toBeInstanceOf(VideoUnavailable);
  });
});

describe("IG-BR-08 only an https address on a named host is ever fetched", () => {
  test.each([
    ["not https", "http://video.cdninstagram.com/reel.mp4"],
    ["a file on this machine", "file:///etc/passwd"],
    ["this machine itself", "https://localhost/reel.mp4"],
    ["an address inside the network, by number", "https://169.254.169.254/latest/meta-data"],
    ["a private address, by number", "https://10.0.0.5/reel.mp4"],
    ["an IPv6 address", "https://[::1]/reel.mp4"],
    ["a name with no dot in it", "https://metadata/reel.mp4"],
    ["an address carrying a user name", "https://user:pass@video.cdninstagram.com/reel.mp4"],
    ["not an address at all", "reel.mp4"],
  ])("%s is refused, and nothing is fetched", async (_what, address) => {
    const { download, calls } = standIn(() => new Response("x"));

    expect(download(address)).rejects.toBeInstanceOf(VideoUnavailable);
    expect(calls).toEqual([]);
  });
});

describe("IG-BR-12 the address is never logged or put in an error", () => {
  test.each([
    ["a fetch that worked", () => new Response("x")],
    ["one that was refused", () => new Response("no", { status: 403 })],
    ["one that could not connect", () => {
      throw new Error(`could not connect to ${ADDRESS}`);
    }],
  ] as const)("%s", async (_what, answer) => {
    const { download, logged } = standIn(answer as never);

    const thrown = await download(ADDRESS).then(
      () => "",
      (error: Error) => error.message,
    );

    for (const secret of ["secret-signature", "cdninstagram", "reel.mp4"]) {
      expect(JSON.stringify(logged)).not.toContain(secret);
      expect(thrown).not.toContain(secret);
    }
    expect(logged).toHaveLength(1);
  });
});
