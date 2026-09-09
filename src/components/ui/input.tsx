import * as React from "react";
import { cn, normalizarTelefonoMx } from "@/lib/utils";

type InputProps = React.ComponentProps<"input"> & {
  /** Convierte lo tecleado a MAYÚSCULAS (visual y en el valor enviado). */
  uppercase?: boolean;
  /**
   * Fuerza formato de teléfono de México: solo dígitos, máximo 10, quita
   * el código de país si viene pegado (+52 / 521). Fija
   * `inputMode="numeric"`; el recorte a 10 lo hace `normalizarTelefonoMx`
   * en cada cambio (no un `maxLength` sobre el texto crudo, que cortaría
   * el "+52 " antes de poder quitarlo al pegar).
   */
  telefonoMx?: boolean;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type, uppercase, telefonoMx, onChange, inputMode, maxLength, ...props },
    ref
  ) => {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      if (uppercase) {
        const upper = e.target.value.toUpperCase();
        // Para inputs no controlados esto persiste; para controlados el
        // padre recibe ya el valor transformado.
        if (upper !== e.target.value) e.target.value = upper;
      }
      if (telefonoMx) {
        const norm = normalizarTelefonoMx(e.target.value);
        if (norm !== e.target.value) e.target.value = norm;
      }
      onChange?.(e);
    }

    return (
      <input
        type={type}
        ref={ref}
        onChange={uppercase || telefonoMx ? handleChange : onChange}
        inputMode={telefonoMx ? "numeric" : inputMode}
        maxLength={maxLength}
        className={cn(
          "flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm",
          uppercase && "uppercase placeholder:normal-case",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
