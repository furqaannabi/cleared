import { http, HttpResponse, type JsonBodyType } from "msw";
import { apiBaseUrl } from "@/lib/api";
import { server } from "./server";

type Method = "post" | "put" | "patch" | "delete";

/** What a change sent: its JSON body, and the path's parameters. */
export interface Sent {
  body: never;
  params: Record<string, string>;
}

/**
 * One thing the API keeps, stubbed for this test: `GET {path}` answers it as
 * it now stands, and `on` answers one change with what it leads to, which
 * later reads see. Each test writes the answers it needs; nothing here copies
 * the backend's rules.
 *
 * @param path - where it is read, after the API's base, e.g. `/deals/deal_glow`
 * @param initial - what the page first reads
 */
export function stubState<T extends JsonBodyType>(path: string, initial: T) {
  let current = initial;
  server.use(http.get(`${apiBaseUrl}${path}`, () => HttpResponse.json(current)));
  return {
    /**
     * @param method - the change's method
     * @param sub - its path after `path`, e.g. `/brief` or `/items/:itemId`; "" for `path` itself
     * @param next - what it is after the change, from before it and what was sent
     */
    on(method: Method, sub: string, next: (before: T, sent: Sent) => T) {
      this.at(method, `${path}${sub}`, next);
    },
    /**
     * As `on`, for a change at another path that answers with this, e.g. a
     * reply to a note that answers with the invite.
     *
     * @param method - the change's method
     * @param at - its whole path after the API's base
     * @param next - what it is after the change
     */
    at(method: Method, at: string, next: (before: T, sent: Sent) => T) {
      server.use(
        http[method](`${apiBaseUrl}${at}`, async ({ request, params }) => {
          const text = await request.text();
          current = next(current, { body: (text ? JSON.parse(text) : undefined) as never, params: params as Record<string, string> });
          return HttpResponse.json(current);
        }),
      );
    },
    /** What it now is. */
    now: () => current,
  };
}
