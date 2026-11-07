"use client";

import { Menu, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Composer, type ComposerHandle } from "@/components/chat/composer";
import { ConversationList, type KnowledgeSummary } from "@/components/chat/conversation-list";
import { EmptyState } from "@/components/chat/empty-state";
import { AssistantMessage, UserMessage } from "@/components/chat/message-item";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { brand } from "@/config/brand";
import { useSpeechSynthesis } from "@/hooks/use-speech";
import {
  getKbCheckedAfter,
  loadConversations,
  newId,
  saveConversations,
  titleFromQuestion,
  type Conversation,
  type Feedback,
  type StoredMessage,
} from "@/lib/chat-storage";
import { markdownToPlainText } from "@/lib/format";
import type { ChatErrorCode, ChatStreamEvent, KnowledgeBaseInfo } from "@/lib/types";

/** Remove uma eventual linha "FONTES: 1, 2" que o modelo escreva fora do marcador. */
function cleanFinalContent(content: string): string {
  return content.replace(/\n+\s*[*_]*\s*fontes\s*[*_]*\s*:?\s*[*_]*\s*\[?[\d,\s]*\]?\s*>*\s*$/i, "").trimEnd();
}

interface AskOptions {
  /** Histórico a usar no lugar do atual (ex.: ao tentar novamente). */
  history?: StoredMessage[];
}

