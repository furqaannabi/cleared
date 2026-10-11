"use client";

import { createContext, useCallback, useContext, type ComponentType, type ReactNode } from "react";

/** PayPal's approval step for one hold: the brand approves the order or closes PayPal. */
export interface ApprovalProps {
  /** The post, e.g. "YouTube video". */
  label: string;
  /** The hold's amount, a two-place decimal string. */
  amount: string;
  /** PayPal's order for this hold, from the API (CH-FR-17). */
  orderId: string;
  onApproved: () => void;
  onClosed: () => void;
  /** PayPal couldn't load or reported an error; nothing was held. */
  onError: () => void;
}

const PayPalApprovalContext = createContext<((props: ApprovalProps) => ReactNode) | null>(null);

/**
 * Supplies a stand-in for PayPal's approval step to the holds: on mocks, the
 * demo PayPal. Without one, the holds use PayPal's own button in the sandbox
 * when the API gives a client id (CH-FR-17, 1.3), and otherwise say no hold
 * can be approved in this build.
 *
 * @param approval - the approval step component
 * @param children - the app
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-17
 */
export function PayPalApprovalProvider({ approval: Approval, children }: { approval: ComponentType<ApprovalProps>; children: ReactNode }) {
  const render = useCallback((props: ApprovalProps) => <Approval {...props} />, [Approval]);
  return <PayPalApprovalContext.Provider value={render}>{children}</PayPalApprovalContext.Provider>;
}

/** The stand-in approval step this build has, or null for PayPal's own. */
export const usePayPalApproval = () => useContext(PayPalApprovalContext);
