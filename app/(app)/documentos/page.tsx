import type { Metadata } from "next";

import { DocumentsView } from "@/components/documents/documents-view";

export const metadata: Metadata = { title: "Base de conhecimento" };

export default function DocumentsPage() {
  return (
    <div className="thin-scrollbar h-full overflow-y-auto">
      <DocumentsView />
    </div>
  );
}
