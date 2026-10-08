"use client";

import { createContext, useCallback, useContext, type ComponentType, type ReactNode } from "react";

/** PayPal's approval step for one hold: the brand approves the order or closes PayPal. */
export interface ApprovalProps {
  /** The post, e.g. "YouTube video". */
  label: string;
  /** The hold's amount, a two-place decimal string. */
  amount: string;
  onApproved: () => void;
  onClosed: () => void;
}

const PayPalApprovalContext = createContext<((props: ApprovalProps) => ReactNode) | null>(null);

/**
 * Supplies PayPal's approval step to the holds. The real one is PayPal's own
 * script (Requests for Furqaan); on mocks it is the demo PayPal. Without one,
 * the page says no hold can be approved in this build.
 *
 * @param approval - the approval step component
 * @param children - the app
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-17
 */
export function PayPalApprovalProvider({ approval: Approval, children }: { approval: ComponentType<ApprovalProps>; children: ReactNode }) {
  const render = useCallback((props: ApprovalProps) => <Approval {...props} />, [Approval]);
  return <PayPalApprovalContext.Provider value={render}>{children}</PayPalApprovalContext.Provider>;
}

/** Renders the approval step this build has, or null when there is none. */
export const usePayPalApproval = () => useContext(PayPalApprovalContext);
