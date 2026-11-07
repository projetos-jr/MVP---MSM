import "server-only";

import { SOURCES_MARKER } from "@/lib/prompt";
import { rankPassages, type ContextDoc } from "@/lib/retrieval";
import type { LLMMessage } from "@/lib/llm";

/**
 * Modo de teste SEM IA: usado apenas quando GEMINI_API_KEY não está
 * configurada. Em vez de gerar uma resposta, mostra os trechos mais
 * relevantes dos documentos (busca por palavras-chave), deixando claro
 * que é um modo de teste. Serve para validar a base de conhecimento, as
 * fontes e a interface antes de criar a chave do Gemini.
 */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function trimPassage(text: string, max = 900): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastBreak = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(". "));
  return `${cut.slice(0, lastBreak > max * 0.5 ? lastBreak + 1 : max).trim()} …`;
}

export async function* streamOfflineAnswer(
  messages: LLMMessage[],
  docs: ContextDoc[],
): AsyncGenerator<string> {
  const question = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const ranked = rankPassages(docs, question).filter((p) => p.score > 0);

  // Até 2 trechos, de documentos diferentes quando possível.
  const picked: typeof ranked = [];
  for (const passage of ranked) {
    if (picked.length >= 2) break;
    if (picked.some((p) => p.docIndex === passage.docIndex) && ranked.length > 2) continue;
    picked.push(passage);
  }

  let answer =
    "> ⚠️ **Modo de teste sem IA.** A chave do Gemini (`GEMINI_API_KEY`) ainda não foi configurada, " +
    "então estou mostrando os trechos mais relevantes encontrados nos documentos.\n\n";

  if (picked.length === 0) {
    answer +=
      "Não encontrei essa informação nos documentos da base de conhecimento. " +
      "Sugiro procurar o responsável pela área.\n\n" +
      `${SOURCES_MARKER} >>`;
  } else {
    for (const passage of picked) {
      answer += `**Trecho de *${docs[passage.docIndex].name}*:**\n\n${trimPassage(passage.text)}\n\n---\n\n`;
    }
    const numbers = [...new Set(picked.map((p) => p.docIndex + 1))].join(", ");
    answer = answer.replace(/\n\n---\n\n$/, "\n\n") + `${SOURCES_MARKER} ${numbers}>>`;
  }

  // Simula o streaming para a interface se comportar como no modo com IA.
  const pieces = answer.match(/[\s\S]{1,24}/g) ?? [];
  for (const piece of pieces) {
    await sleep(12);
    yield piece;
  }
}
