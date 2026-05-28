import React, { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import { getQuoteOfDay, getCurrentDateKey } from "@/lib/date";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  Sun,
  Moon,
  Smile,
  Users,
  Wallet,
  Repeat,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  BarChart3,
  FileText,
  Target,
} from "lucide-react";
import {
  getMorningStatus,
  getNightStatus,
  EMPTY_MORNING_RITUAL,
  EMPTY_NIGHT_RITUAL,
} from "@/lib/ritual";
import { supabase } from "@/lib/supabase";
import {
  EMPTY_WEEKLY_PLAN,
  WeeklyPlanData,
  loadWeeklyPlan,
} from "@/lib/weekly-plan";

type DailyData = {
  tasks?: any[];
  morning?: any;
  evening?: any;
  emotions?: any;
  habits?: any[];
  habitsCompleted?: string[];
  people?: any[];
  financial?: any[];
};

type DailyRecord = {
  date: string;
  data: DailyData;
};

type PendingTask = any & {
  sourceDate: string;
};

type ListTask = any & {
  sourceDate?: string;
  isAccumulated?: boolean;
};

type Proof = {
  id: string;
  text: string;
  checked: boolean;
};

function go(path: string) {
  window.location.assign(path);
}

function shortText(value: string, fallback: string) {
  const text = value.trim();
  return text || fallback;
}

function shiftDate(dateKey: string, amount: number) {
  const d = new Date(dateKey + "T12:00:00");
  d.setDate(d.getDate() + amount);
  return d.toISOString().slice(0, 10);
}

function parseProofs(raw: string): Proof[] {
  if (!raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  return [];
}

function getDayType(dateKey: string) {
  const day = new Date(dateKey + "T12:00:00").getDay();
  if (day === 0) return "sunday";
  if (day === 6) return "saturday";
  return "normal";
}

function normalizeTasks(value: unknown, fallbackDate: string) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((task) => task && typeof task === "object")
    .map((task: any) => ({
      ...task,
      id:
        typeof task.id === "string" && task.id.trim()
          ? task.id
          : crypto.randomUUID(),
      title: typeof task.title === "string" ? task.title : "",
      details: typeof task.details === "string" ? task.details : "",
      subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
      alignedToWeek: Boolean(task.alignedToWeek),
      mustDoToday: Boolean(task.mustDoToday),
      category: typeof task.category === "string" ? task.category : "",
      status: ["todo", "done", "cancelled", "critical", "postponed"].includes(
        task.status,
      )
        ? task.status
        : "todo",
      type: task.type === "event" ? "event" : "task",
      time: typeof task.time === "string" ? task.time : "",
      date:
        typeof task.date === "string" && task.date ? task.date : fallbackDate,
    }))
    .filter((task) => task.title.trim());
}

function isPendingStatus(status: string) {
  return status === "todo" || status === "critical" || status === "postponed";
}

function getLiveTasks(tasks: any[], accumulatedTasks: PendingTask[]) {
  const liveTasksMap = new Map<string, ListTask>();

  [
    ...tasks.map((task) => ({
      ...task,
      isAccumulated: false,
    })),
    ...accumulatedTasks.map((task) => ({
      ...task,
      isAccumulated: true,
      sourceDate: task.sourceDate,
    })),
  ].forEach((task) => {
    if (task?.id && !liveTasksMap.has(task.id)) {
      liveTasksMap.set(task.id, task);
    }
  });

  return Array.from(liveTasksMap.values());
}

function getLatestEmotion(data: DailyData) {
  const emotions = data.emotions || {};

  if (emotions.evening?.emotion) return emotions.evening.emotion;
  if (emotions.afternoon?.emotion) return emotions.afternoon.emotion;
  if (emotions.morning?.emotion) return emotions.morning.emotion;

  return null;
}

function getSuggestedLoad(emotion: string | null) {
  switch (emotion) {
    case "muito mal":
      return 1;
    case "mal":
      return 2;
    case "ok":
      return 3;
    case "bem":
      return 4;
    case "muito bem":
      return 5;
    default:
      return null;
  }
}

