"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  requireUserOrThrow,
  requireRole,
  requireLocalidadAccess,
} from "@/lib/auth-helpers";
import { obtenerCasaActiva } from "@/lib/casa-server";
import { enlaceCasillaSchema } from "@/lib/validations/persona";
import {
  buscarCasillasParaRuta,
  type CasillaBusquedaRuta,
} from "@/lib/rutas-query";
import { encryptField } from "@/lib/crypto";
import { registrarAuditoria } from "@/lib/audit";
import { ejecutarAccion, AccionError, type ActionResult } from "@/lib/action-result";

const ROLES_MODULO_RUTAS = ["ADMIN_GENERAL", "REPRESENTANTE_GENERAL"] as const;

/**
 * Busca casillas dentro del alcance del usuario para agregarlas a una ruta
 * en captura (ver RutaForm) — usada por el buscador de "+ agregar casilla".
 * Excluye las casillas que YA tienen enlace (una casilla no puede tener
 * dos: el enlace/RG es único por casilla). El `casa` solo se usa para
 * mostrar el contexto del RC (que sí es por casa).
 */
export async function buscarCasillasRuta(
  texto: string
): Promise<ActionResult<CasillaBusquedaRuta[]>> {
  return ejecutarAccion(async () => {
    const usuario = await requireUserOrThrow();
    requireRole(usuario, [...ROLES_MODULO_RUTAS]);
    const casa = await obtenerCasaActiva();
    if (!casa) throw new AccionError("Elige una casa (26 o 52) antes de capturar.");
    return buscarCasillasParaRuta(usuario, casa, texto);
  });
}

/**
 * Guarda el enlace de UNA persona en varias casillas a la vez (módulo
 * Rutas): el Representante General (RG) captura los datos de contacto una
 * sola vez y los replica a cada casilla que va encadenando en su ruta
 * (ej. el mismo operador cubre varias casillas contiguas). Disponible
 * para Admin general y RG — siempre que cada casilla pertenezca a una
 * localidad asignada al RG (verificado abajo, nunca solo en la UI).
 *
 * El enlace es ÚNICO por casilla (sin importar la casa): una casilla que
 * ya tiene enlace NO puede recapturarse. Con `rutaId` se edita una ruta
 * existente — sus casillas ya guardadas se corrigen y se pueden agregar
 * más (que deben estar libres); sin `rutaId` se crea una ruta nueva y
 * TODAS las casillas deben estar libres. Para quitar una parada de una
 * ruta ya guardada se usa `quitarCasillaDeRuta`.
 *
 * Se guarda la casa activa al CREAR el enlace (nunca se toca al editarlo,
 * igual que capturadoEn/capturadoPorId) — solo para que la impresión de
 * Casillas sepa de qué lado (Casa 26 / Casa 52) mostrarlo; sigue siendo un
 * único dato por casilla, no dos.
 */
