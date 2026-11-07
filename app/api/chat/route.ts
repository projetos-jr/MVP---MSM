import { cookies } from "next/headers";

import { SourcesMarkerFilter, resolveSources } from "@/lib/answer";
import { NAME_COOKIE, sanitizeName } from "@/lib/auth";
import { env } from "@/lib/env";
import { getReadableDocs } from "@/lib/knowledge";
import { LLMError, isLLMConfigured, streamAnswer, type LLMMessage } from "@/lib/llm";
import { streamOfflineAnswer } from "@/lib/llm-offline";
import { buildContext } from "@/lib/prompt";
import { selectContext } from "@/lib/retrieval";
import type { ChatErrorCode, ChatStreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Mensagens anteriores enviadas junto com a pergunta (acompanhamento). */
const HISTORY_SIZE = 6;
const MAX_MESSAGE_CHARS = 8000;

const FRIENDLY_ERRORS: Record<ChatErrorCode, string> = {
  rate_limit:
    "O assistente atingiu o limite de uso gratuito da IA neste momento. Aguarde cerca de 1 minuto e tente novamente.",
  auth: "A chave da IA (GEMINI_API_KEY) é inválida ou não tem permissão. Avise o responsável pelo sistema.",
  unavailable: "O serviço de IA está instável no momento. Tente novamente em alguns instantes.",
  blocked: "Não consegui gerar uma resposta para essa pergunta. Tente reformular.",
  knowledge: "Não foi possível carregar a base de conhecimento.",
  bad_request: "Não entendi a mensagem enviada. Tente novamente.",
  unknown: "Ocorreu um erro inesperado ao gerar a resposta. Tente novamente.",
};

function parseMessages(raw: unknown): LLMMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const messages: LLMMessage[] = [];
  for (const item of raw) {
    const role = (item as { role?: unknown })?.role;
    const content = (item as { content?: unknown })?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const text = content.trim().slice(0, MAX_MESSAGE_CHARS);
    if (text) messages.push({ role, content: text });
  }
  // Pergunta atual + as últimas 6 mensagens da conversa.
  const recent = messages.slice(-(HISTORY_SIZE + 1));
  // O Gemini exige que a conversa comece com o usuário.
  while (recent.length && recent[0].role !== "user") recent.shift();
  if (!recent.length || recent.at(-1)!.role !== "user") return null;
  return recent;
}

export async function POST(request: Request) {
  let body: { messages?: unknown; checkedAfter?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: FRIENDLY_ERRORS.bad_request }, { status: 400 });
  }

  const messages = parseMessages(body.messages);
  if (!messages) {
    return Response.json({ error: FRIENDLY_ERRORS.bad_request }, { status: 400 });
  }
  const checkedAfter = typeof body.checkedAfter === "number" ? body.checkedAfter : undefined;
  const cookieStore = await cookies();
  const userName = sanitizeName(decodeURIComponent(cookieStore.get(NAME_COOKIE)?.value ?? ""));

  const encoder = new TextEncoder();
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        if (signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // Cliente desconectou.
        }
      };

      try {
        const { docs, error: kbError } = await getReadableDocs({ checkedAfter });
        if (docs.length === 0 && kbError) {
          send({ type: "error", code: "knowledge", message: `${FRIENDLY_ERRORS.knowledge} ${kbError}` });
          return;
        }

        const offline = !isLLMConfigured();
        send({ type: "meta", offline, documents: docs.length });

        // Consulta para a busca: pergunta atual + pergunta anterior (acompanhamento).
        const userTurns = messages.filter((m) => m.role === "user");
        const query = userTurns.slice(-2).map((m) => m.content).join("\n");
        const selection = selectContext(docs, query, env.maxContextChars);

        const generator = offline
          ? streamOfflineAnswer(messages, selection.docs)
          : streamAnswer(
              messages,
              buildContext({ docs: selection.docs, userName, selected: selection.selected }),
            );

        const filter = new SourcesMarkerFilter();
        for await (const chunk of generator) {
          if (signal.aborted) {
            await generator.return(undefined);
            return;
          }
          const text = filter.push(chunk);
          if (text) send({ type: "text", text });
        }
        const rest = filter.flush();
        if (rest) send({ type: "text", text: rest });

        send({
          type: "sources",
          sources: resolveSources(filter.answer, filter.citedNumbers, selection.docs),
        });
        send({ type: "done" });
      } catch (error) {
        const code: ChatErrorCode = error instanceof LLMError ? error.code : "unknown";
        if (!(error instanceof LLMError)) console.error("[chat] Erro inesperado:", error);
        send({ type: "error", code, message: FRIENDLY_ERRORS[code] });
      } finally {
        try {
          controller.close();
        } catch {
          // já fechado
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
