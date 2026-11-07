import { env, knowledgeMode } from "@/lib/env";
import { getKnowledgeBaseInfo } from "@/lib/knowledge";
import { diagnoseLLM, isLLMConfigured, llmModels } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/diagnostico — teste rápido da configuração (exige estar logado).
 * Mostra quais variáveis estão definidas (nunca os valores), a situação da
 * base de conhecimento e, para cada modelo de IA, se respondeu e em quanto
 * tempo. Útil para descobrir por que o chat não responde.
 */
export async function GET() {
  const started = Date.now();
  const [kb, ia] = await Promise.all([
    getKnowledgeBaseInfo().catch((error: unknown) => ({ error: String(error) })),
    isLLMConfigured() ? diagnoseLLM() : Promise.resolve(null),
  ]);

  const documents = "documents" in kb ? kb.documents : [];
  const report = {
    verificadoEm: new Date().toISOString(),
    duracaoMs: Date.now() - started,
    configuracao: {
      APP_PASSWORD: Boolean(env.appPassword),
      GEMINI_API_KEY: isLLMConfigured(),
      modelos: llmModels(),
      GEMINI_THINKING_LEVEL: env.geminiThinkingLevel,
      GEMINI_FIRST_TOKEN_SECONDS: env.geminiFirstTokenSeconds,
      DRIVE_FOLDER_ID: Boolean(env.driveFolderId),
      GOOGLE_SERVICE_ACCOUNT_EMAIL: env.serviceAccountEmail || null,
      GOOGLE_PRIVATE_KEY: Boolean(env.privateKey),
      MAX_CONTEXT_CHARS: env.maxContextChars,
      regiaoVercel: process.env.VERCEL_REGION ?? null,
    },
    baseDeConhecimento: {
      modo: knowledgeMode() === "drive" ? "Google Drive" : "modo de teste (seed-docs/)",
      arquivos: documents.length,
      lidos: documents.filter((d) => d.status === "lido").length,
      comErro: documents
        .filter((d) => d.status === "erro")
        .map((d) => ({ nome: d.name, erro: d.error })),
      erro: kb.error ?? null,
    },
    ia: ia
      ? ia.map((r) => ({
          modelo: r.model,
          funcionou: r.ok,
          primeiraRespostaEmMs: r.firstChunkMs,
          tempoTotalMs: r.totalMs,
          resposta: r.reply ?? null,
          tipoDeErro: r.errorCode ?? null,
          erro: r.error ?? null,
        }))
      : "GEMINI_API_KEY não configurada (modo de teste sem IA)",
  };

  return Response.json(report, { headers: { "Cache-Control": "no-store" } });
}
