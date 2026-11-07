import Link from "next/link";

import { BrandStripe, Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <BrandStripe />
      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <Logo className="h-10" />
        <p className="section-title mt-8 text-brand">Erro 404</p>
        <h1 className="mt-2 text-2xl font-bold">Página não encontrada</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          O endereço acessado não existe ou o documento não está mais disponível.
        </p>
        <Button asChild className="mt-6 bg-brand font-semibold hover:bg-brand-hover">
          <Link href="/">Voltar ao assistente</Link>
        </Button>
      </main>
    </div>
  );
}
