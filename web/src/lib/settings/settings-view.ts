import type { CreatorProfile } from "@/lib/invite/types";

type Platform = CreatorProfile["accounts"][number]["platform"];

/** One connected-account row: the account's name when connected, and whether Disconnect shows. */
export interface AccountRow {
  platform: Platform;
  label: string;
  name: string | null;
  disconnect: boolean;
}

/** What the settings page shows, worked out once from the profile. */
export interface SettingsView {
  initials: string;
  name: string;
  /** Null when the API sends no email (ST-FR-02). */
  signedInAs: string | null;
  paypalEmail: string | null;
  accounts: AccountRow[];
  deleteAccount: boolean;
}

const PLATFORMS: { platform: Platform; label: string }[] = [
  { platform: "youtube", label: "YouTube" },
  { platform: "instagram", label: "Instagram" },
];

/**
 * The creator's settings from their profile. Disconnecting and deleting show
 * only with the build flag on (ST-FR-12); whether either is allowed now is the
 * API's answer when it's tried (ST-BR-04).
 *
 * @param me - the creator's profile
 * @param options.removal - whether disconnecting and deleting are switched on
 * @see docs/specs/settings-frd.md ST-FR-02 to ST-FR-12
 */
export function settingsView(me: CreatorProfile, { removal }: { removal: boolean }): SettingsView {
  const initials = me.name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return {
    initials,
    name: me.name,
    signedInAs: me.email ? `Signed in with Google as ${me.email}` : null,
    paypalEmail: me.paypalEmail ?? null,
    accounts: PLATFORMS.map(({ platform, label }) => {
      const name = me.accounts.find((a) => a.platform === platform)?.name ?? null;
      return { platform, label, name, disconnect: removal && name !== null };
    }),
    deleteAccount: removal,
  };
}
