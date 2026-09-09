import Link from "next/link";
import { LogOut, ShieldAlert, KeyRound, ChevronDown } from "lucide-react";
import type { Casa } from "@prisma/client";
import { LogoConTexto } from "@/components/layout/logo";
import { CasaSwitcher } from "@/components/layout/casa-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DropdownAccionItem } from "@/components/layout/dropdown-accion-item";
import { Button } from "@/components/ui/button";
import { ROL_LABELS } from "@/lib/roles";
import { cerrarSesion, cerrarTodasMisSesiones } from "@/actions/auth";
import type { UsuarioAutenticado } from "@/lib/auth-helpers";

export function Header({
  usuario,
  casaActiva,
}: {
  usuario: UsuarioAutenticado;
  casaActiva: Casa;
}) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/dashboard" className="shrink-0">
          <LogoConTexto />
        </Link>

        <div className="flex items-center gap-2">
          <CasaSwitcher casaActiva={casaActiva} />

          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="max-w-[38vw]">
              <span className="truncate">{usuario.nombre}</span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <p className="truncate font-medium text-foreground">{usuario.correo}</p>
              <p className="font-normal text-muted-foreground">{ROL_LABELS[usuario.rol]}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {usuario.rol === "ADMIN_GENERAL" && (
              <DropdownMenuItem asChild>
                <Link href="/cuenta/password">
                  <KeyRound className="mr-2 h-4 w-4" />
                  Cambiar contraseña
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownAccionItem accion={cerrarTodasMisSesiones}>
              <ShieldAlert className="mr-2 h-4 w-4" />
              Cerrar sesión en todos los dispositivos
            </DropdownAccionItem>
            <DropdownMenuSeparator />
            <DropdownAccionItem accion={cerrarSesion}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownAccionItem>
          </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
