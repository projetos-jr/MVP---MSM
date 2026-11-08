/**
 * Teste de ponta a ponta no navegador (Playwright), genérico para qualquer
 * empresa: entrada, sugestão, resposta com fontes, avaliação, erro de limite,
 * histórico, base de conhecimento, documento, celular e saída.
 *
 * Pré-requisitos:
 *   1. Gemini simulado rodando:  node scripts/teste/gemini-simulado.mjs
 *   2. .env.local com APP_PASSWORD=<senha>, GEMINI_API_KEY=chave-falsa,
 *      GEMINI_BASE_URL=http://localhost:3999 (sem DRIVE_FOLDER_ID: lê seed-docs/)
 *   3. App rodando:  npm run build && PORT=3100 npm run start
 *
 * Uso:
 *   SENHA=<senha> node scripts/teste/e2e.cjs
 *   BASE=http://localhost:3100 SENHA=<senha> node scripts/teste/e2e.cjs
 *
 * Capturas de tela em scripts/teste/capturas/ (ignorada pelo Git).
 */
const path = require("node:path");
const fs = require("node:fs");
const { chromium, devices } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:3100";
const SENHA = process.env.SENHA ?? "teste123";
const OUT = path.join(__dirname, "capturas");
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
const ok = (msg) => console.log(`  ✔ ${msg}`);
const fail = (msg) => {
  failures++;
  console.log(`  ✘ ${msg}`);
};
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
const SUGGESTION = 'p.section-title:has-text("Sugestões de perguntas") + div button';

async function login(page, name = "Teste") {
  await page.goto(`${BASE}/entrar`);
  await page.fill("#nome", name);
  await page.fill("#senha", SENHA);
  await page.click("button[type=submit]");
  await page.waitForURL(`${BASE}/`);
  await page.waitForSelector("h1:has-text('Tudo bem?')");
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("401")) errors.push(m.text());
  });

  console.log("Desktop");
  await page.goto(`${BASE}/`);
  check(page.url().startsWith(`${BASE}/entrar`), "sem login, redireciona para /entrar");
  await page.screenshot({ path: `${OUT}/desktop-1-entrada.png` });

  await page.fill("#nome", "Teste");
  await page.fill("#senha", "senha-errada");
  await page.click("button[type=submit]");
  await page.waitForSelector("p[role=alert]:has-text('Senha incorreta')");
  ok("senha errada mostra o aviso");
  await page.fill("#senha", SENHA);
  await page.click("button[type=submit]");
  await page.waitForURL(`${BASE}/`);
  await page.waitForSelector("h1:has-text('Tudo bem?')");
  ok(`entrou: "${await page.textContent("h1")}"`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/desktop-2-inicio.png` });

  const suggestions = await page.locator(SUGGESTION).count();
  check(suggestions >= 2, `${suggestions} sugestões de perguntas na tela inicial`);
  await page.locator(SUGGESTION).first().click();
  await page.waitForSelector("text=Fontes", { timeout: 30_000 });
  const sources = await page.locator("a[title^='Abrir']").allTextContents();
  check(sources.length > 0, `resposta com fontes: ${sources.join(", ")}`);
  await page.screenshot({ path: `${OUT}/desktop-3-resposta.png` });

  await page.click("button[aria-label='Resposta útil']");
  await page.waitForSelector("text=Obrigado pelo feedback!");
  ok("avaliação 👍 registrada");

  await page.fill("#pergunta", "Qual o faturamento anual da empresa?");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.querySelectorAll("button[aria-label='Copiar resposta']").length >= 2,
    null,
    { timeout: 30_000 },
  );
  ok("pergunta digitada respondida");

  await page.fill("#pergunta", "TESTE429TODOS limite");
  await page.keyboard.press("Enter");
  await page.waitForSelector("text=Tentar novamente", { timeout: 30_000 });
  ok("erro de limite mostra mensagem e 'Tentar novamente'");
  await page.click("text=Tentar novamente");
  await page.waitForTimeout(1500);
  check(
    (await page.locator("text=TESTE429TODOS limite").count()) === 1,
    "'Tentar novamente' substitui a pergunta que falhou",
  );

  await page.reload();
  await page.waitForSelector("aside li");
  check((await page.locator("aside li").count()) >= 1, "histórico salvo após recarregar");

  await page.goto(`${BASE}/documentos`);
  await page.waitForSelector("table tbody tr");
  const rows = await page.locator("table tbody tr").count();
  check(rows > 0, `${rows} documento(s) na base de conhecimento`);
  await page.click("text=Atualizar agora");
  await page.waitForSelector("text=Base de conhecimento atualizada!");
  ok("'Atualizar agora' funciona");
  await page.screenshot({ path: `${OUT}/desktop-4-documentos.png`, fullPage: true });
  const [docPage] = await Promise.all([
    ctx.waitForEvent("page"),
    page.locator("table a[aria-label^='Abrir ']").first().click(),
  ]);
  await docPage.waitForSelector("article h1");
  ok(`documento abre: "${await docPage.textContent("article h1")}"`);
  await docPage.close();

  for (const name of ["iPhone SE", "iPhone 13", "Pixel 7"]) {
    console.log(name);
    const m = await browser.newContext({ ...devices[name], locale: "pt-BR" });
    const mp = await m.newPage();
    mp.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    await mp.goto(`${BASE}/entrar`);
    await mp.waitForTimeout(600);
    await mp.screenshot({ path: `${OUT}/${slug}-1-entrada.png` });
    await login(mp);
    await mp.waitForTimeout(400);
    await mp.screenshot({ path: `${OUT}/${slug}-2-inicio.png` });
    let overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, "tela inicial sem rolagem lateral");
    await mp.locator(SUGGESTION).first().click();
    await mp.waitForSelector("text=Fontes", { timeout: 30_000 });
    await mp.screenshot({ path: `${OUT}/${slug}-3-resposta.png` });
    await mp.click("button[aria-label='Abrir conversas']");
    await mp.waitForTimeout(400);
    check(await mp.getByRole("dialog").getByRole("button", { name: "Nova conversa" }).isVisible(), "menu de conversas abre");
    await mp.keyboard.press("Escape");
    await mp.goto(`${BASE}/documentos`);
    await mp.waitForSelector("ul li a[aria-label^='Abrir ']");
    overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, "base de conhecimento sem rolagem lateral");
    await mp.screenshot({ path: `${OUT}/${slug}-4-documentos.png`, fullPage: true });
    await m.close();
  }

  console.log("Encerramento");
  await page.bringToFront();
  await page.goto(`${BASE}/`);
  await page.click("button[aria-label='Menu do usuário']");
  await page.click("text=Apagar histórico de conversas");
  await page.click("button:has-text('Apagar histórico')");
  await page.waitForTimeout(1500);
  check((await page.locator("aside li").count()) === 0, "apagar histórico funciona");
  await page.click("button[aria-label='Menu do usuário']");
  await page.click("text=Sair");
  await page.waitForURL(`${BASE}/entrar`);
  ok("sair volta para /entrar");

  check(errors.length === 0, `sem erros no console${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await browser.close();
  console.log(failures ? `\n${failures} verificação(ões) falharam.` : "\nTudo certo.");
  console.log(`Capturas em ${OUT}`);
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error("FALHOU:", error);
  process.exit(1);
});
