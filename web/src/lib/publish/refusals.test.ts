import { describe, expect, test } from "vitest";
import { refusal } from "./refusals";

const who = { brand: "Glow Theory", channel: "Ada Makes", account: "@adamakes" };

describe("PP-FR-37 refusals, in plain words", () => {
  test.each([
    ["not_a_youtube_link", "That isn’t a YouTube video link. Copy it from YouTube Studio or the video’s Share button."],
    ["invalid", "That isn’t a YouTube video link. Copy it from YouTube Studio or the video’s Share button."],
    ["video_not_found", "We couldn’t find that video on YouTube. Check the link."],
    ["not_your_channel", "That video isn’t on Ada Makes. Use a video from the channel you connected."],
    ["not_the_approved_file", "That video isn’t the draft Glow Theory approved. Upload the approved file as it was, without re-editing it."],
    ["video_private", "That video is private. Make it unlisted so we can check it."],
    ["already_published", "This post is already published with a different video. The go-ahead stays with that one."],
    ["youtube_unavailable", "YouTube isn’t answering right now. Try again in a few minutes."],
  ])("asking for the go-ahead: %s", (code, text) => {
    expect(refusal("go_ahead", code, who)).toEqual({ text });
  });

  test.each([
    ["not_public_yet", "Your video isn’t public yet. Make it public, then tap again."],
    ["no_video", "We don’t have your video’s link yet. Get the go-ahead first."],
    ["video_not_found", "We couldn’t find your video on YouTube. Check it’s still on your channel."],
    ["youtube_unavailable", "YouTube isn’t answering right now. Try again in a few minutes."],
    ["not_an_instagram_link", "That isn’t an Instagram link."],
    ["reel_not_found", "We couldn’t find that Reel on @adamakes."],
    ["not_a_reel", "That link is a post, not a Reel."],
  ])("I've posted it: %s", (code, text) => {
    expect(refusal("posted", code, who)).toEqual({ text });
  });

  test("reconnecting is offered with its words, for YouTube and Instagram", () => {
    expect(refusal("go_ahead", "reconnect_youtube", who)).toEqual({ text: "We can’t read your YouTube channel any more.", reconnect: "youtube" });
    expect(refusal("posted", "reconnect_instagram", who)).toEqual({ text: "We can’t read your Instagram account any more.", reconnect: "instagram" });
  });

  test("checking again outside the fix window says the time ended and asks for a reload", () => {
    expect(refusal("check_again", "not_in_fix_window", who)).toEqual({ text: "The time to fix this post has ended.", reload: true });
  });

  test("a code it doesn't know is left to the page's own message", () => {
    expect(refusal("posted", "something_new", who)).toBeNull();
  });
});
