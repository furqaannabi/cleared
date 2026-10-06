import type { ReactNode } from "react";

/** The 14-scallop outline from DESIGN.md, on a 24px grid. */
const SEAL_PATH =
  "M12.00 1.40A2.48 2.48 0 0 1 16.60 2.45A2.48 2.48 0 0 1 20.29 5.39A2.48 2.48 0 0 1 22.33 9.64A2.48 2.48 0 0 1 22.33 14.36A2.48 2.48 0 0 1 20.29 18.61A2.48 2.48 0 0 1 16.60 21.55A2.48 2.48 0 0 1 12.00 22.60A2.48 2.48 0 0 1 7.40 21.55A2.48 2.48 0 0 1 3.71 18.61A2.48 2.48 0 0 1 1.67 14.36A2.48 2.48 0 0 1 1.67 9.64A2.48 2.48 0 0 1 3.71 5.39A2.48 2.48 0 0 1 7.40 2.45A2.48 2.48 0 0 1 12.00 1.40Z";

/**
 * The scalloped seal, DESIGN.md's signature mark: a filled 14-scallop shape
 * with an icon in its centre half. Decorative; whatever sits beside it (a
 * chip, a label, a button name) carries the meaning.
 *
 * @param fillClassName - Tailwind fill class for the shape, e.g. "fill-pass-wash"
 * @param className - size classes for the whole seal, e.g. "size-7"
 * @param children - the icon, drawn in its own colour
 */
export function Seal({
  fillClassName,
  className,
  children,
}: {
  fillClassName: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    // Layers stack in one grid cell, so the seal sets no position of its own
    // and callers can place it (e.g. absolutely, on the money card).
    <span aria-hidden="true" className={`inline-grid shrink-0 place-items-center ${className ?? "size-7"}`}>
      <svg viewBox="0 0 24 24" className="size-full [grid-area:1/1]">
        <path data-seal-shape d={SEAL_PATH} className={fillClassName} />
      </svg>
      <span data-seal-icon className="grid size-1/2 place-items-center [grid-area:1/1]">
        {children}
      </span>
    </span>
  );
}
