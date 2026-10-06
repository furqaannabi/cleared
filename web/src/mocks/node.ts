import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/** MSW server for Vitest. Tests add per-test handlers with `server.use()`. */
export const server = setupServer(...handlers);
