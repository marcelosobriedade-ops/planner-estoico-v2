import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import {
  EMPTY_WEEKLY_PLAN,
  WeeklyPlanData,
  loadWeeklyPlan,
  saveWeeklyPlan,
} from "@/lib/weekly-plan";

type NightData = {
  approach: string;
  away: string;
  wins: string;
  ending: string;
};

type DailyData = {
  evening?: NightData;
  [key: string]: unknown;
};

type Proof = {
  id: string;
  text: string;
  checked: boolean;
};

function parseProofs(raw: string): Proof[] {
  if (!raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({
      id: crypto.randomUUID(),
      text,
      checked: false,
    }));
}

function stringifyProofs(proofs: Proof[]) {
  return JSON.stringify(proofs);
}

export default function Evening() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [data, setData] = useState<NightData>({
    approach: "",
    away: "",
    wins: "",
    ending: "",
  });

  const [dailyData, setDailyData] = useState<DailyData>({});
  const [userId, setUserId] = useState<string | null>(null);

  const [weeklyPlan, setWeeklyPlan] =
    useState<WeeklyPlanData>(EMPTY_WEEKLY_PLAN);
  const [weeklyUserId, setWeeklyUserId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState("");
  const [proofs, setProofs] = useState<Proof[]>([]);

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
      });

      const weekly = await loadWeeklyPlan(dateKey);
      setWeeklyUserId(weekly.userId);
      setWeekStart(weekly.weekStart);
      setWeeklyPlan(weekly.plan);
      setProofs(parseProofs(weekly.plan.proofs));
    }

    load();
  }, [dateKey]);

  async function save(updated: NightData) {
    if (!userId) return;

    const next: DailyData = {
      ...dailyData,
      evening: updated,
    };

    setData(updated);
    setDailyData(next);

    await supabase.from("daily_records").upsert(
      {
        user_id: userId,
        date: dateKey,
        data: next,
      },
      { onConflict: "user_id,date" },
    );
  }

  function setField(key: keyof NightData, value: string) {
    save({ ...data, [key]: value });
  }

  async function toggleProof(id: string) {
    if (!weeklyUserId || !weekStart) return;

    const nextProofs = proofs.map((proof) =>
      proof.id === id ? { ...proof, checked: !proof.checked } : proof,
    );

    const nextPlan: WeeklyPlanData = {
      ...weeklyPlan,
      proofs: stringifyProofs(nextProofs),
    };

    setProofs(nextProofs);
    setWeeklyPlan(nextPlan);

    await saveWeeklyPlan(weeklyUserId, weekStart, nextPlan);
  }

  const completedProofs = proofs.filter((p) => p.checked).length;

  return (
    <Layout>
      <Header title="Noite" />

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

            <h1 className="font-serif text-3xl">Noite</h1>

            <p className="pt-4 font-serif italic text-sm text-muted-foreground leading-relaxed">
              "Examine as suas ações do dia. O que fez de errado? O que fez de
              certo? O que deixou por fazer?"
            </p>
          </div>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarDays className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-widest text-primary/70">
                  Fechamento da semana no dia
                </p>

                <p className="mt-2 font-serif text-xl leading-snug break-words">
                  {weeklyPlan.change.trim()
                    ? weeklyPlan.change
                    : "Nenhuma mudança da semana definida ainda."}
                </p>

                <p className="mt-2 text-xs text-muted-foreground">
                  A noite revela o dia à luz da direção da semana.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-primary/70">
                Provas da semana
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {proofs.length > 0
                  ? `${completedProofs}/${proofs.length} marcadas`
                  : "Nenhuma prova definida ainda"}
              </p>
            </div>

            {proofs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Defina provas no Plano Semanal para acompanhar seu avanço aqui.
              </p>
            ) : (
              <div className="space-y-2">
                {proofs.map((proof) => (
                  <button
                    key={proof.id}
                    type="button"
                    onClick={() => toggleProof(proof.id)}
                    className="w-full flex items-start gap-3 rounded-xl border border-border/40 bg-background px-4 py-3 text-left"
                  >
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/40 text-primary">
                      {proof.checked && <CheckCircle2 className="h-4 w-4" />}
                    </div>

                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {proof.text}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Toque para marcar/desmarcar como evidência da semana.
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <NightField
            label="1. O que me aproximou da mudança da semana hoje?"
            value={data.approach}
            onChange={(v) => setField("approach", v)}
            placeholder={
              weeklyPlan.change.trim()
                ? `Direção da semana: ${weeklyPlan.change}`
                : "O que hoje apoiou a travessia da semana?"
            }
          />

          <NightField
            label="2. O que me afastou ou me derrubou hoje?"
            value={data.away}
            onChange={(v) => setField("away", v)}
            placeholder={
              weeklyPlan.risks.trim()
                ? `Risco previsto: ${weeklyPlan.risks}`
                : "Onde desviei, me perdi ou cedi ao automático?"
            }
          />

          <NightField
            label="3. Que prova, passo ou pequena vitória toquei hoje?"
            value={data.wins}
            onChange={(v) => setField("wins", v)}
            placeholder="Quais sinais reais de avanço apareceram no dia?"
          />

          <NightField
            label="4. Como estou terminando este dia?"
            value={data.ending}
            onChange={(v) => setField("ending", v)}
            placeholder="Estado emocional, mental e físico ao fechar o dia..."
          />
        </div>
      </div>
    </Layout>
  );
}

function NightField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
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
        placeholder={placeholder}
        className="min-h-[100px] resize-none rounded-xl border-border/40 bg-card"
      />
    </section>
  );
}
