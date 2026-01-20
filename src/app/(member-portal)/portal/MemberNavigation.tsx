"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { Menu, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function MemberNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDisplay, setUserDisplay] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserDisplay(user.email.split("@")[0]);
      }
    };
    getUser();
  }, [supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out");
    router.push("/portal/login");
    router.refresh();
  };

  const navItems = [
    { href: "/portal", label: "Dashboard", exact: true },
    { href: "/portal/payments", label: "Payments" },
    { href: "/portal/profile", label: "Profile" },
  ];

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname?.startsWith(href + "/");
  };

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="bg-brand-teal border-b border-white/10">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            {/* Top Row - Logo and Profile */}
            <div className="flex justify-between items-center h-16 border-b border-white/10">
              <div className="flex items-center gap-2">
                {/* Mobile Menu Button */}
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
                      <nav className="flex flex-col gap-2 mt-8">
                        {navItems.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`text-lg font-medium px-4 py-2 rounded-md transition-colors ${
                              isActive(item.href, item.exact)
                                ? "bg-brand-teal text-white"
                                : "text-foreground hover:bg-accent"
                            }`}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {item.label}
                          </Link>
                        ))}
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

                {/* Logo / Title */}
                <Link href="/portal" className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logos/logo-white.svg"
                    alt="Member Portal"
                    className="h-8"
                  />
                  <span className="text-white/60 text-sm hidden sm:inline">Member Portal</span>
                </Link>
              </div>

              {/* Profile Dropdown */}
              <div className="flex items-center gap-2">
                {mounted && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white/80 hover:text-white hover:bg-white/10"
                      >
                        <span>{userDisplay || "Account"}</span>
                        <ChevronDown className="ml-1 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem asChild>
                        <Link href="/portal/profile" className="w-full cursor-pointer">
                          Profile
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
            <div className="hidden lg:flex justify-center items-center h-12">
              <NavigationMenu>
                <NavigationMenuList>
                  {navItems.map((item) => (
                    <NavItem key={item.href}>
                      <NavigationMenuLink asChild active={isActive(item.href, item.exact)}>
                        <Link
                          href={item.href}
                          className="text-white hover:text-white hover:bg-white/10 data-[active]:bg-white/10 h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors"
                        >
                          {item.label}
                        </Link>
                      </NavigationMenuLink>
                    </NavItem>
                  ))}
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer to push content below fixed header */}
      <div className="h-28" aria-hidden="true" />
    </>
  );
}
