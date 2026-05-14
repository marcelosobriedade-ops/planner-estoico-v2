import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

const EMOTIONS = [
  "Calmo",
  "Ansioso",
  "Grato",
  "Frustrado",
  "Animado",
  "Cansado",
  "Focado",
  "Entediado",
  "Alegre",
  "Triste",
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

type DailyData = {
  emotions?: EmotionsState;
  [key: string]: any;
};

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
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [emotions, setEmotions] = useState<EmotionsState>(defaultState);
  const [dailyData, setDailyData] = useState<DailyData>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    async function load() {
      setSaveError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      setUserId(session.user.id);

      const { data } = await supabase
        .from("daily_records")
        .select("data")
        .eq("user_id", session.user.id)
        .eq("date", dateKey)
        .maybeSingle();

      const loaded = (data?.data || {}) as DailyData;

      setDailyData(loaded);
      setEmotions(loaded.emotions || defaultState);
    }

    load();
  }, [dateKey]);

  async function save(updated: EmotionsState) {
    if (!userId) return;

    const nextData: DailyData = {
      ...dailyData,
      emotions: updated,
    };

    setEmotions(updated);
    setDailyData(nextData);

    const { error } = await supabase.from("daily_records").upsert(
      {
        user_id: userId,
        date: dateKey,
        data: nextData,
      },
      { onConflict: "user_id,date" },
    );

    if (error) {
      setSaveError("Erro ao salvar emoções");
      console.error(error);
    }
  }

  const update = (period: Period, patch: Partial<CheckIn>) => {
    const updated = {
      ...emotions,
      [period]: { ...defaultCheckIn, ...emotions[period], ...patch },
    };

    save(updated);
  };

  const toggleEmotion = (period: Period, emotion: string) => {
    const current = emotions[period]?.emotion ?? null;

    update(period, {
      emotion: current === emotion ? null : emotion,
    });
  };

  return (
    <Layout>
      <Header title="Emocoes" />

      <div className="flex-1 p-6 overflow-y-auto space-y-10 pb-12">
        <p className="text-center font-serif text-muted-foreground italic">
          "Observar sem julgar. Sentir sem ser consumido."
        </p>

        {saveError && <div className="text-red-500 text-sm">{saveError}</div>}

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

              {/* Emotion */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  Emocao
                </p>

                <div className="flex flex-wrap gap-2">
                  {EMOTIONS.map((emo) => (
                    <button
                      key={emo}
                      onClick={() => toggleEmotion(id, emo)}
                      className={cn(
                        "px-3 py-1.5 rounded-full border text-sm",
                        state.emotion === emo
                          ? "bg-primary text-white"
                          : "bg-card border-border",
                      )}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>

              {/* Intensity */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  Intensidade
                </p>

                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() =>
                        update(id, {
                          intensity: state.intensity === n ? null : n,
                        })
                      }
                      className={cn(
                        "w-10 h-10 border rounded",
                        state.intensity === n && "bg-primary text-white",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cause */}
              <Input
                value={state.cause}
                onChange={(e) => update(id, { cause: e.target.value })}
                placeholder="Causa"
              />

              {/* Observations */}
              <Textarea
                value={state.observations}
                onChange={(e) => update(id, { observations: e.target.value })}
                placeholder="Observacoes"
              />
            </section>
          );
        })}
      </div>
    </Layout>
  );
}
