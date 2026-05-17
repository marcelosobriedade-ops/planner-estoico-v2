import React, { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Brain,
  Target,
  CheckCircle2,
} from "lucide-react";
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

const DECISION_OPTIONS = [
  { value: "continuar", label: "Continuar direção" },
  { value: "ajustar", label: "Ajustar rota" },
  { value: "proteger", label: "Reforçar proteção" },
];

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

function getPreviousWeekDateKey(weekStart: string) {
  const date = new Date(weekStart + "T12:00:00");
  date.setDate(date.getDate() - 7);
  return date.toISOString().slice(0, 10);
}

function getDecisionLabel(value: string) {
  if (value === "continuar") return "Continuar direção";
  if (value === "ajustar") return "Ajustar rota";
  if (value === "proteger") return "Reforçar proteção";
  return "";
}

function getPreviousDecisionGuidance(value: string) {
  if (value === "continuar") {
    return "Na semana anterior você decidiu continuar. Mantenha a direção, mas escolha provas realistas para sustentar o avanço.";
  }

  if (value === "ajustar") {
    return "Na semana anterior você decidiu ajustar a rota. Antes de definir a direção, revise o que não funcionou e simplifique o plano.";
  }

  if (value === "proteger") {
    return "Na semana anterior você decidiu reforçar proteção. Dê mais atenção aos riscos e defina respostas claras para evitar repetir os mesmos erros.";
  }

  return "";
}

function getDirectionGuidance(value: string) {
  if (value === "continuar") {
    return "Você decidiu continuar. Mantenha a mesma direção, mas torne-a mais concreta e sustentável.";
  }

  if (value === "ajustar") {
    return "Você decidiu ajustar. Evite algo genérico — escreva uma direção mais simples, clara e executável.";
  }

  if (value === "proteger") {
    return "Você decidiu se proteger. Sua direção deve considerar os riscos e evitar repetir os mesmos erros.";
  }

  return "";
}

function getProofGuidance(value: string) {
  if (value === "continuar") {
    return "Você decidiu continuar. Foque em provas simples e repetíveis — consistência é mais importante que intensidade.";
  }

  if (value === "ajustar") {
    return "Você decidiu ajustar. Reduza a ambição e escolha provas mais claras e executáveis.";
  }

  if (value === "proteger") {
    return "Você decidiu se proteger. Inclua provas que evitem erros recorrentes e preservem sua energia.";
  }

  return "";
}

function getRiskGuidance(value: string) {
  if (value === "continuar") {
    return "Como você decidiu continuar, observe o que pode quebrar sua consistência nesta semana.";
  }

  if (value === "ajustar") {
    return "Como você decidiu ajustar, identifique o que tornou o plano anterior difícil, confuso ou pesado demais.";
  }

  if (value === "proteger") {
    return "Como você decidiu reforçar proteção, escolha o risco principal que mais pode te derrubar nesta semana.";
  }

  return "";
}

