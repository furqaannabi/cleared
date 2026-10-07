"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

/**
 * A sheet: full-screen on phones, a right-hand side panel from `md:` up
 * (CLAUDE.md: modals are full-screen on mobile). Built on Radix Dialog for
 * focus trapping, Escape to close and returning focus to its trigger.
 *
 * @param trigger - the button that opens it (rendered as is)
 * @param title - the sheet's heading and accessible name
 * @param children - the sheet's content
 */
export function Sheet({ trigger, title, children }: { trigger: ReactNode; title: string; children: ReactNode }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-espresso-ink/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-surface md:inset-y-0 md:right-0 md:left-auto md:w-[440px] md:border-l md:border-line md:shadow-floating-bar"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-3">
            <Dialog.Title className="font-head text-section-title font-bold">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="grid size-11 place-items-center rounded-pill text-ink-2 hover:bg-latte-wash"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="size-5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
