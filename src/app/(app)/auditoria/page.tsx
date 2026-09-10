import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { formatFecha } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export const metadata = { title: "Auditoría" };

const PAGE_SIZE = 50;

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ entidad?: string; page?: string }>;
}) {
  const usuario = await requireUser();
  if (usuario.rol !== "ADMIN_GENERAL") redirect("/dashboard");

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = sp.entidad ? { entidad: sp.entidad } : {};

  const [total, registros, entidades] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { usuario: { select: { nombre: true, correo: true } } },
    }),
    prisma.auditLog.findMany({ select: { entidad: true }, distinct: ["entidad"] }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const listaEntidades = entidades.map((e) => e.entidad).sort();

  function buildHref(p: number) {
    const q = new URLSearchParams();
    if (sp.entidad) q.set("entidad", sp.entidad);
    q.set("page", String(p));
    return `/auditoria?${q.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Auditoría</h1>
        <p className="text-sm text-muted-foreground">
          {total} registro(s). Quién hizo qué y cuándo (inicios de sesión y cambios).
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <a
          href="/auditoria"
          className={`rounded-md border px-2.5 py-1 ${
            !sp.entidad ? "border-primary text-primary" : "border-border text-muted-foreground"
          }`}
        >
          Todo
        </a>
        {listaEntidades.map((e) => (
          <a
            key={e}
            href={`/auditoria?entidad=${encodeURIComponent(e)}`}
            className={`rounded-md border px-2.5 py-1 ${
              sp.entidad === e
                ? "border-primary text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {e}
          </a>
        ))}
      </div>

      {registros.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No hay registros.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2 sm:hidden">
            {registros.map((r) => (
              <Card key={r.id}>
                <CardContent className="space-y-1 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary">{r.accion}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatFecha(r.timestamp)}
                    </span>
                  </div>
                  <p className="text-foreground">
                    {r.entidad}
                    {r.entidadId ? ` · ${r.entidadId}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.usuario ? `${r.usuario.nombre} (${r.usuario.correo})` : "—"} · IP {r.ip ?? "—"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registros.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatFecha(r.timestamp)}
                    </TableCell>
                    <TableCell>
                      {r.usuario ? (
                        <span title={r.usuario.correo}>{r.usuario.nombre}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.accion}</Badge>
                    </TableCell>
                    <TableCell>{r.entidad}</TableCell>
                    <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                      {r.entidadId ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.ip ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
        </>
      )}
    </div>
  );
}
