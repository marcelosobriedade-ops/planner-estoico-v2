import React from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

const EMOTIONS = [
  "Calmo", "Ansioso", "Grato", "Frustrado", "Animado", 
  "Cansado", "Focado", "Entediado", "Alegre", "Triste"
];

type Period = "morning" | "afternoon" | "evening";

interface CheckIn {
  emotion: string | null;
  note: string;
}

interface EmotionsState {
  morning: CheckIn;
  afternoon: CheckIn;
  evening: CheckIn;
}

const defaultState: EmotionsState = {
  morning: { emotion: null, note: "" },
  afternoon: { emotion: null, note: "" },
  evening: { emotion: null, note: "" }
};

const PERIODS = [
  { id: "morning", label: "Manhã", time: "Ao acordar" },
  { id: "afternoon", label: "Tarde", time: "Meio do dia" },
  { id: "evening", label: "Noite", time: "Antes de dormir" }
] as const;

export default function Emotions() {
  const dateKey = getCurrentDateKey();
  const [emotions, setEmotions] = useLocalStorage<EmotionsState>(`${dateKey}-emotions`, defaultState);

  const updateEmotion = (period: Period, emotion: string) => {
    setEmotions({
      ...emotions,
      [period]: { ...emotions[period], emotion: emotions[period].emotion === emotion ? null : emotion }
    });
  };

  const updateNote = (period: Period, note: string) => {
    setEmotions({
      ...emotions,
      [period]: { ...emotions[period], note }
    });
  };

  return (
    <Layout>
      <Header title="Emoções" />
      <div className="flex-1 p-6 overflow-y-auto space-y-10">
        <p className="text-center font-serif text-muted-foreground italic mb-2">
          "Observar sem julgar. Sentir sem ser consumido."
        </p>

        {PERIODS.map(({ id, label, time }) => {
          const state = emotions[id];
          return (
            <section key={id} className="space-y-4">
              <div className="flex items-end justify-between border-b border-border/50 pb-2">
                <h2 className="text-xl font-serif text-foreground">{label}</h2>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">{time}</span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {EMOTIONS.map((emo) => (
                  <button
                    key={emo}
                    onClick={() => updateEmotion(id, emo)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
                      state.emotion === emo 
                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                        : "bg-card border-border/40 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {emo}
                  </button>
                ))}
              </div>

              <Textarea
                value={state.note}
                onChange={(e) => updateNote(id, e.target.value)}
                placeholder={`O que está por trás dessa emoção? (Opcional)`}
                className="resize-none bg-card/50 border-border/50 rounded-xl min-h-[80px] focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground/40"
              />
            </section>
          );
        })}
        <div className="h-4" />
      </div>
    </Layout>
  );
}
