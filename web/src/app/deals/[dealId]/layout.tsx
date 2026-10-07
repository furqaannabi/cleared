import { AppShell } from "@/components/shell/app-shell";

/** Every page of a deal sits in the app shell, with that deal marked (DC-FR-31). */
export default async function DealLayout(props: LayoutProps<"/deals/[dealId]">) {
  const { dealId } = await props.params;
  return <AppShell currentDealId={dealId}>{props.children}</AppShell>;
}
