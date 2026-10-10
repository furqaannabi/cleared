/** A browser for route tests: it keeps the cookies it is given and sends them back, as a real one would. */
interface App {
  request(path: string, init?: RequestInit): Response | Promise<Response>;
}

export function browserFor(app: App, appOrigin: string) {
  const cookies = new Map<string, string>();

  /** Sends a request as a script on Cleared's own app would, unless `origin` says otherwise. */
  async function send(
    method: string,
    path: string,
    options: { body?: unknown; origin?: string | null; form?: boolean; file?: { bytes: Uint8Array; type?: string } } = {},
  ) {
    const headers = new Headers();
    const origin = options.origin === undefined ? appOrigin : options.origin;
    if (origin) headers.set("origin", origin);
    if (cookies.size) headers.set("cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));
    let body: string | Uint8Array | undefined;
    if (options.file) {
      // A file is sent as the body itself, as the page sends a draft.
      headers.set("content-type", options.file.type ?? "video/mp4");
      body = options.file.bytes;
    } else if (options.form) headers.set("content-type", "application/x-www-form-urlencoded");
    else if (options.body !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(options.body);
    }
    const response = await app.request(path, { method, headers, body });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair = "", ...attributes] = cookie.split("; ");
      const [name = "", value = ""] = pair.split("=");
      if (value === "" || attributes.some((attribute) => attribute.toLowerCase() === "max-age=0")) cookies.delete(name);
      else cookies.set(name, value);
    }
    return response;
  }

  return {
    cookies,
    send,
    /** Follows a link or a redirect: a GET the browser makes itself, which carries no origin. */
    visit: (path: string) => send("GET", path, { origin: null }),
  };
}

export type Browser = ReturnType<typeof browserFor>;
