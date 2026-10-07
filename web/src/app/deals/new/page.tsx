import { AppShell } from "@/components/shell/app-shell";
import { NewDealForm } from "@/components/new-deal/new-deal-form";

/** BC-FR-01 to BC-FR-03: start a deal with its brand and posts. */
export default function NewDealPage() {
  return (
    <AppShell currentDealId={null}>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] px-4 pt-6 pb-16 focus:outline-none md:px-6 lg:px-9">
        <h1 className="font-head text-page-title-phone font-bold tracking-[-0.01em] md:text-page-title">New deal</h1>
        <p className="mt-1.5 text-ink-2">Name the brand and the posts you agreed. Next you’ll paste their brief.</p>
        <NewDealForm />
      </main>
    </AppShell>
  );
}
