import React, { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { loadWeeklyPlan, saveWeeklyPlan } from "@/lib/weekly-plan";

type EmotionState = {
  emotion: string;
  note: string;
};

type EmotionsData = {
  morning: EmotionState;
  afternoon: EmotionState;
  evening: EmotionState;
};

type FinancialReflection = {
  reviewed: boolean;
  note: string;
};

type NightData = {
  approach: string;
  away: string;
  wins: string;
  ending: string;
  assessment?: string;
  tomorrowIntent?: string;
  bridgeToTomorrow?: string;
  financialReflection?: FinancialReflection;
};

type DailyTask = {
  id?: string;
  title?: string;
  text?: string;
  label?: string;
  status?: string;
  done?: boolean;
  completed?: boolean;
  discarded?: boolean;
  broughtToToday?: boolean;
  weeklyProofId?: string;
  date?: string;
  [key: string]: unknown;
};

type DailyData = {
  evening?: NightData;
  emotions?: Partial<EmotionsData>;
  people?: any[];
  financial?: any[];
  tasks?: DailyTask[];
  [key: string]: unknown;
};

const EMPTY_EMOTIONS: EmotionsData = {
  morning: { emotion: "", note: "" },
  afternoon: { emotion: "", note: "" },
  evening: { emotion: "", note: "" },
};

const EMPTY_FINANCIAL_REFLECTION: FinancialReflection = {
  reviewed: false,
  note: "",
};

const EMPTY_NIGHT: NightData = {
  approach: "",
  away: "",
  wins: "",
  ending: "",
  assessment: "",
  tomorrowIntent: "",
  bridgeToTomorrow: "",
  financialReflection: EMPTY_FINANCIAL_REFLECTION,
};

const FEELINGS = [
  { value: "alegria", emoji: "🌞", label: "Alegria" },
  { value: "amor", emoji: "🤍", label: "Amor" },
  { value: "medo", emoji: "🌫️", label: "Medo" },
  { value: "tristeza", emoji: "🌧️", label: "Tristeza" },
  { value: "raiva", emoji: "🔥", label: "Raiva" },
  { value: "nojo", emoji: "🪨", label: "Nojo" },
  { value: "surpresa", emoji: "⚡", label: "Surpresa" },
  { value: "confusão", emoji: "🌀", label: "Confusão" },
];

const ASSESSMENT_OPTIONS = [
  { value: "bem", label: "Agi bem" },
  { value: "parcial", label: "Parcialmente" },
  { value: "falhei", label: "Falhei claramente" },
];

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

function normalizeFinancialReflection(value: unknown): FinancialReflection {
  const data =
    value && typeof value === "object"
      ? (value as Partial<FinancialReflection>)
      : {};

  return {
    reviewed: Boolean(data.reviewed),
    note: data.note || "",
  };
}

function parseProofs(raw: unknown) {
  const text = typeof raw === "string" ? raw : "";

  if (!text.trim()) return [];

  try {
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && typeof item === "object");
    }
  } catch {}

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      id: crypto.randomUUID(),
      text: line,
      checked: false,
    }));
}

function stringifyProofs(proofs: unknown[]) {
  return JSON.stringify(proofs);
}

function getTaskTitle(task: DailyTask): string {
  return task.title || task.text || task.label || "Tarefa sem título";
}

function getTaskStatus(task: DailyTask): string {
  if (task.done || task.completed || task.status === "done") {
    return "Feita";
  }

  if (
    task.discarded ||
    task.status === "discarded" ||
    task.status === "cancelled"
  ) {
    return "Descartada";
  }

  if (task.broughtToToday || task.status === "today") {
    return "Trazida para hoje";
  }

  return "Pendente";
}

function applyMorningPriorityCancellationSync(
  data: DailyData,
  taskToSync?: DailyTask | null,
): DailyData {
  if (
    taskToSync?.source !== "morning-priority" ||
    typeof taskToSync.morningPriorityIndex !== "number" ||
    taskToSync.status !== "cancelled"
  ) {
    return data;
  }

  const currentPriorities = Array.isArray(data.morning?.priorities)
    ? [...data.morning.priorities]
    : ["", "", ""];

  currentPriorities[taskToSync.morningPriorityIndex] = "";

  return {
    ...data,
    morning: {
      ...(data.morning || {}),
      priorities: currentPriorities,
    },
  };
}

