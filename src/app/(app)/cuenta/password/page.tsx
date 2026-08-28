import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CambiarPasswordForm } from "@/components/cuenta/cambiar-password-form";

export default function CambiarPasswordPage() {
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Cambiar contraseña</CardTitle>
        <CardDescription>
          Al cambiar tu contraseña se cerrarán tus demás sesiones activas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CambiarPasswordForm />
      </CardContent>
    </Card>
  );
}
