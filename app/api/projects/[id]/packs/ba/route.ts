import { generateBAPack } from "../../../../../../lib/pack-generator";

// generateBAPack verifies the session and scopes to the caller's own projects,
// so an id belonging to someone else returns null here — the same answer as an
// id that does not exist.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const pack = await generateBAPack(id);
  if (!pack) {
    return Response.json({ error: "That project could not be found." }, { status: 404 });
  }
  return Response.json(pack);
}
