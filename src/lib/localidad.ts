import type { LocalidadAsignada } from "@/lib/auth-helpers";

/** Texto legible para una localidad asignada (municipio o distrito local). */
export function etiquetaLocalidad(l: LocalidadAsignada): string {
  if (l.tipo === "MUNICIPIO") return l.valor;
  const match = l.valor.match(/^(\d+)\.\s*(.+)$/);
  return match ? `Distrito local ${match[1]} (${match[2]})` : `Distrito local ${l.valor}`;
}

export function etiquetasLocalidades(localidades: LocalidadAsignada[]): string {
  if (localidades.length === 0) return "—";
  return localidades.map(etiquetaLocalidad).join(", ");
}
