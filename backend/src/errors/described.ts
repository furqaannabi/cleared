/**
 * An error as it may be logged or kept (deal set-up spec DS-FR-50, DS-FR-52, DS-FR-53, DS-BR-15): its
 * name, its code and where in the service's own code it was thrown. Never its message: a message can
 * repeat what the database or another service was sent, or what it answered.
 */

export interface Described {
  name: string;
  code?: string;
  /** File and line, nearest first, within the service's own code. */
  at: string[];
}

/** Where in the service's own code an error was thrown. Nothing of the error's own words. */
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

/** What may be said of something that was thrown. Something that is not an error at all is only that it happened. */
export function described(thrown: unknown): Described {
  if (!(thrown instanceof Error)) return { name: "Error", at: [] };
  const code = (thrown as { code?: unknown }).code;
  return {
    // A name or a code that is not a plain word is not trusted to be one.
    name: /^\w{1,60}$/.test(thrown.name) ? thrown.name : "Error",
    ...(typeof code === "string" && /^\w{1,40}$/.test(code) ? { code } : {}),
    at: thrownAt(thrown),
  };
}

/** The same, as one short line of text: "DatabaseSaidNo P2002 at src/jobs/jobs.ts:104". */
export function inWords(error: Described): string {
  return `${error.name}${error.code ? ` ${error.code}` : ""}${error.at.length > 0 ? ` at ${error.at.join(", ")}` : ""}`;
}
