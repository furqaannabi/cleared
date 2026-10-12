import { NotFoundPage } from "@/components/errors/not-found-page";

/** EP-FR-01, EP-FR-02: any address that matches no page (served with a 404). */
export default function NotFound() {
  return <NotFoundPage />;
}
