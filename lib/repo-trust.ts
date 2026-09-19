import { env } from "cloudflare:workers";

export type TrustStats = {
  documentsReady: number; documentsTotal: number;
  projectsVerified: number; projectsTotal: number;
  communityReportsApproved: number; communityReportsTotal: number;
};

export async function getTrustStats(): Promise<TrustStats> {
  const [documentsReady, documentsTotal, projectsVerified, projectsTotal, reportsApproved, reportsTotal] = await env.DB.batch<{ count: number }>([
    env.DB.prepare("SELECT COUNT(*) as count FROM documents WHERE processing_status='ready'"),
    env.DB.prepare("SELECT COUNT(*) as count FROM documents"),
    env.DB.prepare("SELECT COUNT(*) as count FROM projects WHERE verification_status='verified'"),
    env.DB.prepare("SELECT COUNT(*) as count FROM projects"),
    env.DB.prepare("SELECT COUNT(*) as count FROM community_reports WHERE moderation_status='approved'"),
    env.DB.prepare("SELECT COUNT(*) as count FROM community_reports"),
  ]);
  const num = (result: D1Result<{ count: number }>) => Number(result.results?.[0]?.count ?? 0);
  return {
    documentsReady: num(documentsReady), documentsTotal: num(documentsTotal),
    projectsVerified: num(projectsVerified), projectsTotal: num(projectsTotal),
    communityReportsApproved: num(reportsApproved), communityReportsTotal: num(reportsTotal),
  };
}
