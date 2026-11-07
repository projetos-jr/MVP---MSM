"use client";

import { AlertTriangle, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSavedName, setSavedName } from "@/lib/chat-storage";

interface LoginFormProps {
  passwordRequired: boolean;
  misconfigured: boolean;
  redirectTo: string;
}

export function LoginForm({ passwordRequired, misconfigured, redirectTo }: LoginFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Lembra o nome usado na última entrada.
  useEffect(() => {
    const saved = getSavedName();
    if (saved) {
      setName(saved);
      passwordRef.current?.focus();
    } else {
      nameRef.current?.focus();
    }
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Informe seu nome para continuar.");
      nameRef.current?.focus();
      return;
    }
    if (passwordRequired && !password) {
      setError("Digite a senha de acesso.");
      passwordRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; name?: string };
      if (!response.ok) {
        setError(data.error ?? "Não foi possível entrar. Tente novamente.");
        setLoading(false);
        if (response.status === 401) {
          setPassword("");
          passwordRef.current?.focus();
        }
        return;
      }
      setSavedName(data.name ?? name.trim());
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("Sem conexão com o servidor. Verifique a internet e tente novamente.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 sm:space-y-5" noValidate>
      {misconfigured && (
        <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            A senha de acesso ainda não foi configurada no servidor. Defina a variável{" "}
            <code className="font-semibold">APP_PASSWORD</code>.
          </span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="nome" className="text-sm font-semibold text-navy">
          Seu nome
        </Label>
        <Input
          id="nome"
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Marcelo"
          autoComplete="name"
          maxLength={60}
          className="h-11 bg-white text-base sm:text-sm"
        />
      </div>

      {passwordRequired && (
        <div className="space-y-2">
          <Label htmlFor="senha" className="text-sm font-semibold text-navy">
            Senha de acesso
          </Label>
          <div className="relative">
            <Input
              id="senha"
              ref={passwordRef}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha"
              autoComplete="current-password"
              className="h-11 bg-white pr-11 text-base sm:text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-navy"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-destructive/8 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={loading || misconfigured}
        className="h-11 w-full rounded-md bg-brand text-[15px] font-semibold hover:bg-brand-hover"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        {loading ? "Entrando…" : "Entrar"}
        {!loading && <ArrowRight className="size-4" />}
      </Button>

      {!passwordRequired && !misconfigured && (
        <p className="text-center text-xs text-muted-foreground">
          Modo de desenvolvimento: nenhuma senha configurada (APP_PASSWORD).
        </p>
      )}
    </form>
  );
}
