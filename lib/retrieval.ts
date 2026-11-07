/**
 * Seleção de contexto para o modelo.
 *
 * MVP sem vetores: se todos os documentos couberem em MAX_CONTEXT_CHARS,
 * eles vão inteiros para o modelo (janela de contexto grande do Gemini).
 * Se não couberem, fazemos uma pré-seleção simples por palavras-chave
 * (BM25 em memória, por trechos) e enviamos só os trechos mais relevantes.
 *
 * TODO (produto final): substituir a BM25 por busca vetorial (embeddings +
 * banco vetorial), com indexação incremental quando a pasta mudar.
 */

export interface RetrievableDoc {
  id: string;
  name: string;
  url: string;
  text: string;
}

export interface ContextDoc extends RetrievableDoc {
  /** true quando só parte do documento foi incluída. */
  partial: boolean;
}

export interface Passage {
  docIndex: number;
  index: number;
  text: string;
}

// Palavras muito comuns em português que não ajudam na busca.
const STOPWORDS = new Set(
  (
    "a o e é de do da dos das em no na nos nas um uma uns umas por para pra pro com sem sob " +
    "ao aos à às que se ou mas como mais menos muito muita muitos muitas qual quais quando onde " +
    "quem cujo porque pois isso isto esse essa esses essas este esta estes estas aquele aquela " +
    "ele ela eles elas eu tu voce voces nos vos me te lhe meu minha meus minhas seu sua seus suas " +
    "nosso nossa ser estar ter haver foi sao sou era tem tinha ha faz fazer faco posso pode podem " +
    "deve devo preciso precisa sobre entre ate apos antes depois tambem ja nao sim so cada todo " +
    "toda todos todas outro outra qualquer algum alguma quanto quanta quantos quantas leva levar " +
    "existe existem gostaria queria saber informar explique explicar diga dizer favor ola oi bom dia " +
    "the of and to in is"
  ).split(/\s+/),
);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Radical simples: tira o plural e corta a palavra em 5 letras, para casar
 * "chamados" com "chamado", "comprar" com "compras" e "urgência" com
 * "urgente". Grosseiro, mas suficiente para uma pré-seleção.
 */
function stem(token: string): string {
  if (token.length <= 3 || /^\d+$/.test(token)) return token;
  let t = token;
  if (t.endsWith("oes") || t.endsWith("aes")) t = t.slice(0, -3) + "ao";
  else if (t.endsWith("ais")) t = t.slice(0, -3) + "al";
  else if (t.endsWith("ns")) t = t.slice(0, -2) + "m";
  else if (t.endsWith("s") && !t.endsWith("ss")) t = t.slice(0, -1);
  return t.slice(0, 5);
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
    .map(stem);
}

/**
 * Divide o texto em trechos de ~targetChars respeitando parágrafos e
 * começando um trecho novo nos títulos (Markdown), quando possível.
 */
