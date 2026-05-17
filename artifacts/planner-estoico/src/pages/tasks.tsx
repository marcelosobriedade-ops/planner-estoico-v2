import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Circle,
  Plus,
  Trash2,
  CalendarPlus,
  Smile,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TaskStatus = "todo" | "done" | "cancelled" | "critical" | "postponed";

interface Task {
  id: string;
  title: string;
  category: string;
  status: TaskStatus;
  type?: "task" | "event";
  time?: string;
  date?: string;
}

type DailyData = {
  tasks?: Task[];
  morning?: any;
  emotions?: any;
  [key: string]: unknown;
};

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "A fazer" },
  { value: "done", label: "Feita" },
  { value: "critical", label: "Crítica" },
  { value: "postponed", label: "Adiada" },
  { value: "cancelled", label: "Cancelada" },
];

function shiftDate(dateKey: string, amount: number) {
  const d = new Date(dateKey + "T12:00:00");
  d.setDate(d.getDate() + amount);
  return d.toISOString().slice(0, 10);
}

function getEmotionSummary(data: DailyData) {
  const emotions = data.emotions || {};
  const morningFeeling = data.morning?.feeling;

  const values = [
    emotions.morning?.emotion,
    emotions.afternoon?.emotion,
    emotions.evening?.emotion,
  ].filter(Boolean);

  if (morningFeeling) return `Manhã: ${morningFeeling}`;
  if (values.length > 0)
    return `${values.length}/3 check-ins emocionais feitos`;
  return "Nenhum estado emocional registrado ainda";
}

function getMorningDirection(data: DailyData) {
  return (
    data.morning?.actions ||
    data.morning?.virtueOfDay ||
    data.morning?.control ||
    ""
  );
}

function TaskOrigin({ category }: { category: string }) {
  if (!category) return null;

  const isWeek = category === "semana";
  const isMorning = category === "prioridade";

  return (
    <span
      className={cn(
        "text-[10px] px-2 py-0.5 rounded-full border",
        isWeek && "border-primary/20 bg-primary/5 text-primary/70",
        isMorning && "border-amber-300/50 bg-amber-50/30 text-amber-600",
        !isWeek && !isMorning && "border-border/20 text-muted-foreground/60",
      )}
    >
      {isWeek ? "Semana" : isMorning ? "Manhã" : category}
    </span>
  );
}

function TaskStatusButton({
  current,
  value,
  label,
  onChange,
}: {
  current: TaskStatus;
  value: TaskStatus;
  label: string;
  onChange: (s: TaskStatus) => void;
}) {
  const selected = current === value;

  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cn(
        "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
        selected
          ? value === "critical"
            ? "bg-rose-600 border-rose-600 text-white shadow-sm"
            : value === "done"
              ? "bg-primary border-primary text-primary-foreground shadow-sm"
              : value === "postponed"
                ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                : value === "cancelled"
                  ? "bg-muted-foreground border-muted-foreground text-background shadow-sm"
                  : "bg-foreground border-foreground text-background shadow-sm"
          : "bg-card border-border/40 text-muted-foreground hover:bg-muted/70",
      )}
    >
      {label}
    </button>
  );
}