export function ChatApp({ userName }: { userName: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [knowledge, setKnowledge] = useState<KnowledgeSummary | null>(null);

  const conversationsRef = useRef(conversations);
  const activeIdRef = useRef(activeId);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const composerRef = useRef<ComposerHandle>(null);
  const {
    supported: canSpeak,
    speakingId,
    speak: speakText,
    stop: stopSpeaking,
  } = useSpeechSynthesis();

  useEffect(() => {
    conversationsRef.current = conversations;
    activeIdRef.current = activeId;
  });

  // Carrega o histórico salvo no navegador.
  useEffect(() => {
    setConversations(loadConversations());
    setHydrated(true);
  }, []);

  // Salva o histórico (com atraso durante o streaming).
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => saveConversations(conversations), streamingId ? 1000 : 150);
    return () => clearTimeout(timer);
  }, [conversations, hydrated, streamingId]);

  // Resumo da base para o rodapé do menu (também "aquece" o cache do servidor).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/documents")
      .then((res) => (res.ok ? (res.json() as Promise<KnowledgeBaseInfo>) : null))
      .then((info) => {
        if (!cancelled && info) {
          setKnowledge({
            mode: info.mode,
            documents: info.documents.filter((d) => d.status === "lido").length,
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const messages = active?.messages ?? [];
  const lastMessage = messages.at(-1);

  // Rola para o fim quando chega conteúdo novo (se o usuário estiver no fim).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Tela vazia (sugestões): sempre do topo, para mostrar a saudação.
    if (messages.length === 0) el.scrollTop = 0;
    else if (stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [lastMessage?.content, lastMessage?.sources, lastMessage?.error, messages.length, activeId]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const ask = useCallback(async (question: string, options: AskOptions = {}) => {
    const text = question.trim();
    if (!text || abortRef.current) return;

    const now = Date.now();
    const userMessage: StoredMessage = { id: newId(), role: "user", content: text, createdAt: now };
    const assistantMessage: StoredMessage = {
      id: newId(),
      role: "assistant",
      content: "",
      createdAt: now,
    };

    const existing = conversationsRef.current.find((c) => c.id === activeIdRef.current);
    const conversationId = existing?.id ?? newId();
    const history = options.history ?? existing?.messages ?? [];

    setConversations((prev) => {
      if (existing) {
        return prev.map((c) =>
          c.id === conversationId
            ? { ...c, updatedAt: now, messages: [...c.messages, userMessage, assistantMessage] }
            : c,
        );
      }
      const created: Conversation = {
        id: conversationId,
        title: titleFromQuestion(text),
        createdAt: now,
        updatedAt: now,
        messages: [userMessage, assistantMessage],
      };
      return [created, ...prev];
    });
    setActiveId(conversationId);
    activeIdRef.current = conversationId;
    setStreamingId(assistantMessage.id);
    stickToBottomRef.current = true;

    const patch = (update: Partial<StoredMessage> | ((m: StoredMessage) => Partial<StoredMessage>)) =>
      setConversations((prev) =>
        prev.map((c) =>
          c.id !== conversationId
            ? c
            : {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, ...(typeof update === "function" ? update(m) : update) }
                    : m,
                ),
              },
        ),
      );
    const fail = (code: ChatErrorCode, message: string) => patch({ error: { code, message } });

    // Histórico enviado: ignora perguntas cuja resposta falhou.
    const turns = history.filter((m, i) => {
      if (m.error || !m.content.trim()) return false;
      const next = history[i + 1];
      return !(m.role === "user" && next?.role === "assistant" && next.error && !next.content.trim());
    });
    const payload = {
      messages: [
        ...turns.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: text },
      ],
      checkedAfter: getKbCheckedAfter(),
    };

    const controller = new AbortController();
    abortRef.current = controller;
    let content = "";
    let finished = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (response.status === 401) {
        toast.error("Sua sessão expirou. Entre novamente.");
        window.location.href = "/entrar";
        return;
      }
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        fail("unknown", data?.error ?? "Não foi possível enviar a pergunta. Tente novamente.");
        finished = true;
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const handle = (event: ChatStreamEvent) => {
        switch (event.type) {
          case "meta":
            if (event.offline) patch({ offline: true });
            break;
          case "text":
            content += event.text;
            patch({ content });
            break;
          case "sources":
            patch({ sources: event.sources });
            break;
          case "error":
            fail(event.code, event.message);
            finished = true;
            break;
          case "done":
            finished = true;
            break;
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line) continue;
          try {
            handle(JSON.parse(line) as ChatStreamEvent);
          } catch {
            // linha inválida: ignora
          }
        }
      }
      if (buffer.trim()) {
        try {
          handle(JSON.parse(buffer) as ChatStreamEvent);
        } catch {
          // ignora
        }
      }
    } catch {
      if (controller.signal.aborted) {
        patch({ stopped: true });
        finished = true;
      } else {
        fail(
          "unavailable",
          typeof navigator !== "undefined" && !navigator.onLine
            ? "Sem conexão com a internet. Verifique sua rede e tente novamente."
            : "Não foi possível falar com o servidor. Tente novamente.",
        );
        finished = true;
      }
    } finally {
      if (!finished) {
        fail("unavailable", "A conexão foi interrompida antes do fim da resposta. Tente novamente.");
      }
      patch((m) => ({ content: cleanFinalContent(m.content) }));
      abortRef.current = null;
      setStreamingId(null);
    }
  }, []);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const retry = useCallback(
    (assistantId: string) => {
      const conversation = conversationsRef.current.find((c) => c.id === activeIdRef.current);
      if (!conversation || abortRef.current) return;
      const index = conversation.messages.findIndex((m) => m.id === assistantId);
      const question = conversation.messages[index - 1];
      if (index < 1 || question?.role !== "user") return;
      const history = conversation.messages.slice(0, index - 1);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversation.id ? { ...c, messages: history } : c)),
      );
      void ask(question.content, { history });
    },
    [ask],
  );

  const giveFeedback = useCallback((messageId: string, value: Feedback) => {
    const conversationId = activeIdRef.current;
    const current = conversationsRef.current
      .find((c) => c.id === conversationId)
      ?.messages.find((m) => m.id === messageId);
    // Clicar de novo no mesmo botão desfaz a avaliação.
    const next: Feedback | undefined = current?.feedback === value ? undefined : value;
    setConversations((prev) =>
      prev.map((c) =>
        c.id !== conversationId
          ? c
          : {
              ...c,
              messages: c.messages.map((m) => (m.id === messageId ? { ...m, feedback: next } : m)),
            },
      ),
    );
    if (next === "down") {
      toast.success("Obrigado pelo feedback!", {
        description: "Sua avaliação ajuda a melhorar os documentos e as respostas.",
      });
    } else if (next === "up") {
      toast.success("Obrigado pelo feedback!");
    }
  }, []);

  const speak = useCallback(
    (id: string, text: string) => speakText(id, markdownToPlainText(text)),
    [speakText],
  );

  const newConversation = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    stopSpeaking();
    setActiveId(null);
    setSidebarOpen(false);
    setTimeout(() => composerRef.current?.focus(), 50);
  }, [stopSpeaking]);

  const selectConversation = useCallback(
    (id: string) => {
      if (abortRef.current) abortRef.current.abort();
      stopSpeaking();
      setActiveId(id);
      setSidebarOpen(false);
      stickToBottomRef.current = true;
    },
    [stopSpeaking],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      if (id === activeIdRef.current) {
        if (abortRef.current) abortRef.current.abort();
        setActiveId(null);
      }
      setConversations((prev) => prev.filter((c) => c.id !== id));
      toast("Conversa excluída.");
    },
    [],
  );

  const sidebar = (
    <ConversationList
      conversations={conversations}
      activeId={activeId}
      hydrated={hydrated}
      knowledge={knowledge}
      onSelect={selectConversation}
      onNew={newConversation}
      onDelete={deleteConversation}
    />
  );

  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-72 shrink-0 md:block lg:w-80">{sidebar}</aside>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-80 border-none bg-sidebar p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Conversas</SheetTitle>
          <SheetDescription className="sr-only">Histórico de conversas e nova conversa</SheetDescription>
          {sidebar}
        </SheetContent>
      </Sheet>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-white px-2 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} aria-label="Abrir conversas">
            <Menu className="size-5 text-navy" />
          </Button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-navy">
            {active?.title ?? "Nova conversa"}
          </p>
          <Button variant="ghost" size="icon" onClick={newConversation} aria-label="Nova conversa">
            <Plus className="size-5 text-brand" />
          </Button>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="thin-scrollbar min-h-0 flex-1 overflow-y-auto"
        >
          {messages.length === 0 ? (
            <EmptyState userName={userName} onPick={(q) => void ask(q)} />
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-6 px-3 py-6 sm:px-6">
              {messages.map((message) =>
                message.role === "user" ? (
                  <UserMessage key={message.id} message={message} />
                ) : (
                  <AssistantMessage
                    key={message.id}
                    message={message}
                    streaming={message.id === streamingId}
                    speaking={speakingId === message.id}
                    canSpeak={canSpeak}
                    onFeedback={giveFeedback}
                    onRetry={retry}
                    onSpeak={speak}
                    onStopSpeaking={stopSpeaking}
                  />
                ),
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 bg-gradient-to-t from-background via-background to-background/0 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <Composer ref={composerRef} streaming={streamingId !== null} onSend={(q) => void ask(q)} onStop={stop} />
            <p className="mt-2 hidden text-center text-xs text-muted-foreground sm:block">
              O {brand.productName} responde com base nos documentos da base de conhecimento. Confira
              informações importantes na fonte.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