export function splitIntoPassages(text: string, targetChars = 1500): string[] {
  const units: string[] = [];
  const blocks = text
    .split(/\n{2,}|\n(?=#{1,6}\s)/)
    .map((p) => p.trim())
    .filter(Boolean);
  // Blocos muito grandes (listas, tabelas) são quebrados por linha.
  for (const block of blocks) {
    if (block.length <= targetChars * 1.5) {
      units.push(block);
      continue;
    }
    let buffer = "";
    for (const line of block.split("\n")) {
      if (line.length > targetChars) {
        if (buffer) units.push(buffer);
        buffer = "";
        for (let i = 0; i < line.length; i += targetChars) units.push(line.slice(i, i + targetChars));
      } else if (buffer && buffer.length + line.length + 1 > targetChars) {
        units.push(buffer);
        buffer = line;
      } else {
        buffer = buffer ? `${buffer}\n${line}` : line;
      }
    }
    if (buffer) units.push(buffer);
  }

  const passages: string[] = [];
  let current = "";
  for (const unit of units) {
    const isHeading = /^#{1,6}\s/.test(unit);
    // Um título nunca fica sozinho: o conteúdo seguinte vai junto.
    const currentIsSmall = current.length < targetChars * 0.25;
    const overflow = current.length + unit.length + 2 > targetChars;
    if (current && !currentIsSmall && (overflow || (isHeading && current.length > targetChars * 0.4))) {
      passages.push(current);
      current = "";
    }
    current = current ? `${current}\n\n${unit}` : unit;
  }
  if (current) passages.push(current);
  return passages;
}

/** Índice BM25 simples em memória. */
export class Bm25Index {
  private readonly docTokens: Map<string, number>[] = [];
  private readonly lengths: number[] = [];
  private readonly docFreq = new Map<string, number>();
  private avgLength = 0;

  constructor(
    texts: string[],
    private readonly k1 = 1.4,
    private readonly b = 0.75,
  ) {
    for (const text of texts) {
      const tokens = tokenize(text);
      const tf = new Map<string, number>();
      for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
      for (const token of tf.keys()) this.docFreq.set(token, (this.docFreq.get(token) ?? 0) + 1);
      this.docTokens.push(tf);
      this.lengths.push(tokens.length);
    }
    const total = this.lengths.reduce((sum, n) => sum + n, 0);
    this.avgLength = this.lengths.length ? total / this.lengths.length : 0;
  }

  /** Pontuação BM25 e fração dos termos da consulta presentes em cada texto. */
  score(query: string): Array<{ score: number; coverage: number }> {
    const terms = [...new Set(tokenize(query))];
    const n = this.docTokens.length;
    return this.docTokens.map((tf, i) => {
      let score = 0;
      let matched = 0;
      for (const term of terms) {
        const freq = tf.get(term);
        if (!freq) continue;
        matched++;
        const df = this.docFreq.get(term) ?? 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        const norm = this.k1 * (1 - this.b + this.b * (this.lengths[i] / (this.avgLength || 1)));
        score += idf * ((freq * (this.k1 + 1)) / (freq + norm));
      }
      return { score, coverage: terms.length ? matched / terms.length : 0 };
    });
  }
}

/** Ordena trechos de todos os documentos por relevância para a consulta. */
export function rankPassages(
  docs: RetrievableDoc[],
  query: string,
  passageChars = 1500,
): Array<Passage & { score: number; coverage: number }> {
  const passages: Passage[] = [];
  docs.forEach((doc, docIndex) => {
    splitIntoPassages(doc.text, passageChars).forEach((text, index) => {
      passages.push({ docIndex, index, text });
    });
  });
  // O nome do documento entra no índice de cada trecho (ajuda bastante).
  const index = new Bm25Index(
    passages.map((p) => `${docs[p.docIndex].name}\n${p.text}`),
  );
  const scores = index.score(query);
  return passages
    .map((p, i) => ({ ...p, ...scores[i] }))
    .sort((a, b) => b.score - a.score || a.docIndex - b.docIndex || a.index - b.index);
}

const DOC_OVERHEAD = 200; // cabeçalho <documento ...> de cada documento

/**
 * Escolhe o que vai no contexto. Retorna os documentos (inteiros ou em
 * trechos) dentro do limite de caracteres.
 */
export function selectContext(
  docs: RetrievableDoc[],
  query: string,
  maxChars: number,
): { docs: ContextDoc[]; selected: boolean } {
  const total = docs.reduce((sum, d) => sum + d.text.length + DOC_OVERHEAD, 0);
  if (total <= maxChars) {
    return { docs: docs.map((d) => ({ ...d, partial: false })), selected: false };
  }

  const ranked = rankPassages(docs, query);
  const hasMatches = ranked.some((p) => p.score > 0);
  // Sem nenhuma palavra em comum: usa o início de cada documento, alternando.
  const ordered = hasMatches
    ? ranked.filter((p) => p.score > 0)
    : [...ranked].sort((a, b) => a.index - b.index || a.docIndex - b.docIndex);

  const chosen = new Map<number, Passage[]>();
  const docOrder: number[] = [];
  let used = 0;
  for (const passage of ordered) {
    const isNewDoc = !chosen.has(passage.docIndex);
    const cost = passage.text.length + 10 + (isNewDoc ? DOC_OVERHEAD : 0);
    if (used + cost > maxChars) continue;
    used += cost;
    if (isNewDoc) {
      chosen.set(passage.docIndex, []);
      docOrder.push(passage.docIndex);
    }
    chosen.get(passage.docIndex)!.push(passage);
  }

  const result: ContextDoc[] = docOrder.map((docIndex) => {
    const doc = docs[docIndex];
    const passages = chosen.get(docIndex)!.sort((a, b) => a.index - b.index);
    const totalPassages = splitIntoPassages(doc.text).length;
    let text = "";
    let last = -1;
    for (const p of passages) {
      if (text) text += p.index === last + 1 ? "\n\n" : "\n\n[...]\n\n";
      text += p.text;
      last = p.index;
    }
    return { ...doc, text, partial: passages.length < totalPassages };
  });

  return { docs: result, selected: true };
}
