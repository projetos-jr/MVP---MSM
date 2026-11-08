/**
 * Gemini SIMULADO para testes (não usa a internet nem gasta cota).
 *
 * Uso:
 *   node scripts/teste/gemini-simulado.mjs            # porta 3999
 *   PORTA=4000 node scripts/teste/gemini-simulado.mjs
 *
 * No .env.local do app, durante o teste:
 *   GEMINI_API_KEY=chave-falsa
 *   GEMINI_BASE_URL=http://localhost:3999
 *
 * Cenários, escolhidos por palavras na pergunta:
 *   (normal)          responde em streaming citando o documento 1
 *   "faturamento"     responde que não encontrou nos documentos
 *   TESTE429          o modelo principal responde 429 (limite) → o app usa o reserva
 *   TESTE429TODOS     os dois modelos respondem 429 → mensagem de limite
 *   TESTELENTO        o principal fica 40 s sem responder → o app troca para o reserva
 *   TESTELENTOTODOS   os dois ficam lentos → mensagem "a IA demorou demais"
 *   TESTECHAVE        400 "API key not valid" → mensagem de chave inválida
 *
 * Cada requisição é registrada no terminal (modelo, papéis, tamanho do
 * contexto, configuração de geração), útil para conferir o que o app envia.
 */
import http from "node:http";

const PORT = Number(process.env.PORTA ?? 3999);
const PRIMARY = process.env.MODELO_PRINCIPAL ?? "gemini-3.5-flash-lite";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      const match = req.url.match(/models\/([^:]+):(\w+)/);
      const model = match?.[1] ?? "?";
      let json = {};
      try {
        json = JSON.parse(body);
      } catch {}
      const system = json.systemInstruction?.parts?.[0]?.text ?? "";
      const contents = json.contents ?? [];
      const question = contents.at(-1)?.parts?.[0]?.text ?? "";
      const isPrimary = model === PRIMARY;
      log(
        model,
        "| papéis:", contents.map((c) => c.role).join(","),
        "| contexto:", system.length, "caracteres,",
        (system.match(/<documento /g) || []).length, "documentos",
        "| config:", JSON.stringify(json.generationConfig ?? {}),
        "| pergunta:", question.slice(0, 50),
      );

      const fail = (status, message, code) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { code: status, message, status: code } }));
      };
      if ((question.includes("TESTE429") && isPrimary) || question.includes("TESTE429TODOS")) {
        return fail(429, "Resource has been exhausted (e.g. check quota).", "RESOURCE_EXHAUSTED");
      }
      if (question.includes("TESTECHAVE")) {
        return fail(400, "API key not valid. Please pass a valid API key.", "INVALID_ARGUMENT");
      }
      if (question.includes("TESTELENTOTODOS") || (question.includes("TESTELENTO") && isPrimary)) {
        await sleep(40_000);
      }

      res.writeHead(200, { "content-type": "text/event-stream" });
      const answer = /faturamento/i.test(question)
        ? "Não encontrei essa informação nos documentos da base de conhecimento. Sugiro procurar o responsável pela área.\n\n<<FONTES: >>"
        : `Resposta de teste (modelo: ${model}). Segundo o documento 1, siga estes passos:\n\n` +
          "1. Primeiro passo do procedimento.\n2. Segundo passo, com **destaque**.\n3. Terceiro passo.\n\n" +
          "Em caso de dúvida, procure o responsável pela área.\n\n<<FON" +
          "TES: 1>>"; // marcador quebrado de propósito, para testar o filtro
      for (const piece of answer.match(/[\s\S]{1,17}/g)) {
        const chunk = { candidates: [{ content: { role: "model", parts: [{ text: piece }] }, index: 0 }] };
        res.write(`data: ${JSON.stringify(chunk)}\r\n\r\n`);
        await sleep(25);
      }
      const end = { candidates: [{ content: { role: "model", parts: [{ text: "" }] }, finishReason: "STOP", index: 0 }] };
      res.write(`data: ${JSON.stringify(end)}\r\n\r\n`);
      res.end();
    });
  })
  .listen(PORT, () => log(`Gemini simulado em http://localhost:${PORT} (principal: ${PRIMARY})`));
