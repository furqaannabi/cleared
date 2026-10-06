import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/** MSW service worker for local development. Never started in production. */
export const worker = setupWorker(...handlers);
