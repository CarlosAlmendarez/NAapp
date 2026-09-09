import type { Casa } from "@prisma/client";

/**
 * "Casa": las dos estructuras paralelas de la operación (Casa 26 y Casa
 * 52). Comparten el catálogo de casillas pero llevan datos de RC, enlace
 * de Rutas y asistentes por separado. Quien captura elige su casa activa
 * al entrar (ver src/actions/casa.ts + el gate en (app)/layout.tsx); se
 * guarda en la cookie `casa` y acota TODO lo que captura o consulta.
 *
 * La casa NO restringe el alcance geográfico ni quién puede capturar —
 * cualquier CAPTURADOR/RG puede trabajar en ambas casas. Solo separa los
 * datos.
 *
 * Este módulo es puro (sin `next/headers`) a propósito: lo importan tanto
 * componentes de servidor como de cliente. La lectura de la cookie vive
 * en `src/lib/casa-server.ts`.
 */

export const COOKIE_CASA = "casa";

export const CASAS: readonly Casa[] = ["C26", "C52"] as const;

/** Número visible de cada casa (para etiquetas, XLSX, nombres de archivo). */
export const CASA_NUMERO: Record<Casa, string> = {
  C26: "26",
  C52: "52",
};

export const CASA_LABEL: Record<Casa, string> = {
  C26: "Casa 26",
  C52: "Casa 52",
};

/**
 * Distintivo visual por casa — clases utilitarias de Tailwind ya
 * presentes en el tema. La 26 usa el acento primario (azul), la 52 el de
 * advertencia (ámbar); así se distingue de un vistazo en qué casa se está
 * capturando.
 */
export const CASA_ESTILO: Record<
  Casa,
  { banda: string; chip: string; punto: string }
> = {
  C26: {
    banda: "border-t-4 border-t-primary",
    chip: "bg-primary/10 text-primary",
    punto: "bg-primary",
  },
  C52: {
    banda: "border-t-4 border-t-warning",
    chip: "bg-warning/15 text-warning",
    punto: "bg-warning",
  },
};

export function esCasa(valor: string | undefined | null): valor is Casa {
  return valor === "C26" || valor === "C52";
}

/** Etiqueta corta "(Casa 26)" / "(Casa 52)" para anexar a "Propone", etc. */
export function sufijoCasa(casa: Casa): string {
  return `(${CASA_LABEL[casa]})`;
}
