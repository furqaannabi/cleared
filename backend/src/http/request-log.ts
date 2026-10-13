/**
 * The log of requests, and the handler for an error no route handled (deal set-up spec DS-FR-49 to
 * DS-FR-51; docs/decisions/2026-10-13-requests-and-errors-are-logged-by-our-own-middleware.md).
 *
 * A line holds ids, a route's pattern, a status and a time, and nothing else (DS-BR-15). It never
 * holds the path as it was asked for: a brand's token is part of a path. Nor a query string, which
 * can carry a one-time code or a file's name; nor a body, a header, an IP address or a user agent.
 * An error is logged by its name, its code and where it was thrown, never by its message: a message
 * can repeat what the database or another service was sent.
 */
import { randomUUID } from "node:crypto";
import type { Context, ErrorHandler, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { matchedRoutes } from "hono/route";
import type { AppEnv } from "./http";

export const REQUEST_ID_HEADER = "X-Request-Id";
const NO_ROUTE = "(no route)";
/** The parts of a path that are ids, and so may be logged. A token never is. */
const LOGGED_IDS = ["dealId", "deliverableId"] as const;
/** What an id looks like. Anything else typed where an id goes is left out. */
const ID = /^[\w-]{1,64}$/;

/** Told of each request and each failure: a message, and details that hold only what this module puts there. */
export type RequestLogger = (message: string, details: Record<string, unknown>) => void;

/**
 * The route that answered, as its pattern, and the ids in the path that the pattern names. The last
 * route matched that is a route and not something placed over every path. None, if no route matched.
 */
function routeOf(c: Context): { route: string; ids: Record<string, string> } {
  const matched = matchedRoutes(c).filter((route) => !route.path.includes("*"));
  const pattern = matched.at(-1)?.path;
  if (!pattern) return { route: NO_ROUTE, ids: {} };

  const names = pattern.split("/");
  const given = c.req.path.split("/");
  const ids: Record<string, string> = {};
  names.forEach((name, position) => {
    const key = name.startsWith(":") ? name.slice(1).replace(/\{.*$/, "") : undefined;
    const value = given[position];
    if (key && (LOGGED_IDS as readonly string[]).includes(key) && value && ID.test(value)) ids[key] = value;
  });
  // Written as the contract writes it: /deliverables/{deliverableId}.
  return { route: names.map((name) => (name.startsWith(":") ? `{${name.slice(1).replace(/\{.*$/, "")}}` : name)).join("/"), ids };
}

/**
 * Gives each request an id of the service's own making, puts it on the answer, and logs one line once
 * the request is answered. It is placed ahead of everything, so every answer has an id. Without a
 * logger the id is still made and sent, and nothing is logged.
 */
export function requestLog(log?: RequestLogger): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    // Never one the caller sent: a line could then be made to say anything.
    const requestId = randomUUID();
    c.set("requestId", requestId);
    const started = performance.now();
    await next();
    c.res.headers.set(REQUEST_ID_HEADER, requestId);
    if (!log || c.req.path === "/health") return;

    const { route, ids } = routeOf(c);
    const creatorId = c.get("creatorId");
    log("A request was answered", { requestId, method: c.req.method, route, ...ids, ...(creatorId ? { creatorId } : {}), status: c.res.status, ms: Math.round(performance.now() - started) });
  };
}

/** Where in the service's own code an error was thrown: file and line, nearest first. Nothing of the error's own words. */
function thrownAt(error: Error): string[] {
  const places: string[] = [];
  for (const frame of (error.stack ?? "").split("\n")) {
    // A frame, not the first line: that one is the name and the message.
    const place = /^\s*at .*?\(?((?:\/|[A-Za-z]:\\)[^()\s]*?):(\d+):\d+\)?\s*$/.exec(frame);
    if (!place || place[1]!.includes("node_modules")) continue;
    const from = place[1]!.lastIndexOf("/src/");
    const file = (from === -1 ? place[1]!.split("/").slice(-2).join("/") : place[1]!.slice(from + 1)).replace(/[^\w./-]/g, "");
    places.push(`${file}:${place[2]}`);
    if (places.length === 5) break;
  }
  return places;
}

/**
 * Answers an error no route handled with 500 in the one error shape, and logs it once (DS-FR-50).
 * The answer says nothing of what went wrong. The log says what kind of error it was and where.
 */
export function unhandled(log: RequestLogger): ErrorHandler<AppEnv> {
  return (error, c) => {
    // An answer a middleware chose to give by throwing it is that answer, not a failure.
    if (error instanceof HTTPException) return error.getResponse();
    const code = (error as { code?: unknown }).code;
    log("A request failed", {
      requestId: c.get("requestId"),
      name: /^\w{1,60}$/.test(error.name) ? error.name : "Error",
      ...(typeof code === "string" && /^\w{1,40}$/.test(code) ? { code } : {}),
      at: thrownAt(error),
    });
    return c.json({ error: { code: "server_error" } }, 500);
  };
}
