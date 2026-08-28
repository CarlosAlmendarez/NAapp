/**
 * Traduce el código de tipo de casilla del padrón (B, C01, S02, E01C03…)
 * a una etiqueta legible para mostrar en la UI.
 */
export function formatTipoCasilla(tipo: string): string {
  const codigo = tipo.trim().toUpperCase();

  if (codigo === "B") return "Básica";

  const soloContigua = codigo.match(/^C(\d{2})$/);
  if (soloContigua) return `Contigua ${soloContigua[1]}`;

  const soloEspecial = codigo.match(/^S(\d{2})$/);
  if (soloEspecial) return `Especial ${soloEspecial[1]}`;

  const soloExtraordinaria = codigo.match(/^E(\d{2})$/);
  if (soloExtraordinaria) return `Extraordinaria ${soloExtraordinaria[1]}`;

  const extraordinariaContigua = codigo.match(/^E(\d{2})C(\d{2})$/);
  if (extraordinariaContigua) {
    return `Extraordinaria ${extraordinariaContigua[1]} - Contigua ${extraordinariaContigua[2]}`;
  }

  // Formato no reconocido: se muestra tal cual en vez de fallar.
  return codigo;
}

export type VarianteTipoCasilla =
  | "tipo-basica"
  | "tipo-contigua"
  | "tipo-especial"
  | "tipo-extraordinaria";

/**
 * Variante de <Badge> según la categoría del tipo de casilla — un color
 * distinto por categoría (antes todas se veían igual, en el mismo teal de
 * acento).
 */
export function varianteTipoCasilla(tipo: string): VarianteTipoCasilla {
  const codigo = tipo.trim().toUpperCase();
  if (codigo.startsWith("C")) return "tipo-contigua";
  if (codigo.startsWith("S")) return "tipo-especial";
  if (codigo.startsWith("E")) return "tipo-extraordinaria";
  return "tipo-basica";
}