function getTrailTasks(tasks: any[], data: DailyData) {
  const activeTasks = tasks.filter((task: any) => {
    const isPlanningTask =
      task?.alignedToWeek && !task?.mustDoToday && task?.status === "todo";

    return (
      task &&
      task.status !== "done" &&
      task.status !== "cancelled" &&
      task.status !== "postponed" &&
      !isPlanningTask
    );
  });

  const critical = activeTasks.filter(
    (task: any) => task.status === "critical",
  );

  const week = activeTasks.filter(
    (task: any) => task.status !== "critical" && task.category === "semana",
  );

  const morning = activeTasks.filter(
    (task: any) => task.status !== "critical" && task.category === "prioridade",
  );

  const other = activeTasks.filter(
    (task: any) =>
      task.status !== "critical" &&
      task.category !== "semana" &&
      task.category !== "prioridade",
  );

  const ordered = [...week, ...morning, ...other];

  const latestEmotion = getLatestEmotion(data);
  const suggestedLoad = getSuggestedLoad(latestEmotion);

  if (!suggestedLoad) {
    return [...critical, ...ordered];
  }

  return [...critical, ...ordered.slice(0, suggestedLoad)];
}

function SaturdayWeekCard({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="h-full min-w-0 rounded-[30px] border border-border/50 bg-card p-4 shadow-sm">
      <div className="flex gap-4 min-w-0">
        <button
          type="button"
          onClick={() => go("/plano-semanal")}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10"
        >
          <CalendarDays className="h-6 w-6 text-primary" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => go("/plano-semanal")}
              className="text-left"
            >
              <p className="text-sm text-primary">Fechamento da semana</p>
            </button>

            <button
              type="button"
              onClick={onToggle}
              className="shrink-0 rounded-full p-1 text-muted-foreground"
              aria-label="Abrir detalhes do fechamento da semana"
            >
              <ChevronDown
                className={
                  open
                    ? "h-5 w-5 rotate-180 transition-transform"
                    : "h-5 w-5 transition-transform"
                }
              />
            </button>
          </div>

          <button
            type="button"
            onClick={() => go("/plano-semanal")}
            className="w-full text-left"
          >
            <p
              className="mt-2 font-serif text-2xl leading-tight text-foreground break-words overflow-hidden"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
              }}
            >
              Hoje é dia de revisar o que esta semana mostrou...
            </p>

            <p
              className="mt-2 text-sm text-muted-foreground break-words overflow-hidden"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              Abra a avaliação semanal, observe as evidências e decida o próximo
              passo com clareza.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}

function SaturdayDetailsPanel() {
  return (
    <div className="rounded-[24px] border border-border/50 bg-card p-4 shadow-sm space-y-3">
      <SaturdayStep
        icon={<BarChart3 className="h-4 w-4" />}
        title="Ver evidências da semana"
        description="Registros, provas, emoções, hábitos e tarefas."
        path="/plano-semanal#evidencias"
      />

      <SaturdayStep
        icon={<FileText className="h-4 w-4" />}
        title="Ler e interpretar"
        description="Entenda o que funcionou e onde ajustar."
        path="/plano-semanal#interpretacao"
      />

      <SaturdayStep
        icon={<Target className="h-4 w-4" />}
        title="Decidir o próximo passo"
        description="Continuar, ajustar ou reforçar proteção."
        path="/plano-semanal#decisao"
      />

      <button
        type="button"
        onClick={() => go("/plano-semanal")}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
      >
        Abrir fechamento da semana
      </button>
    </div>
  );
}

