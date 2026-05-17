import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { loadWeeklyPlan } from "@/lib/weekly-plan";

type NightData = {
  approach: string;
  away: string;
  wins: string;
  ending: string;
  assessment?: string;
  tomorrowIntent?: string;
};

type DailyData = {
  evening?: NightData;
  emotions?: any;
  [key: string]: unknown;
};

const EMPTY_NIGHT: NightData = {
  approach: "",
  away: "",
  wins: "",
  ending: "",
  assessment: "",
  tomorrowIntent: "",
};

const ASSESSMENT_OPTIONS = [
  { value: "bem", label: "Agi bem" },
  { value: "parcial", label: "Parcialmente" },
  { value: "falhei", label: "Falhei claramente" },
];

export default function Evening() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [data, setData] = useState<NightData>(EMPTY_NIGHT);
  const [dailyData, setDailyData] = useState<DailyData>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [weeklyChange, setWeeklyChange] = useState("");
  const [assessment, setAssessment] = useState("");
  const [tomorrowIntent, setTomorrowIntent] = useState("");

  useEffect(() => {
    async function load() {
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
      setData({
        approach: loaded.evening?.approach || "",
        away: loaded.evening?.away || "",
        wins: loaded.evening?.wins || "",
        ending: loaded.evening?.ending || "",
        assessment: loaded.evening?.assessment || "",
        tomorrowIntent: loaded.evening?.tomorrowIntent || "",
      });

      setAssessment(loaded.evening?.assessment || "");
      setTomorrowIntent(loaded.evening?.tomorrowIntent || "");

      const weekly = await loadWeeklyPlan(dateKey);
      setWeeklyChange(weekly.plan.change || "");
    }

    load();
  }, [dateKey]);

  function setField(key: keyof NightData, value: string) {
    setData((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function save(updated: NightData) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    const currentUserId = session.user.id;
    setUserId(currentUserId);

    const { data: latestRecord, error: loadError } = await supabase
      .from("daily_records")
      .select("data")
      .eq("user_id", currentUserId)
      .eq("date", dateKey)
      .maybeSingle();

    if (loadError) {
      console.error("Erro ao carregar registro da noite:", loadError);
      return;
    }

    const latestData = (latestRecord?.data || {}) as DailyData;

    const nextEvening: NightData = {
      ...(latestData.evening || EMPTY_NIGHT),
      approach: updated.approach || "",
      away: updated.away || "",
      wins: updated.wins || "",
      ending: updated.ending || "",
      assessment: updated.assessment ?? assessment,
      tomorrowIntent: updated.tomorrowIntent ?? tomorrowIntent,
    };

    const next: DailyData = {
      ...latestData,
      evening: nextEvening,
    };

    setDailyData(next);
    setData(nextEvening);
    setAssessment(nextEvening.assessment || "");
    setTomorrowIntent(nextEvening.tomorrowIntent || "");

    const { error } = await supabase.from("daily_records").upsert(
      {
        user_id: currentUserId,
        date: dateKey,
        data: next,
      },
      { onConflict: "user_id,date" },
    );

    if (error) {
      console.error("Erro ao salvar noite:", error);
    }
  }

  function handleAssessmentClick(value: string) {
    const nextAssessment = assessment === value ? "" : value;

    setAssessment(nextAssessment);

    save({
      ...data,
      assessment: nextAssessment,
      tomorrowIntent,
    });
  }

  const afternoonEmotion = dailyData.emotions?.afternoon?.emotion;
  const afternoonNote = dailyData.emotions?.afternoon?.note;

  const isAfternoonLow =
    afternoonEmotion === "muito mal" || afternoonEmotion === "mal";

  return (
    <Layout>
      <Header title="" />

      <div className="flex-1 overflow-y-auto bg-background px-5 py-6 pb-12">
        <div className="mx-auto max-w-md space-y-7">
          <div className="text-center space-y-2">
            <h1 className="font-serif text-3xl">Noite</h1>

            <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
              Olhe para o dia como ele foi — não como você gostaria que tivesse
              sido.
            </p>
          </div>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-primary/70">
              Fechamento do dia
            </p>

            {(afternoonEmotion || afternoonNote) && (
              <div className="rounded-xl border border-border/40 bg-background px-3 py-2 text-sm text-muted-foreground">
                {afternoonEmotion && (
                  <p>
                    Estado da tarde:{" "}
                    <span className="font-medium text-foreground">
                      {afternoonEmotion}
                    </span>
                  </p>
                )}

                {afternoonNote && (
                  <p className="mt-1 text-xs leading-relaxed">
                    {afternoonNote}
                  </p>
                )}
              </div>
            )}

            {weeklyChange && (
              <div className="rounded-xl border border-border/40 bg-background px-3 py-3 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-primary/70">
                  Direção da semana
                </p>

                <p className="text-sm font-medium text-foreground">
                  {weeklyChange}
                </p>

                <p className="text-xs text-muted-foreground">
                  Hoje você se aproximou ou se afastou dessa direção?
                </p>

                {afternoonEmotion && (
                  <p className="text-xs text-muted-foreground">
                    {isAfternoonLow
                      ? "Você já vinha mal à tarde — onde isso começou a sair do controle?"
                      : "O que você fez hoje que ajudou a manter esse estado?"}
                  </p>
                )}
              </div>
            )}
          </section>

          <NightField
            label="1. O que hoje realmente me puxou para frente?"
            value={data.approach}
            onChange={(v) => setField("approach", v)}
            onBlur={() =>
              save({
                ...data,
                assessment,
                tomorrowIntent,
              })
            }
            placeholder="Uma ação, decisão ou momento que ajudou você a avançar..."
          />

          <NightField
            label="2. Onde eu me perdi, cedi ou saí do eixo?"
            value={data.away}
            onChange={(v) => setField("away", v)}
            onBlur={() =>
              save({
                ...data,
                assessment,
                tomorrowIntent,
              })
            }
            placeholder="Algo que drenou sua energia ou desviou seu caminho..."
          />

          <NightField
            label="3. Qual foi uma pequena vitória real hoje?"
            value={data.wins}
            onChange={(v) => setField("wins", v)}
            onBlur={() =>
              save({
                ...data,
                assessment,
                tomorrowIntent,
              })
            }
            placeholder="Algo concreto, mesmo que pequeno, que aconteceu..."
          />

          <NightField
            label="4. Como estou terminando este dia?"
            value={data.ending}
            onChange={(v) => setField("ending", v)}
            onBlur={() =>
              save({
                ...data,
                assessment,
                tomorrowIntent,
              })
            }
            placeholder="Agora, ao fechar o dia, eu me sinto..."
          />

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-primary/70">
              Avaliação leve
            </p>

            <p className="text-sm text-muted-foreground">
              Em relação à direção da semana, como você avalia sua conduta hoje?
            </p>

            <div className="grid grid-cols-3 gap-2">
              {ASSESSMENT_OPTIONS.map((option) => {
                const selected = assessment === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleAssessmentClick(option.value)}
                    className={
                      selected
                        ? "rounded-xl border border-primary bg-primary/10 px-2 py-3 text-xs text-primary"
                        : "rounded-xl border border-border/40 bg-background px-2 py-3 text-xs text-muted-foreground"
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-muted-foreground">
              Esta avaliação será usada depois no fechamento da semana.
            </p>
          </section>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-primary/70">
              Ponte para amanhã
            </p>

            <p className="text-sm text-muted-foreground">
              Uma coisa que quero fazer diferente amanhã:
            </p>

            <Textarea
              value={tomorrowIntent}
              onChange={(e) => setTomorrowIntent(e.target.value)}
              onBlur={() =>
                save({
                  ...data,
                  assessment,
                  tomorrowIntent,
                })
              }
              placeholder="Amanhã eu vou..."
              className="min-h-[80px] resize-none rounded-xl border-border/40 bg-background"
            />

            <p className="text-[11px] text-muted-foreground">
              Essa intenção será usada depois para preparar a próxima manhã.
            </p>
          </section>
        </div>
      </div>
    </Layout>
  );
}

function NightField({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  placeholder: string;
}) {
  return (
    <section className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-widest text-primary/70">
        {label}
      </p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="min-h-[100px] resize-none rounded-xl border-border/40 bg-card"
      />
    </section>
  );
}
