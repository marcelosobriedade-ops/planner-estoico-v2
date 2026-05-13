import { useState } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useAppearance } from "@/hooks/use-appearance";
import { cn } from "@/lib/utils";
import { Sun, Flame, AlertTriangle } from "lucide-react";

export default function Settings() {
  const { appearance, setAppearance } = useAppearance();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, navigate] = useLocation();

  const deleteAllData = () => {
    const keysToDelete = Object.keys(localStorage).filter(
      (k) =>
        /^\d{4}-\d{2}-\d{2}-/.test(k) ||
        k === "global-habits" ||
        k === "planner-appearance"
    );
    keysToDelete.forEach((k) => localStorage.removeItem(k));
    setConfirmDelete(false);
    navigate("/");
  };

  return (
    <Layout>
      <Header title="Ajustes" />
      <div className="flex-1 p-6 space-y-10 overflow-y-auto">

        <section>
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-5">
            Aparencia
          </h2>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setAppearance("day")}
              className={cn(
                "flex-1 flex flex-col items-center gap-3 py-6 px-4 rounded-2xl border-2 transition-all",
                appearance === "day"
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border/40 text-muted-foreground hover:bg-muted/40"
              )}
            >
              <Sun className={cn("w-7 h-7", appearance === "day" ? "stroke-[2]" : "stroke-[1.5]")} />
              <span className="text-sm font-medium font-serif">Luz do Dia</span>
            </button>
            <button
              type="button"
              onClick={() => setAppearance("candle")}
              className={cn(
                "flex-1 flex flex-col items-center gap-3 py-6 px-4 rounded-2xl border-2 transition-all",
                appearance === "candle"
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border/40 text-muted-foreground hover:bg-muted/40"
              )}
            >
              <Flame className={cn("w-7 h-7", appearance === "candle" ? "stroke-[2]" : "stroke-[1.5]")} />
              <span className="text-sm font-medium font-serif">Luz de Velas</span>
            </button>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-3 text-center font-serif italic">
            {appearance === "day" ? "Clareza e leveza para o dia." : "Calor e foco para a noite."}
          </p>
        </section>

        <section>
          <h2 className="text-xs font-medium uppercase tracking-widest text-destructive/60 mb-5">
            Zona de Risco
          </h2>
          <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-5 space-y-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive/60 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                Esta acao remove permanentemente todos os registros do Planner Estoico
                deste dispositivo. Nao pode ser desfeita.
              </p>
            </div>

            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full py-3 rounded-xl border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
              >
                Apagar todos os dados
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-center text-destructive">
                  Tem certeza? Esta acao e irreversivel.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border/40 text-muted-foreground text-sm font-medium hover:bg-muted/50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={deleteAllData}
                    className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Confirmar e apagar
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

      </div>
    </Layout>
  );
}
