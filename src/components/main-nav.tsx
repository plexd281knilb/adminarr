"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
    LayoutDashboard, 
    Users, 
    Settings, 
    Activity, 
    Layers // <--- New Icon for Apps
} from "lucide-react";

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname();

  return (
    <nav
      className={cn("flex items-center space-x-4 lg:space-x-6", className)}
      {...props}
    >
      <Link
        href="/"
        className={cn(
          "text-sm font-medium transition-colors hover:text-primary flex items-center gap-2",
          pathname === "/" ? "text-primary" : "text-muted-foreground"
        )}
      >
        <LayoutDashboard className="h-4 w-4" />
        Dashboard
      </Link>
      
      <Link
        href="/monitoring"
        className={cn(
          "text-sm font-medium transition-colors hover:text-primary flex items-center gap-2",
          pathname.startsWith("/monitoring") ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Activity className="h-4 w-4" />
        Infrastructure
      </Link>

      <Link
        href="/apps"
        className={cn(
          "text-sm font-medium transition-colors hover:text-primary flex items-center gap-2",
          pathname.startsWith("/apps") ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Layers className="h-4 w-4" />
        Apps
      </Link>

      <Link
        href="/users"
        className={cn(
          "text-sm font-medium transition-colors hover:text-primary flex items-center gap-2",
          pathname.startsWith("/users") ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Users className="h-4 w-4" />
        Users
      </Link>
      
      <Link
        href="/settings"
        className={cn(
          "text-sm font-medium transition-colors hover:text-primary flex items-center gap-2",
          pathname === "/settings" ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Settings className="h-4 w-4" />
        Settings
      </Link>
    </nav>
  );
}