"use client";

import { FolderOpen, History, LogOut, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { BrandStripe, Logo } from "@/components/brand/logo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { brand } from "@/config/brand";
import { clearConversations } from "@/lib/chat-storage";
import { firstName, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Chat", icon: MessageSquareText },
  { href: "/documentos", label: "Base de conhecimento", icon: FolderOpen },
];

export function AppHeader({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  async function logout() {
    setLeaving(true);
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      router.replace("/entrar");
      router.refresh();
    }
  }

  return (
    <header className="shrink-0 bg-white">
      <BrandStripe />
      <div className="flex h-14 items-center gap-3 border-b border-border px-3 sm:h-16 sm:px-5">
        <Link href="/" className="flex min-w-0 items-center gap-3 sm:gap-4" aria-label={brand.productName}>
          <Logo className="h-9 sm:h-11" priority />
          <span aria-hidden className="hidden h-8 w-px bg-border sm:block" />
          <span className="hidden font-heading text-[15px] font-bold tracking-wide text-navy uppercase sm:block">
            {brand.productName}
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1" aria-label="Navegação principal">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={cn(
                  "relative flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-semibold transition-colors sm:px-3",
                  active ? "text-brand" : "text-navy/80 hover:bg-muted hover:text-navy",
                )}
              >
                <Icon className="size-[18px]" />
                <span className={cn(href === "/" ? "hidden sm:inline" : "hidden md:inline")}>{label}</span>
                {active && (
                  <span className="absolute inset-x-2 -bottom-[13px] h-[3px] rounded-full bg-brand sm:-bottom-[15px]" />
                )}
              </Link>
            );
          })}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-10 gap-2 rounded-full px-1 sm:pr-3"
              aria-label="Menu do usuário"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-navy font-heading text-xs font-bold text-white">
                {initials(userName || "MSM")}
              </span>
              <span className="hidden max-w-32 truncate text-sm font-semibold text-navy lg:inline">
                {userName ? `Olá, ${firstName(userName)}` : "Colaborador"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-xs text-muted-foreground">Conectado como</span>
              <span className="block truncate font-semibold text-navy">{userName || "Colaborador"}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setConfirmClear(true)}>
              <History />
              Apagar histórico de conversas
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={logout} disabled={leaving}>
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apagar histórico de conversas?</AlertDialogTitle>
              <AlertDialogDescription>
                Todas as conversas salvas neste navegador serão apagadas. Recomendado em aparelhos
                compartilhados. Essa ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => {
                  clearConversations();
                  window.location.assign("/");
                }}
              >
                Apagar histórico
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </header>
  );
}
