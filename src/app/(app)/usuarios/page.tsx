import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ROL_LABELS } from "@/lib/roles";
import { etiquetasLocalidades } from "@/lib/localidad";
import { UsuarioCard } from "@/components/usuarios/usuario-card";

export default async function UsuariosPage() {
  const usuario = await requireUser();
  if (usuario.rol !== "ADMIN_GENERAL") redirect("/dashboard");

  const usuarios = await prisma.usuario.findMany({
    include: { localidades: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Usuarios</h1>
          <p className="text-sm text-muted-foreground">{usuarios.length} cuenta(s).</p>
        </div>
        <Button asChild>
          <Link href="/usuarios/nuevo">
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Link>
        </Button>
      </div>

      {/* Celular: tarjetas apiladas (la tabla de 5 columnas no cabe sin
          ocultar Rol/Localidades/Estado). Tablet/escritorio: tabla. */}
      <div className="space-y-3 sm:hidden" data-testid="usuarios-lista-movil">
        {usuarios.map((u) => (
          <UsuarioCard key={u.id} usuario={u} />
        ))}
      </div>

      <div className="hidden sm:block" data-testid="usuarios-tabla-escritorio">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Localidades</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((u) => (
              <TableRow key={u.id} className="cursor-pointer">
                <TableCell>
                  <Link
                    href={`/usuarios/${u.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {u.nombre}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.correo}</TableCell>
                <TableCell>{ROL_LABELS[u.rol]}</TableCell>
                <TableCell className="text-muted-foreground">
                  {etiquetasLocalidades(u.localidades)}
                </TableCell>
                <TableCell>
                  <Badge variant={u.activo ? "success" : "outline"}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
