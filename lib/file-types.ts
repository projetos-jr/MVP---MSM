/** Tipos de arquivo reconhecidos pela base de conhecimento. */

export const MIME = {
  folder: "application/vnd.google-apps.folder",
  shortcut: "application/vnd.google-apps.shortcut",
  googleDoc: "application/vnd.google-apps.document",
  googleSheet: "application/vnd.google-apps.spreadsheet",
  googleSlides: "application/vnd.google-apps.presentation",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  text: "text/plain",
  markdown: "text/markdown",
  csv: "text/csv",
} as const;

export type FileKind =
  | "google-doc"
  | "google-sheet"
  | "google-slides"
  | "pdf"
  | "docx"
  | "text"
  | "unsupported";

const TEXT_EXTENSIONS = [".md", ".markdown", ".txt", ".csv"];

function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

export function fileKind(mimeType: string, name: string): FileKind {
  const ext = extensionOf(name);
  switch (mimeType) {
    case MIME.googleDoc:
      return "google-doc";
    case MIME.googleSheet:
      return "google-sheet";
    case MIME.googleSlides:
      return "google-slides";
    case MIME.pdf:
      return "pdf";
    case MIME.docx:
      return "docx";
    case MIME.text:
    case MIME.markdown:
    case "text/x-markdown":
    case MIME.csv:
      return "text";
  }
  // O Drive às vezes classifica .md como application/octet-stream.
  if (TEXT_EXTENSIONS.includes(ext)) return "text";
  if (ext === ".pdf") return "pdf";
  if (ext === ".docx") return "docx";
  return "unsupported";
}

export function typeLabel(mimeType: string, name: string): string {
  const ext = extensionOf(name);
  switch (fileKind(mimeType, name)) {
    case "google-doc":
      return "Google Docs";
    case "google-sheet":
      return "Google Planilhas";
    case "google-slides":
      return "Google Apresentações";
    case "pdf":
      return "PDF";
    case "docx":
      return "Word";
    case "text":
      if (ext === ".md" || ext === ".markdown" || mimeType.includes("markdown"))
        return "Markdown";
      if (ext === ".csv" || mimeType === MIME.csv) return "CSV";
      return "Texto";
  }
  if (mimeType.startsWith("image/")) return "Imagem";
  if (mimeType.startsWith("video/")) return "Vídeo";
  if (mimeType.startsWith("audio/")) return "Áudio";
  if (mimeType.includes("spreadsheet") || ext === ".xlsx" || ext === ".xls")
    return "Planilha Excel";
  if (mimeType.includes("presentation") || ext === ".pptx") return "PowerPoint";
  if (mimeType.includes("zip")) return "Arquivo compactado";
  if (mimeType.startsWith("application/vnd.google-apps."))
    return "Arquivo Google";
  return ext ? ext.slice(1).toUpperCase() : "Outro";
}

export function mimeFromExtension(name: string): string {
  switch (extensionOf(name)) {
    case ".md":
    case ".markdown":
      return MIME.markdown;
    case ".txt":
      return MIME.text;
    case ".csv":
      return MIME.csv;
    case ".pdf":
      return MIME.pdf;
    case ".docx":
      return MIME.docx;
    default:
      return "application/octet-stream";
  }
}

/** Nome sem extensão, usado para exibir e para identificar citações. */
export function displayName(name: string): string {
  const ext = extensionOf(name);
  return ext && ext.length <= 6 ? name.slice(0, -ext.length) : name;
}