export async function guardarRutaEnlaces(
  formData: unknown,
  casillaIds: string[],
  rutaId?: string
): Promise<ActionResult<{ guardadas: number }>> {
  return ejecutarAccion(async () => {
    const usuario = await requireUserOrThrow();
    requireRole(usuario, [...ROLES_MODULO_RUTAS]);

    const casa = await obtenerCasaActiva();
    if (!casa) throw new AccionError("Elige una casa (26 o 52) antes de capturar.");

    const idsUnicos = Array.from(new Set(casillaIds));
    if (idsUnicos.length === 0) {
      throw new AccionError("Agrega al menos una casilla a la ruta.");
    }

    const datos = enlaceCasillaSchema.parse(formData);

    const casillas = await prisma.casilla.findMany({
      where: { id: { in: idsUnicos } },
      include: { enlace: true },
    });
    if (casillas.length !== idsUnicos.length) {
      throw new AccionError("Alguna de las casillas seleccionadas ya no existe.");
    }
    for (const casilla of casillas) {
      requireLocalidadAccess(usuario, casilla);
    }

    // Al editar una ruta se reutiliza su `rutaId`; al crear una nueva se
    // genera uno.
    let rutaIdFinal: string;
    if (rutaId) {
      const pertenece = casillas.filter((c) => c.enlace?.rutaId === rutaId);
      if (pertenece.length === 0) {
        throw new AccionError("La ruta que intentas editar ya no existe.");
      }
      rutaIdFinal = rutaId;
    } else {
      rutaIdFinal = randomUUID();
    }

    // Ninguna casilla NUEVA (que no fuera ya parte de esta ruta) puede
    // tener un enlace: el enlace/RG es único por casilla y no se recaptura.
    const recaptura = casillas.find(
      (c) => c.enlace !== null && c.enlace.rutaId !== rutaIdFinal
    );
    if (recaptura) {
      throw new AccionError(
        `La casilla de la sección ${recaptura.seccion} ya tiene un enlace capturado; ` +
          "no se puede volver a tomar. Corrígela desde “Editar ruta”."
      );
    }

    // Alta: la clave de elector es obligatoria (si alguna casilla es nueva
    // y no viene clave, se rechaza). Edición: si viene vacía, cada casilla
    // CONSERVA la clave ya guardada — nunca se borra.
    const claveNuevaCifrada = datos.claveElector ? encryptField(datos.claveElector) : null;
    if (!claveNuevaCifrada && casillas.some((c) => !c.enlace)) {
      throw new AccionError("La clave de elector es obligatoria.");
    }

    // El orden dentro de la ruta es el orden en que vienen las casillas
    // (idsUnicos): al editar, primero las que ya estaban (en su orden) y
    // luego las nuevas.
    const ordenPorCasillaId = new Map(idsUnicos.map((id, indice) => [id, indice]));

    await prisma.$transaction(
      casillas.map((casilla) =>
        prisma.enlaceCasilla.upsert({
          where: { casillaId: casilla.id },
          create: {
            casillaId: casilla.id,
            casa,
            nombre: datos.nombre,
            apellidoPaterno: datos.apellidoPaterno,
            apellidoMaterno: datos.apellidoMaterno,
            claveElectorCifrada: claveNuevaCifrada!,
            telefono: datos.telefono,
            correoElectronico: datos.correoElectronico,
            rutaId: rutaIdFinal,
            ordenEnRuta: ordenPorCasillaId.get(casilla.id) ?? 0,
            capturadoPorId: usuario.id,
            updatedById: usuario.id,
          },
          update: {
            nombre: datos.nombre,
            apellidoPaterno: datos.apellidoPaterno,
            apellidoMaterno: datos.apellidoMaterno,
            claveElectorCifrada: claveNuevaCifrada ?? casilla.enlace!.claveElectorCifrada,
            telefono: datos.telefono,
            correoElectronico: datos.correoElectronico,
            rutaId: rutaIdFinal,
            ordenEnRuta: ordenPorCasillaId.get(casilla.id) ?? 0,
            updatedById: usuario.id,
            // capturadoEn/capturadoPorId/casa NUNCA se tocan en el update:
            // fijan el momento y contexto real de la primera captura (para
            // casa, en qué casa se dio de alta), que no debe moverse solo
            // porque se corrigió o reemplazó el enlace desde otra casa.
          },
        })
      )
    );

    for (const casilla of casillas) {
      await registrarAuditoria({
        usuarioId: usuario.id,
        accion: casilla.enlace ? "ACTUALIZAR" : "CREAR",
        entidad: "EnlaceCasilla",
        entidadId: casilla.id,
        datosAntes: casilla.enlace
          ? { ...casilla.enlace, claveElectorCifrada: "[cifrado]" }
          : undefined,
        datosDespues: {
          casillaId: casilla.id,
          rutaId: rutaIdFinal,
          nombre: datos.nombre,
          apellidoPaterno: datos.apellidoPaterno,
          claveElectorCifrada: "[cifrado]",
        },
      });
    }

    revalidatePath("/rutas");
    for (const casilla of casillas) {
      revalidatePath(`/casillas/${casilla.id}`);
    }

    return { guardadas: casillas.length };
  });
}

/**
 * Quita una casilla de su ruta: borra su `EnlaceCasilla`. La casilla
 * vuelve a quedar "pendiente" (sin enlace) y puede volver a agregarse a
 * una ruta. Si era la última parada de la ruta, la ruta deja de existir.
 * Disponible para Admin general y RG, siempre que la casilla esté en su
 * alcance geográfico.
 */
export async function quitarCasillaDeRuta(
  casillaId: string
): Promise<ActionResult<{ rutaId: string; quedanEnRuta: number }>> {
  return ejecutarAccion(async () => {
    const usuario = await requireUserOrThrow();
    requireRole(usuario, [...ROLES_MODULO_RUTAS]);

    const casilla = await prisma.casilla.findUnique({
      where: { id: casillaId },
      include: { enlace: true },
    });
    if (!casilla?.enlace) {
      throw new AccionError("Esta casilla no forma parte de ninguna ruta.");
    }
    requireLocalidadAccess(usuario, casilla);

    const { enlace } = casilla;
    await prisma.enlaceCasilla.delete({ where: { casillaId } });

    await registrarAuditoria({
      usuarioId: usuario.id,
      accion: "ELIMINAR",
      entidad: "EnlaceCasilla",
      entidadId: casillaId,
      datosAntes: { ...enlace, claveElectorCifrada: "[cifrado]" },
    });

    const quedanEnRuta = await prisma.enlaceCasilla.count({
      where: { rutaId: enlace.rutaId },
    });

    revalidatePath("/rutas");
    revalidatePath(`/casillas/${casillaId}`);

    return { rutaId: enlace.rutaId, quedanEnRuta };
  });
}
