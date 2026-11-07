import type { Metadata } from "next";
import { preload } from "react-dom";

import { BrandStripe, Logo } from "@/components/brand/logo";
import { LoginForm } from "@/components/login-form";
import { brand } from "@/config/brand";
import { accessMisconfigured, passwordRequired } from "@/lib/auth";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

function safeRedirect(value: string | string[] | undefined): string {
  const target = Array.isArray(value) ? value[0] : value;
  return target && target.startsWith("/") && !target.startsWith("//") && !target.includes("\\")
    ? target
    : "/";
}

/**
 * Tela de entrada no estilo do site da MSM: foto de uma peça fabricada pela
 * empresa ao fundo, com sobreposição em degradê azul, e o logo e o formulário
 * no centro. A foto é definida em config/brand.ts (loginBackground).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  preload(brand.loginBackground, { as: "image", fetchPriority: "high" });

  return (
    <div className="relative min-h-dvh bg-navy-deep">
      {/* Fundo: foto + degradê azul (fica fixo ao rolar no celular) */}
      <div aria-hidden className="fixed inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={brand.loginBackground}
          alt=""
          className="h-full w-full scale-105 object-cover object-[center_40%]"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-navy opacity-50 mix-blend-multiply sm:opacity-60" />
        <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(4,30,66,0.78)_0%,rgba(30,42,94,0.4)_48%,rgba(4,30,66,0.8)_100%)] sm:bg-[linear-gradient(160deg,rgba(4,30,66,0.92)_0%,rgba(30,42,94,0.5)_48%,rgba(4,30,66,0.9)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(4,30,66,0.35)_100%)] sm:bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(4,30,66,0.55)_100%)]" />
      </div>

      <BrandStripe className="fixed inset-x-0 top-0 z-20" />

      <main className="relative z-10 flex min-h-dvh items-center justify-center px-5 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-4">
        <div className="w-full max-w-[400px] animate-in fade-in-0 slide-in-from-bottom-2 duration-500 sm:max-w-[420px]">
          <div className="rounded-xl bg-white px-5 pt-6 pb-6 shadow-[0_24px_64px_rgba(4,30,66,0.45)] sm:px-9 sm:pt-10 sm:pb-9">
            <div className="flex flex-col items-center text-center">
              <Logo className="h-14 sm:h-[88px]" priority />
              <span aria-hidden className="mt-4 h-[3px] w-10 rounded-full bg-brand sm:mt-6" />
              <h1 className="mt-3 font-heading text-[15px] font-bold tracking-[0.14em] uppercase sm:mt-4 sm:text-lg">
                {brand.productName}
              </h1>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground sm:mt-1.5 sm:text-sm">
                Tire dúvidas sobre processos, serviços e procedimentos da MSM.
              </p>
            </div>
            <div className="mt-5 sm:mt-7">
              <LoginForm
                passwordRequired={passwordRequired()}
                misconfigured={accessMisconfigured()}
                redirectTo={safeRedirect(params.de)}
              />
            </div>
          </div>
          <p className="mt-5 text-center text-xs text-white/80 sm:mt-6">
            Uso interno · {brand.companyName} · {brand.companyLocation}
          </p>
        </div>
      </main>
    </div>
  );
}
