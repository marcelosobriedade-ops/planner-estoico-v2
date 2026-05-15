import React, { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save, ChevronDown, ChevronUp } from "lucide-react";
import {
  EMPTY_WEEKLY_PLAN,
  EMPTY_WEEKLY_REVIEW,
  WeeklyPlanData,
  WeeklyReviewData,
  getWeekEnd,
  loadWeeklyPlan,
  saveWeeklyPlan,
} from "@/lib/weekly-plan";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { supabase } from "@/lib/supabase";

type Proof = {
  id: string;
  text: string;
  checked: boolean;
};

type DailyRecord = {
  date: string;
  data: any;
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

function isSaturday(dateKey: string) {
  return new Date(dateKey + "T12:00:00").getDay() === 6;
}

function hasEmotion(record: DailyRecord) {
  const emotions = record.data?.emotions;
  return Boolean(
    emotions?.morning?.emotion ||
      emotions?.afternoon?.emotion ||
      emotions?.evening?.emotion,
  );
}

function hasPeople(record: DailyRecord) {
  return Array.isArray(record.data?.people) && record.data.people.length > 0;
}

function getFinancialCount(record: DailyRecord) {
  return record.data?.financial?.length || 0;
}

function getTasksCount(record: DailyRecord) {
  return record.data?.tasks?.length || 0;
}

function getDoneTasksCount(record: DailyRecord) {
  return (record.data?.tasks || []).filter(
    (task: any) => task.status === "done",
  ).length;
}

export default function Weekly() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [plan, setPlan] = useState<WeeklyPlanData>(EMPTY_WEEKLY_PLAN);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [newProof, setNewProof] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState("");
  const [status, setStatus] = useState("Carregando...");
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [reviewOpen, setReviewOpen] = useState(isSaturday(dateKey));

  useEffect(() => {
    async function load() {
      try {
        const result = await loadWeeklyPlan(dateKey);

        setUserId(result.userId);
        setWeekStart(result.weekStart);
        setPlan(result.plan);
        setProofs(parseProofs(result.plan.proofs));
        setStatus("Nenhuma alteração pendente.");

        if (result.userId) {
          const { data } = await supabase
            .from("daily_records")
            .select("date, data")
            .eq("user_id", result.userId)
            .gte("date", result.weekStart)
            .lte("date", getWeekEnd(result.weekStart))
            .order("date", { ascending: true });

          setRecords(data || []);
        }
      } catch (error) {
        console.error(error);
        setStatus("Erro ao carregar plano.");
      }
    }

    load();
  }, [dateKey]);

  const summary = useMemo(() => {
    const days = records.length;
    const emotions = records.filter(hasEmotion).length;
    const people = records.filter(hasPeople).length;
    const tasks = records.reduce((acc, r) => acc + getTasksCount(r), 0);
    const doneTasks = records.reduce((acc, r) => acc + getDoneTasksCount(r), 0);
    const financial = records.reduce((acc, r) => acc + getFinancialCount(r), 0);
    const checkedProofs = proofs.filter((p) => p.checked).length;

    return {
      days,
      emotions,
      people,
      tasks,
      doneTasks,
      financial,
      checkedProofs,
      totalProofs: proofs.length,
    };
  }, [records, proofs]);

  async function persist(nextPlan: WeeklyPlanData) {
    if (!userId || !weekStart) return;

    setStatus("Salvando...");

    try {
      await saveWeeklyPlan(userId, weekStart, nextPlan);
      setStatus("Plano salvo.");
    } catch (error) {
      console.error(error);
      setStatus("Erro ao salvar plano.");
    }
  }

  function updateField(key: keyof WeeklyPlanData, value: string) {
    const next = {
      ...plan,
      [key]: value,
    };

    setPlan(next);
    persist(next);
  }

  function updateReviewField(key: keyof WeeklyReviewData, value: string) {
    const nextReview = {
      ...(plan.review || EMPTY_WEEKLY_REVIEW),
      [key]: value,
    };

    const nextPlan = {
      ...plan,
      review: nextReview,
    };

    setPlan(nextPlan);
    persist(nextPlan);
  }

  function addProof() {
    if (!newProof.trim()) return;

    const nextProofs = [
      ...proofs,
      {
        id: crypto.randomUUID(),
        text: newProof.trim(),
        checked: false,
      },
    ];

    const nextPlan = {
      ...plan,
      proofs: stringifyProofs(nextProofs),
    };

    setProofs(nextProofs);
    setNewProof("");
    setPlan(nextPlan);
    persist(nextPlan);
  }

  function toggleProof(id: string) {
    const nextProofs = proofs.map((p) =>
      p.id === id ? { ...p, checked: !p.checked } : p,
    );

    const nextPlan = {
      ...plan,
      proofs: stringifyProofs(nextProofs),
    };

    setProofs(nextProofs);
    setPlan(nextPlan);
    persist(nextPlan);
  }

  function deleteProof(id: string) {
    const nextProofs = proofs.filter((p) => p.id !== id);

    const nextPlan = {
      ...plan,
      proofs: stringifyProofs(nextProofs),
    };

    setProofs(nextProofs);
    setPlan(nextPlan);
    persist(nextPlan);
  }

  const review = plan.review || EMPTY_WEEKLY_REVIEW;

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto bg-background px-5 py-6 pb-12">
        <div className="mx-auto max-w-md space-y-6">
          <header className="text-center space-y-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Semana iniciada em {weekStart || "..."}
            </p>
            <h1 className="font-serif text-3xl">Plano Semanal</h1>
            <p className="text-xs text-muted-foreground">{status}</p>
          </header>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <h2 className="font-serif text-lg">1. Visão — daqui a 7 dias</h2>
            <Textarea
              value={plan.change}
              onChange={(e) => updateField("change", e.target.value)}
              placeholder="O que precisa ter mudado ao final desta semana?"
              className="min-h-[110px] resize-none rounded-xl bg-background"
            />
          </section>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-4">
            <h2 className="font-serif text-lg">2. Provas da semana</h2>

            <div className="flex gap-2">
              <Input
                value={newProof}
                onChange={(e) => setNewProof(e.target.value)}
                placeholder="Adicionar prova da semana"
                className="bg-background"
              />
              <button
                type="button"
                onClick={addProof}
                className="w-11 rounded-xl border border-border/40 bg-background flex items-center justify-center"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {proofs.map((proof) => (
                <div
                  key={proof.id}
                  className="flex items-center gap-3 rounded-xl border border-border/40 bg-background px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => toggleProof(proof.id)}
                    className="h-6 w-6 rounded-full border border-primary/40 text-xs"
                  >
                    {proof.checked ? "✓" : ""}
                  </button>

                  <p className="flex-1 text-sm">{proof.text}</p>

                  <button
                    type="button"
                    onClick={() => deleteProof(proof.id)}
                    className="text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <h2 className="font-serif text-lg">
              3. O que pode te derrubar nesta semana?
            </h2>
            <Textarea
              value={plan.risks}
              onChange={(e) => updateField("risks", e.target.value)}
              placeholder="Quais riscos, padrões ou obstáculos podem aparecer?"
              className="min-h-[110px] resize-none rounded-xl bg-background"
            />
          </section>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <h2 className="font-serif text-lg">
              4. O que você fará quando isso acontecer?
            </h2>
            <Textarea
              value={plan.prevention}
              onChange={(e) => updateField("prevention", e.target.value)}
              placeholder="Qual será sua resposta concreta?"
              className="min-h-[110px] resize-none rounded-xl bg-background"
            />
          </section>

          <section className="rounded-2xl border border-border/40 bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setReviewOpen(!reviewOpen)}
              className="w-full p-4 text-left flex items-center justify-between"
            >
              <div>
                <p className="text-[10px] uppercase tracking-widest text-primary/70">
                  Avaliação da semana
                </p>
                <h2 className="font-serif text-lg">
                  {isSaturday(dateKey)
                    ? "Fechamento disponível"
                    : "Fechamento previsto para sábado"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {summary.days} dias registrados · {summary.emotions} dias com
                  emoção · {summary.tasks} tarefas · {summary.financial}{" "}
                  registros financeiros
                </p>
              </div>

              {reviewOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {reviewOpen && (
              <div className="border-t border-border/30 p-4 space-y-4">
                <ReviewField
                  label="Sentimento geral da semana"
                  evidence={`${summary.days} dia${summary.days === 1 ? "" : "s"} com registro nesta semana.`}
                  value={review.generalFeeling}
                  onChange={(v) => updateReviewField("generalFeeling", v)}
                  placeholder="Como esta semana foi sentida no geral?"
                />

                <ReviewField
                  label="Principais acontecimentos"
                  evidence={`${summary.days} dia${summary.days === 1 ? "" : "s"} com algum registro no período.`}
                  value={review.mainEvents}
                  onChange={(v) => updateReviewField("mainEvents", v)}
                  placeholder="O que marcou esta semana?"
                />

                <ReviewField
                  label="Padrão emocional"
                  evidence={`${summary.emotions} dia${summary.emotions === 1 ? "" : "s"} com emoção registrada.`}
                  value={review.emotionalPattern}
                  onChange={(v) => updateReviewField("emotionalPattern", v)}
                  placeholder="Que emoções apareceram com mais força?"
                />

                <ReviewField
                  label="Finanças e humor"
                  evidence={`${summary.financial} registro${summary.financial === 1 ? "" : "s"} financeiro${summary.financial === 1 ? "" : "s"} na semana.`}
                  value={review.financialImpact}
                  onChange={(v) => updateReviewField("financialImpact", v)}
                  placeholder="Como dinheiro, gastos ou inseguranças afetaram seu humor?"
                />

                <ReviewField
                  label="Relações e emoções"
                  evidence={`${summary.people} dia${summary.people === 1 ? "" : "s"} com registro de pessoas/relações.`}
                  value={review.relationshipImpact}
                  onChange={(v) => updateReviewField("relationshipImpact", v)}
                  placeholder="Como os relacionamentos influenciaram emocionalmente?"
                />

                <ReviewField
                  label="Produtividade"
                  evidence={`${summary.doneTasks}/${summary.tasks} tarefa${summary.tasks === 1 ? "" : "s"} concluída${summary.doneTasks === 1 ? "" : "s"} na semana.`}
                  value={review.productivityImpact}
                  onChange={(v) => updateReviewField("productivityImpact", v)}
                  placeholder="O que ajudou ou prejudicou sua execução?"
                />

                <ReviewField
                  label="Melhorias"
                  evidence={`${summary.checkedProofs}/${summary.totalProofs} prova${summary.totalProofs === 1 ? "" : "s"} da semana marcada${summary.checkedProofs === 1 ? "" : "s"}.`}
                  value={review.improvements}
                  onChange={(v) => updateReviewField("improvements", v)}
                  placeholder="Que virtudes, hábitos ou correções precisam entrar no próximo ciclo?"
                />
              </div>
            )}
          </section>

          <div className="rounded-2xl border border-border/40 bg-card p-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{status}</p>
            <button
              type="button"
              onClick={() => persist(plan)}
              className="rounded-xl bg-primary px-4 py-3 text-sm text-primary-foreground flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Salvar plano
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function ReviewField({
  label,
  evidence,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  evidence: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-primary/70">
          {label}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{evidence}</p>
      </div>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[90px] resize-none rounded-xl bg-background"
      />
    </div>
  );
}
