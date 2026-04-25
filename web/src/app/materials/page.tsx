import Link from "next/link";
import { redirect } from "next/navigation";
import MaterialSearch from "@/components/MaterialSearch";
import { getSessionSupabaseUid } from "@/lib/session-uid";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const session = await getSessionSupabaseUid();
  if (!session.ok) {
    redirect("/login?next=%2Fmaterials");
  }

  return (
    <div id="shell">
      <aside id="sb">
        <div className="logo">
          <div className="logo-full">
            <div className="logo-t">RenoFlow</div>
            <div className="logo-s">Renovation Calculator</div>
          </div>
          <div className="logo-rf">RF</div>
        </div>

        <div className="pi">
          <div className="pi-l">Tools</div>
          <div className="pi-n">Material search</div>
          <div className="pi-c">Home Depot (CA)</div>
        </div>

        <nav className="nav">
          <div className="ns">Navigate</div>
          <Link href="/final" className="ni" prefetch={false}>
            <span className="ni-i">
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="1.5" y="1.5" width="6" height="6" rx="1.2" />
                <rect x="9.5" y="1.5" width="6" height="6" rx="1.2" />
                <rect x="1.5" y="9.5" width="6" height="6" rx="1.2" />
                <rect x="9.5" y="9.5" width="6" height="6" rx="1.2" />
              </svg>
            </span>
            <span className="ni-l">Workspace</span>
          </Link>
          <Link href="/projects" className="ni" prefetch={false}>
            <span className="ni-i">
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 5.5h11M3 8.5h11M3 11.5h8" />
                <rect x="1.5" y="2.5" width="14" height="12" rx="1.5" />
              </svg>
            </span>
            <span className="ni-l">Active projects</span>
          </Link>
          <div className="ni on" aria-current="page">
            <span className="ni-i">
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3.5 6.5 8.5 3l5 3.5v6.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V6.5Z" />
                <path d="M6.5 14.5V10h4v4.5" />
              </svg>
            </span>
            <span className="ni-l">Materials</span>
          </div>
        </nav>

        <div className="sb-tot">
          <div className="tot-l">Signed in</div>
          <div className="tot-b">Test supplier search</div>
        </div>
      </aside>

      <div id="main">
        <div
          className="ph"
          style={{ borderBottom: "1px solid #d9d9d9", paddingBottom: 16, alignItems: "flex-start" }}
        >
          <div>
            <div className="pt">
              <em>Materials</em> search
            </div>
            <p className="ps">Query Home Depot Canada via the server API (SerpAPI).</p>
          </div>
          <a href="/api/auth/logout" className="btn bg sm">
            Sign out
          </a>
        </div>

        <div className="pc">
          <MaterialSearch />
        </div>
      </div>
    </div>
  );
}
