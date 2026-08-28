import { redirect } from "next/navigation";
import { obtenerUsuarioValidoOrNull } from "@/lib/auth-helpers";

export default async function Home() {
  // Validado contra la BD (no `auth()` a secas) — ver el comentario en
  // obtenerUsuarioValidoOrNull para por qué importa.
  const usuario = await obtenerUsuarioValidoOrNull();
  redirect(usuario ? "/dashboard" : "/login");
}
