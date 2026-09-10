import { notFound } from "next/navigation";
import { requireUser, puedeUsarModuloRutas } from "@/lib/auth-helpers";
import {
  listarRutasParaImpresion,
  type PersonaImpresion,
  type RcImpresion,
  type CasillaImpresion,
} from "@/lib/rutas-impresion";
import { formatTipoCasilla } from "@/lib/tipo-casilla";
import { nombreCompleto, formatFecha } from "@/lib/utils";
import { BotonImprimir } from "@/components/rutas/boton-imprimir";

export const metadata = { title: "Rutas — Impresión" };

const CSS = `
@page { size: letter; margin: 13mm; }
* { box-sizing: border-box; }
.pv-wrap { background:#e6e6e6; padding: 20px 10px 40px; min-height:100vh; font-family: var(--font-inter), system-ui, sans-serif; }
.pv-bar { width:190mm; max-width:100%; margin:0 auto 12px; display:flex; justify-content:space-between; align-items:center; gap:12px; }
.pv-bar .hint { font-size:12px; color:#444; }
.hoja {
  width:190mm; max-width:100%; margin:0 auto; background:#fff; color:#111;
  padding:12mm; font-size:10.5px; line-height:1.35;
  box-shadow:0 2px 14px rgba(0,0,0,.18);
}
.doc-title { font-size:15px; font-weight:700; margin:0; }
.doc-sub { color:#555; font-size:10px; margin:1mm 0 6mm; }
.ruta { border:1px solid #333; border-radius:6px; padding:4mm; margin-bottom:6mm; }
.ruta:last-child { margin-bottom:0; }
.ruta-h { break-inside:avoid; break-after:avoid; border-bottom:1.5px solid #333; padding-bottom:2mm; margin-bottom:2mm; }
.ruta-h .n { font-weight:700; font-size:12.5px; }
.ruta-h .meta { color:#555; font-size:9.5px; margin-top:1mm; }
.casilla { break-inside:avoid; padding:2.5mm 0; border-bottom:1px dashed #c8c8c8; }
.casilla:last-child { border-bottom:0; padding-bottom:0; }
.casilla .c-h { font-weight:700; }
.casilla .c-row { color:#555; margin-top:.5mm; }
.casilla .c-row b { color:#111; font-weight:600; }
.rc-grid { display:grid; grid-template-columns:1fr 1fr; gap:2mm; margin-top:1.5mm; }
.rc-casa { padding-left:2.5mm; border-left:2px solid #d0d0d0; }
.rc-casa .rc-t { font-weight:700; font-size:9.5px; }
.rc-linea { font-size:9.5px; margin-top:.4mm; }
.rc-linea .lbl { font-weight:600; }
.rc-vacio { color:#999; }
.vacio { color:#999; }
@media print {
  .pv-wrap { background:#fff; padding:0; }
  .pv-bar { display:none; }
  .hoja { width:auto; max-width:none; box-shadow:none; padding:0; }
  .ruta { break-inside:auto; }
}
`;

function LineaPersona({
  etiqueta,
  p,
  conPropone,
}: {
  etiqueta: string;
  p: (PersonaImpresion & { propone?: string }) | null;
  conPropone?: boolean;
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
      {conPropone && (
        <>
          {" · Propone: "}
          {p.propone || "—"}
        </>
      )}
    </p>
  );
}

function RcCasa({ titulo, rc }: { titulo: string; rc: RcImpresion }) {
  return (
    <div className="rc-casa">
      <p className="rc-t">{titulo}</p>
      <LineaPersona etiqueta="Propietario" p={rc.propietario} conPropone />
      <LineaPersona etiqueta="Suplente" p={rc.suplente} conPropone />
    </div>
  );
}

function CasillaBloque({ c }: { c: CasillaImpresion }) {
  return (
    <div className="casilla">
      <p className="c-h">
        {c.orden}. Sección {c.seccion} · {formatTipoCasilla(c.tipoCasilla)} · Distrito local{" "}
        {c.distritoLocal}
        {c.distritoFederal ? ` · Distrito federal ${c.distritoFederal}` : ""}
      </p>
      <p className="c-row">
        <b>{c.municipio}</b> · {c.coloniaLocalidad}
        {c.codigoPostal ? ` · C.P. ${c.codigoPostal}` : ""}
      </p>
      <p className="c-row">
        <b>Domicilio:</b> {c.domicilio}
      </p>
      <p className="c-row">
        <b>Ubicación:</b> {c.ubicacion}
      </p>
      <p className="c-row">
        <b>RG Casa 26:</b> {c.rg.C26 ?? <span className="rc-vacio">—</span>} ·{" "}
        <b>RG Casa 52:</b> {c.rg.C52 ?? <span className="rc-vacio">—</span>}
      </p>
      <div className="rc-grid">
        <RcCasa titulo="RC Casa 26" rc={c.rc.C26} />
        <RcCasa titulo="RC Casa 52" rc={c.rc.C52} />
      </div>
    </div>
  );
}

export default async function ImprimirRutasPage({
  searchParams,
}: {
  searchParams: Promise<{ ruta?: string }>;
}) {
  const usuario = await requireUser();
  if (!puedeUsarModuloRutas(usuario)) notFound();

  const { ruta: rutaId } = await searchParams;
  const rutas = await listarRutasParaImpresion(usuario, rutaId);
  if (rutaId && rutas.length === 0) notFound();

  const ahora = new Date();

  return (
    <div className="pv-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pv-bar">
        <span className="hint">
          Vista de impresión (tamaño carta). Usa el botón para guardar como PDF.
        </span>
        <BotonImprimir />
      </div>

      <div className="hoja">
        <h1 className="doc-title">
          {rutaId ? "Ruta de recorrido" : "Rutas de recorrido"}
        </h1>
        <p className="doc-sub">
          {rutas.length} ruta(s) · Generado el {formatFecha(ahora)} · {usuario.nombre}
        </p>

        {rutas.length === 0 ? (
          <p className="vacio">No hay rutas para imprimir en tu alcance.</p>
        ) : (
          rutas.map((r) => (
            <section key={r.rutaId} className="ruta">
              <div className="ruta-h">
                <p className="n">
                  Ruta de {nombreCompleto(r.enlace)} · {r.casillas.length}{" "}
                  {r.casillas.length === 1 ? "casilla" : "casillas"}
                </p>
                <p className="meta">
                  Capturada el {formatFecha(r.capturadoEn)} · Tel: {r.enlace.telefono || "—"} ·
                  Correo: {r.enlace.correoElectronico || "—"} · Clave INE:{" "}
                  {r.enlace.claveElector || "—"}
                </p>
              </div>
              {r.casillas.map((c) => (
                <CasillaBloque key={c.id} c={c} />
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
