/** A page view as Vercel Web Analytics hands it to `beforeSend`. */
export type PageView = { type: "pageview" | "event"; url: string };

/**
 * Cleans a page view's address before it leaves the browser: the brand's
 * invite token in `/b/{token}` becomes `[token]`, and the query string and
 * fragment are dropped.
 *
 * @param event - the page view Vercel is about to send
 * @see docs/specs/legal-pages-frd.md LG-FR-17 (1.4)
 */
export function cleanPageView<E extends PageView>(event: E): E {
  const url = new URL(event.url);
  url.pathname = url.pathname.replace(/^\/b\/[^/]+/, "/b/[token]");
  url.search = "";
  url.hash = "";
  return { ...event, url: url.toString() };
}
