import "server-only";

import { auth, drive, type drive_v3 } from "@googleapis/drive";

import { env } from "@/lib/env";
import { cleanText, extractFromBuffer } from "@/lib/extract";
import { MIME, fileKind } from "@/lib/file-types";
import type { KnowledgeSource, SourceFile } from "@/lib/sources";

/**
 * Integração com o Google Drive via conta de serviço (somente leitura).
 * A pasta DRIVE_FOLDER_ID precisa estar compartilhada com o e-mail da conta
 * de serviço (GOOGLE_SERVICE_ACCOUNT_EMAIL) como "Leitor".
 *
 * Usamos @googleapis/drive (o módulo oficial do Drive da família googleapis):
 * mesma API do pacote `googleapis`, mas ~2 MB em vez de ~250 MB, o que
 * cabe com folga no limite de funções da Vercel.
 */

const FILE_FIELDS =
  "id,name,mimeType,modifiedTime,webViewLink,size,shortcutDetails(targetId,targetMimeType)";

let cachedClient: drive_v3.Drive | null = null;
let cachedClientKey = "";

function getClient(): drive_v3.Drive {
  const email = env.serviceAccountEmail;
  const key = env.privateKey;
  if (!email || !key) {
    throw new Error(
      "Credenciais do Google ausentes: defina GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY.",
    );
  }
  const clientKey = `${email}:${key.length}`;
  if (cachedClient && cachedClientKey === clientKey) return cachedClient;

  const jwt = new auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  cachedClient = drive({ version: "v3", auth: jwt });
  cachedClientKey = clientKey;
  return cachedClient;
}

export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

function fileUrl(file: drive_v3.Schema$File): string {
  return file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`;
}

async function listChildren(
  client: drive_v3.Drive,
  folderId: string,
): Promise<drive_v3.Schema$File[]> {
  const files: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;
  do {
    const res = await client.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: `nextPageToken, files(${FILE_FIELDS})`,
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    files.push(...(res.data.files ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return files;
}

/** Lista recursivamente todos os arquivos (não pastas) da pasta raiz. */
export async function listDriveFiles(rootFolderId: string): Promise<SourceFile[]> {
  if (!/^[\w-]+$/.test(rootFolderId)) {
    throw new Error("DRIVE_FOLDER_ID inválido: use o ID ou o link da pasta do Drive.");
  }
  const client = getClient();

  // Valida o acesso à pasta raiz para dar uma mensagem de erro clara.
  await client.files.get({
    fileId: rootFolderId,
    fields: "id,name,mimeType",
    supportsAllDrives: true,
  });

  const result: SourceFile[] = [];
  const visited = new Set<string>();
  const queue: Array<{ id: string; path: string }> = [{ id: rootFolderId, path: "" }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    for (const item of await listChildren(client, current.id)) {
      let file = item;

      // Atalhos: segue para o arquivo/pasta de destino.
      if (item.mimeType === MIME.shortcut && item.shortcutDetails?.targetId) {
        if (item.shortcutDetails.targetMimeType === MIME.folder) {
          queue.push({
            id: item.shortcutDetails.targetId,
            path: joinPath(current.path, item.name ?? ""),
          });
          continue;
        }
        try {
          const target = await client.files.get({
            fileId: item.shortcutDetails.targetId,
            fields: FILE_FIELDS,
            supportsAllDrives: true,
          });
          file = { ...target.data, name: item.name ?? target.data.name };
        } catch {
          // Destino sem permissão: lista o atalho como não suportado.
        }
      }

      if (file.mimeType === MIME.folder) {
        queue.push({ id: file.id!, path: joinPath(current.path, file.name ?? "") });
        continue;
      }

      result.push({
        id: file.id!,
        name: file.name ?? "(sem nome)",
        mimeType: file.mimeType ?? "application/octet-stream",
        modifiedTime: file.modifiedTime ?? new Date(0).toISOString(),
        url: fileUrl(file),
        folder: current.path,
        size: file.size ? Number(file.size) : undefined,
      });
    }
  }

  return result;
}

function joinPath(base: string, name: string): string {
  return base ? `${base} / ${name}` : name;
}

async function exportAs(fileId: string, mimeType: string): Promise<string> {
  const res = await getClient().files.export(
    { fileId, mimeType },
    { responseType: "text" },
  );
  return typeof res.data === "string" ? res.data : String(res.data ?? "");
}

async function download(fileId: string): Promise<Buffer> {
  const res = await getClient().files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(res.data as ArrayBuffer);
}

/** Extrai o texto de um arquivo do Drive conforme o tipo. */
export async function extractDriveFile(file: SourceFile): Promise<string> {
  switch (fileKind(file.mimeType, file.name)) {
    case "google-doc":
      return cleanText(await exportAs(file.id, "text/plain"));
    case "google-sheet":
      // Observação: a exportação CSV do Drive inclui apenas a primeira aba.
      return cleanText(await exportAs(file.id, "text/csv"));
    case "google-slides":
      return cleanText(await exportAs(file.id, "text/plain"));
    case "pdf":
    case "docx":
    case "text":
      return extractFromBuffer(await download(file.id), file.mimeType, file.name);
    default:
      throw new Error("Tipo de arquivo não suportado");
  }
}

/** Traduz erros da API do Google para mensagens úteis em português. */
export function describeDriveError(error: unknown): string {
  const err = error as {
    code?: number | string;
    status?: number;
    message?: string;
    response?: { status?: number; data?: { error?: string | { message?: string } } };
  };
  const status = Number(err?.response?.status ?? err?.status ?? err?.code);
  const raw =
    (typeof err?.response?.data?.error === "object"
      ? err.response.data.error?.message
      : err?.response?.data?.error) ??
    err?.message ??
    String(error);
  const email = env.serviceAccountEmail || "da conta de serviço";

  if (/invalid_grant|invalid_client|PEM|DECODER|private key|asn1/i.test(raw)) {
    return "Credenciais da conta de serviço inválidas. Confira GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY (incluindo as quebras de linha).";
  }
  if (/Credenciais do Google ausentes/.test(raw)) return raw;
  if (status === 404) {
    return `Pasta não encontrada. Confira o DRIVE_FOLDER_ID e se a pasta foi compartilhada com ${email} como Leitor.`;
  }
  if (status === 403) {
    if (/has not been used|is disabled|accessNotConfigured/i.test(raw)) {
      return "A Google Drive API não está ativada no projeto do Google Cloud da conta de serviço.";
    }
    return `Sem permissão para acessar a pasta. Compartilhe a pasta com ${email} como Leitor.`;
  }
  if (status === 429) {
    return "Limite de requisições do Google Drive atingido. Tente novamente em alguns instantes.";
  }
  return `Não foi possível acessar o Google Drive: ${raw}`;
}

export function createDriveSource(folderId: string): KnowledgeSource {
  return {
    mode: "drive",
    folderUrl: driveFolderUrl(folderId),
    list: () => listDriveFiles(folderId),
    extract: extractDriveFile,
  };
}
