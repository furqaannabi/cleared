/**
 * Root route. Holds only the wordmark and tagline until the landing page
 * has its own spec; it is not linked from anywhere.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4">
      <h1 className="font-head text-page-title-phone font-bold tracking-[-0.01em] md:text-page-title">
        Cleared
      </h1>
      <p className="mt-2 text-ink-2">Brand deals where the content and the payment clear together.</p>
    </main>
  );
}
