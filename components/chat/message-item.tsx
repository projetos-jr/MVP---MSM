"use client";

import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  FileText,
  RotateCcw,
  Square,
  ThumbsDown,
  ThumbsUp,
  Volume2,
} from "lucide-react";
import { memo, useState } from "react";

import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Feedback, StoredMessage } from "@/lib/chat-storage";
import { cn } from "@/lib/utils";

export function AssistantAvatar({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md bg-navy font-heading text-[10px] font-extrabold tracking-wide text-white shadow-sm",
        className,
      )}
    >
      MSM
    </div>
  );
}

function IconAction({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
          className={cn(
            "text-muted-foreground hover:text-navy",
            active && "bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand",
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground" role="status">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-bounce rounded-full bg-brand"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      Consultando os documentos…
    </div>
  );
}

interface AssistantMessageProps {
  message: StoredMessage;
  streaming: boolean;
  speaking: boolean;
  canSpeak: boolean;
  onFeedback: (id: string, value: Feedback) => void;
  onRetry: (id: string) => void;
  onSpeak: (id: string, text: string) => void;
  onStopSpeaking: () => void;
}

export const AssistantMessage = memo(function AssistantMessage({
  message,
  streaming,
  speaking,
  canSpeak,
  onFeedback,
  onRetry,
  onSpeak,
  onStopSpeaking,
}: AssistantMessageProps) {
  const [copied, setCopied] = useState(false);
  const hasContent = message.content.trim().length > 0;
  const showActions = !streaming && hasContent;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Navegador sem permissão para a área de transferência.
    }
  }

  return (
    <div className="flex gap-3 sm:gap-4">
      <AssistantAvatar className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-[0_1px_2px_rgba(30,42,94,0.05)] sm:px-5 sm:py-4">
          {!hasContent && streaming && <ThinkingIndicator />}
          {hasContent && (
            <Markdown className={cn(streaming && "[&>*:last-child]:typing-caret")}>
              {message.content}
            </Markdown>
          )}
          {message.stopped && (
            <p className="mt-2 text-xs text-muted-foreground italic">Resposta interrompida.</p>
          )}

          {message.error && (
            <div
              role="alert"
              className={cn(
                "flex flex-col gap-3 rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive sm:flex-row sm:items-center",
                hasContent && "mt-3",
              )}
            >
              <div className="flex flex-1 items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{message.error.message}</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="self-start border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive sm:self-auto"
                onClick={() => onRetry(message.id)}
              >
                <RotateCcw />
                Tentar novamente
              </Button>
            </div>
          )}

          {!streaming && message.sources && message.sources.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="section-title mb-2 text-[10px]">Fontes</p>
              <ul className="flex flex-wrap gap-2">
                {message.sources.map((source) => (
                  <li key={source.id}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2.5 py-1.5 text-xs font-semibold text-navy transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand"
                      title={`Abrir "${source.name}"`}
                    >
                      <FileText className="size-3.5 shrink-0 text-brand" />
                      <span className="truncate">{source.name}</span>
                      <ExternalLink className="size-3 shrink-0 opacity-60 group-hover:opacity-100" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {showActions && (
          <div className="mt-1.5 flex flex-wrap items-center gap-0.5">
            <IconAction label={copied ? "Copiado!" : "Copiar resposta"} onClick={copy}>
              {copied ? <Check /> : <Copy />}
            </IconAction>
            {canSpeak && (
              <IconAction
                label={speaking ? "Parar leitura" : "Ouvir resposta"}
                onClick={() => (speaking ? onStopSpeaking() : onSpeak(message.id, message.content))}
                active={speaking}
              >
                {speaking ? <Square className="fill-current" /> : <Volume2 />}
              </IconAction>
            )}
            <IconAction
              label="Resposta útil"
              onClick={() => onFeedback(message.id, "up")}
              active={message.feedback === "up"}
            >
              <ThumbsUp />
            </IconAction>
            <IconAction
              label="Resposta não ajudou"
              onClick={() => onFeedback(message.id, "down")}
              active={message.feedback === "down"}
            >
              <ThumbsDown />
            </IconAction>
            {message.feedback && (
              <span className="ml-1 text-xs font-medium text-success animate-in fade-in">
                Obrigado pelo feedback!
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export function UserMessage({ message }: { message: StoredMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-lg rounded-br-sm bg-navy px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-white shadow-sm sm:max-w-[75%]">
        {message.content}
      </div>
    </div>
  );
}
