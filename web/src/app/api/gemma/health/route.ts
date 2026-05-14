import { GEMMA_E4B_MODEL, GEMMA_31B_MODEL, health } from "@/lib/ollama";

export async function GET() {
  const h = await health();
  return Response.json({
    ...h,
    expected: { e4b: GEMMA_E4B_MODEL, cloud31b: GEMMA_31B_MODEL },
  });
}
