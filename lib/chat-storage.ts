"use client";

import type { ChatErrorCode, Source } from "@/lib/types";

/** Histórico de conversas salvo no navegador (localStorage). */

export type Feedback = "up" | "down";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  sources?: Source[];
  feedback?: Feedback;
  error?: { code: ChatErrorCode; message: string };
  /** Resposta interrompida pelo usuário. */
  stopped?: boolean;
  /** Resposta gerada no modo de teste sem IA. */
  offline?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredMessage[];
}

const STORAGE_KEY = "msm.conversas.v1";
const KB_REFRESH_KEY = "msm.base.verificadaEm";
const NAME_KEY = "msm.nome";
const MAX_CONVERSATIONS = 60;

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function titleFromQuestion(question: string): string {
  const clean = question.replace(/\s+/g, " ").trim();
  return clean.length > 48 ? `${clean.slice(0, 46).trimEnd()}…` : clean || "Nova conversa";
}

function isConversation(value: unknown): value is Conversation {
  const c = value as Conversation;
  return Boolean(c && typeof c.id === "string" && Array.isArray(c.messages));
}

export function loadConversations(): Conversation[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(isConversation).sort((a, b) => b.updatedAt - a.updatedAt)
      : [];
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  // Não salva conversas vazias.
  let list = conversations
    .filter((c) => c.messages.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CONVERSATIONS);
  // Se o armazenamento encher, descarta as conversas mais antigas.
  while (list.length > 0) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return;
    } catch {
      list = list.slice(0, Math.floor(list.length / 2));
    }
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignora
  }
}

/** Instante (do servidor) da última releitura forçada da base. */
export function getKbCheckedAfter(): number | undefined {
  try {
    const value = Number(window.localStorage.getItem(KB_REFRESH_KEY));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

export function setKbCheckedAfter(isoDate: string | null): void {
  if (!isoDate) return;
  try {
    window.localStorage.setItem(KB_REFRESH_KEY, String(new Date(isoDate).getTime()));
  } catch {
    // ignora
  }
}

export function getSavedName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setSavedName(name: string): void {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignora
  }
}
