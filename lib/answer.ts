import { displayName } from "@/lib/file-types";
import { normalize } from "@/lib/retrieval";
import type { Source } from "@/lib/types";

/**
 * Filtra o marcador de fontes (<<FONTES: 1, 2>>) do fluxo de texto do
 * modelo. Enquanto o texto chega, segura qualquer final que possa ser o
 * começo do marcador, para ele nunca aparecer na tela.
 */
export class SourcesMarkerFilter {
  private full = "";
  private emitted = 0;
  private markerIndex = -1;
  private static readonly MARKER = /<<\s*FONTES\s*:/i;
  private static readonly COMPACT = "<<FONTES:";

  push(chunk: string): string {
    this.full += chunk;
    if (this.markerIndex >= 0) return "";

    const match = SourcesMarkerFilter.MARKER.exec(this.full.slice(Math.max(0, this.emitted - 16)));
    if (match) {
      this.markerIndex = Math.max(0, this.emitted - 16) + match.index;
      const out = this.full.slice(this.emitted, Math.max(this.emitted, this.markerIndex));
      this.emitted = Math.max(this.emitted, this.markerIndex);
      return out;
    }

    let safeEnd = this.full.length;
    for (let k = Math.min(16, this.full.length - this.emitted); k > 0; k--) {
      const tail = this.full.slice(this.full.length - k);
      if (!tail.startsWith("<")) continue;
      const compact = tail.replace(/\s+/g, "").toUpperCase();
      if (SourcesMarkerFilter.COMPACT.startsWith(compact)) {
        safeEnd = this.full.length - k;
        break;
      }
    }
    const out = this.full.slice(this.emitted, safeEnd);
    this.emitted = safeEnd;
    return out;
  }

  /** Libera o que sobrou no fim do fluxo. */
  flush(): string {
    if (this.markerIndex >= 0) return "";
    const out = this.full.slice(this.emitted);
    this.emitted = this.full.length;
    return out;
  }

  get answer(): string {
    return (this.markerIndex >= 0 ? this.full.slice(0, this.markerIndex) : this.full).trim();
  }

  /** Números de documentos citados no marcador, ou null se não houver marcador. */
  get citedNumbers(): number[] | null {
    if (this.markerIndex < 0) return null;
    const content = this.full.slice(this.markerIndex).replace(SourcesMarkerFilter.MARKER, "");
    const end = content.indexOf(">>");
    const inside = end >= 0 ? content.slice(0, end) : content;
    return [...inside.matchAll(/\d+/g)].map((m) => Number(m[0]));
  }
}

interface CitableDoc {
  id: string;
  name: string;
  url: string;
}

/**
 * Define as fontes exibidas: documentos indicados no marcador + documentos
 * citados pelo nome no texto da resposta.
 */
export function resolveSources(
  answer: string,
  citedNumbers: number[] | null,
  docs: CitableDoc[],
): Source[] {
  const chosen = new Set<number>();
  for (const n of citedNumbers ?? []) {
    if (n >= 1 && n <= docs.length) chosen.add(n - 1);
  }
  const normalizedAnswer = normalize(answer);
  docs.forEach((doc, index) => {
    const title = normalize(displayName(doc.name)).trim();
    if (title.length >= 4 && normalizedAnswer.includes(title)) chosen.add(index);
  });
  return [...chosen]
    .sort((a, b) => a - b)
    .map((index) => ({ id: docs[index].id, name: docs[index].name, url: docs[index].url }));
}
