import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useAppearance } from "@/hooks/use-appearance";
import { cn } from "@/lib/utils";
import { Sun, Flame } from "lucide-react";

export default function Settings() {
  const { appearance, setAppearance } = useAppearance();

  return (
    <Layout>
      <Header title="Ajustes" />

      <div className="flex-1 p-6 space-y-10 overflow-y-auto">
        <section>
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-5">
            Aparência
          </h2>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setAppearance("day")}
              className={cn(
                "flex-1 flex flex-col items-center gap-3 py-6 px-4 rounded-2xl border-2 transition-all",
                appearance === "day"
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border/40 text-muted-foreground hover:bg-muted/40",
              )}
            >
              <Sun
                className={cn(
                  "w-7 h-7",
                  appearance === "day" ? "stroke-[2]" : "stroke-[1.5]",
                )}
              />
              <span className="text-sm font-medium font-serif">Luz do Dia</span>
            </button>

            <button
              type="button"
              onClick={() => setAppearance("candle")}
              className={cn(
                "flex-1 flex flex-col items-center gap-3 py-6 px-4 rounded-2xl border-2 transition-all",
                appearance === "candle"
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border/40 text-muted-foreground hover:bg-muted/40",
              )}
            >
              <Flame
                className={cn(
                  "w-7 h-7",
                  appearance === "candle" ? "stroke-[2]" : "stroke-[1.5]",
                )}
              />
              <span className="text-sm font-medium font-serif">
                Luz de Velas
              </span>
            </button>
          </div>

          <p className="text-xs text-muted-foreground/60 mt-3 text-center font-serif italic">
            {appearance === "day"
              ? "Clareza e leveza para o dia."
              : "Calor e foco para a noite."}
          </p>
        </section>
      </div>
    </Layout>
  );
}
