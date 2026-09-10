"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

/**
 * Antes de imprimir el PDF de casillas pide el alcance: SIEMPRE un
 * municipio (son demasiadas casillas para imprimirlas todas). Los
 * administradores (que reciben `distritos`) pueden en su lugar elegir un
 * distrito local.
 */
export function ImprimirCasillasDialog({
  municipios,
  distritos,
}: {
  municipios: string[];
  distritos?: string[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [municipio, setMunicipio] = useState("");
  const [distrito, setDistrito] = useState("");
  const [error, setError] = useState<string | null>(null);

  const puedePorDistrito = Boolean(distritos && distritos.length > 0);

  function imprimir() {
    setError(null);
    if (!municipio && !distrito) {
      setError("Elige un municipio o un distrito local.");
      return;
    }
    const sp = new URLSearchParams();
    if (municipio) sp.set("municipio", municipio);
    if (distrito) sp.set("distrito", distrito);
    window.open(`/imprimir/casillas?${sp.toString()}`, "_blank", "noopener");
    setAbierto(false);
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Printer className="h-4 w-4" />
          Imprimir PDF
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Imprimir casillas (PDF)</DialogTitle>
          <DialogDescription>
            Se divide por municipio para un mejor manejo. Elige de qué municipio
            {puedePorDistrito ? " (o distrito local)" : ""} quieres imprimir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Municipio</Label>
            <Select
              value={municipio}
              onValueChange={(v) => {
                setMunicipio(v);
                setDistrito("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un municipio" />
              </SelectTrigger>
              <SelectContent>
                {municipios.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {puedePorDistrito && (
            <div className="space-y-1.5">
              <Label>o Distrito local</Label>
              <Select
                value={distrito}
                onValueChange={(v) => {
                  setDistrito(v);
                  setMunicipio("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un distrito local" />
                </SelectTrigger>
                <SelectContent>
                  {distritos!.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button onClick={imprimir}>
            <Printer className="h-4 w-4" />
            Abrir impresión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
