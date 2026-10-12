/**
 * Deleting an account asked for by email (account and history spec AH-FR-22): the command a person at
 * Cleared runs. It runs the same code as the route, is refused for the same reasons, and asks for the
 * email to be typed again before it deletes.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { heldWorld, resetDatabase, type HeldWorld } from "../../test/held-post";
import { prisma } from "../db";
import { deleteByEmail } from "./delete-command";

beforeEach(resetDatabase);

/** Runs the command as a person would, typing `typed` when asked. */
async function run(world: HeldWorld, args: string[], typed = "") {
  const printed: string[] = [];
  const asked: string[] = [];
  const code = await deleteByEmail({ prisma, removal: world.removal, ask: async (question) => (asked.push(question), typed), print: (line) => void printed.push(line) }, args);
  return { code, printed: printed.join("\n"), asked };
}

describe("AH-FR-22 deleting an account by its Google email", () => {
  test("the email typed again deletes the account, as the route would", async () => {
    const world = heldWorld();
    await world.creator();

    const done = await run(world, ["sam@example.com"], "sam@example.com");

    expect(done.code).toBe(0);
    expect(done.asked).toHaveLength(1);
    expect(done.printed).toContain("Deleted");
    expect(await prisma.creator.count()).toBe(0);
    expect(world.google.revoked).toEqual(["refresh-sam"]);
  });

  test("the email is matched whatever its capitals, and spaces around it are ignored", async () => {
    const world = heldWorld();
    await world.creator();

    expect((await run(world, [" Sam@Example.com "], "sam@example.com")).code).toBe(0);
    expect(await prisma.creator.count()).toBe(0);
  });

  test.each([
    ["nothing typed", ""],
    ["another email typed", "ada@example.com"],
  ])("with %s when asked, nothing is deleted", async (_what, typed) => {
    const world = heldWorld();
    await world.creator();

    const done = await run(world, ["sam@example.com"], typed);

    expect(done.code).toBe(1);
    expect(done.printed).toContain("Nothing was deleted");
    expect(await prisma.creator.count()).toBe(1);
  });

  test("an email nobody signs in with deletes nothing, and nobody is asked to confirm", async () => {
    const world = heldWorld();
    await world.creator();

    const done = await run(world, ["nobody@example.com"], "nobody@example.com");

    expect(done.code).toBe(1);
    expect(done.asked).toEqual([]);
    expect(await prisma.creator.count()).toBe(1);
  });

  test("it is refused for the same reasons as the route, and prints what is in the way", async () => {
    const world = heldWorld();
    const deal = await world.heldPost();

    const done = await run(world, ["sam@example.com"], "sam@example.com");

    expect(done.code).toBe(1);
    expect(done.printed).toContain("Glow Skincare: a post is held");
    expect(done.printed).toContain("Nothing was deleted");
    expect(await prisma.creator.count()).toBe(1);
    expect(await world.money.view(deal.post)).toMatchObject({ stage: "held" });
  });

  test("AH-BR-10 what it prints names the account by its id, and a brand's name is printed as plain text", async () => {
    const world = heldWorld();
    const sam = await world.creator();
    await sam.send("POST", "/deals", { body: { brandName: "Glow\u001b[31m Skincare", deliverables: [{ platform: "youtube_video" }] } });
    const { id } = await prisma.creator.findFirstOrThrow();

    const done = await run(world, ["sam@example.com"], "sam@example.com");

    expect(done.printed).toContain(id);
    expect(done.printed).not.toContain("\u001b");
    expect(done.printed).not.toContain("Sam Rivera");
  });

  test("anything but one email is a usage error", async () => {
    const world = heldWorld();
    await world.creator();

    expect((await run(world, [])).code).toBe(2);
    expect((await run(world, ["sam@example.com", "extra"])).code).toBe(2);
    expect((await run(world, ["not-an-email"])).code).toBe(2);
    expect(await prisma.creator.count()).toBe(1);
  });
});