function TaskItem({
  task,
  onStatusChange,
  onDelete,
  onPostponeTomorrow,
  showOrigin = true,
}: {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onPostponeTomorrow: (task: Task) => void;
  showOrigin?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "bg-card border rounded-xl shadow-sm overflow-hidden transition-all",
        task.status === "critical" && "border-rose-300/60 bg-rose-50/40",
        task.status === "done" && "opacity-60 border-border/20",
        task.status === "cancelled" && "opacity-40 border-border/20",
        task.status === "postponed" && "border-amber-300/50 bg-amber-50/30",
        task.status === "todo" && "border-border/40",
      )}
    >
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={() =>
            onStatusChange(task.id, task.status === "done" ? "todo" : "done")
          }
          className={cn(
            "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
            task.status === "done"
              ? "bg-primary border-primary text-primary-foreground"
              : task.status === "critical"
                ? "border-rose-500 text-rose-500"
                : "border-primary/40 hover:border-primary text-transparent",
          )}
        >
          {task.status === "critical" ? (
            <AlertTriangle className="w-2.5 h-2.5 text-rose-500" />
          ) : (
            <Check className="w-3 h-3" />
          )}
        </button>

        <div
          className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-foreground leading-snug",
                task.status === "done" && "line-through text-muted-foreground",
                task.status === "cancelled" &&
                  "line-through text-muted-foreground",
              )}
            >
              {task.title}
            </p>

            {task.time && (
              <span className="text-xs text-muted-foreground block">
                {task.time}
              </span>
            )}

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {showOrigin && <TaskOrigin category={task.category} />}

              <span
                className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                  task.status === "done" &&
                    "text-primary/70 border-primary/20 bg-primary/5",
                  task.status === "critical" &&
                    "text-rose-600 border-rose-300/50 bg-rose-50/40",
                  task.status === "postponed" &&
                    "text-amber-600 border-amber-300/50 bg-amber-50/30",
                  task.status === "cancelled" &&
                    "text-muted-foreground/50 border-border/20",
                  task.status === "todo" &&
                    "text-muted-foreground/50 border-border/20",
                )}
              >
                {STATUS_OPTIONS.find((o) => o.value === task.status)?.label}
              </span>
            </div>
          </div>

          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground/40 shrink-0 transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </div>

        <button
          type="button"
          onClick={() => onDelete(task.id)}
          className="flex-shrink-0 p-1.5 text-muted-foreground/40 hover:text-destructive transition-colors rounded-lg hover:bg-muted"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/20 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((opt) => (
              <TaskStatusButton
                key={opt.value}
                current={task.status}
                value={opt.value}
                label={opt.label}
                onChange={(s) => onStatusChange(task.id, s)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => onPostponeTomorrow(task)}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl border border-amber-300/50 bg-amber-50/40 text-amber-700"
          >
            <CalendarPlus className="w-4 h-4" />
            Adiar para amanhã
          </button>
        </div>
      )}
    </div>
  );
}

function TaskSection({
  title,
  subtitle,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  if (count === 0) return null;

  return (
    <section className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-4 py-4 text-left"
      >
        <div>
          <h3 className="text-xs font-medium uppercase tracking-widest text-primary/70">
            {title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {count} tarefa{count === 1 ? "" : "s"} · {subtitle}
          </p>
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-2 border-t border-border/20 p-3">
          {children}
        </div>
      )}
    </section>
  );
}

