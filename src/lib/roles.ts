import type { Rol } from "@prisma/client";

export const ROL_LABELS: Record<Rol, string> = {
  ADMIN_GENERAL: "Administrador general",
  ADMIN_CASILLAS: "Administrador de casillas",
  CAPTURADOR: "Capturador",
  REPRESENTANTE_GENERAL: "Representante General (RG)",
};

export const ROL_OPTIONS: { value: Rol; label: string }[] = (
  Object.keys(ROL_LABELS) as Rol[]
).map((value) => ({ value, label: ROL_LABELS[value] }));
