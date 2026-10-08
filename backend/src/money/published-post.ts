/**
 * Whether a deliverable's approved post is published, and when (MP-FR-16). The money module asks this
 * when a go-ahead runs out and at the deadline. The live check answers it once it is built; tests supply
 * the answer. It is decided by fixed code, never by a model (MP-BR-01).
 */
export interface PublishedPostPort {
  /** When the approved post was published, or null if it has not been. Throws if the platform cannot say. */
  publishedAt(deliverableId: string): Promise<Date | null>;
}
