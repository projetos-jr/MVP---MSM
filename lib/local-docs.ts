import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { extractFromBuffer } from "@/lib/extract";
import { mimeFromExtension } from "@/lib/file-types";
import type { KnowledgeSource, SourceFile } from "@/lib/sources";

/**
 * Modo de teste: sem DRIVE_FOLDER_ID, os documentos são lidos da pasta
 * seed-docs/ do próprio projeto. Assim a demo funciona antes de configurar
 * o Google Drive. Os mesmos arquivos podem depois ser enviados ao Drive.
 */

export const SEED_DIR = path.join(process.cwd(), "seed-docs");

const LOCAL_PREFIX = "local:";

function toId(relativePath: string): string {
  return LOCAL_PREFIX + relativePath.split(path.sep).join("/");
}

/** Converte o id de volta em caminho absoluto, impedindo sair da pasta. */
export function resolveLocalId(id: string): string | null {
  if (!id.startsWith(LOCAL_PREFIX)) return null;
  const relative = id.slice(LOCAL_PREFIX.length);
  const absolute = path.resolve(SEED_DIR, relative);
  if (!absolute.startsWith(SEED_DIR + path.sep)) return null;
  return absolute;
}

export function localDocUrl(id: string): string {
  return `/documentos/local?id=${encodeURIComponent(id)}`;
}

async function walk(dir: string, relative: string, out: SourceFile[]) {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" && relative === "") return;
    throw error;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(dir, entry.name);
    const rel = relative ? path.join(relative, entry.name) : entry.name;
    if (entry.isDirectory()) {
      await walk(abs, rel, out);
    } else if (entry.isFile()) {
      const stat = await fs.stat(abs);
      const id = toId(rel);
      out.push({
        id,
        name: entry.name,
        mimeType: mimeFromExtension(entry.name),
        modifiedTime: stat.mtime.toISOString(),
        url: localDocUrl(id),
        folder: relative.split(path.sep).filter(Boolean).join(" / "),
        size: stat.size,
      });
    }
  }
}

export async function listLocalFiles(): Promise<SourceFile[]> {
  const files: SourceFile[] = [];
  await walk(SEED_DIR, "", files);
  return files;
}

export async function extractLocalFile(file: SourceFile): Promise<string> {
  const absolute = resolveLocalId(file.id);
  if (!absolute) throw new Error("Caminho inválido");
  const buffer = await fs.readFile(absolute);
  return extractFromBuffer(buffer, file.mimeType, file.name);
}

export function createLocalSource(): KnowledgeSource {
  return {
    mode: "local",
    folderUrl: null,
    list: listLocalFiles,
    extract: extractLocalFile,
  };
}
