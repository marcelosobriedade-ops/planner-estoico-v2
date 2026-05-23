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
  getWeekEnd,
  loadWeeklyPlan,
  saveWeeklyPlan,
} from "@/lib/weekly-plan";

type EmotionState = {
  emotion: string;
  note: string;
};

type EmotionsData = {
  morning: EmotionState;
  afternoon: EmotionState;
  evening: EmotionState;
};

type DailyData = {
  morning?: MorningRitual;
  evening?: {
    bridgeToTomorrow?: string;
    tomorrowIntent?: string;
    [key: string]: unknown;
  };
  emotions?: EmotionsData;
  tasks?: any[];
  [key: string]: unknown;
};

type Proof = {
  id: string;
  text: string;
  checked: boolean;
};

const FEELINGS = [
  { value: "muito mal", emoji: "😵", label: "Muito mal" },
  { value: "mal", emoji: "🙁", label: "Mal" },
  { value: "ok", emoji: "😐", label: "Ok" },
  { value: "bem", emoji: "🙂", label: "Bem" },
  { value: "muito bem", emoji: "😄", label: "Muito bem" },
];

function go(path: string) {
  window.location.assign(path);
}

function getPreviousDateKey(date: string) {
  const previous = new Date(`${date}T12:00:00`);
  previous.setDate(previous.getDate() - 1);
  return previous.toISOString().slice(0, 10);
}

function parseProofs(raw: string): Proof[] {
  if (!raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id:
            typeof item.id === "string" && item.id.trim()
              ? item.id
              : crypto.randomUUID(),
          text: typeof item.text === "string" ? item.text : "",
          checked: Boolean(item.checked),
        }))
        .filter((item) => item.text.trim());
    }
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

function normalizeEmotions(value: unknown): EmotionsData {
  const data =
    value && typeof value === "object" ? (value as Partial<EmotionsData>) : {};

  return {
    morning: {
      emotion: data.morning?.emotion || "",
      note: data.morning?.note || "",
    },
    afternoon: {
      emotion: data.afternoon?.emotion || "",
      note: data.afternoon?.note || "",
    },
    evening: {
      emotion: data.evening?.emotion || "",
      note: data.evening?.note || "",
    },
  };
}

