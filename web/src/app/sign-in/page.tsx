import type { Metadata } from "next";
import { SignInPage } from "@/components/session/sign-in-page";

export const metadata: Metadata = { title: "Sign in · Cleared" };

/** SI-FR-05: the sign-in page; `next` is checked again in the component and by the backend (SI-BR-02). */
export default async function Page(props: PageProps<"/sign-in">) {
  const { next } = await props.searchParams;
  return <SignInPage next={typeof next === "string" ? next : null} />;
}
