import { BookOpenCheck, FileSearch, Mic } from "lucide-react";
import type { Metadata } from "next";

import { BrandStripe, Logo } from "@/components/brand/logo";
import { LoginForm } from "@/components/login-form";
import { brand } from "@/config/brand";
import { accessMisconfigured, passwordRequired } from "@/lib/auth";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

const HIGHLIGHTS = [
  { icon: FileSearch, title: "Respostas com fonte", text: "Cada resposta indica o documento de onde veio." },
  { icon: Mic, title: "Por texto ou voz", text: "Digite ou fale a pergunta, até pelo celular." },
  { icon: BookOpenCheck, title: "Sempre atualizado", text: "Arquivo novo na pasta do Drive já entra na base." },
];

function safeRedirect(value: string | string[] | undefined): string {
  const target = Array.isArray(value) ? value[0] : value;
  return target && target.startsWith("/") && !target.startsWith("//") ? target : "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <div className="flex min-h-dvh flex-col">
      <BrandStripe />
      <div className="grid flex-1 lg:grid-cols-[1.05fr_1fr]">
        {/* Painel institucional (desktop) */}
        <aside className="relative hidden overflow-hidden bg-navy text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, #fff 0 2px, transparent 2px 28px)",
            }}
          />
          <div aria-hidden className="absolute -right-24 -bottom-24 size-96 rounded-full border-[40px] border-brand/25" />

          <div className="relative">
            <p className="font-heading text-4xl font-extrabold tracking-wider">MSM</p>
            <p className="font-heading text-[11px] font-semibold tracking-[0.3em] text-white/70">
              INDUSTRIAL ENGINEERING
            </p>
          </div>

          <div className="relative max-w-lg">
            <p className="font-heading text-xs font-bold tracking-[0.2em] text-brand uppercase">
              {brand.productName}
            </p>
            <h2 className="mt-3 font-heading text-3xl leading-tight font-bold text-white xl:text-4xl">
              Tire dúvidas sobre a MSM em segundos.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/75">
              Processos, serviços, funções e procedimentos da empresa, respondidos com base nos
              documentos oficiais.
            </p>
            <ul className="mt-10 space-y-5">
              {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-white/10">
                    <Icon className="size-5 text-brand" />
                  </span>
                  <span>
                    <span className="block font-heading text-sm font-bold">{title}</span>
                    <span className="block text-sm text-white/70">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-white/50">
            {brand.companyName} · {brand.companyLocation}
          </p>
        </aside>

        {/* Formulário */}
        <main className="flex items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
              <Logo className="h-12" />
              <h1 className="mt-6 font-heading text-xl font-bold tracking-wide uppercase">
                {brand.productName}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Assistente interno da {brand.companyName}. Entre para começar.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-white p-6 shadow-[0_4px_24px_rgba(30,42,94,0.08)] sm:p-7">
              <LoginForm
                passwordRequired={passwordRequired()}
                misconfigured={accessMisconfigured()}
                redirectTo={safeRedirect(params.de)}
              />
            </div>
            <p className="mt-6 text-center text-xs text-muted-foreground lg:hidden">
              Uso interno · {brand.companyName} · {brand.companyLocation}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
