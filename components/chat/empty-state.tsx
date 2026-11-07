"use client";

import { ArrowRight, MessageCircleQuestion } from "lucide-react";

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
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pt-8 pb-6 text-center sm:pt-16">
      <div className="mb-5 flex size-14 items-center justify-center rounded-lg bg-navy shadow-md">
        <span className="font-heading text-base font-extrabold tracking-wide text-white">MSM</span>
      </div>
      <h1 className="text-2xl font-bold sm:text-3xl">
        {name ? `Olá, ${name}!` : "Olá!"} Como posso ajudar?
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
        Sou o <strong className="text-navy">{brand.productName}</strong>. Pergunte sobre processos,
        serviços, funções e procedimentos da {brand.companyName}. Respondo com base nos documentos
        oficiais e sempre indico a fonte.
      </p>

      <div className="mt-8 w-full sm:mt-10">
        <p className="section-title mb-3 text-left">Sugestões de perguntas</p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {brand.suggestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => onPick(question)}
              className="group flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3.5 text-left text-sm font-medium text-navy shadow-[0_1px_2px_rgba(30,42,94,0.05)] transition-all hover:-translate-y-px hover:border-brand hover:shadow-md focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 focus-visible:outline-none"
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