export default function Evening() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [data, setData] = useState<NightData>(EMPTY_NIGHT);
  const [dailyData, setDailyData] = useState<DailyData>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [weeklyChange, setWeeklyChange] = useState("");
  const [weeklyHabits, setWeeklyHabits] = useState("");
  const [assessment, setAssessment] = useState("");
  const [tomorrowIntent, setTomorrowIntent] = useState("");
  const [eveningEmotion, setEveningEmotion] = useState("");
  const [eveningNote, setEveningNote] = useState("");
  const [tasksOpen, setTasksOpen] = useState(false);

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
      const loadedEmotions = normalizeEmotions(loaded.emotions);
      const loadedFinancialReflection = normalizeFinancialReflection(
        loaded.evening?.financialReflection,
      );

      setDailyData({
        ...loaded,
        emotions: loadedEmotions,
      });

      setData({
        approach: loaded.evening?.approach || "",
        away: loaded.evening?.away || "",
        wins: loaded.evening?.wins || "",
        ending: loaded.evening?.ending || "",
        assessment: loaded.evening?.assessment || "",
        tomorrowIntent:
          loaded.evening?.bridgeToTomorrow ||
          loaded.evening?.tomorrowIntent ||
          "",
        bridgeToTomorrow:
          loaded.evening?.bridgeToTomorrow ||
          loaded.evening?.tomorrowIntent ||
          "",
        financialReflection: loadedFinancialReflection,
      });

      setAssessment(loaded.evening?.assessment || "");
      setTomorrowIntent(
        loaded.evening?.bridgeToTomorrow ||
          loaded.evening?.tomorrowIntent ||
          "",
      );
      setEveningEmotion(loadedEmotions.evening.emotion || "");
      setEveningNote(loadedEmotions.evening.note || "");

      const weekly = await loadWeeklyPlan(dateKey);
      setWeeklyChange(weekly.plan.change || "");
      setWeeklyHabits(weekly.plan.supportHabits || "");
    }

    load();
  }, [dateKey]);

  function setField(key: keyof NightData, value: string) {
    setData((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function setFinancialReflectionField(
    key: keyof FinancialReflection,
    value: boolean | string,
  ) {
    setData((current) => ({
      ...current,
      financialReflection: {
        ...normalizeFinancialReflection(current.financialReflection),
        [key]: value,
      },
    }));
  }

  async function getLatestDailyData(currentUserId: string): Promise<DailyData> {
    const { data, error } = await supabase
      .from("daily_records")
      .select("data")
      .eq("user_id", currentUserId)
      .eq("date", dateKey)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar registro mais recente da noite:", error);
      return dailyData;
    }

    return (data?.data || {}) as DailyData;
  }

  async function save(updated: NightData) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    const currentUserId = session.user.id;
    setUserId(currentUserId);

    const latestData = await getLatestDailyData(currentUserId);

    const bridgeValue =
      updated.bridgeToTomorrow ??
      updated.tomorrowIntent ??
      tomorrowIntent ??
      "";

    const financialReflection = normalizeFinancialReflection(
      updated.financialReflection,
    );

    const nextEvening: NightData = {
      ...(latestData.evening || EMPTY_NIGHT),
      approach: updated.approach || "",
      away: updated.away || "",
      wins: updated.wins || "",
      ending: updated.ending || "",
      assessment: updated.assessment ?? assessment,
      tomorrowIntent: bridgeValue,
      bridgeToTomorrow: bridgeValue,
      financialReflection: {
        reviewed: financialReflection.reviewed,
        note: financialReflection.reviewed ? financialReflection.note : "",
      },
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

  async function saveEveningEmotion(
    emotion: string,
    note: string = eveningNote,
  ) {
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
      evening: {
        emotion,
        note,
      },
    };

    const nextData: DailyData = {
      ...latestData,
      emotions: nextEmotions,
    };

    setDailyData(nextData);
    setEveningEmotion(emotion);
    setEveningNote(note);

    const { error } = await supabase.from("daily_records").upsert(
      {
        user_id: currentUserId,
        date: dateKey,
        data: nextData,
      },
      { onConflict: "user_id,date" },
    );

    if (error) {
      console.error("Erro ao salvar emoção da noite:", error);
    }
  }

  async function removeWeeklyProofFromPlan(taskToRemove: DailyTask) {
    const proofId =
      typeof taskToRemove.weeklyProofId === "string"
        ? taskToRemove.weeklyProofId
        : "";

    if (!proofId) return;

    const taskDateKey =
      typeof taskToRemove.date === "string" && taskToRemove.date.trim()
        ? taskToRemove.date
        : dateKey;

    try {
      const weekly = await loadWeeklyPlan(taskDateKey);
      const currentProofs = parseProofs(weekly.plan.proofs);
      const nextProofs = currentProofs.filter(
        (proof: any) => proof?.id !== proofId,
      );

      if (nextProofs.length === currentProofs.length) return;

      await saveWeeklyPlan(weekly.userId, weekly.weekStart, {
        ...weekly.plan,
        proofs: stringifyProofs(nextProofs),
      });
    } catch (error) {
      console.error("Erro ao remover prova semanal pela noite:", error);
    }
  }

  async function updateTaskStatus(
    taskToUpdate: DailyTask,
    taskIndex: number,
    status: string,
  ) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    const currentUserId = session.user.id;
    setUserId(currentUserId);

    const latestData = await getLatestDailyData(currentUserId);
    const currentTasks = Array.isArray(latestData.tasks)
      ? latestData.tasks
      : [];

    let updatedTask: DailyTask | null = null;

    const nextTasks = currentTasks.map((task, index) => {
      const sameTask =
        taskToUpdate.id && task.id
          ? task.id === taskToUpdate.id
          : index === taskIndex;

      if (!sameTask) return task;

      updatedTask = {
        ...task,
        status,
        discarded: status === "cancelled" ? true : task.discarded,
        done:
          status === "done" ? true : status === "cancelled" ? false : task.done,
        completed:
          status === "done"
            ? true
            : status === "cancelled"
              ? false
              : task.completed,
      };

      return updatedTask;
    });

    const nextData: DailyData = applyMorningPriorityCancellationSync(
      {
        ...latestData,
        tasks: nextTasks,
      },
      updatedTask,
    );

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
      console.error("Erro ao atualizar status da tarefa na noite:", error);
      return;
    }

    if (status === "cancelled" && updatedTask?.weeklyProofId) {
      await removeWeeklyProofFromPlan(updatedTask);
    }
  }

  function discardTask(task: DailyTask, taskIndex: number) {
    void updateTaskStatus(task, taskIndex, "cancelled");
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

  function handleFinancialReviewedClick(reviewed: boolean) {
    const currentReflection = normalizeFinancialReflection(
      data.financialReflection,
    );

    const nextReflection: FinancialReflection = {
      reviewed,
      note: reviewed ? currentReflection.note : "",
    };

    setData((current) => ({
      ...current,
      financialReflection: nextReflection,
    }));

    save({
      ...data,
      financialReflection: nextReflection,
      assessment,
      tomorrowIntent,
    });
  }

  const emotions = normalizeEmotions(dailyData.emotions);
  const afternoonEmotion = emotions.afternoon.emotion;
  const afternoonNote = emotions.afternoon.note;

  const financialReflection = normalizeFinancialReflection(
    data.financialReflection,
  );

  const isAfternoonLow =
    afternoonEmotion === "muito mal" || afternoonEmotion === "mal";

  const peopleCount = Array.isArray(dailyData.people)
    ? dailyData.people.length
    : 0;

  const financialCount = Array.isArray(dailyData.financial)
    ? dailyData.financial.length
    : 0;

  const allTasks = Array.isArray(dailyData.tasks) ? dailyData.tasks : [];
  const taskItems = allTasks
    .map((task, originalIndex) => ({ task, originalIndex }))
    .filter(({ task }) => getTaskStatus(task) !== "Descartada");
  const tasks = taskItems.map(({ task }) => task);
  const doneTasks = tasks.filter((task) => getTaskStatus(task) === "Feita");
  const pendingTasks = tasks.filter(
    (task) => getTaskStatus(task) === "Pendente",
  );
  const hasTasks = tasks.length > 0;

  const hasPeople = peopleCount > 0;
  const hasFinancial = financialCount > 0;

  const habitsList = weeklyHabits
    .split("\n")
    .map((habit) => habit.trim())
    .filter(Boolean);

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

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-4">
            <p className="text-[10px] uppercase tracking-widest text-primary/70">
              Como está minha onda ao fechar o dia?
            </p>

            <div className="grid grid-cols-5 gap-2">
              {FEELINGS.map((feeling) => {
                const selected = eveningEmotion === feeling.value;

                return (
                  <button
                    key={feeling.value}
                    type="button"
                    onClick={() => {
                      const nextEmotion = selected ? "" : feeling.value;
                      saveEveningEmotion(nextEmotion, eveningNote);
                    }}
                    className={
                      selected
                        ? "rounded-xl border border-primary bg-primary/10 px-2 py-3 text-center"
                        : "rounded-xl border border-border/40 bg-background px-2 py-3 text-center"
                    }
                  >
                    <div className="text-lg">{feeling.emoji}</div>
                    <div className="mt-1 text-[10px] leading-tight text-muted-foreground">
                      {feeling.label}
                    </div>
                  </button>
                );
              })}
            </div>

            <Textarea
              value={eveningNote}
              onChange={(e) => setEveningNote(e.target.value)}
              onBlur={() => saveEveningEmotion(eveningEmotion, eveningNote)}
              placeholder="O que essa emoção está tentando comunicar no fechamento do dia?"
              className="min-h-[80px] resize-none rounded-xl border-border/40 bg-background"
            />

            <p className="text-[11px] text-muted-foreground">
              Esse registro também aparece na página Emoções, na seção Noite.
            </p>
          </section>

          {hasTasks && (
            <section className="rounded-2xl border border-border/40 bg-card p-4">
              <button
                type="button"
                onClick={() => setTasksOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-primary/70">
                    Leitura das tarefas
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {tasks.length} tarefas · {doneTasks.length} feitas ·{" "}
                    {pendingTasks.length} pendentes
                  </p>
                </div>

                <ChevronDown
                  className={
                    tasksOpen
                      ? "h-4 w-4 shrink-0 text-muted-foreground transition-transform rotate-180"
                      : "h-4 w-4 shrink-0 text-muted-foreground transition-transform"
                  }
                />
              </button>

              {tasksOpen && (
                <div className="mt-4 space-y-3">
                  <div className="space-y-2">
                    {taskItems.map(({ task, originalIndex }) => (
                      <div
                        key={
                          task.id || `${getTaskTitle(task)}-${originalIndex}`
                        }
                        className="rounded-xl border border-border/40 bg-background px-3 py-2"
                      >
                        <p className="text-sm font-medium text-foreground">
                          {getTaskTitle(task)}
                        </p>

                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                            {getTaskStatus(task)}
                          </p>

                          {getTaskStatus(task) !== "Feita" && (
                            <button
                              type="button"
                              onClick={() => discardTask(task, originalIndex)}
                              className="rounded-full border border-border/40 px-3 py-1 text-[11px] text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                            >
                              Descartar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    O que essas tarefas mostram sobre como você conduziu o dia?
                  </p>
                </div>
              )}
            </section>
          )}

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

            {(hasPeople || hasFinancial) && (
              <div className="rounded-xl border border-border/40 bg-background px-3 py-3 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-primary/70">
                  Contexto do dia
                </p>

                {hasPeople && (
                  <p className="text-sm text-foreground">
                    Você teve {peopleCount} registro
                    {peopleCount === 1 ? "" : "s"} de pessoas hoje.
                  </p>
                )}

                {hasFinancial && (
                  <p className="text-sm text-foreground">
                    Você teve {financialCount} registro
                    {financialCount === 1 ? "" : "s"} financeiro
                    {financialCount === 1 ? "" : "s"} hoje.
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  Isso influenciou como você agiu hoje?
                </p>
              </div>
            )}

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
                  Hoje você agiu de acordo com isso?
                </p>
              </div>
            )}
          </section>

          <NightField
            label="1. O que hoje realmente me puxou para frente?"
            value={data.approach}
            onChange={(value) => setField("approach", value)}
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
            onChange={(value) => setField("away", value)}
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
            onChange={(value) => setField("wins", value)}
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
            onChange={(value) => setField("ending", value)}
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
              Reflexão Financeira
            </p>

            <p className="text-sm text-muted-foreground">
              Teve alguma decisão financeira hoje que você repensaria?
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleFinancialReviewedClick(false)}
                className={
                  !financialReflection.reviewed
                    ? "rounded-xl border border-primary bg-primary/10 px-2 py-3 text-xs text-primary"
                    : "rounded-xl border border-border/40 bg-background px-2 py-3 text-xs text-muted-foreground"
                }
              >
                Não
              </button>

              <button
                type="button"
                onClick={() => handleFinancialReviewedClick(true)}
                className={
                  financialReflection.reviewed
                    ? "rounded-xl border border-primary bg-primary/10 px-2 py-3 text-xs text-primary"
                    : "rounded-xl border border-border/40 bg-background px-2 py-3 text-xs text-muted-foreground"
                }
              >
                Sim
              </button>
            </div>

            {financialReflection.reviewed && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-widest text-primary/70">
                  O que aconteceu?
                </p>

                <Textarea
                  value={financialReflection.note}
                  onChange={(e) =>
                    setFinancialReflectionField("note", e.target.value)
                  }
                  onBlur={() =>
                    save({
                      ...data,
                      financialReflection,
                      assessment,
                      tomorrowIntent,
                    })
                  }
                  placeholder="Comprei por impulso depois de um dia estressante."
                  className="min-h-[90px] resize-none rounded-xl border-border/40 bg-background"
                />
              </div>
            )}
          </section>

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
              onBlur={(e) => {
                const value = e.currentTarget.value;

                save({
                  ...data,
                  assessment,
                  tomorrowIntent: value,
                  bridgeToTomorrow: value,
                });
              }}
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
  onChange: (value: string) => void;
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
