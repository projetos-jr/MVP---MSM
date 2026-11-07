/** Tipos compartilhados entre servidor e cliente. */

export type DocStatus = "lido" | "erro" | "nao_suportado";

/** Documento como exibido na página "Base de conhecimento". */
export interface DocumentInfo {
  id: string;
  name: string;
  /** Pasta (relativa à pasta raiz) onde o arquivo está. */
  folder: string;
  mimeType: string;
  typeLabel: string;
  modifiedTime: string;
  url: string;
  status: DocStatus;
  error?: string;
  chars: number;
}

export interface KnowledgeBaseInfo {
  mode: "drive" | "local";
  folderUrl: string | null;
  serviceAccountEmail: string | null;
  lastCheckedAt: string | null;
  /** Erro ao acessar a pasta (a lista pode estar desatualizada). */
  error: string | null;
  documents: DocumentInfo[];
}

export interface Source {
  id: string;
  name: string;
  url: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type ChatErrorCode =
  | "rate_limit"
  | "auth"
  | "unavailable"
  | "timeout"
  | "blocked"
  | "knowledge"
  | "bad_request"
  | "unknown";

/** Eventos enviados pelo /api/chat, um JSON por linha (NDJSON). */
export type ChatStreamEvent =
  | { type: "meta"; offline: boolean; documents: number }
  | { type: "ping" }
  | { type: "text"; text: string }
  | { type: "sources"; sources: Source[] }
  | { type: "error"; code: ChatErrorCode; message: string }
  | { type: "done" };
