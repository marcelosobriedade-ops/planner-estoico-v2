import React from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const EMOTIONS = [
  "Calmo", "Ansioso", "Grato", "Frustrado", "Animado",
  "Cansado", "Focado", "Entediado", "Alegre", "Triste",
];

type Period = "morning" | "afternoon" | "evening";

interface CheckIn {
  emotion: string | null;
  intensity: number | null;
  cause: string;
  observations: string;
}

interface EmotionsState {
  morning: CheckIn;
  afternoon: CheckIn;
  evening: CheckIn;
}

const defaultCheckIn: CheckIn = {
  emotion: null,
  intensity: null,
  cause: "",
  observations: "",
};

const defaultState: EmotionsState = {
  morning: { ...defaultCheckIn },
  afternoon: { ...defaultCheckIn },
  evening: { ...defaultCheckIn },
};

const PERIODS = [
  { id: "morning" as Period, label: "Manha", time: "Ao acordar" },
  { id: "afternoon" as Period, label: "Tarde", time: "Meio do dia" },
  { id: "evening" as Period, label: "Noite", time: "Antes de dormir" },
];

export default function Emotions() {
  const dateKey = getCurrentDateKey();
  const [emotions, setEmotions] = useLocalStorage<EmotionsState>(
    `${dateKey}-emotions`,
    defaultState
  );

  const update = (period: Period, patch: Partial<CheckIn>) => {
    setEmotions({
      ...emotions,
      [period]: { ...defaultCheckIn, ...emotions[period], ...patch },
    });
  };

  const toggleEmotion = (period: Period, emotion: string) => {
    const current = emotions[period]?.emotion ?? null;
    update(period, { emotion: current === emotion ? null : emotion });
  };

  return (
    <Layout>
      <Header title="Emocoes" />
      <div className="flex-1 p-6 overflow-y-auto space-y-10 pb-12">
        <p className="text-center font-serif text-muted-foreground italic">
          "Observar sem julgar. Sentir sem ser consumido."
        </p>

        {PERIODS.map(({ id, label, time }) => {
          const state: CheckIn = { ...defaultCheckIn, ...emotions[id] };
          return (
            <section key={id} className="space-y-5">
              <div className="flex items-end justify-between border-b border-border/50 pb-2">
                <h2 className="text-xl font-serif text-foreground">{label}</h2>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {time}
                </span>
              </div>

              {/* Emotion selection */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  Emocao
                </p>
                <div className="flex flex-wrap gap-2">
                  {EMOTIONS.map((emo) => (
                    <button
                      key={emo}
                      type="button"
                      onClick={() => toggleEmotion(id, emo)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
                        state.emotion === emo
                          ? "bg-primary border-primary text-primary-foreground shadow-sm scale-105"
                          : "bg-card border-border/40 text-muted-foreground hover:bg-muted/70 hover:border-border/70"
                      )}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>

              {/* Intensity 1–5 */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  Intensidade
                </p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        update(id, {
                          intensity: state.intensity === n ? null : n,
                        })
                      }
                      className={cn(
                        "w-10 h-10 rounded-xl border text-sm font-semibold transition-all",
                        state.intensity === n
                          ? "bg-primary border-primary text-primary-foreground shadow-sm scale-110 font-bold"
                          : "bg-card border-border/40 text-muted-foreground hover:bg-muted/70"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                  {state.intensity && (
                    <span className="self-center text-xs text-muted-foreground ml-1">
                      {state.intensity <= 2
                        ? "Leve"
                        : state.intensity === 3
                        ? "Moderada"
                        : "Intensa"}
                    </span>
                  )}
                </div>
              </div>

              {/* Cause */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  Causa
                </p>
                <Input
                  value={state.cause}
                  onChange={(e) => update(id, { cause: e.target.value })}
                  placeholder="O que gerou essa emocao?"
                  className="bg-card/60 border-border/50 rounded-xl focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground/40"
                />
              </div>

              {/* Observations */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  Observacoes
                </p>
                <Textarea
                  value={state.observations}
                  onChange={(e) => update(id, { observations: e.target.value })}
                  placeholder="Reflexoes adicionais sobre esse momento..."
                  className="resize-none bg-card/60 border-border/50 rounded-xl min-h-[72px] focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground/40"
                />
              </div>
            </section>
          );
        })}

        <div className="h-4" />
      </div>
    </Layout>
  );
}
