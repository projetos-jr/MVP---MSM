/**
 * Identidade visual e textos de marca do Assistente MSM.
 *
 * Este é o ÚNICO lugar onde cores, nomes e textos de marca são definidos.
 * As cores viram variáveis CSS (`--brand-*`) injetadas no <head> pelo
 * layout raiz (app/layout.tsx) e são consumidas pelo app/globals.css.
 * Para trocar a identidade, altere apenas este arquivo (e o logo em
 * public/logo.svg).
 */

export const brand = {
  productName: "Assistente MSM",
  companyName: "MSM Caldeiraria",
  companyLegalName: "MSM Industrial Engineering",
  companyLocation: "Ribeirão Pires/SP",
  tagline: "Tire dúvidas sobre processos, serviços e procedimentos da MSM.",

  logo: {
    src: "/logo.svg",
    alt: "MSM Industrial Engineering",
    width: 132,
    height: 40,
  },

  colors: {
    /** Laranja principal: botões, destaques, barra superior */
    primary: "#D9531E",
    primaryHover: "#BF4515",
    primarySoft: "#FBEDE7",
    /** Azul-marinho: títulos, logo, menu lateral */
    navy: "#1E2A5E",
    navyLight: "#2C3A78",
    navyDark: "#151E45",
    /** Fundo claro e texto */
    background: "#F7F7F7",
    surface: "#FFFFFF",
    text: "#333333",
    textMuted: "#6B6F7B",
    border: "#E3E5EA",
    success: "#1F8A4C",
    danger: "#C62828",
  },

  /** Raio dos cantos: pouco arredondado, visual industrial. */
  radius: "0.375rem",

  /**
   * Sugestões exibidas na tela vazia do chat. Devem ser respondíveis pelos
   * documentos da base de conhecimento (ver seed-docs/).
   */
  suggestions: [
    "Como faço para abrir um chamado de TI?",
    "Quais são as etapas do processo de compras?",
    "O que acontece na primeira semana de um novo colaborador?",
    "Quanto tempo o TI leva para atender um chamado urgente?",
  ],
} as const;

/** Gera o bloco `:root { --brand-*: ... }` a partir das cores acima. */
export function brandCssVariables(): string {
  const c = brand.colors;
  const vars: Record<string, string> = {
    "--brand-primary": c.primary,
    "--brand-primary-hover": c.primaryHover,
    "--brand-primary-soft": c.primarySoft,
    "--brand-navy": c.navy,
    "--brand-navy-light": c.navyLight,
    "--brand-navy-dark": c.navyDark,
    "--brand-background": c.background,
    "--brand-surface": c.surface,
    "--brand-text": c.text,
    "--brand-text-muted": c.textMuted,
    "--brand-border": c.border,
    "--brand-success": c.success,
    "--brand-danger": c.danger,
    "--brand-radius": brand.radius,
  };
  const body = Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join("");
  return `:root{${body}}`;
}
