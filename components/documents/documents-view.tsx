"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  File,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  FolderOpen,
  Info,
  Presentation,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { setKbCheckedAfter } from "@/lib/chat-storage";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { DocStatus, DocumentInfo, KnowledgeBaseInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<DocStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  lido: {
    label: "Lido",
    className: "border-success/25 bg-success/10 text-success",
    icon: CheckCircle2,
  },
  erro: {
    label: "Erro",
    className: "border-destructive/25 bg-destructive/10 text-destructive",
    icon: XCircle,
  },
  nao_suportado: {
    label: "Não suportado",
    className: "border-border bg-muted text-muted-foreground",
    icon: Info,
  },
};

function FileIcon({ doc, className }: { doc: DocumentInfo; className?: string }) {
  const label = doc.typeLabel;
  const Icon = /Planilha|CSV/.test(label)
    ? FileSpreadsheet
    : /Apresenta|PowerPoint/.test(label)
      ? Presentation
      : doc.status === "nao_suportado"
        ? File
        : FileText;
  return (
    <Icon
      className={cn(
        "size-5 shrink-0",
        doc.status === "nao_suportado" ? "text-muted-foreground" : "text-brand",
        className,
      )}
    />
  );
}

function StatusBadge({ doc }: { doc: DocumentInfo }) {
  const status = STATUS[doc.status];
  const Icon = status.icon;
  const badge = (
    <Badge variant="outline" className={cn("gap-1 font-semibold", status.className)}>
      <Icon className="size-3" />
      {status.label}
    </Badge>
  );
  if (!doc.error) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">
          {badge}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{doc.error}</TooltipContent>
    </Tooltip>
  );
}

