import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normaliza un correo para almacenamiento/comparación consistente. */
export function normalizeEmail(correo: string): string {
  return correo.trim().toLowerCase();
}

/** Deja solo dígitos — usado para normalizar teléfonos antes de guardar. */
export function digitsOnly(value: string): string {
  return value.replace(/\D+/g, "");
}

/**
 * Normaliza un teléfono a 10 dígitos de México: quita todo lo que no sea
 * dígito, descarta el código de país si viene pegado (+52, 52, o 521 para
 * celular / 1 de larga distancia) y recorta a 10 dígitos como máximo.
 */
export function normalizarTelefonoMx(value: string): string {
  let d = value.replace(/\D+/g, "");
  if (d.length > 10) {
    if (d.startsWith("521")) d = d.slice(3);
    else if (d.startsWith("52")) d = d.slice(2);
    else if (d.startsWith("1")) d = d.slice(1);
  }
  return d.slice(0, 10);
}

export function formatFecha(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function nombreCompleto(p: {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
}): string {
  return [p.nombre, p.apellidoPaterno, p.apellidoMaterno].filter(Boolean).join(" ");
}