export default function Tasks() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [tasks, setTasks] = useState<Task[]>([]);
  const [dailyData, setDailyData] = useState<DailyData>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [saveError, setSaveError] = useState("");

  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [category, setCategory] = useState("");
  const [showMatrix, setShowMatrix] = useState(false);

  const [showCriticalTasks, setShowCriticalTasks] = useState(true);
  const [showWeekTasks, setShowWeekTasks] = useState(true);
  const [showMorningTasks, setShowMorningTasks] = useState(true);
  const [showOtherTasks, setShowOtherTasks] = useState(true);
  const [showDoneTasks, setShowDoneTasks] = useState(false);

  useEffect(() => {
    async function loadTasks() {
      setLoadingTasks(true);
      setSaveError("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setSaveError("Sessão não encontrada. Faça login novamente.");
        setLoadingTasks(false);
        return;
      }

      setUserId(session.user.id);

      const { data, error } = await supabase
        .from("daily_records")
        .select("data")
        .eq("user_id", session.user.id)
        .eq("date", dateKey)
        .maybeSingle();

      if (error) {
        setSaveError("Erro ao carregar tarefas.");
        setLoadingTasks(false);
        return;
      }

      const loadedData = (data?.data || {}) as DailyData;
      const normalizedTasks = Array.isArray(loadedData.tasks)
        ? loadedData.tasks.map((task) => ({
            ...task,
            date: task.date || dateKey,
          }))
        : [];

      setDailyData({
        ...loadedData,
        tasks: normalizedTasks,
      });
      setTasks(normalizedTasks);
      setLoadingTasks(false);
    }

    loadTasks();
  }, [dateKey]);

  async function getLatestDailyData(
    currentUserId: string,
    targetDate: string = dateKey,
  ): Promise<DailyData> {
    const { data, error } = await supabase
      .from("daily_records")
      .select("data")
      .eq("user_id", currentUserId)
      .eq("date", targetDate)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar registro mais recente:", error);
      return targetDate === dateKey ? dailyData : {};
    }

    return (data?.data || {}) as DailyData;
  }

  async function saveTasks(updatedTasks: Task[]) {
    if (!userId) {
      setSaveError("Usuário não encontrado. Faça login novamente.");
      return;
    }

    setSaveError("");

    const latestData = await getLatestDailyData(userId);

    const nextData: DailyData = {
      ...latestData,
      tasks: updatedTasks,
    };

    setTasks(updatedTasks);
    setDailyData(nextData);

    const { error } = await supabase.from("daily_records").upsert(
      {
        user_id: userId,
        date: dateKey,
        data: nextData,
      },
      {
        onConflict: "user_id,date",
      },
    );

    if (error) {
      setSaveError("Erro ao salvar tarefas.");
      console.error("Erro ao salvar tarefas:", error);
    }
  }

  async function saveDailyData(targetDate: string, nextData: DailyData) {
    if (!userId) return;

    const { error } = await supabase.from("daily_records").upsert(
      {
        user_id: userId,
        date: targetDate,
        data: nextData,
      },
      { onConflict: "user_id,date" },
    );

    if (error) {
      console.error("Erro ao salvar dia destino:", error);
      setSaveError("Erro ao adiar tarefa.");
    }
  }

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      title: title.trim(),
      category: category.trim(),
      status: "todo",
      time,
      date: dateKey,
    };

    saveTasks([...tasks, newTask]);

    setTitle("");
    setTime("");
    setCategory("");
  };

  const updateStatus = async (id: string, status: TaskStatus) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    if (status === "postponed") {
      await postponeTomorrow(task);
      return;
    }

    if (status === "cancelled") {
      saveTasks(tasks.filter((t) => t.id !== id));
      return;
    }

    saveTasks(tasks.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  const deleteTask = (id: string) => {
    saveTasks(tasks.filter((t) => t.id !== id));
  };

  const postponeTomorrow = async (task: Task) => {
    if (!userId) return;

    const tomorrow = shiftDate(dateKey, 1);

    const latestToday = await getLatestDailyData(userId, dateKey);
    const todayTasks = Array.isArray(latestToday.tasks)
      ? latestToday.tasks
      : [];

    const currentTasks = todayTasks.filter((t) => t.id !== task.id);

    const movedTask: Task = {
      ...task,
      status: "todo",
      date: tomorrow,
    };

    await saveTasks(currentTasks);

    const targetData = await getLatestDailyData(userId, tomorrow);
    const targetTasks = Array.isArray(targetData.tasks) ? targetData.tasks : [];

    const alreadyExistsTomorrow = targetTasks.some(
      (t) => t.id === movedTask.id,
    );

    const nextTomorrowData: DailyData = {
      ...targetData,
      tasks: alreadyExistsTomorrow ? targetTasks : [...targetTasks, movedTask],
    };

    await saveDailyData(tomorrow, nextTomorrowData);
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });

  const criticalTasks = sortedTasks.filter((t) => t.status === "critical");
  const activeTasks = sortedTasks.filter((t) => t.status === "todo");

  const weekTasks = activeTasks.filter((t) => t.category === "semana");
  const morningTasks = activeTasks.filter((t) => t.category === "prioridade");
  const otherTasks = activeTasks.filter(
    (t) => t.category !== "semana" && t.category !== "prioridade",
  );

  const doneTasks = sortedTasks.filter((t) => t.status === "done");

  const done = tasks.filter((t) => t.status === "done").length;

  const matrix = {
    critical: tasks.filter((t) => t.status === "critical"),
    todo: tasks.filter((t) => t.status === "todo"),
    done: tasks.filter((t) => t.status === "done"),
  };

  const emotionSummary = getEmotionSummary(dailyData);
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

  const latestEmotion = getLatestEmotion(dailyData);
  const suggestedLoad = getSuggestedLoad(latestEmotion);
  const morningDirection = getMorningDirection(dailyData);

  return (
    <Layout>
      <Header title="Tarefas" />

      <div className="flex-1 flex flex-col p-6 overflow-y-auto gap-6">
        <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Smile className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-primary/70">
                Estado do dia
              </p>

              <p className="mt-1 font-serif text-lg leading-snug">
                {emotionSummary}
              </p>

              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {morningDirection ||
                  "Antes de executar, perceba seu estado e escolha um ritmo possível."}
              </p>
              {suggestedLoad && (
                <p className="text-xs text-muted-foreground">
                  Baseado no seu estado atual, foque em até{" "}
                  <span className="font-medium text-foreground">
                    {suggestedLoad} tarefa{suggestedLoad > 1 ? "s" : ""}
                  </span>{" "}
                  hoje.
                </p>
              )}
            </div>
          </div>
        </section>

        <div className="flex items-end justify-between">
          <p className="font-serif italic text-muted-foreground">
            Deveres do dia.
          </p>

          {tasks.length > 0 && (
            <p className="text-xs font-medium tracking-widest text-primary/70 uppercase">
              {done}/{tasks.length} feitas
            </p>
          )}
        </div>

        {saveError && (
          <div className="rounded-xl border border-rose-300/50 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {saveError}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowMatrix(!showMatrix)}
          className="w-full rounded-xl border border-border/40 bg-card px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
        >
          {showMatrix ? "Ocultar matriz" : "Ver matriz"}
        </button>

        {showMatrix && (
          <section className="grid grid-cols-2 gap-3">
            <MatrixCard
              title="Crítico"
              subtitle="Prioridade real"
              items={matrix.critical}
              onMakeCritical={(id) => updateStatus(id, "critical")}
            />

            <MatrixCard
              title="A fazer"
              subtitle="Execução normal"
              items={matrix.todo}
              onMakeCritical={(id) => updateStatus(id, "critical")}
            />

            <MatrixCard
              title="Feito"
              subtitle="Concluído"
              items={matrix.done}
              onMakeCritical={(id) => updateStatus(id, "critical")}
            />

            <MatrixCard
              title="Fora do fluxo"
              subtitle="Adiadas/canceladas saem do dia"
              items={[]}
              onMakeCritical={() => {}}
            />
          </section>
        )}

        <form
          onSubmit={addTask}
          className="bg-card border border-border/40 rounded-2xl p-5 shadow-sm space-y-3"
        >
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nova tarefa"
            className="bg-transparent border-b border-0 border-border/50 rounded-none focus-visible:ring-0 px-0 h-10 text-base"
          />

          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />

          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Categoria (opcional)"
            className="bg-transparent border-b border-0 border-border/40 rounded-none focus-visible:ring-0 px-0 h-9 text-sm text-muted-foreground"
          />

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={!title.trim() || loadingTasks}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </div>
        </form>

        {loadingTasks && (
          <div className="flex flex-col items-center justify-center text-muted-foreground/50 gap-3 py-10">
            <Circle className="w-10 h-10 stroke-[1.5]" />
            <p className="font-serif italic">Carregando tarefas...</p>
          </div>
        )}

        {!loadingTasks && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center text-muted-foreground/50 gap-3 py-10">
            <Circle className="w-10 h-10 stroke-[1.5]" />
            <p className="font-serif italic">Nenhuma tarefa para hoje</p>
          </div>
        )}

        {!loadingTasks && tasks.length > 0 && (
          <div className="space-y-3">
            <TaskSection
              title="Prioridades críticas"
              subtitle="exigem atenção imediata"
              count={criticalTasks.length}
              open={showCriticalTasks}
              onToggle={() => setShowCriticalTasks(!showCriticalTasks)}
            >
              {criticalTasks.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  showOrigin
                  onStatusChange={updateStatus}
                  onDelete={deleteTask}
                  onPostponeTomorrow={postponeTomorrow}
                />
              ))}
            </TaskSection>

            <TaskSection
              title="Da semana"
              subtitle="vieram das provas da semana"
              count={weekTasks.length}
              open={showWeekTasks}
              onToggle={() => setShowWeekTasks(!showWeekTasks)}
            >
              {weekTasks.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  showOrigin={false}
                  onStatusChange={updateStatus}
                  onDelete={deleteTask}
                  onPostponeTomorrow={postponeTomorrow}
                />
              ))}
            </TaskSection>

            <TaskSection
              title="Da manhã"
              subtitle="vieram das prioridades do dia"
              count={morningTasks.length}
              open={showMorningTasks}
              onToggle={() => setShowMorningTasks(!showMorningTasks)}
            >
              {morningTasks.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  showOrigin={false}
                  onStatusChange={updateStatus}
                  onDelete={deleteTask}
                  onPostponeTomorrow={postponeTomorrow}
                />
              ))}
            </TaskSection>

            <TaskSection
              title="Outras tarefas"
              subtitle="criadas manualmente ou sem origem definida"
              count={otherTasks.length}
              open={showOtherTasks}
              onToggle={() => setShowOtherTasks(!showOtherTasks)}
            >
              {otherTasks.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  showOrigin={Boolean(t.category)}
                  onStatusChange={updateStatus}
                  onDelete={deleteTask}
                  onPostponeTomorrow={postponeTomorrow}
                />
              ))}
            </TaskSection>

            <TaskSection
              title="Feitas"
              subtitle="já saíram do foco principal"
              count={doneTasks.length}
              open={showDoneTasks}
              onToggle={() => setShowDoneTasks(!showDoneTasks)}
            >
              {doneTasks.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  showOrigin
                  onStatusChange={updateStatus}
                  onDelete={deleteTask}
                  onPostponeTomorrow={postponeTomorrow}
                />
              ))}
            </TaskSection>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground/40 italic font-serif pb-4">
          Toque numa tarefa para mudar o status ou adiar para amanhã.
        </p>
      </div>
    </Layout>
  );
}

function MatrixCard({
  title,
  subtitle,
  items,
  onMakeCritical,
}: {
  title: string;
  subtitle: string;
  items: Task[];
  onMakeCritical: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-4 min-h-[120px]">
      <p className="text-[10px] uppercase tracking-widest text-primary/70">
        {title}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>

      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 italic">
            Nenhuma tarefa
          </p>
        ) : (
          items.slice(0, 3).map((task) => (
            <div key={task.id} className="space-y-1">
              <p className="text-sm leading-snug">{task.title}</p>

              {task.status === "todo" && (
                <button
                  type="button"
                  onClick={() => onMakeCritical(task.id)}
                  className="text-[11px] rounded-full border border-rose-300/50 px-2 py-1 text-rose-600 bg-rose-50/40"
                >
                  Tornar crítica
                </button>
              )}
            </div>
          ))
        )}

        {items.length > 3 && (
          <p className="text-xs text-muted-foreground">
            +{items.length - 3} tarefa{items.length - 3 > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
