"use client";

import { ArrowRight, MessageCircleQuestion } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { brand } from "@/config/brand";
import { firstName } from "@/lib/format";

export function EmptyState({
  userName,
  onPick,
}: {
  userName: string;
  onPick: (question: string) => void;
}) {
  const name = firstName(userName);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pt-6 pb-6 text-center sm:pt-14">
      <Logo className="h-12 sm:h-24" priority />
      <h1 className="mt-4 text-[22px] font-bold sm:mt-8 sm:text-3xl">
        {name ? `Olá, ${name}! Tudo bem?` : "Olá! Tudo bem?"}
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:mt-3 sm:text-[15px]">
        Como posso ajudar? Pergunte sobre processos, serviços, funções e procedimentos da{" "}
        {brand.companyName}.<span className="hidden sm:inline"> Respondo com base nos documentos oficiais e sempre indico a fonte.</span>
      </p>

      <div className="mt-6 w-full sm:mt-10">
        <p className="section-title mb-3 text-left">Sugestões de perguntas</p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {brand.suggestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => onPick(question)}
              className="group flex items-center gap-3 rounded-lg border border-border bg-white px-3.5 py-3 text-left sm:px-4 sm:py-3.5 text-sm font-medium text-navy shadow-[0_1px_2px_rgba(30,42,94,0.05)] transition-all hover:-translate-y-px hover:border-brand hover:shadow-md focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 focus-visible:outline-none"
            >
              <MessageCircleQuestion className="size-5 shrink-0 text-brand" />
              <span className="flex-1">{question}</span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
