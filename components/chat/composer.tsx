"use client";

import { ArrowUp, Mic, Square } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSpeechRecognition } from "@/hooks/use-speech";
import { cn } from "@/lib/utils";

export interface ComposerHandle {
  focus: () => void;
}

interface ComposerProps {
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

const MAX_HEIGHT = 200;

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { streaming, onSend, onStop },
  ref,
) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prefixRef = useRef("");

  useImperativeHandle(ref, () => ({ focus: () => textareaRef.current?.focus() }), []);

  const speech = useSpeechRecognition({
    onTranscript: (transcript, isFinal) => {
      const prefix = prefixRef.current;
      setText(prefix ? `${prefix} ${transcript}` : transcript);
      if (isFinal) textareaRef.current?.focus();
    },
    onError: (message) => toast.error(message),
  });

  // Ajusta a altura do campo ao conteúdo.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [text]);

  const submit = useCallback(() => {
    const value = text.trim();
    if (!value || streaming) return;
    if (speech.listening) speech.stop();
    onSend(value);
    setText("");
  }, [text, streaming, onSend, speech]);

  function toggleMic() {
    if (speech.listening) {
      speech.stop();
    } else {
      prefixRef.current = text.trim();
      speech.start();
    }
  }

  const canSend = text.trim().length > 0 && !streaming;

  return (
    <form
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div
        className={cn(
          "flex items-end gap-1.5 rounded-lg border border-input bg-white p-1.5 pl-3 shadow-[0_2px_10px_rgba(30,42,94,0.08)] transition-colors focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/15",
          speech.listening && "border-brand ring-3 ring-brand/15",
        )}
      >
        <label htmlFor="pergunta" className="sr-only">
          Sua pergunta
        </label>
        <textarea
          id="pergunta"
          ref={textareaRef}
          value={text}
          rows={1}
          maxLength={4000}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={
speech.listening ? "Ouvindo… fale sua pergunta" : "Digite sua pergunta…"
          }
          className="max-h-[200px] min-h-10 flex-1 resize-none bg-transparent py-2 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground sm:text-[15px]"
        />

        {speech.supported && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                onClick={toggleMic}
                aria-label={speech.listening ? "Parar de ouvir" : "Falar pergunta"}
                aria-pressed={speech.listening}
                className={cn(
                  "size-10 shrink-0 rounded-md text-navy hover:bg-muted",
                  speech.listening && "bg-brand-soft text-brand hover:bg-brand-soft",
                )}
              >
                <span className="relative flex">
                  {speech.listening && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-brand/40" />
                  )}
                  <Mic className="relative size-5" />
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{speech.listening ? "Ouvindo… toque para parar" : "Falar pergunta"}</TooltipContent>
          </Tooltip>
        )}

        {streaming ? (
          <Button
            type="button"
            size="icon-lg"
            onClick={onStop}
            aria-label="Parar resposta"
            className="size-10 shrink-0 rounded-md bg-navy hover:bg-navy-light"
          >
            <Square className="size-4 fill-current" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon-lg"
            disabled={!canSend}
            aria-label="Enviar pergunta"
            className="size-10 shrink-0 rounded-md bg-brand hover:bg-brand-hover disabled:bg-brand/40 disabled:opacity-100"
          >
            <ArrowUp className="size-5" />
          </Button>
        )}
      </div>
      {speech.listening && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-brand" role="status">
          <span className="size-2 animate-pulse rounded-full bg-brand" />
          Ouvindo… fale sua pergunta e toque em enviar.
        </p>
      )}
    </form>
  );
});
