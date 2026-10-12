import { describe, expect, test } from "vitest";
import { aProfile } from "@/test/stub-api";
import { settingsView } from "./settings-view";

describe("ST-FR-02 to ST-FR-10 the settings view", () => {
  test("the profile band: initials, name and the Google email", () => {
    expect(settingsView(aProfile({ name: "Ada Okafor", email: "ada.okafor@gmail.com" }))).toMatchObject({
      initials: "AO",
      name: "Ada Okafor",
      signedInAs: "Signed in with Google as ada.okafor@gmail.com",
    });
    expect(settingsView(aProfile({ email: undefined })).signedInAs).toBeNull();
  });

  test("ST-FR-06, ST-FR-07 (1.3): each platform connected by name, or not connected; Disconnect on a connected one, no flag", () => {
    const v = settingsView(aProfile({ accounts: [{ platform: "youtube", name: "Ada Makes", inUse: false }] }));
    expect(v.accounts).toEqual([
      { platform: "youtube", label: "YouTube", name: "Ada Makes", disconnect: true, inUse: false },
      { platform: "instagram", label: "Instagram", name: null, disconnect: false, inUse: false },
    ]);
  });

  test("ST-FR-08 (1.3): an account in use by a post under way has no Disconnect, and says so", () => {
    const v = settingsView(aProfile({ accounts: [{ platform: "youtube", name: "Ada Makes", inUse: true }] }));
    expect(v.accounts[0]).toMatchObject({ disconnect: false, inUse: true });
  });
});
