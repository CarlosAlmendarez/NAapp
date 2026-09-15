import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { listarCasillasParaImpresion } from "@/lib/casillas-impresion";
import type { PersonaImpresion, RcImpresion } from "@/lib/rutas-impresion";
import { formatTipoCasilla } from "@/lib/tipo-casilla";
import { nombreCompleto, formatFecha } from "@/lib/utils";
import { BotonImprimir } from "@/components/rutas/boton-imprimir";

export const metadata = { title: "Casillas — Impresión" };

const CSS = `
@page { size: letter; margin: 13mm; }
* { box-sizing: border-box; }
.pv-wrap { background:#e6e6e6; padding:20px 10px 40px; min-height:100vh; font-family: var(--font-inter), system-ui, sans-serif; }
.pv-bar { width:190mm; max-width:100%; margin:0 auto 12px; display:flex; justify-content:space-between; align-items:center; gap:12px; }
.pv-bar .hint { font-size:12px; color:#444; }
.hoja { width:190mm; max-width:100%; margin:0 auto; background:#fff; color:#111; padding:12mm; font-size:10.5px; line-height:1.35; box-shadow:0 2px 14px rgba(0,0,0,.18); }
.doc-title { font-size:15px; font-weight:700; margin:0; }
.doc-sub { color:#555; font-size:10px; margin:1mm 0 6mm; }
.grupo { font-size:12px; font-weight:700; margin:5mm 0 2mm; padding-bottom:1mm; border-bottom:1.5px solid #333; break-after:avoid; }
.casilla { break-inside:avoid; border:1px solid #bcbcbc; border-radius:5px; padding:3mm; margin-bottom:3mm; }
.casilla .c-h { font-weight:700; }
.casilla .c-row { color:#555; margin-top:.5mm; }
.casilla .c-row b { color:#111; font-weight:600; }
.rc-grid { display:grid; grid-template-columns:1fr 1fr; gap:2mm; margin-top:1.5mm; }
.rc-casa { padding-left:2.5mm; border-left:2px solid #d0d0d0; }
.rc-casa .rc-t { font-weight:700; font-size:9.5px; }
.rc-linea { font-size:9.5px; margin-top:.4mm; }
.rc-linea .lbl { font-weight:600; }
.vacio, .rc-vacio { color:#999; }
@media print {
  .pv-wrap { background:#fff; padding:0; }
  .pv-bar { display:none; }
  .hoja { width:auto; max-width:none; box-shadow:none; padding:0; }
}
`;

function LineaPersona({
  etiqueta,
  p,
}: {
  etiqueta: string;
  p: (PersonaImpresion & { propone?: string; telefonoPropone?: string | null }) | null;
}) {
  if (!p) {
    return (
      <p className="rc-linea">
        <span className="lbl">{etiqueta}:</span> <span className="rc-vacio">—</span>
      </p>
    );
  }
  return (
    <p className="rc-linea">
      <span className="lbl">{etiqueta}:</span> {nombreCompleto(p)}
      {" · Clave INE: "}
      {p.claveElector || "—"}
      {" · Tel: "}
      {p.telefono || "—"}
      {" · Correo: "}
      {p.correoElectronico || "—"}
      {" · Propone: "}
      {p.propone || "—"}
      {" · Tel. de quien propone: "}
      {p.telefonoPropone || "—"}
    </p>
  );
}

function RcCasa({ titulo, rc }: { titulo: string; rc: RcImpresion }) {
  return (
    <div className="rc-casa">
      <p className="rc-t">{titulo}</p>
      <LineaPersona etiqueta="Propietario" p={rc.propietario} />
      <LineaPersona etiqueta="Suplente" p={rc.suplente} />
    </div>
  );
}

/** Solo nombre completo y teléfono del RG (el enlace/ruta ya capturado
 * para esta casilla) — nunca su correo. */
