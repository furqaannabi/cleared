/** Which action the API refused. */
export type RefusedAction = "go_ahead" | "posted" | "check_again";

/** A refusal in words; `reconnect` offers reconnecting that platform, `reload` asks the page to read the post again. */
export interface Refusal {
  text: string;
  reconnect?: "youtube" | "instagram";
  reload?: true;
}

/** Names the words need: the brand, the creator's connected channel and Instagram account. */
export interface RefusalNames {
  brand: string;
  channel?: string;
  account?: string;
}

const NOT_A_LINK = "That isn’t a YouTube video link. Copy it from YouTube Studio or the video’s Share button.";
const YOUTUBE_DOWN = "YouTube isn’t answering right now. Try again in a few minutes.";
const INSTAGRAM_DOWN = "Instagram isn’t answering right now. Try again in a few minutes.";

/**
 * A refusal from the go-ahead, "I've posted it" or Check again, in plain
 * words, from the API's code. Null for a code it doesn't know, so the page
 * keeps its own message.
 *
 * @param action - which action was refused
 * @param code - the API's code
 * @param names - who and where, for the words
 * @see docs/specs/publish-and-pay-frd.md PP-FR-37
 */
export function refusal(action: RefusedAction, code: string | undefined, names: RefusalNames): Refusal | null {
  const channel = names.channel ?? "your connected channel";
  const account = names.account ?? "your Instagram account";
  if (code === "reconnect_youtube") return { text: "We can’t read your YouTube channel any more.", reconnect: "youtube" };
  if (code === "reconnect_instagram") return { text: "We can’t read your Instagram account any more.", reconnect: "instagram" };
  if (code === "youtube_unavailable") return { text: YOUTUBE_DOWN };
  // PP-FR-37 (1.4): on every action, as YouTube's.
  if (code === "instagram_unavailable") return { text: INSTAGRAM_DOWN };
  if (action === "go_ahead") {
    const words: Record<string, string> = {
      not_a_youtube_link: NOT_A_LINK,
      invalid: NOT_A_LINK,
      video_not_found: "We couldn’t find that video on YouTube. Check the link.",
      not_your_channel: `That video isn’t on ${channel}. Use a video from the channel you connected.`,
      not_the_approved_file: `That video isn’t the draft ${names.brand} approved. Upload the approved file as it was, without re-editing it.`,
      video_private: "That video is private. Make it unlisted so we can check it.",
      already_published: "This post is already published with a different video. The go-ahead stays with that one.",
    };
    return code && words[code] ? { text: words[code] } : null;
  }
  if (action === "posted") {
    const words: Record<string, string> = {
      not_public_yet: "Your video isn’t public yet. Make it public, then tap again.",
      no_video: "We don’t have your video’s link yet. Get the go-ahead first.",
      video_not_found: "We couldn’t find your video on YouTube. Check it’s still on your channel.",
      not_an_instagram_link: "That isn’t an Instagram link.",
      reel_not_found: `We couldn’t find that Reel on ${account}.`,
      not_a_reel: "That link is a post, not a Reel.",
    };
    return code && words[code] ? { text: words[code] } : null;
  }
  if (code === "not_in_fix_window") return { text: "The time to fix this post has ended.", reload: true };
  return null;
}
