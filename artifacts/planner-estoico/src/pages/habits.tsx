import React, { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { Compass } from "lucide-react";
import {
  EMPTY_WEEKLY_REVIEW,
  WeeklyPlanData,
  getWeekEnd,
  loadWeeklyPlan,
  saveWeeklyPlan,
} from "@/lib/weekly-plan";

type WeeklyRecord = {
  date: string;
  data: any;
};

function parseLines(raw: string): string[] {
  return (raw || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getEvening(record: WeeklyRecord) {
  return record.data?.evening;
}

function uniqueTexts(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

export default function Habits() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [userId, setUserId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState("");
  const [weeklyChange, setWeeklyChange] = useState("");
  const [plan, setPlan] = useState<WeeklyPlanData | null>(null);
  const [habits, setHabits] = useState<string[]>([]);
  const [records, setRecords] = useState<WeeklyRecord[]>([]);
  const [selectedHabitIndex, setSelectedHabitIndex] = useState(0);
  const [decisionText, setDecisionText] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    async function load() {
      const weekly = await loadWeeklyPlan(dateKey);

      setUserId(weekly.userId);
      setWeekStart(weekly.weekStart);
      setWeeklyChange(weekly.plan.change || "");
      setPlan(weekly.plan);
      setDecisionText(weekly.plan.review?.improvements || "");

      setHabits(parseLines(weekly.plan.supportHabits || ""));

      const { data } = await supabase
        .from("daily_records")
        .select("date, data")
        .eq("user_id", weekly.userId)
        .gte("date", weekly.weekStart)
        .lte("date", getWeekEnd(weekly.weekStart))
        .order("date", { ascending: true });

      setRecords(data || []);
    }

    load();
  }, [dateKey]);

  async function saveDecision() {
    if (!userId || !weekStart || !plan) return;

    setSaveStatus("Salvando...");

    const nextPlan = {
      ...plan,
      review: {
        ...(plan.review || EMPTY_WEEKLY_REVIEW),
        improvements: decisionText,
      },
    };

    await saveWeeklyPlan(userId, weekStart, nextPlan);
    setPlan(nextPlan);
    setSaveStatus("Ajuste registrado. Isso vai orientar a próxima semana.");
  }

  const analysis = useMemo(() => {
    const evaluated = records.filter(
      (record) => getEvening(record)?.assessment,
    );

    const good = records.filter(
      (record) => getEvening(record)?.assessment === "bem",
    ).length;

    const failed = records.filter(
      (record) => getEvening(record)?.assessment === "falhei",
    ).length;

    const emotionDays = records.filter(
      (record) => record.data?.emotions?.evening?.emotion,
    ).length;

    const peopleDays = records.filter(
      (record) =>
        Array.isArray(record.data?.people) && record.data.people.length > 0,
    ).length;

    const financialDays = records.filter(
      (record) =>
        Array.isArray(record.data?.financial) &&
        record.data.financial.length > 0,
    ).length;

    const worked = uniqueTexts(
      records
        .filter((record) => getEvening(record)?.assessment === "bem")
        .map((record) => String(getEvening(record)?.approach || "")),
    );

    const blocked = uniqueTexts(
      records
        .filter((record) => getEvening(record)?.assessment === "falhei")
        .map((record) => String(getEvening(record)?.away || "")),
    );

    let interpretation = "";

    if (evaluated.length <= 1) {
      interpretation =
        "Você avaliou poucos dias. O padrão da semana ainda não está claro.";
    } else if (good > failed) {
      interpretation =
        "Você teve mais dias bons que falhas. Há um sinal de consistência.";
    } else if (failed > good) {
      interpretation =
        "As falhas estão dominando a semana. Há um padrão de quebra.";
    } else {
      interpretation =
        "Os resultados estão equilibrados. O padrão ainda é instável.";
    }

    if (emotionDays === 0) {
      interpretation +=
        " Você não registrou emoções — falta contexto emocional.";
    }

    if (peopleDays > 0 || financialDays > 0) {
      interpretation +=
        " Pessoas ou finanças podem estar influenciando esse padrão.";
    }

    let decisionGuidance = "";

    if (evaluated.length <= 1) {
      decisionGuidance =
        "Antes de mudar muita coisa, registre melhor a Noite por mais dias. O ajuste pode ser: observar mais, simplificar a forma de agir ou escolher uma ação mínima.";
    } else if (failed > good) {
      decisionGuidance =
        "Como as falhas pesaram mais, escolha uma proteção concreta para a próxima semana. O ajuste deve reduzir risco, atrito ou excesso.";
    } else if (good > failed) {
      decisionGuidance =
        "Como houve mais consistência do que falha, escolha o que deve ser mantido. O ajuste deve preservar o que funcionou e evitar complicar a semana.";
    } else {
      decisionGuidance =
        "Como a semana ficou instável, escolha um ajuste pequeno e claro. O objetivo não é reinventar a semana, é remover o principal ponto de atrito.";
    }

    return {
      evaluated: evaluated.length,
      good,
      failed,
      emotionDays,
      peopleDays,
      financialDays,
      worked,
      blocked,
      interpretation,
      decisionGuidance,
    };
  }, [records]);

  const selectedHabit = habits[selectedHabitIndex];

  return (
    <Layout>
      <Header title="Hábitos" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-md space-y-6">
          <section className="rounded-2xl border bg-card p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Compass className="h-4 w-4" />
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Direção da semana
                </p>

                <p className="mt-2 font-serif text-lg">
                  {weeklyChange || "Nenhuma direção definida ainda."}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-4 space-y-3">
            {habits.length > 0 ? (
              habits.map((habit, index) => (
                <button
                  key={`${habit}-${index}`}
                  type="button"
                  onClick={() => setSelectedHabitIndex(index)}
                  className={
                    selectedHabitIndex === index
                      ? "w-full rounded-xl border border-primary bg-primary/10 p-3 text-left"
                      : "w-full rounded-xl border p-3 text-left"
                  }
                >
                  {habit}
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma forma de agir definida nesta semana.
              </p>
            )}
          </section>

          {selectedHabit && (
            <section className="rounded-2xl border bg-card p-4 space-y-3">
              <p className="font-serif text-lg">{selectedHabit}</p>

              <div className="text-sm text-muted-foreground space-y-1">
                <p>Avaliado em {analysis.evaluated} dias</p>
                <p>
                  Bem: {analysis.good} | Falhas: {analysis.failed}
                </p>
                <p>Emoções: {analysis.emotionDays}</p>
                <p>Pessoas: {analysis.peopleDays}</p>
                <p>Finanças: {analysis.financialDays}</p>
              </div>

              <div className="rounded-xl border border-border/40 bg-background p-3">
                <p className="text-[10px] uppercase tracking-widest text-primary/70">
                  Leitura da semana
                </p>

                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {analysis.interpretation}
                </p>
              </div>

              <div className="rounded-xl border border-border/40 bg-background p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-primary/70">
                  Funcionou
                </p>

                {analysis.worked.length > 0 ? (
                  <div className="space-y-1">
                    {analysis.worked.slice(0, 3).map((item, index) => (
                      <p
                        key={`${item}-${index}`}
                        className="text-sm leading-relaxed"
                      >
                        • {item}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Ainda não há padrão claro do que funcionou.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border/40 bg-background p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-primary/70">
                  Travou
                </p>

                {analysis.blocked.length > 0 ? (
                  <div className="space-y-1">
                    {analysis.blocked.slice(0, 3).map((item, index) => (
                      <p
                        key={`${item}-${index}`}
                        className="text-sm leading-relaxed"
                      >
                        • {item}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Ainda não há padrão claro do que travou.
                  </p>
                )}
              </div>
            </section>
          )}

          <section className="rounded-2xl border bg-card p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Ajuste para próxima semana
            </p>

            <div className="rounded-xl border border-border/40 bg-background p-3">
              <p className="text-[10px] uppercase tracking-widest text-primary/70">
                Orientação
              </p>

              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {analysis.decisionGuidance}
              </p>
            </div>

            <Textarea
              value={decisionText}
              onChange={(event) => setDecisionText(event.target.value)}
              onBlur={saveDecision}
              placeholder="Ex: manter o que funcionou, proteger contra o que travou ou simplificar a forma de agir."
              className="min-h-[100px] resize-none rounded-xl border-border/40 bg-background"
            />

            <p className="text-xs text-muted-foreground">
              {saveStatus || "Salva automaticamente."}
            </p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
