"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          background: "#f7f7f7",
          color: "#111",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Algo salió mal</h1>
          <p style={{ fontSize: 14, color: "#555", marginBottom: 16 }}>
            Ocurrió un error inesperado. Vuelve a intentarlo.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              border: 0,
              borderRadius: 6,
              padding: "8px 16px",
              fontSize: 14,
              background: "#0f766e",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
          {error.digest && (
            <p style={{ fontSize: 11, color: "#888", marginTop: 12 }}>
              Referencia: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
