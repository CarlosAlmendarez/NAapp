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
