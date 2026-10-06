/**
 * The draft check page's shape while its data loads: title, money card,
 * player and checklist rows, without content (DC-FR-39).
 */
export function PageSkeleton() {
  const block = "rounded-lg bg-latte motion-safe:animate-pulse";
  return (
    <div role="status" className="flex flex-col gap-5">
      <span className="sr-only">Loading this deliverable</span>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className={`${block} h-7 w-3/4 rounded-sm`} />
        <div className={`${block} h-4 w-1/2 rounded-sm`} />
      </div>
      <div aria-hidden="true" className={`${block} h-44`} />
      <div aria-hidden="true" className={`${block} aspect-video`} />
      <div aria-hidden="true" className="flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${block} h-15 rounded-md`} />
        ))}
      </div>
    </div>
  );
}
