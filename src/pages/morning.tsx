import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MorningRitual, EMPTY_MORNING_RITUAL } from "@/lib/ritual";
import { supabase } from "@/lib/supabase";
import { ChevronDown, ChevronUp, Check, CalendarDays } from "lucide-react";
import {
  EMPTY_WEEKLY_PLAN,
  WeeklyPlanData,
  loadWeeklyPlan,
} from "@/lib/weekly-plan";

type DailyData = {
  morning?: MorningRitual;
  [key: string]: unknown;
};

const DAY_MODES: { value: MorningRitual["mode"]; label: string }[] = [
  { value: "productive", label: "Produtivo" },
  { value: "normal", label: "Normal" },
  { value: "survival", label: "Sobrevivência" },
];

const FEELINGS = [
  { value: "muito mal", emoji: "😵", label: "Muito mal" },
  { value: "mal", emoji: "🙁", label: "Mal" },
  { value: "ok", emoji: "😐", label: "Ok" },
  { value: "bem", emoji: "🙂", label: "Bem" },
  { value: "muito bem", emoji: "😄", label: "Muito bem" },
];

function parseProofs(raw: string) {
  if (!raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  return [];
}

export default function Morning() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [ritual, setRitual] = useState<MorningRitual>(EMPTY_MORNING_RITUAL);
  const [dailyData, setDailyData] = useState<DailyData>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [weeklyPlan, setWeeklyPlan] =
    useState<WeeklyPlanData>(EMPTY_WEEKLY_PLAN);

  const [showFeelingNote, setShowFeelingNote] = useState(false);
  const [showPriorities, setShowPriorities] = useState(false);
  const [showProofs, setShowProofs] = useState(true);

  useEffect(() => {
    async function loadMorning() {
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

      const loadedData = (data?.data || {}) as DailyData;

      setDailyData(loadedData);
      setRitual({
        ...EMPTY_MORNING_RITUAL,
        ...(loadedData.morning || {}),
      });

      const weekly = await loadWeeklyPlan(dateKey);
      setWeeklyPlan(weekly.plan);
    }

    loadMorning();
  }, [dateKey]);

  async function saveMorning(updatedRitual: MorningRitual) {
    if (!userId) return;

    const nextData: DailyData = {
      ...dailyData,
      morning: updatedRitual,
    };

    setRitual(updatedRitual);
    setDailyData(nextData);

    await supabase.from("daily_records").upsert(
      {
        user_id: userId,
        date: dateKey,
        data: nextData,
      },
      { onConflict: "user_id,date" },
    );
  }

  function setField<K extends keyof MorningRitual>(
    key: K,
    value: MorningRitual[K],
  ) {
    saveMorning({ ...ritual, [key]: value });
  }

  function setPriority(index: number, value: string) {
    const next = [...ritual.priorities] as [string, string, string];
    next[index] = value;
    saveMorning({ ...ritual, priorities: next });
  }

  const prioritiesDone = ritual.priorities.filter((p) => p.trim()).length;
  const proofs = parseProofs(weeklyPlan.proofs);
  const hasWeeklyPlan =
    weeklyPlan.change.trim() ||
    weeklyPlan.risks.trim() ||
    weeklyPlan.prevention.trim() ||
    proofs.length > 0;

  return (
    <Layout>
      <Header title="Manhã" />

      <div className="flex-1 overflow-y-auto bg-background px-5 py-6 pb-12">
        <div className="mx-auto max-w-md space-y-7">
          <div className="text-center space-y-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {new Date(dateKey + "T00:00:00").toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>

            <h1 className="font-serif text-3xl text-foreground">Manhã</h1>

            <p className="pt-4 font-serif italic text-sm text-muted-foreground leading-relaxed">
              "Que o teu princípio seja este: agir como um estóico."
            </p>
          </div>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarDays className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <SectionLabel>Direção da semana</SectionLabel>

                <p className="mt-2 font-serif text-xl leading-snug break-words">
                  {weeklyPlan.change.trim()
                    ? weeklyPlan.change
                    : "Nenhuma mudança da semana definida ainda."}
                </p>

                {hasWeeklyPlan && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Use esta direção para escolher o primeiro passo possível de
                    hoje.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <SectionLabel>Modo do dia</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {DAY_MODES.map((m) => {
                const selected = ritual.mode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setField("mode", selected ? "" : m.value)}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-xs font-medium transition-all",
                      selected
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border/40 bg-card text-muted-foreground",
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <SectionLabel>Como estou me sentindo agora?</SectionLabel>
            <div className="grid grid-cols-5 gap-2">
              {FEELINGS.map((f) => {
                const selected = ritual.feeling === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setField("feeling", selected ? "" : f.value)}
                    className={cn(
                      "rounded-xl border px-2 py-3 text-center transition-all",
                      selected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/40 bg-card",
                    )}
                  >
                    <div className="text-lg">{f.emoji}</div>
                    <div className="mt-1 text-[10px] leading-tight text-muted-foreground">
                      {f.label}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowFeelingNote(!showFeelingNote)}
              className="flex w-full items-center justify-between rounded-xl border border-border/40 bg-card px-4 py-3 text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
            >
              Quero registrar algo sobre isso?
              {showFeelingNote ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showFeelingNote && (
              <Textarea
                value={ritual.control}
                onChange={(e) => setField("control", e.target.value)}
                placeholder="O que preciso reconhecer sobre meu estado agora?"
                className="min-h-[90px] resize-none rounded-xl border-border/40 bg-card"
              />
            )}
          </section>

          <section className="rounded-2xl border border-border/40 bg-card">
            <button
              type="button"
              onClick={() => setShowPriorities(!showPriorities)}
              className="flex w-full items-center justify-between px-4 py-4 text-left"
            >
              <div>
                <SectionLabel>Prioridade do dia</SectionLabel>
                <p className="mt-1 text-xs text-muted-foreground">
                  {prioritiesDone > 0
                    ? `${prioritiesDone} prioridade${prioritiesDone > 1 ? "s" : ""} definida${prioritiesDone > 1 ? "s" : ""}`
                    : "Nenhuma prioridade definida ainda"}
                </p>
              </div>
              {showPriorities ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {showPriorities && (
              <div className="space-y-3 border-t border-border/30 px-4 pb-4 pt-3">
                {([0, 1, 2] as const).map((i) => (
                  <Textarea
                    key={i}
                    value={ritual.priorities[i]}
                    onChange={(e) => setPriority(i, e.target.value)}
                    placeholder={`Prioridade ${i + 1}`}
                    className="min-h-[58px] resize-none rounded-xl border-border/40 bg-background"
                  />
                ))}
              </div>
            )}
          </section>

          <MorningQuestion
            label="Qual é o primeiro passo possível hoje?"
            value={ritual.actions}
            onChange={(value) => setField("actions", value)}
            placeholder="Qual é a ação mais simples e concreta para começar?"
          />

          <MorningQuestion
            label="O que pode me derrubar hoje?"
            value={ritual.challenges}
            onChange={(value) => setField("challenges", value)}
            placeholder={
              weeklyPlan.risks.trim()
                ? `Risco da semana: ${weeklyPlan.risks}`
                : "Antecipe o que pode te desorganizar, travar ou puxar para baixo."
            }
          />

          <MorningQuestion
            label="Como quero responder?"
            value={ritual.virtueOfDay}
            onChange={(value) => setField("virtueOfDay", value)}
            placeholder={
              weeklyPlan.prevention.trim()
                ? `Resposta da semana: ${weeklyPlan.prevention}`
                : "Como você quer agir quando isso acontecer?"
            }
          />

          <section className="rounded-2xl border border-border/40 bg-card">
            <button
              type="button"
              onClick={() => setShowProofs(!showProofs)}
              className="flex w-full items-center justify-between px-4 py-4 text-left"
            >
              <div>
                <SectionLabel>Provas da semana</SectionLabel>
                <p className="mt-1 text-xs text-muted-foreground">
                  {proofs.length > 0
                    ? `${proofs.filter((p: any) => !p.checked).length} prova${proofs.length > 1 ? "s" : ""} pendente${proofs.length > 1 ? "s" : ""}`
                    : "Nenhuma prova definida ainda"}
                </p>
              </div>
              {showProofs ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {showProofs && (
              <div className="space-y-2 px-4 pb-4">
                {proofs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Defina as provas da semana no Plano Semanal.
                  </p>
                ) : (
                  proofs.map((proof: any) => (
                    <div
                      key={proof.id}
                      className="flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50/30 px-4 py-3"
                    >
                      <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-amber-400 text-amber-600">
                        {proof.checked && <Check className="h-3.5 w-3.5" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {proof.text}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Use isso como referência para orientar o dia.
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary/70">
      {children}
    </p>
  );
}

function MorningQuestion({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <section className="space-y-2">
      <SectionLabel>{label}</SectionLabel>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[86px] resize-none rounded-xl border-border/40 bg-card"
      />
    </section>
  );
}
