import { http } from "msw";
import { setupWorker } from "msw/browser";
import { apiBaseUrl } from "@/lib/api";
import { loadSaved, save } from "./browser-persist";
import { handlers } from "./handlers";

/**
 * MSW service worker for local development. Never started in production.
 * The mock data is kept in this browser across page loads and tabs: brought
 * up to date before each request, saved after each mocked response.
 */
export const worker = setupWorker(
  // Answers nothing: falls through to the real handlers once the data is current.
  http.all(`${apiBaseUrl}/*`, () => {
    loadSaved();
  }),
  ...handlers,
);
worker.events.on("response:mocked", save);
