import Link from "next/link";
import type { Rol } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROL_LABELS } from "@/lib/roles";
import { etiquetasLocalidades } from "@/lib/localidad";
import type { LocalidadAsignada } from "@/lib/auth-helpers";

type UsuarioResumen = {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  activo: boolean;
  localidades: LocalidadAsignada[];
};

/**
 * Tarjeta de usuario para pantallas angostas — la tabla de escritorio
 * (Rol, Localidades, Estado) no cabe en un celular sin ocultar columnas
 * enteras, así que en `sm:hidden` se usa esta vista apilada en su lugar.
 */
export function UsuarioCard({ usuario }: { usuario: UsuarioResumen }) {
  return (
    <Link href={`/usuarios/${usuario.id}`}>
      <Card className="transition-colors hover:border-primary">
        <CardContent className="space-y-1.5 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-primary">{usuario.nombre}</p>
            <Badge variant={usuario.activo ? "success" : "outline"}>
              {usuario.activo ? "Activo" : "Inactivo"}
            </Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">{usuario.correo}</p>
          <p className="text-sm text-foreground">{ROL_LABELS[usuario.rol]}</p>
          {usuario.localidades.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {etiquetasLocalidades(usuario.localidades)}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
