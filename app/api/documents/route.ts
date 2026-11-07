import { getKnowledgeBaseInfo } from "@/lib/knowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/documents          → lista (usa o cache de até 2 min)
 *  GET /api/documents?refresh=1 → força a releitura da pasta agora */
export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("refresh") === "1";
  try {
    const info = await getKnowledgeBaseInfo({ force });
    return Response.json(info, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[documents] Falha:", error);
    return Response.json(
      { error: "Não foi possível carregar a base de conhecimento." },
      { status: 500 },
    );
  }
}