export default function Morning() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [ritual, setRitual] = useState<MorningRitual>(EMPTY_MORNING_RITUAL);
  const [dailyData, setDailyData] = useState<DailyData>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState("");
  const [weeklyPlan, setWeeklyPlan] =
    useState<WeeklyPlanData>(EMPTY_WEEKLY_PLAN);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [previousNightBridge, setPreviousNightBridge] = useState("");

  const [showFeelingNote, setShowFeelingNote] = useState(false);
  const [showPriorities, setShowPriorities] = useState(false);
  const [showWeekCard, setShowWeekCard] = useState(true);

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
      const loadedMorning = {
        ...EMPTY_MORNING_RITUAL,
        ...(loadedData.morning || {}),
      };

      const loadedEmotions = normalizeEmotions(loadedData.emotions);

      const syncedMorning: MorningRitual = {
        ...loadedMorning,
        feeling: loadedMorning.feeling || loadedEmotions.morning.emotion,
        control: loadedMorning.control || loadedEmotions.morning.note,
      };

      setDailyData({
        ...loadedData,
        emotions: loadedEmotions,
      });

      setRitual(syncedMorning);

      const previousDateKey = getPreviousDateKey(dateKey);

      const { data: previousRecord, error: previousError } = await supabase
        .from("daily_records")
        .select("data")
        .eq("user_id", session.user.id)
        .eq("date", previousDateKey)
        .maybeSingle();

      if (previousError) {
        console.error(
          "Erro ao carregar ponte da noite anterior:",
          previousError,
        );
        setPreviousNightBridge("");
      } else {
        const previousData = (previousRecord?.data || {}) as DailyData;
        const bridge =
          previousData.evening?.bridgeToTomorrow ||
          previousData.evening?.tomorrowIntent ||
          "";

        setPreviousNightBridge(String(bridge || "").trim());
      }

      const weekly = await loadWeeklyPlan(dateKey);
      setWeekStart(weekly.weekStart);
      setWeeklyPlan(weekly.plan);

      const parsedProofs = parseProofs(weekly.plan.proofs);
      setProofs(parsedProofs);

      await syncMorningPrioritiesAsTasks(syncedMorning.priorities);
    }

    loadMorning();
  }, [dateKey]);

  async function getLatestDailyData(currentUserId: string): Promise<DailyData> {
    const { data, error } = await supabase
      .from("daily_records")
      .select("data")
      .eq("user_id", currentUserId)
      .eq("date", dateKey)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar registro mais recente da manhã:", error);
      return dailyData;
    }

    return (data?.data || {}) as DailyData;
  }

  async function saveMorning(updatedRitual: MorningRitual) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    const currentUserId = session.user.id;
    setUserId(currentUserId);

    const latestData = await getLatestDailyData(currentUserId);
    const currentEmotions = normalizeEmotions(latestData.emotions);

    const nextEmotions: EmotionsData = {
      ...currentEmotions,
      morning: {
        ...currentEmotions.morning,
        emotion: updatedRitual.feeling || "",
        note: updatedRitual.control || "",
      },
    };

    const nextData: DailyData = {
      ...latestData,
      morning: updatedRitual,
      emotions: nextEmotions,
    };

    setRitual(updatedRitual);
    setDailyData(nextData);

    const { error } = await supabase.from("daily_records").upsert(
      {
        user_id: currentUserId,
        date: dateKey,
        data: nextData,
      },
      { onConflict: "user_id,date" },
    );

    if (error) {
      console.error("Erro ao salvar manhã:", error);
      return;
    }

    await syncMorningPrioritiesAsTasks(updatedRitual.priorities);
  }

  async function syncMorningPrioritiesAsTasks(priorities: string[]) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    const currentUserId = session.user.id;
    const latestData = await getLatestDailyData(currentUserId);

    const currentTasks = Array.isArray(latestData.tasks)
      ? latestData.tasks
      : [];

    const cleanedPriorities = priorities.map((item) =>
      String(item || "").trim(),
    );

    let nextTasks = [...currentTasks];

    cleanedPriorities.forEach((priority, index) => {
      const existingIndex = nextTasks.findIndex(
        (task: any) =>
          task?.source === "morning-priority" &&
          task?.morningPriorityIndex === index,
      );

      if (!priority) {
        if (existingIndex >= 0) {
          nextTasks = nextTasks.map((task: any, taskIndex: number) =>
            taskIndex === existingIndex
              ? {
                  ...task,
                  status: "cancelled",
                }
              : task,
          );
        }

        return;
      }

      if (existingIndex >= 0) {
        nextTasks = nextTasks.map((task: any, taskIndex: number) =>
          taskIndex === existingIndex
            ? {
                ...task,
                title: priority,
                category: "prioridade",
                mustDoToday: true,
                alignedToWeek: true,
                source: "morning-priority",
                morningPriorityIndex: index,
                details: task.details || "Prioridade definida na Manhã.",
                subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
                status:
                  task.status === "cancelled" ? "todo" : task.status || "todo",
                date: task.date || dateKey,
              }
            : task,
        );

        return;
      }

      nextTasks.push({
        id: crypto.randomUUID(),
        title: priority,
        category: "prioridade",
        status: "todo",
        date: dateKey,
        mustDoToday: true,
        alignedToWeek: true,
        source: "morning-priority",
        morningPriorityIndex: index,
        details: "Prioridade definida na Manhã.",
        subtasks: [],
      });
    });

    const nextData = {
      ...latestData,
      tasks: nextTasks,
    };

    setDailyData(nextData);

    const { error } = await supabase.from("daily_records").upsert(
      {
        user_id: currentUserId,
        date: dateKey,
        data: nextData,
      },
      { onConflict: "user_id,date" },
    );

    if (error) {
      console.error("Erro ao sincronizar prioridades como tarefas:", error);
    }
  }

  async function loadWeekDailyRecords(currentUserId: string) {
    if (!weekStart) return [];

    const { data, error } = await supabase
      .from("daily_records")
      .select("date, data")
      .eq("user_id", currentUserId)
      .gte("date", weekStart)
      .lte("date", getWeekEnd(weekStart))
      .order("date", { ascending: true });

    if (error) {
      console.error("Erro ao carregar registros da semana na manhã:", error);
      return [];
    }

    return (data || []) as { date: string; data: DailyData }[];
  }

  async function updateLinkedProofTaskStatus(
    proofId: string,
    checked: boolean,
  ) {
    if (!userId || !weekStart) return;

    const weekRecords = await loadWeekDailyRecords(userId);

    for (const record of weekRecords) {
      const currentTasks = Array.isArray(record.data?.tasks)
        ? record.data.tasks
        : [];

      let changed = false;

      const nextTasks = currentTasks.map((task: any) => {
        if (task?.weeklyProofId !== proofId) return task;

        changed = true;

        return {
          ...task,
          status: checked ? "done" : "todo",
          source: "weekly-proof",
          weeklyProofId: proofId,
          category: "semana",
          alignedToWeek: true,
          mustDoToday: true,
        };
      });

      if (!changed) continue;

      const nextData: DailyData = {
        ...(record.data || {}),
        tasks: nextTasks,
      };

      if (record.date === dateKey) {
        setDailyData(nextData);
      }

      const { error } = await supabase.from("daily_records").upsert(
        {
          user_id: userId,
          date: record.date,
          data: nextData,
        },
        { onConflict: "user_id,date" },
      );

      if (error) {
        console.error("Erro ao atualizar tarefa vinculada à prova:", error);
      }
    }
  }

  async function toggleProof(id: string) {
    if (!userId || !weekStart) return;

    const nextProofs = proofs.map((proof) =>
      proof.id === id ? { ...proof, checked: !proof.checked } : proof,
    );

    const changedProof = nextProofs.find((proof) => proof.id === id);

    const nextPlan: WeeklyPlanData = {
      ...weeklyPlan,
      proofs: stringifyProofs(nextProofs),
    };

    setProofs(nextProofs);
    setWeeklyPlan(nextPlan);

    await saveWeeklyPlan(userId, weekStart, nextPlan);

    if (changedProof) {
      await updateLinkedProofTaskStatus(id, changedProof.checked);
    }
  }

  function proofTaskAlreadyExists(proofId: string) {
    const currentTasks = Array.isArray(dailyData.tasks) ? dailyData.tasks : [];

    return currentTasks.some((task: any) => task?.weeklyProofId === proofId);
  }

  function taskAlreadyExists(title: string) {
    const cleanTitle = title.trim();
    if (!cleanTitle) return false;

    const currentTasks = Array.isArray(dailyData.tasks) ? dailyData.tasks : [];

    return currentTasks.some((task: any) => {
      const taskTitle = String(task.title || task.text || "").trim();
      return taskTitle === cleanTitle;
    });
  }

  function setField<K extends keyof MorningRitual>(
    key: K,
    value: MorningRitual[K],
  ) {
    setRitual((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function setFieldAndSave<K extends keyof MorningRitual>(
    key: K,
    value: MorningRitual[K],
  ) {
    const next = {
      ...ritual,
      [key]: value,
    };

    setRitual(next);
    saveMorning(next);
  }

  function setPriority(index: number, value: string) {
    setRitual((current) => {
      const nextPriorities = [...current.priorities] as [
        string,
        string,
        string,
      ];
      nextPriorities[index] = value;

      return {
        ...current,
        priorities: nextPriorities,
      };
    });
  }

  function saveCurrentMorning() {
    saveMorning(ritual);
  }

  const prioritiesDone = ritual.priorities.filter((p) => p.trim()).length;
  const pendingProofs = proofs.filter((proof) => !proof.checked).length;

  const hasWeeklyPlan =
    weeklyPlan.change.trim() ||
    weeklyPlan.risks.trim() ||
    weeklyPlan.prevention.trim() ||
    proofs.length > 0;

  const formatDate = new Date(dateKey + "T00:00:00").toLocaleDateString(
    "pt-BR",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
    },
  );

  return (
    <Layout>
      <Header title="" />

      <div className="flex-1 overflow-y-auto bg-background px-5 py-6 pb-12">
        <div className="mx-auto max-w-md space-y-7">
          <div className="text-center space-y-1">
            <h1 className="font-serif text-3xl text-foreground">Manhã</h1>

            <p className="text-xs text-muted-foreground">{formatDate}</p>

            <p className="pt-3 font-serif italic text-sm text-muted-foreground leading-relaxed">
              "Que o teu princípio seja este: agir como um estóico."
            </p>
          </div>

          {previousNightBridge && (
            <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-2">
              <SectionLabel>Ontem à noite você escreveu:</SectionLabel>

              <p className="text-sm leading-relaxed text-foreground break-words">
                {previousNightBridge}
              </p>

              <p className="text-[11px] text-muted-foreground">
                Use isso como referência. A manhã apenas lê essa intenção.
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-border/40 bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setShowWeekCard(!showWeekCard)}
              className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CalendarDays className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <SectionLabel>Semana dentro do dia</SectionLabel>

                  <p className="mt-2 font-serif text-xl leading-snug break-words">
                    {weeklyPlan.change.trim()
                      ? weeklyPlan.change
                      : "Nenhuma direção da semana definida ainda."}
                  </p>

                  {hasWeeklyPlan && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Use a direção da semana para escolher o primeiro passo
                      possível de hoje.
                    </p>
                  )}

                  {proofs.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {pendingProofs} de {proofs.length} prova
                      {proofs.length === 1 ? "" : "s"} pendente
                      {pendingProofs === 1 ? "" : "s"}.
                    </p>
                  )}
                </div>
              </div>

              {showWeekCard ? (
                <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>

            {showWeekCard && (
              <div className="space-y-4 border-t border-border/30 px-4 pb-4 pt-3">
                {weeklyPlan.risks.trim() && (
                  <div className="rounded-xl border border-border/40 bg-background px-4 py-3">
                    <SectionLabel>Risco da semana</SectionLabel>
                    <p className="mt-2 text-sm text-muted-foreground break-words">
                      {weeklyPlan.risks}
                    </p>
                  </div>
                )}

                {weeklyPlan.prevention.trim() && (
                  <div className="rounded-xl border border-border/40 bg-background px-4 py-3">
                    <SectionLabel>Resposta planejada</SectionLabel>
                    <p className="mt-2 text-sm text-muted-foreground break-words">
                      {weeklyPlan.prevention}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <SectionLabel>Provas da semana</SectionLabel>

                  {proofs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Defina as provas da semana no Plano Semanal.
                    </p>
                  ) : (
                    proofs.map((proof) => {
                      return (
                        <div
                          key={proof.id}
                          className={cn(
                            "rounded-xl border px-4 py-3 transition-all",
                            proof.checked
                              ? "border-primary/40 bg-primary/10"
                              : "border-border/40 bg-background",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => toggleProof(proof.id)}
                              className={cn(
                                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
                                proof.checked
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-primary/40 text-primary",
                              )}
                              aria-label={
                                proof.checked
                                  ? "Desmarcar prova da semana"
                                  : "Marcar prova da semana"
                              }
                            >
                              {proof.checked && (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p
                                  className={cn(
                                    "text-sm font-medium break-words",
                                    proof.checked &&
                                      "text-muted-foreground line-through",
                                  )}
                                >
                                  {proof.text}
                                </p>

                                {proof.checked && (
                                  <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                    Concluída
                                  </span>
                                )}
                              </div>

                              <p
                                className={cn(
                                  "mt-1 text-xs",
                                  proof.checked
                                    ? "text-primary"
                                    : "text-muted-foreground",
                                )}
                              >
                                {proof.checked
                                  ? "Você está no rumo certo."
                                  : "Use isso como referência para orientar o dia."}
                              </p>

                              <span className="mt-3 inline-flex rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] text-primary/70">
                                Tarefa da semana
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-4">
            <SectionLabel>Como estou me sentindo?</SectionLabel>

            <div className="grid grid-cols-5 gap-2">
              {FEELINGS.map((f) => {
                const selected = ritual.feeling === f.value;

                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() =>
                      setFieldAndSave("feeling", selected ? "" : f.value)
                    }
                    className={cn(
                      "rounded-xl border px-2 py-3 text-center transition-all",
                      selected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/40 bg-background",
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
              className="flex w-full items-center justify-between rounded-xl border border-border/40 bg-background px-4 py-3 text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
            >
              Registrar algo sobre isso?
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
                onBlur={saveCurrentMorning}
                placeholder="O que preciso reconhecer sobre meu estado agora?"
                className="min-h-[90px] resize-none rounded-xl border-border/40 bg-background"
              />
            )}

            <button
              type="button"
              onClick={() => go("/emocoes")}
              className="w-full text-center text-[11px] text-muted-foreground underline-offset-4 hover:underline"
            >
              Ver acompanhamento emocional do dia
            </button>
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
                {([0, 1, 2] as const).map((i) => {
                  const priority = ritual.priorities[i];
                  const alreadyTask = taskAlreadyExists(priority);

                  return (
                    <div key={i} className="space-y-2">
                      <Textarea
                        value={priority}
                        onChange={(e) => setPriority(i, e.target.value)}
                        onBlur={saveCurrentMorning}
                        placeholder={`Prioridade ${i + 1}`}
                        className="min-h-[58px] resize-none rounded-xl border-border/40 bg-background"
                      />

                      {priority.trim() && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] text-primary/70">
                            🎯 Prioridade do dia
                          </span>

                          {alreadyTask && (
                            <span className="inline-flex items-center rounded-full border border-border/40 bg-muted/20 px-3 py-1 text-[11px] text-muted-foreground">
                              Na trilha
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <MorningQuestion
            label="Qual é o primeiro passo possível hoje?"
            value={ritual.actions}
            onChange={(value) => setField("actions", value)}
            onBlur={saveCurrentMorning}
            placeholder="Qual é a ação mais simples e concreta para começar?"
          />

          <MorningQuestion
            label="O que surgiu hoje?"
            value={ritual.challenges}
            onChange={(value) => setField("challenges", value)}
            onBlur={saveCurrentMorning}
            placeholder="Que risco, situação ou mudança apareceu hoje e precisa ser considerada?"
          />

          <MorningQuestion
            label="Como quero responder hoje?"
            value={ritual.virtueOfDay}
            onChange={(value) => setField("virtueOfDay", value)}
            onBlur={saveCurrentMorning}
            placeholder="Qual resposta concreta faz sentido para o dia de hoje?"
          />
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
  onBlur,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  placeholder: string;
}) {
  return (
    <section className="space-y-2">
      <SectionLabel>{label}</SectionLabel>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="min-h-[86px] resize-none rounded-xl border-border/40 bg-card"
      />
    </section>
  );
}
