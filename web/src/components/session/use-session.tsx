"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type ApiError } from "@/lib/api";
import type { CreatorProfile } from "@/lib/invite/types";

export type SessionLoad =
  | { status: "loading" }
  | { status: "signed_in"; me: CreatorProfile }
  | { status: "signed_out" }
  | { status: "error"; error: ApiError };

const SessionContext = createContext<{ load: SessionLoad; retry: () => void; setMe: (me: CreatorProfile) => void } | null>(null);

/**
 * Who is signed in, read once from `GET /me` for the creator app. The page
 * never sees a token: the session is the backend's HttpOnly cookie (SI-BR-01).
 *
 * @see docs/specs/sign-in-frd.md SI-FR-04
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [load, setLoad] = useState<SessionLoad>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    api.getProfile().then((r) => {
      if (!current) return;
      if (r.ok) setLoad({ status: "signed_in", me: r.data });
      else setLoad(r.error === "signed_out" ? { status: "signed_out" } : { status: "error", error: r.error });
    });
    return () => {
      current = false;
    };
  }, [attempt]);
  const retry = useCallback(() => {
    setLoad({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  const setMe = useCallback((me: CreatorProfile) => setLoad({ status: "signed_in", me }), []);
  return <SessionContext.Provider value={{ load, retry, setMe }}>{children}</SessionContext.Provider>;
}

/** The session, inside SessionProvider. */
export function useSession() {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession needs a SessionProvider");
  return s;
}

/** The session when there is a provider (the account menu outside the app, tests), else null. */
export const useOptionalSession = () => useContext(SessionContext);
