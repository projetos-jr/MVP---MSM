import "server-only";

import { describeDriveError, createDriveSource } from "@/lib/drive";
import { env, knowledgeMode } from "@/lib/env";
import { fileKind, typeLabel } from "@/lib/file-types";
import { createLocalSource } from "@/lib/local-docs";
import { MAX_FILE_BYTES, type KnowledgeSource, type SourceFile } from "@/lib/sources";
import type { DocStatus, DocumentInfo, KnowledgeBaseInfo } from "@/lib/types";

/**
 * Base de conhecimento com cache em memória.
 *
 * - Cada arquivo é guardado com a chave `fileId + modifiedTime`.
 * - A cada pergunta, se a última verificação tiver mais de
 *   DRIVE_REFRESH_SECONDS (padrão: 2 min), a lista de arquivos é consultada
 *   de novo e só os arquivos novos/alterados são reprocessados.
 * - Arquivos removidos da pasta saem do cache.
 *
 * Em serverless (Vercel) cada instância tem seu próprio cache; numa
 * instância nova, a primeira pergunta lê a pasta inteira.
 */

export interface KnowledgeDoc extends DocumentInfo {
  text: string;
}

interface CacheEntry {
  key: string;
  doc: KnowledgeDoc;
}

interface KnowledgeState {
  sourceKey: string;
  entries: Map<string, CacheEntry>;
  docs: KnowledgeDoc[];
  lastCheckedAt: number;
  error: string | null;
  inflight: Promise<void> | null;
}

const globalForKb = globalThis as typeof globalThis & {
  __msmKnowledge?: KnowledgeState;
};

function getState(): KnowledgeState {
  globalForKb.__msmKnowledge ??= {
    sourceKey: "",
    entries: new Map(),
    docs: [],
    lastCheckedAt: 0,
    error: null,
    inflight: null,
  };
  return globalForKb.__msmKnowledge;
}

