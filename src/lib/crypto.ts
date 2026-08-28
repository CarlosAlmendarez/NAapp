import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Cifrado simétrico (AES-256-GCM) para datos personales sensibles en
 * reposo — en este proyecto, la clave de elector de RC y asistentes
 * electorales (requisito de seguridad #13).
 *
 * Formato almacenado: base64(iv) + ":" + base64(authTag) + ":" + base64(ciphertext)
 */

function getKey(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY no está configurada. Genera una con: " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("FIELD_ENCRYPTION_KEY debe decodificar a exactamente 32 bytes (AES-256).");
  }
  return key;
}

export function encryptField(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":"
  );
}

export function decryptField(stored: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Formato de campo cifrado inválido.");
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString("utf8");
}

/** Máscara para mostrar en listados sin exponer la clave de elector completa. */
export function maskClaveElector(claveElector: string): string {
  if (claveElector.length <= 4) return "****";
  return `${"*".repeat(claveElector.length - 4)}${claveElector.slice(-4)}`;
}
