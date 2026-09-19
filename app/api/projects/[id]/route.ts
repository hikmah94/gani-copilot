import { getApprovedReportsForProject, getProjectById } from "@/lib/repo-projects";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  const reports = await getApprovedReportsForProject(id);
  return Response.json({ project, reports });
}