function getPreventionGuidance(value: string) {
  if (value === "continuar") {
    return "Defina uma resposta simples para quando a consistência começar a cair.";
  }

  if (value === "ajustar") {
    return "Defina uma resposta mais realista do que a anterior — menor, mais clara e executável.";
  }

  if (value === "proteger") {
    return "Defina uma proteção concreta: o que você fará no primeiro sinal de queda?";
  }

  return "";
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
  const [previousDecision, setPreviousDecision] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const result = await loadWeeklyPlan(dateKey);

        setUserId(result.userId);
        setWeekStart(result.weekStart);
        setPlan(result.plan);
        setProofs(parseProofs(result.plan.proofs));
        setStatus("Nenhuma alteração pendente.");

        const previousWeekDateKey = getPreviousWeekDateKey(result.weekStart);
        const previous = await loadWeeklyPlan(previousWeekDateKey);
        setPreviousDecision(previous.plan.review?.decision || "");

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

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");

    if (!["evidencias", "interpretacao", "decisao"].includes(hash)) {
      return;
    }

    setReviewOpen(true);

    const timeout = window.setTimeout(() => {
      const element = document.getElementById(hash);

      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [dateKey, records.length, proofs.length]);

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
  const previousDecisionLabel = getDecisionLabel(previousDecision);
  const previousGuidance = getPreviousDecisionGuidance(previousDecision);
  const directionGuidance = getDirectionGuidance(previousDecision);
  const proofGuidance = getProofGuidance(previousDecision);
  const riskGuidance = getRiskGuidance(previousDecision);
  const preventionGuidance = getPreventionGuidance(previousDecision);

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

          {previousDecisionLabel && (
            <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-primary/70">
                Continuidade da semana anterior
              </p>

              <p className="text-sm text-foreground">
                Última decisão:{" "}
                <span className="font-medium">{previousDecisionLabel}</span>
              </p>

              {previousGuidance && (
                <p className="text-sm text-foreground leading-relaxed">
                  {previousGuidance}
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Use isso como ponto de partida — não como regra fixa.
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <h2 className="font-serif text-lg">1. Direção da semana</h2>

            {directionGuidance && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {directionGuidance}
              </p>
            )}

            <Textarea
              value={plan.change}
              onChange={(e) => updateField("change", e.target.value)}
              placeholder="Que direção precisa guiar estes 7 dias?"
              className="min-h-[110px] resize-none rounded-xl bg-background"
            />
          </section>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-4">
            <h2 className="font-serif text-lg">2. Provas da semana</h2>

            {proofGuidance && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {proofGuidance}
              </p>
            )}

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

            {riskGuidance && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {riskGuidance}
              </p>
            )}

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

            {preventionGuidance && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {preventionGuidance}
              </p>
            )}

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
                  Fechamento da semana
                </p>
                <h2 className="font-serif text-lg">
                  {isSaturday(dateKey)
                    ? "Fechamento disponível"
                    : "Disponível no sábado"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Evidências · interpretação · decisão
                </p>
              </div>

              {reviewOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {reviewOpen && (
              <div className="border-t border-border/30 p-4 space-y-5">
                <section id="evidencias" className="space-y-3 scroll-mt-6">
                  <SectionTitle
                    icon={<BarChart3 className="h-4 w-4" />}
                    title="1. Ver evidências"
                    subtitle="O que a semana mostra em dados simples."
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Metric
                      label="Dias registrados"
                      value={`${summary.days}/7`}
                    />
                    <Metric label="Emoções" value={`${summary.emotions}/7`} />
                    <Metric
                      label="Tarefas feitas"
                      value={`${summary.doneTasks}/${summary.tasks}`}
                    />
                    <Metric
                      label="Provas"
                      value={`${summary.checkedProofs}/${summary.totalProofs}`}
                    />
                    <Metric label="Finanças" value={`${summary.financial}`} />
                    <Metric label="Relações" value={`${summary.people}`} />
                  </div>
                </section>

                <section id="interpretacao" className="space-y-4 scroll-mt-6">
                  <SectionTitle
                    icon={<Brain className="h-4 w-4" />}
                    title="2. Ler e interpretar"
                    subtitle="O que funcionou, o que pesou e que padrão apareceu."
                  />

                  <ReviewField
                    label="Como esta semana foi sentida no geral?"
                    evidence={`${summary.days} dia${
                      summary.days === 1 ? "" : "s"
                    } com registro nesta semana.`}
                    value={review.generalFeeling}
                    onChange={(v) => updateReviewField("generalFeeling", v)}
                    placeholder="Ex: Foi uma semana instável, mas com alguns avanços reais..."
                  />

                  <ReviewField
                    label="O que marcou esta semana?"
                    evidence={`${summary.days} dia${
                      summary.days === 1 ? "" : "s"
                    } com algum registro no período.`}
                    value={review.mainEvents}
                    onChange={(v) => updateReviewField("mainEvents", v)}
                    placeholder="Eventos, decisões ou situações que definiram a semana..."
                  />

                  <ReviewField
                    label="Que padrão emocional apareceu?"
                    evidence={`${summary.emotions} dia${
                      summary.emotions === 1 ? "" : "s"
                    } com emoção registrada.`}
                    value={review.emotionalPattern}
                    onChange={(v) => updateReviewField("emotionalPattern", v)}
                    placeholder="O que se repetiu emocionalmente?"
                  />

                  <ReviewField
                    label="O que ajudou ou prejudicou sua execução?"
                    evidence={`${summary.doneTasks}/${summary.tasks} tarefa${
                      summary.tasks === 1 ? "" : "s"
                    } concluída${summary.tasks === 1 ? "" : "s"} na semana.`}
                    value={review.productivityImpact}
                    onChange={(v) => updateReviewField("productivityImpact", v)}
                    placeholder="O que puxou sua ação para frente ou travou sua execução?"
                  />

                  <ReviewField
                    label="Como as finanças impactaram sua semana?"
                    evidence={`${summary.financial} registro${
                      summary.financial === 1 ? "" : "s"
                    } financeiro${summary.financial === 1 ? "" : "s"} na semana.`}
                    value={review.financialImpact}
                    onChange={(v) => updateReviewField("financialImpact", v)}
                    placeholder="Como o dinheiro influenciou sua semana?"
                  />

                  <ReviewField
                    label="Como as relações impactaram sua semana?"
                    evidence={`${summary.people} dia${
                      summary.people === 1 ? "" : "s"
                    } com interações registradas.`}
                    value={review.relationshipImpact}
                    onChange={(v) => updateReviewField("relationshipImpact", v)}
                    placeholder="Pessoas, conversas, conflitos ou apoios que marcaram a semana..."
                  />

                  <ReviewField
                    label="O que precisa melhorar no próximo ciclo?"
                    evidence={`${summary.checkedProofs}/${summary.totalProofs} prova${
                      summary.totalProofs === 1 ? "" : "s"
                    } da semana marcada${summary.checkedProofs === 1 ? "" : "s"}.`}
                    value={review.improvements}
                    onChange={(v) => updateReviewField("improvements", v)}
                    placeholder="Que correção, hábito ou proteção precisa entrar na próxima semana?"
                  />
                </section>

                <section id="decisao" className="space-y-3 scroll-mt-6">
                  <SectionTitle
                    icon={<Target className="h-4 w-4" />}
                    title="3. Decidir o próximo passo"
                    subtitle="Semana não termina em relatório. Termina em decisão."
                  />

                  <p className="text-sm text-muted-foreground">
                    Com base no que esta semana mostrou, qual é a decisão para o
                    próximo ciclo?
                  </p>

                  <div className="grid grid-cols-1 gap-2">
                    {DECISION_OPTIONS.map((option) => {
                      const selected = review.decision === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            updateReviewField(
                              "decision",
                              selected ? "" : option.value,
                            )
                          }
                          className={
                            selected
                              ? "rounded-xl border border-primary bg-primary/10 px-3 py-3 text-left text-sm text-primary flex items-center gap-2"
                              : "rounded-xl border border-border/40 bg-background px-3 py-3 text-left text-sm text-muted-foreground flex items-center gap-2"
                          }
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>

      <div>
        <h3 className="font-serif text-lg">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-xl">{value}</p>
    </div>
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
