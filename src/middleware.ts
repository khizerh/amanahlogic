import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // ==========================================================================
  // Route Classification
  // ==========================================================================

  // Member portal auth pages (public - no login required)
  const isMemberAuthRoute = pathname === "/portal/login" ||
                            pathname === "/portal/forgot-password" ||
                            pathname === "/portal/reset-password" ||
                            pathname === "/portal/accept-invite";

  // Member portal protected pages (require member login)
  const isMemberPortalRoute = pathname.startsWith("/portal") && !isMemberAuthRoute;

  // Admin auth pages (public - no login required)
  const isAdminAuthRoute = pathname === "/login" ||
                           pathname === "/forgot-password" ||
                           pathname === "/reset-password";

  // Admin protected routes (require admin login)
  const isAdminRoute = pathname.startsWith("/dashboard") ||
                       pathname.startsWith("/members") ||
                       pathname.startsWith("/payments") ||
                       pathname.startsWith("/plans") ||
                       pathname.startsWith("/settings");

  // Fully public routes (no auth, no member/admin check)
  const isPublicRoute = pathname.startsWith("/sign/") ||
                        pathname.startsWith("/payment-complete") ||
                        pathname.startsWith("/join/") ||
                        pathname.startsWith("/api/join/") ||
                        pathname.startsWith("/api/webhooks") ||
                        pathname.startsWith("/api/members/verify-invite") ||
                        pathname.startsWith("/api/members/link-invite") ||
                        pathname === "/" ||
                        pathname === "/privacy" ||
                        pathname === "/terms" ||
                        pathname === "/contact";

  // ==========================================================================
  // Public Routes - Allow through immediately
  // ==========================================================================

  if (isPublicRoute || isMemberAuthRoute || isAdminAuthRoute) {
    return supabaseResponse;
  }

  // ==========================================================================
  // No User - Redirect to appropriate login
  // ==========================================================================

  if (!user) {
    if (isMemberPortalRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal/login";
      return NextResponse.redirect(url);
    }
    if (isAdminRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    // Unknown route, let it through (will 404 if doesn't exist)
    return supabaseResponse;
  }

  // ==========================================================================
  // Member Portal - Verify user is linked to a member
  // ==========================================================================

  if (isMemberPortalRoute) {
    const { data: member } = await supabase
      .from("members")
      .select("id, organization_id")
      .eq("user_id", user.id)
      .single();

    if (!member) {
      // User exists but not linked to a member account
      const url = request.nextUrl.clone();
      url.pathname = "/portal/login";
      url.searchParams.set("error", "not_a_member");
      return NextResponse.redirect(url);
    }

    // Set member context in headers for downstream pages
    requestHeaders.set("x-member-id", member.id);
    requestHeaders.set("x-organization-id", member.organization_id);

    // IMPORTANT: Preserve cookies from Supabase session refresh
    const newResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    // Copy over any cookies that were set during auth
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      newResponse.cookies.set(cookie.name, cookie.value, {
        ...cookie,
      });
    });

    return newResponse;
  }

  // ==========================================================================
  // All other routes - Allow through with existing response
  // ==========================================================================

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (logos, images)
     */
    "/((?!_next/static|_next/image|favicon.ico|logos|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
