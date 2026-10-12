import { http, HttpResponse } from "msw";
import { apiBaseUrl } from "@/lib/api";
import type { Deliverable } from "@/lib/deliverable/types";
import { deliverables } from "./fixtures/deliverables";
import { server } from "./server";
import { apiError } from "./stub-api";
import type { Sent } from "./stub-state";

type Method = "post" | "put" | "patch" | "delete";

/**
 * This test's posts as their creator reads them: `GET /deliverables/{id}`
 * answers each as it now stands, and the same "not found" for any other
 * (DC-FR-38). `on` answers one change to a post with the post it leads to.
 *
 * @param posts - the posts the API knows about
 */
/** The seeded posts: Glow Theory's video (run 2, one to fix, one unsure), its Reel, released and failed copies, Northbound's Short, Kora's Reel and Wren's video. */
export const seededPosts = (): Deliverable[] => Object.values(deliverables);

export function stubPosts(...posts: Deliverable[]) {
  const known = new Map(posts.map((p) => [p.id, structuredClone(p)]));
  server.use(
    http.get(`${apiBaseUrl}/deliverables/:id`, ({ params }) => {
      const post = known.get(params.id as string);
      return post ? HttpResponse.json(post) : apiError({ code: "not_found" }, 404);
    }),
  );
  return {
    /**
     * @param id - the post
     * @param method - the change's method
     * @param sub - its path after `/deliverables/{id}`, e.g. `/check/retry`
     * @param next - the post after the change, from before it and what was sent
     */
    on(id: string, method: Method, sub: string, next: (before: Deliverable, sent: Sent) => Deliverable) {
      server.use(
        http[method](`${apiBaseUrl}/deliverables/${id}${sub}`, async ({ request, params }) => {
          const text = await request.text();
          const after = next(known.get(id)!, { body: (text ? JSON.parse(text) : undefined) as never, params: params as Record<string, string> });
          known.set(id, after);
          return HttpResponse.json(after);
        }),
      );
    },
  };
}
