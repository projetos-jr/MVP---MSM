import { ArrowLeft, FileText, FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/markdown";
import { formatDateTime } from "@/lib/format";
import { getDocById } from "@/lib/knowledge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Documento" };

/** Visualização dos documentos do modo de teste (seed-docs/). */
export default async function LocalDocumentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await searchParams;
  const docId = Array.isArray(id) ? id[0] : id;
  if (!docId || !docId.startsWith("local:")) notFound();

  const doc = await getDocById(docId);
  if (!doc) notFound();

  const isMarkdown = /\.(md|markdown)$/i.test(doc.name);

  return (
    <div className="thin-scrollbar h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/documentos"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:text-brand"
        >
          <ArrowLeft className="size-4" />
          Base de conhecimento
        </Link>

        <div className="mt-4 flex items-center gap-2 rounded-md border border-navy/15 bg-navy/[0.04] px-3 py-2 text-xs text-navy">
          <FlaskConical className="size-4 shrink-0 text-brand" />
          Modo de teste: arquivo lido da pasta seed-docs/ do projeto. Com o Drive configurado, os links
          abrem o arquivo no Google Drive.
        </div>

        <article className="mt-4 rounded-lg border border-border bg-white p-5 sm:p-8">
          <header className="mb-6 flex items-start gap-3 border-b border-border pb-4">
            <FileText className="mt-1 size-5 shrink-0 text-brand" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold break-words">{doc.name}</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {doc.typeLabel} · modificado em {formatDateTime(doc.modifiedTime)}
              </p>
            </div>
          </header>
          {doc.status !== "lido" ? (
            <p className="text-sm text-destructive">{doc.error ?? "Não foi possível ler este arquivo."}</p>
          ) : isMarkdown ? (
            <Markdown>{doc.text}</Markdown>
          ) : (
            <pre className="text-sm leading-relaxed whitespace-pre-wrap">{doc.text}</pre>
          )}
        </article>
      </div>
    </div>
  );
}
