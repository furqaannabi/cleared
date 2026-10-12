import type { CreatorProfile } from "@/lib/invite/types";

type Platform = CreatorProfile["accounts"][number]["platform"];

/** One connected-account row: the account's name when connected, whether Disconnect shows, and whether a post under way is using it. */
export interface AccountRow {
  platform: Platform;
  label: string;
  name: string | null;
  disconnect: boolean;
  inUse: boolean;
}

/** What the settings page shows, worked out once from the profile. */
export interface SettingsView {
  initials: string;
  name: string;
  /** Null when the API sends no email (ST-FR-02). */
  signedInAs: string | null;
  paypalEmail: string | null;
  accounts: AccountRow[];
}

const PLATFORMS: { platform: Platform; label: string }[] = [
  { platform: "youtube", label: "YouTube" },
  { platform: "instagram", label: "Instagram" },
];

/**
 * The creator's settings from their profile. Disconnect shows on a connected
 * account no post under way is using; whether disconnecting or deleting is
 * allowed now is still the API's answer when it's tried (ST-BR-04).
 *
 * @param me - the creator's profile
 * @see docs/specs/settings-frd.md ST-FR-02 to ST-FR-10 (1.3)
 */
export function settingsView(me: CreatorProfile): SettingsView {
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
      const account = me.accounts.find((a) => a.platform === platform);
      // ST-FR-08 (1.3): an account a post under way is using can't be disconnected yet (AH-FR-12).
      const inUse = account?.inUse ?? false;
      return { platform, label, name: account?.name ?? null, disconnect: !!account && !inUse, inUse };
    }),
  };
}
