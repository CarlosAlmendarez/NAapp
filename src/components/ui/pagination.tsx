import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PaginacionEtiqueta } from "@/components/ui/pagination-etiqueta";

export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3">
      <Button asChild variant="outline" size="sm" disabled={page <= 1}>
        <Link href={buildHref(Math.max(1, page - 1))} aria-disabled={page <= 1}>
          <PaginacionEtiqueta>Anterior</PaginacionEtiqueta>
        </Link>
      </Button>
      <span className="text-sm text-muted-foreground">
        Página {page} de {totalPages}
      </span>
      <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
        <Link href={buildHref(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages}>
          <PaginacionEtiqueta>Siguiente</PaginacionEtiqueta>
        </Link>
      </Button>
    </div>
  );
}
