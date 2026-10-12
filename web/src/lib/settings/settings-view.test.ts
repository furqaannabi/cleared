import { describe, expect, test } from "vitest";
import { aProfile } from "@/test/stub-api";
import { settingsView } from "./settings-view";

describe("ST-FR-02 to ST-FR-12 the settings view", () => {
  test("the profile band: initials, name and the Google email", () => {
    expect(settingsView(aProfile({ name: "Ada Okafor", email: "ada.okafor@gmail.com" }), { removal: false })).toMatchObject({
      initials: "AO",
      name: "Ada Okafor",
      signedInAs: "Signed in with Google as ada.okafor@gmail.com",
    });
    expect(settingsView(aProfile({ email: undefined }), { removal: false }).signedInAs).toBeNull();
  });

  test("ST-FR-06: each platform connected by name, or not connected", () => {
    const v = settingsView(aProfile({ accounts: [{ platform: "youtube", name: "Ada Makes" }] }), { removal: false });
    expect(v.accounts).toEqual([
      { platform: "youtube", label: "YouTube", name: "Ada Makes", disconnect: false },
      { platform: "instagram", label: "Instagram", name: null, disconnect: false },
    ]);
  });

  test("ST-FR-07, ST-FR-12: Disconnect and Delete only with the flag on, and Disconnect only on a connected account", () => {
    const v = settingsView(aProfile({ accounts: [{ platform: "youtube", name: "Ada Makes" }] }), { removal: true });
    expect(v.accounts.map((a) => a.disconnect)).toEqual([true, false]);
    expect(v.deleteAccount).toBe(true);
    expect(settingsView(aProfile(), { removal: false }).deleteAccount).toBe(false);
  });
});
