/** Contrato comum das origens de documentos (Google Drive ou seed-docs/ local). */

export interface SourceFile {
  id: string;
  name: string;
  mimeType: string;
  /** ISO 8601. Junto com o id, forma a chave do cache. */
  modifiedTime: string;
  url: string;
  /** Caminho da pasta, relativo à pasta raiz ("" = raiz). */
  folder: string;
  size?: number;
}

export interface KnowledgeSource {
  mode: "drive" | "local";
  folderUrl: string | null;
  list(): Promise<SourceFile[]>;
  extract(file: SourceFile): Promise<string>;
}

/** Arquivos maiores que isso não são processados (evita estourar memória/tempo). */
export const MAX_FILE_BYTES = 30 * 1024 * 1024;
