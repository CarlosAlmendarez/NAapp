import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { checkLoginRateLimit, getClientIp } from "@/lib/rate-limit";
import { registrarAuditoria } from "@/lib/audit";

/**
 * Error genérico: nunca revelamos si el correo existe, si la cuenta está
 * desactivada o si la contraseña es incorrecta — todo se reporta igual
 * para no facilitar enumeración de cuentas.
 */
class CredencialesInvalidas extends CredentialsSignin {
  code = "credenciales_invalidas";
}

class DemasiadosIntentos extends CredentialsSignin {
  code = "demasiados_intentos";
}

// Hash "señuelo" válido, calculado una vez por instancia. Se usa para que
// el tiempo de respuesta al comparar contraseñas sea similar exista o no
// el correo, mitigando ataques de enumeración por temporización.
const DUMMY_HASH = bcrypt.hashSync("correo-inexistente-timing-safe", 12);

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        correo: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(rawCredentials, request) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          throw new CredencialesInvalidas();
        }
        const { correo, password } = parsed.data;

        const ip = getClientIp(request);
        const rateLimitKey = `${ip}:${correo}`;
        const { success } = await checkLoginRateLimit(rateLimitKey);
        if (!success) {
          await registrarAuditoria({
            usuarioId: null,
            accion: "LOGIN_BLOQUEADO_RATE_LIMIT",
            entidad: "Usuario",
            entidadId: null,
            datosDespues: { correo, ip },
          });
          throw new DemasiadosIntentos();
        }

        const usuario = await prisma.usuario.findUnique({ where: { correo } });

        const passwordValida = await bcrypt.compare(
          password,
          usuario?.passwordHash ?? DUMMY_HASH
        );

        if (!usuario || !usuario.activo || !passwordValida) {
          await registrarAuditoria({
            usuarioId: usuario?.id ?? null,
            accion: "LOGIN_FALLIDO",
            entidad: "Usuario",
            entidadId: usuario?.id ?? null,
            datosDespues: { correo, ip },
          });
          throw new CredencialesInvalidas();
        }

        await registrarAuditoria({
          usuarioId: usuario.id,
          accion: "LOGIN_EXITOSO",
          entidad: "Usuario",
          entidadId: usuario.id,
          datosDespues: { ip },
        });

        return {
          id: usuario.id,
          name: usuario.nombre,
          email: usuario.correo,
          rol: usuario.rol,
          sessionVersion: usuario.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // Solo se ejecuta con `user` presente en el momento del sign-in.
      if (user) {
        token.id = user.id;
        token.rol = user.rol;
        token.sessionVersion = user.sessionVersion;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.rol = token.rol;
      session.user.sessionVersion = token.sessionVersion;
      return session;
    },
  },
});
