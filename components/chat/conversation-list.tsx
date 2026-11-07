"use client";

import { FolderOpen, MessageSquare, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/lib/chat-storage";
import { cn } from "@/lib/utils";

export interface KnowledgeSummary {
  documents: number;
  mode: "drive" | "local";
}

function groupLabel(timestamp: number, now: Date): string {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  if (timestamp >= startOfToday) return "Hoje";
  if (timestamp >= startOfToday - day) return "Ontem";
  if (timestamp >= startOfToday - 7 * day) return "Últimos 7 dias";
  if (timestamp >= startOfToday - 30 * day) return "Últimos 30 dias";
  return "Mais antigas";
}

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  hydrated: boolean;
  knowledge: KnowledgeSummary | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function ConversationList({
  conversations,
  activeId,
  hydrated,
  knowledge,
  onSelect,
  onNew,
  onDelete,
}: ConversationListProps) {
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);
  const now = new Date();

  const groups: Array<{ label: string; items: Conversation[] }> = [];
  for (const conversation of conversations) {
    if (conversation.messages.length === 0) continue;
    const label = groupLabel(conversation.updatedAt, now);
    const group = groups.find((g) => g.label === label);
    if (group) group.items.push(conversation);
    else groups.push({ label, items: [conversation] });
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="p-3">
        <Button
          onClick={onNew}
          className="h-10 w-full justify-start gap-2 rounded-md bg-brand font-semibold text-white hover:bg-brand-hover"
        >
          <Plus className="size-4" />
          Nova conversa
        </Button>
      </div>

      <div className="thin-scrollbar-dark min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <p className="px-2 pt-2 pb-1 font-heading text-[10px] font-bold tracking-[0.14em] text-white/50 uppercase">
          Conversas
        </p>
        {!hydrated ? (
          <div className="space-y-2 px-2 pt-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-md bg-white/10" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <p className="px-2 pt-2 text-sm leading-relaxed text-white/60">
            Suas conversas aparecem aqui. Elas ficam salvas apenas neste navegador.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mt-3 first:mt-1">
              <p className="px-2 pb-1 text-[11px] font-semibold text-white/45">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((conversation) => {
                  const active = conversation.id === activeId;
                  return (
                    <li key={conversation.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => onSelect(conversation.id)}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md py-2 pr-9 pl-2.5 text-left text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent font-semibold text-white"
                            : "text-white/80 hover:bg-white/8 hover:text-white",
                        )}
                      >
                        <MessageSquare
                          className={cn("size-4 shrink-0", active ? "text-brand" : "text-white/40")}
                        />
                        <span className="truncate">{conversation.title}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(conversation)}
                        aria-label={`Excluir conversa "${conversation.title}"`}
                        className={cn(
                          "absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded text-white/50 transition-opacity hover:bg-white/10 hover:text-white",
                          "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
                          active && "md:opacity-100",
                        )}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/documentos"
          className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-white/80 transition-colors hover:bg-white/8 hover:text-white"
        >
          <FolderOpen className="size-4 text-brand" />
          <span className="flex-1">
            <span className="block font-semibold">Base de conhecimento</span>
            <span className="block text-xs text-white/50">
              {knowledge
                ? `${knowledge.documents} documento${knowledge.documents === 1 ? "" : "s"} · ${
                    knowledge.mode === "drive" ? "Google Drive" : "modo de teste"
                  }`
                : "Carregando…"}
            </span>
          </span>
        </Link>
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              A conversa &ldquo;{pendingDelete?.title}&rdquo; será apagada deste navegador. Essa ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
