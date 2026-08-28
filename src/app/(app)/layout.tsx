import { requireUser } from "@/lib/auth-helpers";
import { Header } from "@/components/layout/header";
import { Nav } from "@/components/layout/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Punto de entrada de toda el área protegida: si la sesión no es válida
  // (sin sesión, cuenta desactivada, o sesión revocada), redirige a /login.
  const usuario = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <Header usuario={usuario} />
      <Nav rol={usuario.rol} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
