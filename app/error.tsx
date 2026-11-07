"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="size-10 text-brand" />
      <h1 className="mt-4 text-xl font-bold">Algo deu errado</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Ocorreu um erro inesperado ao carregar esta tela. Tente novamente.
      </p>
      <Button onClick={reset} className="mt-6 bg-brand font-semibold hover:bg-brand-hover">
        <RotateCcw className="size-4" />
        Tentar novamente
      </Button>
    </div>
  );
}
