import { PostsPage } from "@/components/new-deal/posts-page";

/** BC-FR-23: change a deal's brand and posts before its brief is sent (inside the deal's app shell). */
export default async function DealPostsPage(props: PageProps<"/deals/[dealId]/posts">) {
  const { dealId } = await props.params;
  return <PostsPage dealId={dealId} />;
}
