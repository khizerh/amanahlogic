"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem as NavItem,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Menu } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDisplay, setUserDisplay] = useState<string | null>(null);
  const supabase = createClient();

  // Prevent hydration mismatch with Radix UI components
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Try to get name from metadata, fall back to email
        const name = user.user_metadata?.full_name || user.user_metadata?.name;
        if (name) {
          setUserDisplay(name);
        } else if (user.email) {
          // Show just the part before @ for cleaner display
          setUserDisplay(user.email.split('@')[0]);
        }
      }
    };
    getUser();
  }, [supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out");
    router.push("/login");
    router.refresh();
  };

  const isDashboard = pathname?.startsWith("/");
  const isOverviewActive = pathname === "/dashboard" || pathname === "/";
  const isMembersActive = pathname === "/members" || pathname?.startsWith("/members/");
  const isPendingActive = pathname === "/pending" || pathname?.startsWith("/pending/");
  const isPaymentsActive = pathname === "/payments" || pathname?.startsWith("/payments/");
  const isPlansActive = pathname === "/plans" || pathname?.startsWith("/plans/");

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50">
        {/* Main Header */}
        <div className="backdrop-blur-sm border-b border-white/10 animate-in fade-in slide-in-from-top-4 duration-500 bg-brand-teal">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {/* Top Row - Logo and Actions */}
            <div className="flex justify-between items-center h-16 border-b border-white/10">
              <div className="flex items-center gap-2">
                {/* Mobile Menu Button - Far Left */}
                {mounted && (
                  <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="lg:hidden text-white hover:text-white hover:bg-white/10 -ml-2"
                      >
                        <Menu className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[280px] sm:w-[350px]">
                      <SheetHeader>
                        <SheetTitle>Menu</SheetTitle>
                      </SheetHeader>
                      <nav className="flex flex-col gap-4 mt-8">
                        <Link
                          href="/dashboard"
                          className={`text-lg font-medium px-4 py-2 rounded-md transition-colors ${
                            isOverviewActive
                              ? "bg-brand-teal text-white"
                              : "text-foreground hover:bg-accent"
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Dashboard
                        </Link>
                        <Link
                          href="/members"
                          className={`text-lg font-medium px-4 py-2 rounded-md transition-colors ${
                            isMembersActive
                              ? "bg-brand-teal text-white"
                              : "text-foreground hover:bg-accent"
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Members
                        </Link>
                        <Link
                          href="/pending"
                          className={`text-lg font-medium px-4 py-2 rounded-md transition-colors ${
                            isPendingActive
                              ? "bg-brand-teal text-white"
                              : "text-foreground hover:bg-accent"
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Pending
                        </Link>
                        <Link
                          href="/payments"
                          className={`text-lg font-medium px-4 py-2 rounded-md transition-colors ${
                            isPaymentsActive
                              ? "bg-brand-teal text-white"
                              : "text-foreground hover:bg-accent"
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Payments
                        </Link>
                        <Link
                          href="/plans"
                          className={`text-lg font-medium px-4 py-2 rounded-md transition-colors ${
                            isPlansActive
                              ? "bg-brand-teal text-white"
                              : "text-foreground hover:bg-accent"
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Plans
                        </Link>
                        <Link
                          href="/settings"
                          className="text-lg font-medium px-4 py-2 rounded-md transition-colors text-foreground hover:bg-accent"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Settings
                        </Link>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            handleLogout();
                          }}
                          className="mt-4"
                        >
                          Logout
                        </Button>
                      </nav>
                    </SheetContent>
                  </Sheet>
                )}

                {/* Logo */}
                <Link href="/dashboard" className="flex items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logos/logo-white.svg"
                    alt="Amanah Logic"
                    className="h-8"
                  />
                </Link>
              </div>

              <div className="flex items-center gap-2">
                {/* Desktop User Dropdown */}
                {mounted && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white/80 hover:text-white hover:bg-white/10"
                      >
                        {userDisplay || "Account"}
                        <ChevronDown className="ml-1 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem asChild>
                        <Link href="/settings" className="w-full cursor-pointer">
                          Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleLogout}
                        className="cursor-pointer text-red-600"
                      >
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            {/* Bottom Row - Centered Navigation (Desktop Only) */}
            {isDashboard && (
              <div className="hidden lg:flex justify-center items-center h-12">
                <NavigationMenu>
                  <NavigationMenuList>
                    <NavItem>
                      <NavigationMenuLink asChild active={isOverviewActive}>
                        <Link
                          href="/dashboard"
                          className="text-white hover:text-white hover:bg-white/10 data-[active]:bg-white/10 h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors"
                        >
                          Dashboard
                        </Link>
                      </NavigationMenuLink>
                    </NavItem>

                    <NavItem>
                      <NavigationMenuLink asChild active={isMembersActive}>
                        <Link
                          href="/members"
                          className="text-white hover:text-white hover:bg-white/10 data-[active]:bg-white/10 h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors"
                        >
                          Members
                        </Link>
                      </NavigationMenuLink>
                    </NavItem>

                    <NavItem>
                      <NavigationMenuLink asChild active={isPendingActive}>
                        <Link
                          href="/pending"
                          className="text-white hover:text-white hover:bg-white/10 data-[active]:bg-white/10 h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors"
                        >
                          Pending
                        </Link>
                      </NavigationMenuLink>
                    </NavItem>

                    <NavItem>
                      <NavigationMenuLink asChild active={isPaymentsActive}>
                        <Link
                          href="/payments"
                          className="text-white hover:text-white hover:bg-white/10 data-[active]:bg-white/10 h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors"
                        >
                          Payments
                        </Link>
                      </NavigationMenuLink>
                    </NavItem>

                    <NavItem>
                      <NavigationMenuLink asChild active={isPlansActive}>
                        <Link
                          href="/plans"
                          className="text-white hover:text-white hover:bg-white/10 data-[active]:bg-white/10 h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors"
                        >
                          Plans
                        </Link>
                      </NavigationMenuLink>
                    </NavItem>
                  </NavigationMenuList>
                </NavigationMenu>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Spacer to push content below fixed header */}
      <div className="h-28" aria-hidden="true" />
    </>
  );
}
