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
import { getMonthKey, loadMonthlyPlan } from "@/lib/monthly-plan";
import { loadYearPlan } from "@/lib/year-plan";
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

type MonthlyContext = {
  virtue: string;
  mainGoal: string;
  mainRisk: string;
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

function parseLines(raw: string): string[] {
  return (raw || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringifyLines(items: string[]) {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");
}

function getMonthlyContext(rawPlan: any): MonthlyContext | null {
  if (!rawPlan) return null;

  const virtue = String(
    rawPlan.virtue || rawPlan.monthVirtue || rawPlan.virtude || "",
  ).trim();

  const mainGoal = String(
    rawPlan.mainGoal ||
      rawPlan.objective ||
      rawPlan.goal ||
      rawPlan.primaryGoal ||
      rawPlan.objetivoPrincipal ||
      "",
  ).trim();

  const mainRisk = String(
    rawPlan.mainRisk ||
      rawPlan.risk ||
      rawPlan.primaryRisk ||
      rawPlan.principalRisk ||
      rawPlan.principalRisco ||
      "",
  ).trim();

  if (!virtue && !mainGoal && !mainRisk) return null;

  return {
    virtue,
    mainGoal,
    mainRisk,
  };
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
  const [newSupportHabit, setNewSupportHabit] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState("");
  const [status, setStatus] = useState("Carregando...");
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [reviewOpen, setReviewOpen] = useState(isSaturday(dateKey));
  const [previousDecision, setPreviousDecision] = useState("");
  const [previousImprovement, setPreviousImprovement] = useState("");
  const [monthlyContext, setMonthlyContext] = useState<MonthlyContext | null>(
    null,
  );
  const [yearContext, setYearContext] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await loadWeeklyPlan(dateKey);

        try {
          const yearKey = dateKey.slice(0, 4);
          const yearResult = await loadYearPlan(yearKey);
          setYearContext(yearResult.plan);
        } catch (yearError) {
          console.error("Erro ao carregar contexto anual:", yearError);
          setYearContext(null);
        }

        try {
          const monthlyResult = await loadMonthlyPlan(
            getMonthKey(new Date(dateKey + "T12:00:00")),
          );
          setMonthlyContext(getMonthlyContext(monthlyResult.plan));
        } catch (monthlyError) {
          console.error("Erro ao carregar contexto mensal:", monthlyError);
          setMonthlyContext(null);
        }

        setUserId(result.userId);
        setWeekStart(result.weekStart);
        setPlan(result.plan);
        setProofs(parseProofs(result.plan.proofs));
        setStatus("Nenhuma alteração pendente.");

        const previousWeekDateKey = getPreviousWeekDateKey(result.weekStart);
        const previous = await loadWeeklyPlan(previousWeekDateKey);

        setPreviousDecision(previous.plan.review?.decision || "");
        setPreviousImprovement(previous.plan.review?.improvements || "");

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

  useEffect(() => {
    if (!userId || !weekStart) return;

    void syncProofsToTasks(proofs);
  }, [userId, weekStart]);

  const summary = useMemo(() => {
    const days = records.length;
    const emotions = records.filter(hasEmotion).length;
    const people = records.filter(hasPeople).length;
    const tasks = records.reduce((acc, r) => acc + getTasksCount(r), 0);
    const doneTasks = records.reduce((acc, r) => acc + getDoneTasksCount(r), 0);
    const financial = records.reduce((acc, r) => acc + getFinancialCount(r), 0);
    const checkedProofs = proofs.filter((p) => p.checked).length;

    const importantTasks = records.reduce(
      (acc, record) =>
        acc +
        (record.data?.tasks || []).filter((task: any) =>
          Boolean(task.alignedToWeek),
        ).length,
      0,
    );

    const completedImportantTasks = records.reduce(
      (acc, record) =>
        acc +
        (record.data?.tasks || []).filter(
          (task: any) => Boolean(task.alignedToWeek) && task.status === "done",
        ).length,
      0,
    );

    const unfinishedImportantTasks = records.reduce(
      (acc, record) =>
        acc +
        (record.data?.tasks || []).filter(
          (task: any) => Boolean(task.alignedToWeek) && task.status !== "done",
        ).length,
      0,
    );

    const unfinishedUrgentTasks = records.reduce(
      (acc, record) =>
        acc +
        (record.data?.tasks || []).filter(
          (task: any) => Boolean(task.mustDoToday) && task.status !== "done",
        ).length,
      0,
    );

    return {
      days,
      emotions,
      people,
      tasks,
      doneTasks,
      financial,
      checkedProofs,
      totalProofs: proofs.length,
      importantTasks,
      completedImportantTasks,
      unfinishedImportantTasks,
      unfinishedUrgentTasks,
    };
  }, [records, proofs]);

  const peopleAnalysis = useMemo(() => {
    const allInteractions = records.flatMap((record) =>
      Array.isArray(record.data?.people) ? record.data.people : [],
    );

    const map: Record<
      string,
      {
        count: number;
        learned: number;
        boundary: number;
      }
    > = {};

    allInteractions.forEach((interaction: any) => {
      const name = String(interaction.name || "").trim();
      if (!name) return;

      if (!map[name]) {
        map[name] = {
          count: 0,
          learned: 0,
          boundary: 0,
        };
      }

      map[name].count += 1;

      if (String(interaction.learned || "").trim()) {
        map[name].learned += 1;
      }

      if (String(interaction.boundary || "").trim()) {
        map[name].boundary += 1;
      }
    });

    const entries = Object.entries(map);

    const helpers = entries
      .filter(([_, value]) => value.learned > value.boundary)
      .sort((a, b) => b[1].learned - a[1].learned)
      .slice(0, 3)
      .map(([name]) => name);

    const drainers = entries
      .filter(([_, value]) => value.boundary > value.learned)
      .sort((a, b) => b[1].boundary - a[1].boundary)
      .slice(0, 3)
      .map(([name]) => name);

    let interpretation = "";

    if (allInteractions.length === 0) {
      interpretation =
        "Nenhuma interação registrada. As relações não estão sendo observadas nesta semana.";
    } else if (helpers.length === 0 && drainers.length === 0) {
      interpretation =
        "As relações foram registradas, mas ainda não há padrão claro de impacto.";
    } else {
      interpretation = "Padrão de relações identificado na semana.";
    }

    return {
      helpers,
      drainers,
      interpretation,
    };
  }, [records]);

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

  async function loadWeekDailyRecords(currentUserId: string) {
    const { data, error } = await supabase
      .from("daily_records")
      .select("date, data")
      .eq("user_id", currentUserId)
      .gte("date", weekStart)
      .lte("date", getWeekEnd(weekStart))
      .order("date", { ascending: true });

    if (error) {
      console.error("Erro ao carregar registros da semana:", error);
      return [];
    }

    return (data || []) as DailyRecord[];
  }

  async function syncProofsToTasks(nextProofs: Proof[]) {
    if (!userId || !weekStart) return;

    const activeProofs = nextProofs
      .map((proof) => ({
        ...proof,
        text: String(proof.text || "").trim(),
      }))
      .filter((proof) => proof.id && proof.text);

    const activeProofIds = new Set(activeProofs.map((proof) => proof.id));
    const weekRecords = await loadWeekDailyRecords(userId);
    const recordsByDate = new Map<string, DailyRecord>();

    weekRecords.forEach((record) => {
      recordsByDate.set(record.date, {
        date: record.date,
        data: record.data || {},
      });
    });

    if (!recordsByDate.has(dateKey)) {
      recordsByDate.set(dateKey, {
        date: dateKey,
        data: {},
      });
    }

    const workingRecords = Array.from(recordsByDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const originalByDate = new Map(
      workingRecords.map((record) => [
        record.date,
        JSON.stringify(
          Array.isArray(record.data?.tasks) ? record.data.tasks : [],
        ),
      ]),
    );

    const linkedTasksByProofId = new Map<
      string,
      { record: DailyRecord; taskIndex: number; task: any }[]
    >();

    workingRecords.forEach((record) => {
      const tasks = Array.isArray(record.data?.tasks) ? record.data.tasks : [];

      tasks.forEach((task: any, taskIndex: number) => {
        const proofId =
          typeof task?.weeklyProofId === "string" ? task.weeklyProofId : "";

        if (!proofId) return;

        if (!linkedTasksByProofId.has(proofId)) {
          linkedTasksByProofId.set(proofId, []);
        }

        linkedTasksByProofId.get(proofId)!.push({
          record,
          taskIndex,
          task,
        });
      });
    });

    activeProofs.forEach((proof) => {
      const linkedTasks = linkedTasksByProofId.get(proof.id) || [];
      let keeper = linkedTasks[0];

      if (!keeper) {
        const targetRecord = recordsByDate.get(dateKey)!;
        const targetTasks = Array.isArray(targetRecord.data?.tasks)
          ? [...targetRecord.data.tasks]
          : [];

        const newTask = {
          id: crypto.randomUUID(),
          title: proof.text,
          category: "semana",
          status: proof.checked ? "done" : "todo",
          date: dateKey,
          source: "weekly-proof",
          weeklyProofId: proof.id,
          alignedToWeek: true,
          mustDoToday: true,
          matrixTouched: false,
          details:
            "Prova da semana — se isso for feito, você está no rumo certo.",
          subtasks: [],
        };

        targetTasks.push(newTask);
        targetRecord.data = {
          ...targetRecord.data,
          tasks: targetTasks,
        };

        keeper = {
          record: targetRecord,
          taskIndex: targetTasks.length - 1,
          task: newTask,
        };
      }

      linkedTasks.slice(1).forEach(({ record, taskIndex }) => {
        const tasks = Array.isArray(record.data?.tasks)
          ? [...record.data.tasks]
          : [];

        tasks[taskIndex] = {
          ...tasks[taskIndex],
          status: "cancelled",
          source: "weekly-proof",
          weeklyProofId: proof.id,
          category: "semana",
          alignedToWeek: tasks[taskIndex]?.matrixTouched
            ? tasks[taskIndex].alignedToWeek
            : true,
          mustDoToday: tasks[taskIndex]?.matrixTouched
            ? tasks[taskIndex].mustDoToday
            : true,
          matrixTouched: Boolean(tasks[taskIndex]?.matrixTouched),
        };

        record.data = {
          ...record.data,
          tasks,
        };
      });

      const keeperTasks = Array.isArray(keeper.record.data?.tasks)
        ? [...keeper.record.data.tasks]
        : [];

      const existingKeeperTask = keeperTasks[keeper.taskIndex];

      keeperTasks[keeper.taskIndex] = {
        ...existingKeeperTask,
        title: proof.text,
        category: "semana",
        status: proof.checked ? "done" : "todo",
        date: existingKeeperTask?.date || keeper.record.date,
        source: "weekly-proof",
        weeklyProofId: proof.id,
        alignedToWeek: existingKeeperTask?.matrixTouched
          ? existingKeeperTask.alignedToWeek
          : true,
        mustDoToday: existingKeeperTask?.matrixTouched
          ? existingKeeperTask.mustDoToday
          : true,
        matrixTouched: Boolean(existingKeeperTask?.matrixTouched),
        details:
          "Prova da semana — se isso for feito, você está no rumo certo.",
        subtasks: Array.isArray(existingKeeperTask?.subtasks)
          ? existingKeeperTask.subtasks
          : [],
      };

      keeper.record.data = {
        ...keeper.record.data,
        tasks: keeperTasks,
      };
    });

    workingRecords.forEach((record) => {
      const tasks = Array.isArray(record.data?.tasks)
        ? [...record.data.tasks]
        : [];
      let changed = false;

      const nextTasks = tasks.map((task: any) => {
        const isWeeklyProof =
          task?.source === "weekly-proof" || Boolean(task?.weeklyProofId);
        const proofId =
          typeof task?.weeklyProofId === "string" ? task.weeklyProofId : "";

        if (!isWeeklyProof || !proofId || activeProofIds.has(proofId)) {
          return task;
        }

        changed = true;

        return {
          ...task,
          status: "cancelled",
          source: "weekly-proof",
          category: "semana",
          alignedToWeek: task.matrixTouched ? task.alignedToWeek : true,
          mustDoToday: task.matrixTouched ? task.mustDoToday : true,
          matrixTouched: Boolean(task.matrixTouched),
        };
      });

      if (changed) {
        record.data = {
          ...record.data,
          tasks: nextTasks,
        };
      }
    });

    for (const record of workingRecords) {
      const nextTasks = Array.isArray(record.data?.tasks)
        ? record.data.tasks
        : [];
      const originalTasks = originalByDate.get(record.date) || "[]";

      if (JSON.stringify(nextTasks) === originalTasks) continue;

      const { error } = await supabase.from("daily_records").upsert(
        {
          user_id: userId,
          date: record.date,
          data: {
            ...record.data,
            tasks: nextTasks,
          },
        },
        { onConflict: "user_id,date" },
      );

      if (error) {
        console.error("Erro ao sincronizar provas como tarefas:", error);
      }
    }

    setRecords(workingRecords);
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

  async function addProof() {
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
    await persist(nextPlan);
    await syncProofsToTasks(nextProofs);
  }

  async function toggleProof(id: string) {
    const nextProofs = proofs.map((p) =>
      p.id === id ? { ...p, checked: !p.checked } : p,
    );

    const nextPlan = {
      ...plan,
      proofs: stringifyProofs(nextProofs),
    };

    setProofs(nextProofs);
    setPlan(nextPlan);
    await persist(nextPlan);
    await syncProofsToTasks(nextProofs);
  }

  async function deleteProof(id: string) {
    const nextProofs = proofs.filter((p) => p.id !== id);

    const nextPlan = {
      ...plan,
      proofs: stringifyProofs(nextProofs),
    };

    setProofs(nextProofs);
    setPlan(nextPlan);
    await persist(nextPlan);
    await syncProofsToTasks(nextProofs);
  }

  async function updateProofText(id: string, text: string) {
    const cleanText = text.trim();

    if (!cleanText) return;

    const nextProofs = proofs.map((proof) =>
      proof.id === id
        ? {
            ...proof,
            text: cleanText,
          }
        : proof,
    );

    const nextPlan = {
      ...plan,
      proofs: stringifyProofs(nextProofs),
    };

    setProofs(nextProofs);
    setPlan(nextPlan);
    await persist(nextPlan);
    await syncProofsToTasks(nextProofs);
  }

  function addSupportHabit() {
    if (!newSupportHabit.trim()) return;

    const current = parseLines(plan.supportHabits || "");
    const nextList = [...current, newSupportHabit.trim()];

    updateField("supportHabits", stringifyLines(nextList));
    setNewSupportHabit("");
  }

  function deleteSupportHabit(index: number) {
    const current = parseLines(plan.supportHabits || "");
    const nextList = current.filter((_, i) => i !== index);

    updateField("supportHabits", stringifyLines(nextList));
  }

  const review = plan.review || EMPTY_WEEKLY_REVIEW;
  const previousDecisionLabel = getDecisionLabel(previousDecision);
  const previousGuidance = getPreviousDecisionGuidance(previousDecision);
  const directionGuidance = getDirectionGuidance(previousDecision);
  const proofGuidance = getProofGuidance(previousDecision);
  const riskGuidance = getRiskGuidance(previousDecision);
  const preventionGuidance = getPreventionGuidance(previousDecision);
  const habitsList = parseLines(plan.supportHabits || "");
  const hasYearContext = Boolean(
    String(yearContext?.dreamMap || "").trim() ||
      String(yearContext?.buildNextYear || "").trim() ||
      String(yearContext?.liveNextYear || "").trim() ||
      String(yearContext?.conquerNextYear || "").trim(),
  );

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

          {hasYearContext && (
            <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
              <h2 className="font-serif text-lg">Contexto do Ano</h2>

              {String(yearContext?.dreamMap || "").trim() && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-primary/70">
                    Mapa dos Sonhos
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {yearContext.dreamMap}
                  </p>
                </div>
              )}

              {String(yearContext?.buildNextYear || "").trim() && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-primary/70">
                    O que quero construir
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {yearContext.buildNextYear}
                  </p>
                </div>
              )}

              {String(yearContext?.liveNextYear || "").trim() && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-primary/70">
                    O que quero viver
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {yearContext.liveNextYear}
                  </p>
                </div>
              )}

              {String(yearContext?.conquerNextYear || "").trim() && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-primary/70">
                    O que quero conquistar
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {yearContext.conquerNextYear}
                  </p>
                </div>
              )}
            </section>
          )}

          {monthlyContext && (
            <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
              <h2 className="font-serif text-lg">Contexto do Mês</h2>

              {monthlyContext.virtue && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-primary/70">
                    Virtude
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {monthlyContext.virtue}
                  </p>
                </div>
              )}

              {monthlyContext.mainGoal && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-primary/70">
                    Objetivo
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {monthlyContext.mainGoal}
                  </p>
                </div>
              )}

              {monthlyContext.mainRisk && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-primary/70">
                    Risco
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {monthlyContext.mainRisk}
                  </p>
                </div>
              )}
            </section>
          )}

          {(previousImprovement || previousDecisionLabel) && (
            <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-primary/70">
                Continuidade da semana anterior
              </p>

              {previousImprovement && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Baseado na última semana:
                  </p>

                  <p className="text-sm text-foreground leading-relaxed">
                    {previousImprovement}
                  </p>
                </div>
              )}

              {previousDecisionLabel && (
                <p className="text-sm text-foreground">
                  Última decisão:{" "}
                  <span className="font-medium">{previousDecisionLabel}</span>
                </p>
              )}

              {previousGuidance && (
                <p className="text-sm text-foreground leading-relaxed">
                  {previousGuidance}
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Use isso como contexto para definir direção, forma de agir,
                riscos e prevenção — sem copiar automaticamente.
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

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <h2 className="font-serif text-lg">Forma de agir da semana</h2>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Que forma de agir precisa sustentar esta semana?
            </p>

            <p className="text-[11px] text-muted-foreground">
              Isso será usado na Noite e no Fechamento como lente de reflexão.
            </p>

            <div className="flex gap-2">
              <Input
                value={newSupportHabit}
                onChange={(e) => setNewSupportHabit(e.target.value)}
                placeholder="Adicionar uma forma de agir"
                className="bg-background"
              />

              <button
                type="button"
                onClick={addSupportHabit}
                className="w-11 rounded-xl border border-border/40 bg-background flex items-center justify-center"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {habitsList.length > 0 && (
              <div className="space-y-2">
                {habitsList.map((habit, index) => (
                  <div
                    key={`${habit}-${index}`}
                    className="flex items-center gap-3 rounded-xl border border-border/40 bg-background px-3 py-2"
                  >
                    <p className="flex-1 text-sm">{habit}</p>

                    <button
                      type="button"
                      onClick={() => deleteSupportHabit(index)}
                      className="text-muted-foreground"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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

                  <Input
                    value={proof.text}
                    onChange={(e) => {
                      const value = e.target.value;

                      setProofs((current) =>
                        current.map((item) =>
                          item.id === proof.id
                            ? { ...item, text: value }
                            : item,
                        ),
                      );
                    }}
                    onBlur={(e) => updateProofText(proof.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                    className="flex-1 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
                  />

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

                  <div className="rounded-xl border border-border/40 bg-background p-3 space-y-3">
                    <p className="text-[10px] uppercase tracking-widest text-primary/70">
                      Leitura da execução
                    </p>

                    <div className="grid grid-cols-1 gap-1 text-sm text-muted-foreground">
                      <p>Tarefas alinhadas: {summary.importantTasks}</p>
                      <p>
                        Tarefas alinhadas concluídas:{" "}
                        {summary.completedImportantTasks}
                      </p>
                      <p>
                        Tarefas alinhadas pendentes:{" "}
                        {summary.unfinishedImportantTasks}
                      </p>
                      <p>
                        Urgências não concluídas:{" "}
                        {summary.unfinishedUrgentTasks}
                      </p>
                    </div>

                    <div className="space-y-1 text-sm text-foreground leading-relaxed">
                      {summary.importantTasks === 0 && (
                        <p>Nenhuma tarefa alinhada à semana foi registrada.</p>
                      )}

                      {summary.completedImportantTasks > 0 && (
                        <p>A execução sustentou parte da direção semanal.</p>
                      )}

                      {summary.unfinishedImportantTasks > 0 && (
                        <p>Parte do que era importante ficou sem execução.</p>
                      )}

                      {summary.unfinishedUrgentTasks > 0 && (
                        <p>
                          Existiram urgências não concluídas ao longo da semana.
                        </p>
                      )}

                      {summary.completedImportantTasks ===
                        summary.importantTasks &&
                        summary.importantTasks > 0 && (
                          <p>
                            As tarefas alinhadas à direção da semana foram
                            concluídas.
                          </p>
                        )}
                    </div>
                  </div>

                  {habitsList.length > 0 && (
                    <div className="rounded-xl border border-border/40 bg-background px-3 py-3 space-y-2">
                      <p className="text-[10px] uppercase tracking-widest text-primary/70">
                        Forma de agir da semana
                      </p>

                      <div className="space-y-1">
                        {habitsList.map((habit, index) => (
                          <p
                            key={`${habit}-${index}`}
                            className="text-sm text-foreground"
                          >
                            • {habit}
                          </p>
                        ))}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Isso apareceu no seu comportamento ao longo da semana?
                      </p>
                    </div>
                  )}

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

                  <div className="rounded-xl border border-border/40 bg-background p-3 space-y-2">
                    <p className="text-[10px] uppercase tracking-widest text-primary/70">
                      Leitura das relações
                    </p>

                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {peopleAnalysis.interpretation}
                    </p>

                    {peopleAnalysis.helpers.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Relações que ajudaram
                        </p>

                        {peopleAnalysis.helpers.map((name, index) => (
                          <p key={`${name}-${index}`} className="text-sm">
                            • {name}
                          </p>
                        ))}
                      </div>
                    )}

                    {peopleAnalysis.drainers.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Relações que drenaram
                        </p>

                        {peopleAnalysis.drainers.map((name, index) => (
                          <p key={`${name}-${index}`} className="text-sm">
                            • {name}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

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
