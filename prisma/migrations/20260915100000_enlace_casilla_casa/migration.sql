-- Casa activa al momento de capturar el enlace (nunca se toca al editar).
-- Sigue habiendo un solo enlace por casilla — no se vuelve "por casa" —
-- pero permite mostrarlo en la impresión de Casillas solo del lado que
-- corresponde, en vez de repetirlo en ambos. Los enlaces ya existentes se
-- backfillean a Casa 26 (no se sabe en qué casa se capturaron realmente,
-- ya que el campo no existía).
ALTER TABLE "enlaces_casilla" ADD COLUMN "casa" "Casa" NOT NULL DEFAULT 'C26';
ALTER TABLE "enlaces_casilla" ALTER COLUMN "casa" DROP DEFAULT;