function OpenLink({ doc }: { doc: DocumentInfo }) {
  return (
    <Button asChild variant="ghost" size="sm" className="text-navy hover:text-brand">
      <a href={doc.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${doc.name}`}>
        Abrir
        <ExternalLink className="size-3.5" />
      </a>
    </Button>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" | "muted" }) {
  return (
    <div className="rounded-lg border border-border bg-white px-4 py-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-heading text-2xl font-bold text-navy",
          tone === "success" && "text-success",
          tone === "danger" && value > 0 && "text-destructive",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function DocumentsView() {
  const [info, setInfo] = useState<KnowledgeBaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (force: boolean) => {
    if (force) setRefreshing(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/documents${force ? "?refresh=1" : ""}`, { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/entrar?de=/documentos";
        return;
      }
      const data = (await response.json()) as KnowledgeBaseInfo & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Falha ao carregar.");
      setInfo(data);
      if (force) {
        setKbCheckedAfter(data.lastCheckedAt);
        if (data.error) toast.error("Não foi possível atualizar a base.", { description: data.error });
        else {
          const count = data.documents.filter((d) => d.status === "lido").length;
          toast.success("Base de conhecimento atualizada!", {
            description: `${count} documento${count === 1 ? "" : "s"} pronto${count === 1 ? "" : "s"} para consulta.`,
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar.";
      setLoadError(message);
      if (force) toast.error("Não foi possível atualizar a base.", { description: message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const documents = info?.documents ?? [];
  const counts = {
    total: documents.length,
    lido: documents.filter((d) => d.status === "lido").length,
    erro: documents.filter((d) => d.status === "erro").length,
    nao_suportado: documents.filter((d) => d.status === "nao_suportado").length,
  };
  const isLocal = info?.mode === "local";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="section-title text-brand">Base de conhecimento</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-[28px]">Documentos do assistente</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            O assistente responde somente com base nestes arquivos. Para incluir um conteúdo novo,
            adicione ou altere o arquivo na pasta do Google Drive: ele passa a ser usado
            automaticamente em até 2 minutos.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {info?.folderUrl ? (
            <Button asChild variant="outline" className="h-10 border-navy/25 font-semibold text-navy">
              <a href={info.folderUrl} target="_blank" rel="noopener noreferrer">
                <FolderOpen className="size-4" />
                Abrir pasta no Drive
              </a>
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button variant="outline" disabled className="h-10 font-semibold">
                    <FolderOpen className="size-4" />
                    Abrir pasta no Drive
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Disponível após configurar o DRIVE_FOLDER_ID</TooltipContent>
            </Tooltip>
          )}
          <Button
            onClick={() => void load(true)}
            disabled={refreshing || loading}
            className="h-10 bg-brand font-semibold hover:bg-brand-hover"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            {refreshing ? "Atualizando…" : "Atualizar agora"}
          </Button>
        </div>
      </div>

      {isLocal && (
        <div className="mt-6 flex gap-3 rounded-lg border border-navy/15 bg-navy/[0.04] p-4 text-sm text-navy">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-brand" />
          <div>
            <p className="font-semibold">Modo de teste</p>
            <p className="mt-0.5 text-navy/80">
              Os documentos estão sendo lidos da pasta <code className="font-semibold">seed-docs/</code> do
              projeto. Configure <code className="font-semibold">DRIVE_FOLDER_ID</code> e a conta de
              serviço para usar a pasta do Google Drive.
            </p>
          </div>
        </div>
      )}

      {(info?.error || loadError) && (
        <div role="alert" className="mt-6 flex gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Não foi possível ler a pasta</p>
            <p className="mt-0.5">{info?.error ?? loadError}</p>
            {info?.error && documents.length > 0 && (
              <p className="mt-1 text-destructive/80">A lista abaixo pode estar desatualizada.</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {loading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[74px] rounded-lg bg-white" />)
        ) : (
          <>
            <StatCard label="Arquivos na pasta" value={counts.total} />
            <StatCard label="Lidos" value={counts.lido} tone="success" />
            <StatCard label="Com erro" value={counts.erro} tone="danger" />
            <StatCard label="Não suportados" value={counts.nao_suportado} tone="muted" />
          </>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <p className="section-title">Arquivos</p>
          {info?.lastCheckedAt && (
            <p className="text-xs text-muted-foreground" title={formatDateTime(info.lastCheckedAt)}>
              Última verificação: {formatRelative(info.lastCheckedAt)}
            </p>
          )}
        </div>

        {loading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <FolderOpen className="size-10 text-muted-foreground/60" />
            <p className="mt-3 font-heading font-bold text-navy">Nenhum arquivo na pasta ainda</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {isLocal
                ? "Adicione arquivos na pasta seed-docs/ do projeto."
                : "Adicione documentos na pasta do Drive e clique em “Atualizar agora”."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop: tabela */}
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-4 font-semibold text-navy">Nome</TableHead>
                  <TableHead className="font-semibold text-navy">Tipo</TableHead>
                  <TableHead className="font-semibold text-navy">Modificado em</TableHead>
                  <TableHead className="font-semibold text-navy">Status</TableHead>
                  <TableHead className="pr-4 text-right font-semibold text-navy">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="max-w-md py-3 pl-4">
                      <div className="flex items-center gap-3">
                        <FileIcon doc={doc} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-navy" title={doc.name}>
                            {doc.name}
                          </p>
                          {(doc.folder || doc.error) && (
                            <p className={cn("truncate text-xs", doc.error ? "text-destructive" : "text-muted-foreground")}>
                              {doc.error ?? `Pasta: ${doc.folder}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{doc.typeLabel}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(doc.modifiedTime)}</TableCell>
                    <TableCell>
                      <StatusBadge doc={doc} />
                    </TableCell>
                    <TableCell className="pr-3 text-right">
                      <OpenLink doc={doc} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Celular: cartões */}
            <ul className="divide-y divide-border md:hidden">
              {documents.map((doc) => (
                <li key={doc.id} className="flex gap-3 px-4 py-3.5">
                  <FileIcon doc={doc} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold break-words text-navy">{doc.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {doc.typeLabel} · {formatDateTime(doc.modifiedTime)}
                    </p>
                    {doc.folder && <p className="text-xs text-muted-foreground">Pasta: {doc.folder}</p>}
                    {doc.error && <p className="mt-1 text-xs text-destructive">{doc.error}</p>}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <StatusBadge doc={doc} />
                      <OpenLink doc={doc} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Tipos lidos: Google Docs, Google Planilhas (primeira aba), Google Apresentações, PDF (com
        texto), Word (.docx), TXT, Markdown e CSV. Outros tipos aparecem como “não suportado” e não
        são usados nas respostas.
        {info?.serviceAccountEmail && (
          <>
            {" "}A pasta precisa estar compartilhada com <strong className="break-all">{info.serviceAccountEmail}</strong>.
          </>
        )}
      </p>
    </div>
  );
}