function getSource(): { key: string; source: KnowledgeSource } {
  if (knowledgeMode() === "drive") {
    const folderId = env.driveFolderId;
    return { key: `drive:${folderId}`, source: createDriveSource(folderId) };
  }
  return { key: "local", source: createLocalSource() };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function baseDoc(file: SourceFile, status: DocStatus, text = "", error?: string): KnowledgeDoc {
  return {
    id: file.id,
    name: file.name,
    folder: file.folder,
    mimeType: file.mimeType,
    typeLabel: typeLabel(file.mimeType, file.name),
    modifiedTime: file.modifiedTime,
    url: file.url,
    status,
    error,
    chars: text.length,
    text,
  };
}

async function processFile(source: KnowledgeSource, file: SourceFile): Promise<KnowledgeDoc> {
  if (fileKind(file.mimeType, file.name) === "unsupported") {
    return baseDoc(file, "nao_suportado");
  }
  if (file.size && file.size > MAX_FILE_BYTES) {
    return baseDoc(file, "erro", "", "Arquivo muito grande (limite de 30 MB).");
  }
  try {
    const text = await source.extract(file);
    if (!text.trim()) {
      return baseDoc(
        file,
        "erro",
        "",
        "Nenhum texto encontrado no arquivo (pode ser um PDF escaneado/imagem).",
      );
    }
    return baseDoc(file, "lido", text);
  } catch (error) {
    const message =
      knowledgeMode() === "drive" ? describeDriveError(error) : errorMessage(error);
    console.error(`[base] Falha ao ler "${file.name}":`, errorMessage(error));
    return baseDoc(file, "erro", "", message);
  }
}

async function refresh(state: KnowledgeState): Promise<void> {
  const { key, source } = getSource();
  if (state.sourceKey !== key) {
    state.sourceKey = key;
    state.entries = new Map();
    state.docs = [];
  }

  let files: SourceFile[];
  try {
    files = await source.list();
  } catch (error) {
    // Mantém os documentos que já estavam em cache e registra o erro.
    state.error =
      source.mode === "drive" ? describeDriveError(error) : errorMessage(error);
    state.lastCheckedAt = Date.now();
    console.error("[base] Falha ao listar arquivos:", errorMessage(error));
    return;
  }

  const toProcess: SourceFile[] = [];
  const nextEntries = new Map<string, CacheEntry>();
  for (const file of files) {
    const cacheKey = `${file.id}:${file.modifiedTime}`;
    const cached = state.entries.get(file.id);
    // Reaproveita o cache se o arquivo não mudou (erros são tentados de novo).
    if (cached && cached.key === cacheKey && cached.doc.status !== "erro") {
      nextEntries.set(file.id, { ...cached, doc: { ...cached.doc, url: file.url, folder: file.folder } });
    } else {
      toProcess.push(file);
    }
  }

  const processed = await mapWithConcurrency(toProcess, 4, (file) =>
    processFile(source, file),
  );
  processed.forEach((doc, index) => {
    const file = toProcess[index];
    nextEntries.set(file.id, { key: `${file.id}:${file.modifiedTime}`, doc });
  });

  if (toProcess.length > 0) {
    console.info(
      `[base] ${files.length} arquivo(s) na pasta, ${toProcess.length} (re)processado(s).`,
    );
  }

  state.entries = nextEntries;
  state.docs = [...nextEntries.values()]
    .map((entry) => entry.doc)
    .sort((a, b) => {
      // Arquivos da pasta raiz primeiro, depois as subpastas.
      if (!a.folder !== !b.folder) return a.folder ? 1 : -1;
      const opts = { sensitivity: "base", numeric: true } as const;
      return a.folder.localeCompare(b.folder, "pt-BR", opts) || a.name.localeCompare(b.name, "pt-BR", opts);
    });
  state.error = null;
  state.lastCheckedAt = Date.now();
}

export interface LoadOptions {
  /** Força a releitura da pasta agora. */
  force?: boolean;
  /**
   * Garante que a última verificação seja posterior a este instante (ms).
   * Usado quando o usuário clicou em "Atualizar agora" e depois pergunta:
   * a instância que atende o chat pode ser outra, com cache mais antigo.
   */
  checkedAfter?: number;
}

export async function loadKnowledgeBase(options: LoadOptions = {}): Promise<KnowledgeState> {
  const state = getState();
  const now = Date.now();
  const checkedAfter = Math.min(options.checkedAfter ?? 0, now);
  const sourceChanged = state.sourceKey !== getSource().key;
  const stale =
    options.force ||
    sourceChanged ||
    state.lastCheckedAt === 0 ||
    now - state.lastCheckedAt > env.refreshIntervalMs ||
    state.lastCheckedAt < checkedAfter;

  if (stale) {
    if (!state.inflight) {
      state.inflight = refresh(state).finally(() => {
        state.inflight = null;
      });
    }
    await state.inflight;
  }
  return state;
}

/** Documentos lidos com sucesso (os que entram no contexto do modelo). */
export async function getReadableDocs(options: LoadOptions = {}): Promise<{
  docs: KnowledgeDoc[];
  error: string | null;
}> {
  const state = await loadKnowledgeBase(options);
  return { docs: state.docs.filter((doc) => doc.status === "lido"), error: state.error };
}

export async function getKnowledgeBaseInfo(options: LoadOptions = {}): Promise<KnowledgeBaseInfo> {
  const state = await loadKnowledgeBase(options);
  const { source } = getSource();
  return {
    mode: source.mode,
    folderUrl: source.folderUrl,
    serviceAccountEmail: source.mode === "drive" ? env.serviceAccountEmail || null : null,
    lastCheckedAt: state.lastCheckedAt ? new Date(state.lastCheckedAt).toISOString() : null,
    error: state.error,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    documents: state.docs.map(({ text, ...info }) => info),
  };
}

export async function getDocById(id: string): Promise<KnowledgeDoc | null> {
  const state = await loadKnowledgeBase();
  return state.docs.find((doc) => doc.id === id) ?? null;
}
