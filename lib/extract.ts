import "server-only";

import mammoth from "mammoth";
// Importa direto de lib/ para evitar o código de depuração do index.js
// do pdf-parse, que tenta abrir um PDF de teste e quebra em serverless.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

import { fileKind } from "@/lib/file-types";

/** Normaliza espaços e quebras de linha do texto extraído. */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPdf(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text ?? "";
}

export async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

/** Extrai texto de um arquivo binário (PDF, DOCX, TXT, MD, CSV). */
export async function extractFromBuffer(
  buffer: Buffer,
  mimeType: string,
  name: string,
): Promise<string> {
  switch (fileKind(mimeType, name)) {
    case "pdf":
      return cleanText(await extractPdf(buffer));
    case "docx":
      return cleanText(await extractDocx(buffer));
    case "text":
      return cleanText(buffer.toString("utf8").replace(/^﻿/, ""));
    default:
      throw new Error("Tipo de arquivo não suportado");
  }
}