function RgTexto({ rg }: { rg: { nombre: string; telefono: string } | null }) {
  if (!rg) return <span className="vacio">—</span>;
  return (
    <>
      {rg.nombre}
      {" · Tel: "}
      {rg.telefono}
    </>
  );
}

export default async function ImprimirCasillasPage({
  searchParams,
}: {
  searchParams: Promise<{ municipio?: string; distrito?: string }>;
}) {
  const usuario = await requireUser();
  // RG usa el PDF de Rutas, no éste.
  if (usuario.rol === "REPRESENTANTE_GENERAL") notFound();

  const { municipio, distrito } = await searchParams;
  if (!municipio && !distrito) {
    return (
      <div className="pv-wrap">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="hoja">
          <p className="vacio">
            Elige un municipio (o un distrito local) desde la lista de Casillas para generar
            la impresión.
          </p>
        </div>
      </div>
    );
  }

  const casillas = await listarCasillasParaImpresion(usuario, { municipio, distrito });
  const alcance = municipio ?? `Distrito local ${distrito}`;
  const ahora = new Date();

  // Agrupar por distrito local (un municipio puede abarcar varios).
  const grupos: { distrito: string; casillas: typeof casillas }[] = [];
  for (const c of casillas) {
    let g = grupos.find((x) => x.distrito === c.distritoLocal);
    if (!g) {
      g = { distrito: c.distritoLocal, casillas: [] };
      grupos.push(g);
    }
    g.casillas.push(c);
  }

  return (
    <div className="pv-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pv-bar">
        <span className="hint">
          Vista de impresión (tamaño carta) — {alcance}. Usa el botón para guardar como PDF.
        </span>
        <BotonImprimir />
      </div>

      <div className="hoja">
        <h1 className="doc-title">Casillas — {alcance}</h1>
        <p className="doc-sub">
          {casillas.length} casilla(s) · Generado el {formatFecha(ahora)} · {usuario.nombre}
        </p>

        {casillas.length === 0 ? (
          <p className="vacio">No hay casillas en tu alcance para ese filtro.</p>
        ) : (
          grupos.map((g) => (
            <div key={g.distrito}>
              {grupos.length > 1 && <h2 className="grupo">Distrito local {g.distrito}</h2>}
              {g.casillas.map((c) => (
                <div key={c.id} className="casilla">
                  <p className="c-h">
                    Sección {c.seccion} · {formatTipoCasilla(c.tipoCasilla)} · {c.municipio}
                    {" · Distrito local "}
                    {c.distritoLocal}
                    {c.distritoFederal ? ` · Distrito federal ${c.distritoFederal}` : ""}
                  </p>
                  <p className="c-row">
                    {c.coloniaLocalidad}
                    {c.codigoPostal ? ` · C.P. ${c.codigoPostal}` : ""}
                  </p>
                  <p className="c-row">
                    <b>Domicilio:</b> {c.domicilio}
                  </p>
                  <p className="c-row">
                    <b>Ubicación:</b> {c.ubicacion}
                  </p>
                  {/* El enlace se dio de alta en UNA casa (nunca cambia al
                      editarlo) — se muestra solo del lado que corresponde;
                      el otro queda en "—". Se muestra en TODAS las casillas
                      que lo tengan capturado, aunque se repita seguido; si
                      genuinamente no hay nada capturado para esta casilla,
                      se indica en vez de omitir la línea. */}
                  {c.rg ? (
                    <p className="c-row">
                      <b>RG Casa 26:</b> <RgTexto rg={c.rg.casa === "C26" ? c.rg : null} /> ·{" "}
                      <b>RG Casa 52:</b> <RgTexto rg={c.rg.casa === "C52" ? c.rg : null} />
                    </p>
                  ) : (
                    <p className="c-row">
                      <b>RG:</b> <span className="vacio">Sin RG capturado</span>
                    </p>
                  )}
                  <div className="rc-grid">
                    <RcCasa titulo="RC Casa 26" rc={c.rc.C26} />
                    <RcCasa titulo="RC Casa 52" rc={c.rc.C52} />
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
