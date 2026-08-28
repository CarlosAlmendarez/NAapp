import Link from "next/link";
import { MapPin, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type CasillaResumen = {
  id: string;
  municipio: string;
  seccion: number;
  tipoCasilla: string;
  coloniaLocalidad: string;
  ubicacion: string;
  representantes: { tipo: "PROPIETARIO" | "SUPLENTE" }[];
  _count: { asistentes: number };
};

export function CasillaCard({ casilla }: { casilla: CasillaResumen }) {
  const tienePropietario = casilla.representantes.some((r) => r.tipo === "PROPIETARIO");
  const tieneSuplente = casilla.representantes.some((r) => r.tipo === "SUPLENTE");

  return (
    <Link href={`/casillas/${casilla.id}`}>
      <Card className="transition-colors hover:border-primary">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">Sección {casilla.seccion}</span>
              <Badge variant="secondary">{casilla.tipoCasilla}</Badge>
            </div>
            <p className="mt-1 flex items-center gap-1 truncate text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {casilla.municipio} · {casilla.coloniaLocalidad}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{casilla.ubicacion}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant={tienePropietario ? "success" : "outline"}>
                RC propietario {tienePropietario ? "✓" : "pendiente"}
              </Badge>
              <Badge variant={tieneSuplente ? "success" : "outline"}>
                RC suplente {tieneSuplente ? "✓" : "pendiente"}
              </Badge>
              {casilla._count.asistentes > 0 && (
                <Badge variant="secondary">{casilla._count.asistentes} asistente(s)</Badge>
              )}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
