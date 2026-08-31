"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Rol } from "@prisma/client";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Vote, Users, BarChart3, Map } from "lucide-react";

// Orden fijo del menú principal: Inicio primero, Rutas justo después
// (segunda opción), y Casillas al final — el resto de roles solo ve un
// subconjunto de estos ítems, pero el orden relativo entre los que sí ve
// respeta siempre este mismo arreglo.
const ITEMS: { href: string; label: string; icon: typeof LayoutDashboard; roles: Rol[] }[] = [
  {
    href: "/dashboard",
    label: "Inicio",
    icon: LayoutDashboard,
    roles: ["ADMIN_GENERAL", "ADMIN_CASILLAS", "CAPTURADOR", "REPRESENTANTE_GENERAL"],
  },
  {
    href: "/rutas",
    label: "Rutas",
    icon: Map,
    roles: ["ADMIN_GENERAL", "REPRESENTANTE_GENERAL"],
  },
  { href: "/usuarios", label: "Usuarios", icon: Users, roles: ["ADMIN_GENERAL"] },
  {
    href: "/estadisticas",
    label: "Estadísticas",
    icon: BarChart3,
    roles: ["ADMIN_GENERAL"],
  },
  {
    href: "/casillas",
    label: "Casillas",
    icon: Vote,
    roles: ["ADMIN_GENERAL", "ADMIN_CASILLAS", "CAPTURADOR", "REPRESENTANTE_GENERAL"],
  },
];

export function Nav({ rol }: { rol: Rol }) {
  const pathname = usePathname();
  const items = ITEMS.filter((item) => item.roles.includes(rol));

  return (
    <nav className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
        {items.map((item) => {
          const activo = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                activo
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
