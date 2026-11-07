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
    "toda todos todas outro outra qualquer algum alguma the of and to in is"
  ).split(/\s+/),
);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Redução simples de plural/flexão para casar "chamados" com "chamado". */
function stem(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith("oes") || token.endsWith("aes")) return token.slice(0, -3) + "ao";
  if (token.endsWith("ais")) return token.slice(0, -3) + "al";
  if (token.endsWith("eis") && token.length > 4) return token.slice(0, -3) + "el";
  if (token.endsWith("ns")) return token.slice(0, -2) + "m";
  if (token.endsWith("res") && token.length > 5) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
    .map(stem);
}

/** Divide o texto em trechos de ~targetChars respeitando parágrafos. */
export function splitIntoPassages(text: string, targetChars = 1500): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const passages: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (paragraph.length > targetChars * 1.5) {
      if (current) {
        passages.push(current);
        current = "";
      }
      for (let i = 0; i < paragraph.length; i += targetChars) {
        passages.push(paragraph.slice(i, i + targetChars));
      }
      continue;
    }
    if (current && current.length + paragraph.length + 2 > targetChars) {
      passages.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
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

  score(query: string): number[] {
    const terms = [...new Set(tokenize(query))];
    const n = this.docTokens.length;
    return this.docTokens.map((tf, i) => {
      let score = 0;
      for (const term of terms) {
        const freq = tf.get(term);
        if (!freq) continue;
        const df = this.docFreq.get(term) ?? 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        const norm = this.k1 * (1 - this.b + this.b * (this.lengths[i] / (this.avgLength || 1)));
        score += idf * ((freq * (this.k1 + 1)) / (freq + norm));
      }
      return score;
    });
  }
}

/** Ordena trechos de todos os documentos por relevância para a consulta. */
export function rankPassages(
  docs: RetrievableDoc[],
  query: string,
): Array<Passage & { score: number }> {
  const passages: Passage[] = [];
  docs.forEach((doc, docIndex) => {
    splitIntoPassages(doc.text).forEach((text, index) => {
      passages.push({ docIndex, index, text });
    });
  });
  // O nome do documento entra no índice de cada trecho (ajuda bastante).
  const index = new Bm25Index(
    passages.map((p) => `${docs[p.docIndex].name}\n${docs[p.docIndex].name}\n${p.text}`),
  );
  const scores = index.score(query);
  return passages
    .map((p, i) => ({ ...p, score: scores[i] }))
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
