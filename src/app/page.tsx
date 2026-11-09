import { getLiveOrganizations } from "@/lib/database/live-organizations";
import { LandingPage } from "./landing-page";

// Re-read the org list every few minutes so a newly live org shows up in the
// "Become a Member" dropdown without a redeploy.
export const revalidate = 300;

export default async function HomePage() {
  const orgs = await getLiveOrganizations();
  return <LandingPage orgs={orgs} />;
}
