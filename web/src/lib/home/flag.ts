/**
 * HM-FR-20: the money sections and the Payments page, off until Furqaan's
 * `GET /me/payments` is in the contract. Read at build time.
 */
export const PAYMENTS = process.env.NEXT_PUBLIC_PAYMENTS === "enabled";
