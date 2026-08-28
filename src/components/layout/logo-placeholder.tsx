/**
 * Placeholder neutro del logo de Nueva Alianza SLP.
 *
 * Para reemplazarlo por el logo oficial: coloca el archivo (por ejemplo
 * `logo.svg` o `logo.png`) en `/public/`, y sustituye este componente por
 * un `<Image src="/logo.svg" alt="Nueva Alianza SLP" width={..} height={..} />`
 * de `next/image`.
 */
export function LogoPlaceholder() {
  return (
    <div className="flex items-center gap-2">
      <div
        aria-hidden
        className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
      >
        NA
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-foreground">Nueva Alianza SLP</p>
        <p className="text-xs text-muted-foreground">Captura Electoral</p>
      </div>
    </div>
  );
}
