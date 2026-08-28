import Image from "next/image";
import logoMark from "../../../public/logo-mark.png";

/**
 * Logo oficial de Nueva Alianza SLP (recortado del archivo original a la
 * marca cuadrada). Si el archivo cambia, reemplaza `public/logo-mark.png`
 * — el original sin recortar queda archivado en
 * `assets/branding/logo-original.jpeg` por si se necesita recortar de
 * nuevo con otro margen.
 */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <Image
      src={logoMark}
      alt="Nueva Alianza SLP"
      width={size}
      height={size}
      priority
      className="rounded-md"
    />
  );
}

export function LogoConTexto() {
  return (
    <div className="flex items-center gap-2">
      <Logo />
      {/* En celular no hay suficiente ancho junto al menú de usuario para
          el nombre completo sin que se parta palabra por palabra — el
          logo ya comunica la marca por sí solo ahí. */}
      <div className="hidden leading-tight sm:block">
        <p className="whitespace-nowrap text-sm font-semibold text-foreground">
          Nueva Alianza SLP
        </p>
        <p className="whitespace-nowrap text-xs text-muted-foreground">Captura Electoral</p>
      </div>
    </div>
  );
}