function SaturdayStep({
  icon,
  title,
  description,
  path,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  path: string;
}) {
  return (
    <button
      type="button"
      onClick={() => go(path)}
      className="w-full text-left flex items-center gap-3 rounded-xl border border-border/40 bg-background/60 p-3 cursor-pointer hover:shadow-sm transition-shadow"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export default function Home() {
  const [dateKey, setDateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const transitionDismissKey = `home-transition-dismissed-${dateKey}`;

  const [transitionDismissed, setTransitionDismissed] = useState(() => {
    return localStorage.getItem(transitionDismissKey) === "true";
  });

  const [data, setData] = useState<DailyData>({});
  const [accumulatedTasks, setAccumulatedTasks] = useState<PendingTask[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [weeklyPlan, setWeeklyPlan] =
    useState<WeeklyPlanData>(EMPTY_WEEKLY_PLAN);
  const [trailIndex, setTrailIndex] = useState(0);
  const [saturdayCardOpen, setSaturdayCardOpen] = useState(false);

  useEffect(() => {
    setTransitionDismissed(
      localStorage.getItem(transitionDismissKey) === "true",
    );
  }, [transitionDismissKey]);

  async function loadAccumulatedTasks(currentUserId: string) {
    const { data, error } = await supabase
      .from("daily_records")
      .select("date, data")
      .eq("user_id", currentUserId)
      .lt("date", dateKey)
      .order("date", { ascending: false });

    if (error) {
      console.error("Erro ao carregar pendências acumuladas na Home:", error);
      setAccumulatedTasks([]);
      return;
    }

    const pending: PendingTask[] = [];

    ((data || []) as DailyRecord[]).forEach((record) => {
      const recordTasks = normalizeTasks(record.data?.tasks, record.date);

      recordTasks.forEach((task) => {
        if (!isPendingStatus(task.status)) return;

        pending.push({
          ...task,
          sourceDate: record.date,
        });
      });
    });

    setAccumulatedTasks(pending);
  }

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setAccumulatedTasks([]);
        return;
      }

      setUserId(session.user.id);

      const { data } = await supabase
        .from("daily_records")
        .select("data")
        .eq("user_id", session.user.id)
        .eq("date", dateKey)
        .maybeSingle();

      setData((data?.data || {}) as DailyData);
      await loadAccumulatedTasks(session.user.id);
      setTrailIndex(0);
      setSaturdayCardOpen(false);

      const weekly = await loadWeeklyPlan(dateKey);
      setWeeklyPlan(weekly.plan);
    }

    load();
  }, [dateKey]);

  const dayType = getDayType(dateKey);
  const morningStatus = getMorningStatus(data.morning || EMPTY_MORNING_RITUAL);
  const nightStatus = getNightStatus(data.evening || EMPTY_NIGHT_RITUAL);

  const proofs = useMemo(
    () => parseProofs(weeklyPlan.proofs),
    [weeklyPlan.proofs],
  );

  const checkedProofs = proofs.filter((proof) => proof.checked).length;
  const totalProofs = proofs.length;

  const tasks = data.tasks || [];
  const liveTasks = getLiveTasks(tasks, accumulatedTasks);
  const trailTasks = getTrailTasks(liveTasks, data);
  const planningTasksCount = liveTasks.filter(
    (task: any) =>
      task?.alignedToWeek && !task?.mustDoToday && task?.status === "todo",
  ).length;
  const shouldShowPlanningAlert = planningTasksCount > 5;
  const safeTrailIndex =
    trailTasks.length === 0 ? 0 : Math.min(trailIndex, trailTasks.length - 1);
  const visibleTask = trailTasks[safeTrailIndex];

  const hour = new Date().getHours();
  const isTransitionVisible = hour >= 13 && hour < 19;

  function dismissTransitionPrompt() {
    localStorage.setItem(transitionDismissKey, "true");
    setTransitionDismissed(true);
  }

  function previousTrailTask() {
    if (trailTasks.length <= 1) return;
    setTrailIndex((current) =>
      current <= 0 ? trailTasks.length - 1 : current - 1,
    );
  }

  function nextTrailTask() {
    if (trailTasks.length <= 1) return;
    setTrailIndex((current) =>
      current >= trailTasks.length - 1 ? 0 : current + 1,
    );
  }

  async function markVisibleTaskDone() {
    if (!userId || !visibleTask) return;

    const { data: latestRecord, error: loadError } = await supabase
      .from("daily_records")
      .select("data")
      .eq("user_id", userId)
      .eq("date", dateKey)
      .maybeSingle();

    if (loadError) {
      console.error(
        "Erro ao carregar registro mais recente da Home:",
        loadError,
      );
      return;
    }

    const latestData = (latestRecord?.data || {}) as DailyData;
    const latestTasks = Array.isArray(latestData.tasks) ? latestData.tasks : [];

    const updatedTasks = latestTasks.map((task: any) =>
      task.id === visibleTask.id ? { ...task, status: "done" } : task,
    );

    const nextData: DailyData = {
      ...latestData,
      tasks: updatedTasks,
    };

    setData(nextData);
    setTrailIndex(0);

    const { error } = await supabase.from("daily_records").upsert(
      {
        user_id: userId,
        date: dateKey,
        data: nextData,
      },
      { onConflict: "user_id,date" },
    );

    if (error) {
      console.error("Erro ao marcar tarefa como feita na Home:", error);
    }
  }

  const weekCard = (() => {
    if (dayType === "sunday") {
      return {
        eyebrow: "Abertura da semana",
        title: "Hoje é dia de definir a direção dos próximos 7 dias.",
        description:
          "Abra o plano semanal, escolha a direção da semana e distribua o que vai sustentar este novo ciclo.",
      };
    }

    return {
      eyebrow: "Direção da semana",
      title: shortText(weeklyPlan.change, "Nenhuma direção definida ainda"),
      description: "Use esta direção para orientar suas escolhas de hoje.",
    };
  })();

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
      <div className="p-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <button
              type="button"
              onClick={() => setDateKey(shiftDate(dateKey, -1))}
              className="px-2 py-1"
            >
              ←
            </button>

            <button
              type="button"
              onClick={() => setDateKey(getCurrentDateKey())}
              className="px-2 py-1 text-primary"
            >
              Hoje
            </button>

            <button
              type="button"
              onClick={() => setDateKey(shiftDate(dateKey, 1))}
              className="px-2 py-1"
            >
              →
            </button>
          </div>

          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {formatDate}
          </p>

          <h1 className="text-3xl font-serif">Travessia</h1>
        </div>

        <div className="rounded-2xl border p-5 space-y-2">
          <p className="text-sm text-muted-foreground italic">
            {getQuoteOfDay()}
          </p>
          <p className="text-xs text-muted-foreground uppercase">— Sêneca</p>
        </div>

        <div className="w-full text-left border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => go("/tarefas")}
              className="text-xs text-muted-foreground"
            >
              Trilha de hoje
            </button>

            <div className="flex items-center gap-2">
              {trailTasks.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {safeTrailIndex + 1} de {trailTasks.length}
                </span>
              )}

              <button type="button" onClick={() => go("/tarefas")}>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {visibleTask ? (
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={markVisibleTaskDone}
                className="mt-1 h-5 w-5 rounded-full border border-primary/60 flex items-center justify-center text-primary hover:bg-primary/10"
                aria-label="Marcar tarefa como feita"
              >
                <CheckCircle2 className="h-3.5 w-3.5 opacity-0 hover:opacity-100" />
              </button>

              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => go("/tarefas")}
                  className="w-full text-left"
                >
                  <p className="text-lg font-serif break-words">
                    {visibleTask.title ||
                      visibleTask.text ||
                      "Tarefa sem título"}
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Toque no círculo para marcar como feita.
                  </p>
                </button>

                {shouldShowPlanningAlert && (
                  <button
                    type="button"
                    onClick={() => go("/tarefas")}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40"
                  >
                    <span>Talvez seja hora de reorganizar.</span>
                  </button>
                )}

                {trailTasks.length > 1 && (
                  <div className="mt-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={previousTrailTask}
                      className="flex items-center gap-1 text-xs text-muted-foreground"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </button>

                    <button
                      type="button"
                      onClick={nextTrailTask}
                      className="flex items-center gap-1 text-xs text-muted-foreground"
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => go("/tarefas")}
                className="text-left w-full"
              >
                <p className="text-lg font-serif">
                  Nenhuma tarefa pendente hoje.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Abra tarefas para organizar o próximo passo.
                </p>
              </button>

              {shouldShowPlanningAlert && (
                <button
                  type="button"
                  onClick={() => go("/tarefas")}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40"
                >
                  <span>Talvez seja hora de reorganizar.</span>
                </button>
              )}
            </>
          )}
        </div>

        {isTransitionVisible && !transitionDismissed && (
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Transição do dia</p>

            <p className="text-lg font-serif">
              Você ainda está alinhado com o seu dia?
            </p>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  dismissTransitionPrompt();
                  go("/tarefas");
                }}
                className="text-xs px-3 py-1 border rounded-lg"
              >
                Ajustar tarefas
              </button>

              <button
                type="button"
                onClick={() => {
                  dismissTransitionPrompt();
                  go("/emocoes");
                }}
                className="text-xs px-3 py-1 border rounded-lg"
              >
                Registrar emoção
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-[1.45fr_1fr] gap-3 items-stretch">
          {dayType === "saturday" ? (
            <SaturdayWeekCard
              open={saturdayCardOpen}
              onToggle={() => setSaturdayCardOpen((open) => !open)}
            />
          ) : (
            <button
              type="button"
              onClick={() => go("/plano-semanal")}
              className="h-full min-w-0 text-left rounded-[30px] border border-border/50 bg-card p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex gap-4 min-w-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                  <CalendarDays className="h-6 w-6 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-primary">{weekCard.eyebrow}</p>

                  <p
                    className="mt-2 font-serif text-2xl leading-tight text-foreground break-words overflow-hidden"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: dayType === "normal" ? 3 : 4,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {weekCard.title}
                  </p>

                  <p
                    className="mt-2 text-sm text-muted-foreground break-words overflow-hidden"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {weekCard.description}
                  </p>
                </div>
              </div>
            </button>
          )}

          <div className="h-full rounded-[30px] border border-border/50 bg-card p-4 shadow-sm flex flex-col justify-between">
            <button
              type="button"
              onClick={() => go("/manha")}
              className="flex flex-1 flex-col items-center justify-center w-full"
            >
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Sun className="h-6 w-6" />
              </div>
              <p className="text-lg font-serif">Dia</p>
              <p className="text-xs text-muted-foreground">{morningStatus}</p>
            </button>

            <div className="h-px bg-border/40 my-2" />

            <button
              type="button"
              onClick={() => go("/noite")}
              className="flex flex-1 flex-col items-center justify-center w-full"
            >
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Moon className="h-6 w-6" />
              </div>
              <p className="text-lg font-serif">Noite</p>
              <p className="text-xs text-muted-foreground">{nightStatus}</p>
            </button>
          </div>
        </div>

        {dayType === "saturday" && saturdayCardOpen && <SaturdayDetailsPanel />}

        <div className="grid grid-cols-4 gap-3 text-center text-xs">
          <Mini
            icon={<Users />}
            label="Pessoas"
            onClick={() => go("/pessoas")}
          />
          <Mini
            icon={<Repeat />}
            label="Hábitos"
            onClick={() => go("/habitos")}
          />
          <Mini
            icon={<Wallet />}
            label="Finanças"
            onClick={() => go("/financeiro")}
          />
          <Mini
            icon={<Smile />}
            label="Emoções"
            onClick={() => go("/emocoes")}
          />
        </div>

        <button
          type="button"
          onClick={() => go("/plano-semanal")}
          className="w-full text-left border rounded-xl p-4 flex justify-between items-center cursor-pointer hover:shadow-sm transition-shadow"
        >
          <div>
            <p className="text-xs text-muted-foreground">Marcos da semana</p>
            <p className="text-xl font-serif">
              {checkedProofs} de {totalProofs}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-24 h-6 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary/30 rounded-full transition-all"
                style={{
                  width:
                    totalProofs > 0
                      ? `${Math.round((checkedProofs / totalProofs) * 100)}%`
                      : "0%",
                }}
              />
            </div>
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
          </div>
        </button>
      </div>
    </Layout>
  );
}

function Mini({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer hover:shadow-sm"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
