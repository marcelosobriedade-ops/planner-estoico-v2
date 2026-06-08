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
  CalendarPlus,
  Smile,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { loadWeeklyPlan, saveWeeklyPlan } from "@/lib/weekly-plan";

type TaskStatus = "todo" | "done" | "cancelled" | "critical" | "postponed";

interface Task {
  id: string;
  title: string;
  details?: string;
  subtasks?: {
    id: string;
    text: string;
    done: boolean;
  }[];
  alignedToWeek?: boolean;
  mustDoToday?: boolean;
  matrixTouched?: boolean;
  category: string;
  status: TaskStatus;
  type?: "task" | "event";
  time?: string;
  date?: string;

  source?: string;
  weeklyProofId?: string;
  morningPriorityIndex?: number;
}

type PendingTask = Task & {
  sourceDate: string;
};

type ListTask = Task & {
  sourceDate?: string;
  isAccumulated?: boolean;
};

type DayOrganizationItem = {
  id: string;
  createdAt: string;
  investigation: string;
  theme: string;
  dependencyChain: string[];
  finalPriority: string;
  completed: boolean;
  morningPriorityIndex?: number;
  priorityStatus?: "active" | "cancelled";
};

type DayOrganizationData = {
  items?: DayOrganizationItem[];
  [key: string]: unknown;
};

type DailyData = {
  tasks?: Task[];
  morning?: any;
  dayOrganization?: DayOrganizationData;
  emotions?: any;
  [key: string]: unknown;
};

type DailyRecord = {
  date: string;
  data: DailyData;
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

    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => item && typeof item === "object")
        .map((item: any) => ({
          id:
            typeof item.id === "string" && item.id.trim()
              ? item.id
              : crypto.randomUUID(),
          text: typeof item.text === "string" ? item.text : "",
          checked: Boolean(item.checked),
        }))
        .filter((item) => item.id && item.text.trim());
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

function taskStatusToProofChecked(status: TaskStatus) {
  return status === "done";
}

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

function formatDate(dateKey: string) {
  return new Date(dateKey + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function normalizeTasks(value: unknown, fallbackDate: string): Task[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((task) => task && typeof task === "object")
    .map((task: any) => ({
      id:
        typeof task.id === "string" && task.id.trim()
          ? task.id
          : crypto.randomUUID(),
      title: typeof task.title === "string" ? task.title : "",
      details: typeof task.details === "string" ? task.details : "",
      subtasks: Array.isArray(task.subtasks)
        ? task.subtasks.map((subtask: any) => ({
            id:
              typeof subtask.id === "string" ? subtask.id : crypto.randomUUID(),
            text: typeof subtask.text === "string" ? subtask.text : "",
            done: Boolean(subtask.done),
          }))
        : [],
      alignedToWeek: Boolean(task.alignedToWeek),
      mustDoToday: Boolean(task.mustDoToday),
      matrixTouched: Boolean(task.matrixTouched),
      category: typeof task.category === "string" ? task.category : "",
      status: STATUS_OPTIONS.some((option) => option.value === task.status)
        ? task.status
        : "todo",
      type: task.type === "event" ? "event" : "task",
      time: typeof task.time === "string" ? task.time : "",
      date:
        typeof task.date === "string" && task.date ? task.date : fallbackDate,

      source: typeof task.source === "string" ? task.source : "",
      weeklyProofId:
        typeof task.weeklyProofId === "string" ? task.weeklyProofId : undefined,
      morningPriorityIndex:
        typeof task.morningPriorityIndex === "number"
          ? task.morningPriorityIndex
          : undefined,
    }))
    .filter((task) => task.title.trim());
}

function normalizeDayOrganizationItems(value: unknown): DayOrganizationItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => item && typeof item === "object")
    .map((item: any) => ({
      id:
        typeof item.id === "string" && item.id.trim()
          ? item.id
          : crypto.randomUUID(),
      createdAt:
        typeof item.createdAt === "string" && item.createdAt.trim()
          ? item.createdAt
          : new Date().toISOString(),
      investigation:
        typeof item.investigation === "string" ? item.investigation : "",
      theme: typeof item.theme === "string" ? item.theme : "",
      dependencyChain: Array.isArray(item.dependencyChain)
        ? item.dependencyChain
            .map((step: unknown) => String(step || "").trim())
            .filter(Boolean)
        : [],
      finalPriority:
        typeof item.finalPriority === "string" ? item.finalPriority : "",
      completed: Boolean(item.completed),
      morningPriorityIndex:
        typeof item.morningPriorityIndex === "number"
          ? item.morningPriorityIndex
          : undefined,
      priorityStatus:
        item.priorityStatus === "cancelled" ? "cancelled" : "active",
    }))
    .filter((item) => item.finalPriority.trim() || item.theme.trim());
}

function isPendingStatus(status: TaskStatus) {
  return status === "todo" || status === "critical" || status === "postponed";
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

function WeeklyProofBadge({ task }: { task: Task | ListTask }) {
  const isWeeklyProof =
    task.source === "weekly-proof" || Boolean(task.weeklyProofId);

  if (!isWeeklyProof) return null;

  return (
    <span className="inline-flex items-center rounded-full border border-yellow-300/30 bg-yellow-50/40 px-2 py-0.5 text-[10px] font-medium text-yellow-700">
      ⭐ Prova da semana
    </span>
  );
}

function MorningPriorityBadge({ task }: { task: Task | ListTask }) {
  const isMorningPriority =
    task.source === "morning-priority" ||
    typeof task.morningPriorityIndex === "number";

  if (!isMorningPriority) return null;

  return (
    <span className="inline-flex items-center rounded-full border border-sky-300/30 bg-sky-50/40 px-2 py-0.5 text-[10px] font-medium text-sky-700">
      🎯 Prioridade do dia
    </span>
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
  tasks,
  saveTasks,
  onEditTask,
  onStatusChange,
  onDelete,
  onPostponeTomorrow,
  showOrigin = true,
}: {
  task: ListTask;
  tasks: Task[];
  saveTasks: (updatedTasks: Task[], taskToSync?: Task | null) => void;
  onEditTask: (
    task: ListTask,
    patch: Pick<Task, "title" | "details" | "category" | "time">,
  ) => Promise<void>;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onPostponeTomorrow: (task: Task) => void;
  showOrigin?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [subtasksOpen, setSubtasksOpen] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftDetails, setDraftDetails] = useState(task.details || "");
  const [draftCategory, setDraftCategory] = useState(task.category || "");
  const [draftTime, setDraftTime] = useState(task.time || "");

  const subtasks = task.subtasks || [];

  function addSubtask(e: React.FormEvent) {
    e.preventDefault();

    const text = newSubtask.trim();
    if (!text) return;

    saveTasks(
      tasks.map((currentTask) =>
        currentTask.id === task.id
          ? {
              ...currentTask,
              subtasks: [
                ...(currentTask.subtasks || []),
                {
                  id: crypto.randomUUID(),
                  text,
                  done: false,
                },
              ],
            }
          : currentTask,
      ),
    );

    setNewSubtask("");
    setSubtasksOpen(true);
  }

  function toggleSubtask(subtaskId: string) {
    saveTasks(
      tasks.map((currentTask) =>
        currentTask.id === task.id
          ? {
              ...currentTask,
              subtasks: (currentTask.subtasks || []).map((subtask) =>
                subtask.id === subtaskId
                  ? { ...subtask, done: !subtask.done }
                  : subtask,
              ),
            }
          : currentTask,
      ),
    );
  }

  async function saveEdit() {
    if (!draftTitle.trim()) return;

    await onEditTask(task, {
      title: draftTitle,
      details: draftDetails,
      category: draftCategory,
      time: draftTime,
    });

    setEditing(false);
  }

  function cancelEdit() {
    setDraftTitle(task.title);
    setDraftDetails(task.details || "");
    setDraftCategory(task.category || "");
    setDraftTime(task.time || "");
    setEditing(false);
  }

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

            {task.details && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {task.details}
              </p>
            )}

            <div className="mt-1 flex flex-wrap gap-1">
              <WeeklyProofBadge task={task} />
              <MorningPriorityBadge task={task} />
            </div>

            {task.alignedToWeek && (
              <span className="mt-1 inline-flex rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] text-primary/70">
                Semana
              </span>
            )}

            {task.mustDoToday && (
              <span className="mt-1 inline-flex rounded-full border border-amber-300/50 bg-amber-50/30 px-2 py-0.5 text-[10px] text-amber-700">
                Hoje
              </span>
            )}

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
          className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
        >
          Descartar
        </button>
      </div>

      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={() => setSubtasksOpen(!subtasksOpen)}
          className="text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          Subtarefas {subtasksOpen ? "▴" : "▾"}
          {subtasks.length > 0 && (
            <span className="ml-1 text-muted-foreground/50">
              {subtasks.filter((subtask) => subtask.done).length}/
              {subtasks.length}
            </span>
          )}
        </button>

        {subtasksOpen && (
          <div className="mt-2 ml-7 space-y-2 border-l border-border/30 pl-3">
            {subtasks.length > 0 && (
              <div className="space-y-1.5">
                {subtasks.map((subtask) => (
                  <label
                    key={subtask.id}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={subtask.done}
                      onChange={() => toggleSubtask(subtask.id)}
                      className="h-3.5 w-3.5 rounded border-border/50"
                    />

                    <span
                      className={cn(
                        "leading-snug",
                        subtask.done && "line-through text-muted-foreground/50",
                      )}
                    >
                      {subtask.text}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <form onSubmit={addSubtask} className="flex items-center gap-2">
              <Input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="Nova subtarefa"
                className="h-8 bg-transparent text-xs"
              />

              <button
                type="submit"
                disabled={!newSubtask.trim()}
                className="shrink-0 rounded-lg border border-border/40 px-2 py-1 text-[11px] text-muted-foreground disabled:opacity-40"
              >
                Add
              </button>
            </form>
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/20 pt-3">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-xl border border-border/40 bg-card px-3 py-2 text-xs text-muted-foreground"
            >
              Editar tarefa
            </button>
          )}

          {editing && (
            <div className="space-y-2 rounded-xl border border-border/30 bg-background/60 p-3">
              <Input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Título da tarefa"
                className="h-9 bg-transparent text-sm"
              />

              <Input
                value={draftDetails}
                onChange={(e) => setDraftDetails(e.target.value)}
                placeholder="Detalhes"
                className="h-9 bg-transparent text-sm"
              />

              <Input
                value={draftCategory}
                onChange={(e) => setDraftCategory(e.target.value)}
                placeholder="Lista ou categoria"
                className="h-9 bg-transparent text-sm"
              />

              <Input
                value={draftTime}
                onChange={(e) => setDraftTime(e.target.value)}
                placeholder="Horário"
                className="h-9 bg-transparent text-sm"
              />

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={!draftTitle.trim()}
                  className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary disabled:opacity-40"
                >
                  Salvar
                </button>

                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-lg border border-border/40 px-3 py-2 text-xs text-muted-foreground"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

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

function PendingTaskItem({
  task,
  onMarkDone,
  onDiscard,
}: {
  task: PendingTask;
  onMarkDone: (task: PendingTask) => void;
  onDiscard: (task: PendingTask) => void;
}) {
  return (
    <div className="rounded-xl border border-amber-300/50 bg-amber-50/30 p-4 space-y-3">
      <div className="space-y-1">
        <p className="text-sm leading-snug">{task.title}</p>

        <div className="mt-1 flex flex-wrap gap-1">
          <WeeklyProofBadge task={task} />
          <MorningPriorityBadge task={task} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] rounded-full border border-amber-300/50 px-2 py-0.5 text-amber-700">
            {formatDate(task.sourceDate)}
          </span>

          {task.category && <TaskOrigin category={task.category} />}

          <span className="text-[10px] rounded-full border border-border/30 px-2 py-0.5 text-muted-foreground">
            {STATUS_OPTIONS.find((option) => option.value === task.status)
              ?.label || task.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={() => onMarkDone(task)}
          className="rounded-xl border border-border/40 bg-card px-3 py-2 text-xs text-muted-foreground"
        >
          Marcar como feita
        </button>

        <button
          type="button"
          onClick={() => onDiscard(task)}
          className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
        >
          Descartar
        </button>
      </div>
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
  const [accumulatedTasks, setAccumulatedTasks] = useState<PendingTask[]>([]);
  const [dailyData, setDailyData] = useState<DailyData>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [saveError, setSaveError] = useState("");

  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState("");
  const [showMatrix, setShowMatrix] = useState(false);
  const [taskHistoryOpen, setTaskHistoryOpen] = useState(false);

  const [showAccumulatedTasks, setShowAccumulatedTasks] = useState(true);
  const [showCriticalTasks, setShowCriticalTasks] = useState(true);
  const [showWeekTasks, setShowWeekTasks] = useState(true);
  const [showMorningTasks, setShowMorningTasks] = useState(true);
  const [showOtherTasks, setShowOtherTasks] = useState(true);
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const [categoryOrder, setCategoryOrder] = useLocalStorage<string[]>(
    "tasks-category-order",
    [],
  );

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
      const normalizedTasks = normalizeTasks(loadedData.tasks, dateKey);

      setDailyData({
        ...loadedData,
        tasks: normalizedTasks,
      });
      setTasks(normalizedTasks);

      await loadAccumulatedTasks(session.user.id);

      setLoadingTasks(false);
    }

    loadTasks();
  }, [dateKey]);

  async function loadAccumulatedTasks(currentUserId: string) {
    const { data, error } = await supabase
      .from("daily_records")
      .select("date, data")
      .eq("user_id", currentUserId)
      .lt("date", dateKey)
      .order("date", { ascending: false });

    if (error) {
      console.error("Erro ao carregar pendências acumuladas:", error);
      setSaveError("Erro ao carregar pendências acumuladas.");
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

  async function reloadCurrentAndAccumulated(currentUserId: string) {
    const latestToday = await getLatestDailyData(currentUserId, dateKey);
    const normalizedToday = normalizeTasks(latestToday.tasks, dateKey);

    setDailyData({
      ...latestToday,
      tasks: normalizedToday,
    });
    setTasks(normalizedToday);

    await loadAccumulatedTasks(currentUserId);
  }

  async function syncWeeklyProofFromTask(task: Task) {
    if (!userId || !task.weeklyProofId) return;

    try {
      const taskDate = task.date || dateKey;
      const weekly = await loadWeeklyPlan(taskDate);
      const currentProofs = parseProofs(weekly.plan.proofs);
      let changed = false;

      const nextProofs = currentProofs.map((proof) => {
        if (proof.id !== task.weeklyProofId) return proof;

        const nextChecked = taskStatusToProofChecked(task.status);
        const nextText = task.title.trim() || proof.text;

        if (proof.checked === nextChecked && proof.text === nextText) {
          return proof;
        }

        changed = true;

        return {
          ...proof,
          text: nextText,
          checked: nextChecked,
        };
      });

      if (!changed) return;

      await saveWeeklyPlan(weekly.userId || userId, weekly.weekStart, {
        ...weekly.plan,
        proofs: stringifyProofs(nextProofs),
      });
    } catch (error) {
      console.error("Erro ao sincronizar tarefa vinculada com prova:", error);
      setSaveError("Erro ao sincronizar prova da semana.");
    }
  }

  async function syncWeeklyProofsFromTasks(updatedTasks: Task[]) {
    const linkedTasks = updatedTasks.filter((task) => task.weeklyProofId);

    for (const task of linkedTasks) {
      await syncWeeklyProofFromTask(task);
    }
  }

  function applyMorningPriorityCrossSync(
    data: DailyData,
    taskToSync?: Task | null,
  ): DailyData {
    if (
      taskToSync?.source !== "morning-priority" ||
      typeof taskToSync.morningPriorityIndex !== "number"
    ) {
      return data;
    }

    const priorityIndex = taskToSync.morningPriorityIndex;
    const currentPriorities = Array.isArray(data.morning?.priorities)
      ? [...data.morning.priorities]
      : ["", "", ""];

    while (currentPriorities.length <= priorityIndex) {
      currentPriorities.push("");
    }

    const currentItems = normalizeDayOrganizationItems(
      data.dayOrganization?.items,
    );

    let nextItems = currentItems;

    if (taskToSync.status === "cancelled") {
      currentPriorities[priorityIndex] = "";
      nextItems = currentItems.map((item) =>
        item.morningPriorityIndex === priorityIndex
          ? {
              ...item,
              priorityStatus: "cancelled" as const,
            }
          : item,
      );
    } else {
      const nextTitle = taskToSync.title.trim();

      if (!nextTitle) return data;

      currentPriorities[priorityIndex] = nextTitle;
      nextItems = currentItems.map((item) =>
        item.morningPriorityIndex === priorityIndex
          ? {
              ...item,
              finalPriority: nextTitle,
              priorityStatus: "active" as const,
            }
          : item,
      );
    }

    return {
      ...data,
      morning: {
        ...(data.morning || {}),
        priorities: currentPriorities,
      },
      dayOrganization: {
        ...(data.dayOrganization || {}),
        items: nextItems,
      },
    };
  }

  async function saveTasks(updatedTasks: Task[], taskToSync?: Task | null) {
    if (!userId) {
      setSaveError("Usuário não encontrado. Faça login novamente.");
      return;
    }

    setSaveError("");
    setTasks(updatedTasks);

    const latestData = await getLatestDailyData(userId);

    const nextData: DailyData = applyMorningPriorityCrossSync(
      {
        ...latestData,
        tasks: updatedTasks,
      },
      taskToSync,
    );

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
      return;
    }

    if (taskToSync?.weeklyProofId) {
      await syncWeeklyProofFromTask(taskToSync);
    }

    await reloadCurrentAndAccumulated(userId);
  }

  async function saveDailyData(targetDate: string, nextData: DailyData) {
    if (!userId) return false;

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
      setSaveError("Erro ao salvar tarefa.");
      return false;
    }

    return true;
  }

  async function updateTaskOnDate(
    targetDate: string,
    taskId: string,
    update: (task: Task) => Task | null,
  ) {
    if (!userId) return false;

    const latestData = await getLatestDailyData(userId, targetDate);
    const targetTasks = normalizeTasks(latestData.tasks, targetDate);
    let changedTask: Task | null = null;

    const nextTasks = targetTasks
      .map((task) => {
        if (task.id !== taskId) return task;

        const updated = update(task);

        if (updated) {
          changedTask = {
            ...updated,
            date: updated.date || targetDate,
          };
        }

        return updated;
      })
      .filter(Boolean) as Task[];

    const nextData = applyMorningPriorityCrossSync(
      {
        ...latestData,
        tasks: nextTasks,
      },
      changedTask,
    );

    const saved = await saveDailyData(targetDate, nextData);

    if (saved && changedTask?.weeklyProofId) {
      await syncWeeklyProofFromTask(changedTask);
    }

    if (saved) {
      await reloadCurrentAndAccumulated(userId);
    }

    return saved;
  }

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      title: title.trim(),
      details: details.trim(),
      subtasks: [],
      alignedToWeek: false,
      mustDoToday: false,
      category: category.trim(),
      status: "todo",
      time: "",
      date: dateKey,
    };

    saveTasks([...tasks, newTask]);

    setTitle("");
    setDetails("");
    setCategory("");
  };

  const updateTaskStatus = async (id: string, status: TaskStatus) => {
    if (!userId) {
      setSaveError("Usuário não encontrado. Faça login novamente.");
      return;
    }

    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    if (status === "postponed") {
      await postponeTomorrow(task);
      return;
    }

    const updatedTask: Task = {
      ...task,
      status,
    };

    const updatedTasks = tasks.map((t) => (t.id === id ? updatedTask : t));

    await saveTasks(updatedTasks, updatedTask);
  };

  async function cancelTask(taskId: string) {
    await updateTaskStatus(taskId, "cancelled");
  }

  const updateStatus = updateTaskStatus;

  const deleteTask = (id: string) => {
    void cancelTask(id);
  };

  const postponeTomorrow = async (task: Task) => {
    if (!userId) return;

    const tomorrow = shiftDate(dateKey, 1);

    const latestToday = await getLatestDailyData(userId, dateKey);
    const todayTasks = normalizeTasks(latestToday.tasks, dateKey);
    const currentTasks = todayTasks.filter((t) => t.id !== task.id);

    const movedTask: Task = {
      ...task,
      status: "todo",
      date: tomorrow,
    };

    await saveDailyData(dateKey, {
      ...latestToday,
      tasks: currentTasks,
    });

    const targetData = await getLatestDailyData(userId, tomorrow);
    const targetTasks = normalizeTasks(targetData.tasks, tomorrow);

    const alreadyExistsTomorrow = targetTasks.some(
      (t) => t.id === movedTask.id,
    );

    const nextTomorrowData: DailyData = {
      ...targetData,
      tasks: alreadyExistsTomorrow ? targetTasks : [...targetTasks, movedTask],
    };

    await saveDailyData(tomorrow, nextTomorrowData);
    if (movedTask.weeklyProofId) {
      await syncWeeklyProofFromTask(movedTask);
    }
    await reloadCurrentAndAccumulated(userId);
  };

  async function markPendingDone(task: PendingTask) {
    await updateTaskOnDate(task.sourceDate, task.id, (oldTask) => ({
      ...oldTask,
      status: "done",
    }));
  }

  async function discardPending(task: PendingTask) {
    await updateTaskOnDate(task.sourceDate, task.id, (oldTask) => ({
      ...oldTask,
      status: "cancelled",
    }));
  }

  async function moveTaskToQuadrant(
    taskToMove: ListTask,
    nextAlignedToWeek: boolean,
    nextMustDoToday: boolean,
  ) {
    if (taskToMove.isAccumulated && taskToMove.sourceDate) {
      await updateTaskOnDate(
        taskToMove.sourceDate,
        taskToMove.id,
        (oldTask) => ({
          ...oldTask,
          alignedToWeek: nextAlignedToWeek,
          mustDoToday: nextMustDoToday,
          matrixTouched: true,
        }),
      );

      return;
    }

    await saveTasks(
      tasks.map((task) =>
        task.id === taskToMove.id
          ? {
              ...task,
              alignedToWeek: nextAlignedToWeek,
              mustDoToday: nextMustDoToday,
              matrixTouched: true,
            }
          : task,
      ),
    );
  }

  function completeLiveTask(task: ListTask) {
    if (task.isAccumulated && task.sourceDate) {
      void updateTaskOnDate(task.sourceDate, task.id, (oldTask) => ({
        ...oldTask,
        status: "done",
      }));

      return;
    }

    const updatedTask: Task = {
      ...task,
      status: "done",
      date: task.date || dateKey,
    };

    const updatedTasks = tasks.map((item) =>
      item.id === task.id ? updatedTask : item,
    );

    void saveTasks(updatedTasks, updatedTask);
  }

  function cancelLiveTask(task: ListTask) {
    if (task.isAccumulated && task.sourceDate) {
      updateTaskOnDate(task.sourceDate, task.id, (oldTask) => ({
        ...oldTask,
        status: "cancelled",
      }));

      return;
    }

    void cancelTask(task.id);
  }

  async function updateLiveTaskDetails(
    taskToUpdate: ListTask,
    patch: Pick<Task, "title" | "details" | "category" | "time">,
  ) {
    const nextTitle = patch.title.trim();

    if (!nextTitle) return;

    if (taskToUpdate.isAccumulated && taskToUpdate.sourceDate) {
      let updatedTaskForSync: Task | null = null;

      await updateTaskOnDate(
        taskToUpdate.sourceDate,
        taskToUpdate.id,
        (oldTask) => {
          const updatedTask: Task = {
            ...oldTask,
            title: nextTitle,
            details: patch.details.trim(),
            category: patch.category.trim(),
            time: patch.time.trim(),
          };

          updatedTaskForSync = updatedTask;

          return updatedTask;
        },
      );

      if (updatedTaskForSync?.weeklyProofId) {
        await syncWeeklyProofFromTask(updatedTaskForSync);
      }

      return;
    }

    const updatedTask: Task = {
      ...taskToUpdate,
      title: nextTitle,
      details: patch.details.trim(),
      category: patch.category.trim(),
      time: patch.time.trim(),
      date: taskToUpdate.date || dateKey,
    };

    const latestData = await getLatestDailyData(userId!, dateKey);

    const nextTasks = tasks.map((task) =>
      task.id === taskToUpdate.id ? updatedTask : task,
    );

    const nextData: DailyData = applyMorningPriorityCrossSync(
      {
        ...latestData,
        tasks: nextTasks,
      },
      updatedTask,
    );

    setTasks(nextTasks);
    setDailyData(nextData);

    const { error } = await supabase.from("daily_records").upsert(
      {
        user_id: userId,
        date: dateKey,
        data: nextData,
      },
      { onConflict: "user_id,date" },
    );

    if (error) {
      console.error("Erro ao salvar edição da tarefa:", error);
      setSaveError("Erro ao salvar edição da tarefa.");
      return;
    }

    if (updatedTask.weeklyProofId) {
      await syncWeeklyProofFromTask(updatedTask);
    }

    await reloadCurrentAndAccumulated(userId);
  }

  function renameCategory(oldName: string, newName: string) {
    const normalizedOldName = oldName.trim();
    const normalizedNewName = newName.trim();

    if (!normalizedOldName || !normalizedNewName) return;
    if (normalizedOldName === "Sem lista") return;
    if (normalizedOldName === normalizedNewName) return;

    saveTasks(
      tasks.map((task) =>
        String(task.category || "").trim() === normalizedOldName
          ? {
              ...task,
              category: normalizedNewName,
            }
          : task,
      ),
    );
  }

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
    if (!liveTasksMap.has(task.id)) {
      liveTasksMap.set(task.id, task);
    }
  });

  const liveTasks = Array.from(liveTasksMap.values());

  const sortedLiveTasks = [...liveTasks].sort((a, b) => {
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });

  const sortedTasks = [...tasks].sort((a, b) => {
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });

  const openTasks = sortedLiveTasks.filter((t) => isPendingStatus(t.status));

  const fazerAgora = sortedLiveTasks.filter(
    (t) => t.alignedToWeek && t.mustDoToday && t.status === "todo",
  );

  const planejar = sortedLiveTasks.filter(
    (t) => t.alignedToWeek && !t.mustDoToday && t.status === "todo",
  );

  const resolverRapido = sortedLiveTasks.filter(
    (t) => !t.alignedToWeek && t.mustDoToday && t.status === "todo",
  );

  const questionar = sortedLiveTasks.filter(
    (t) => !t.alignedToWeek && !t.mustDoToday && t.status === "todo",
  );

  const criticalTasks = sortedTasks.filter((t) => t.status === "critical");
  const activeTasks = sortedTasks.filter((t) => t.status === "todo");

  const weekTasks = activeTasks.filter((t) => t.category === "semana");
  const morningTasks = activeTasks.filter((t) => t.category === "prioridade");
  const otherTasks = activeTasks.filter(
    (t) => t.category !== "semana" && t.category !== "prioridade",
  );

  const doneTasks = sortedTasks.filter((t) => t.status === "done");

  const done = tasks.filter((t) => t.status === "done").length;

  const existingCategories = Array.from(
    new Set(
      tasks.map((task) => String(task.category || "").trim()).filter(Boolean),
    ),
  ).sort();

  const listTasks: ListTask[] = liveTasks.filter((task) =>
    isPendingStatus(task.status),
  );

  const categoryGroups = Array.from(
    listTasks.reduce((map, task) => {
      const categoryName = String(task.category || "").trim() || "Sem lista";

      if (!map.has(categoryName)) {
        map.set(categoryName, []);
      }

      map.get(categoryName)!.push(task);

      return map;
    }, new Map<string, ListTask[]>()),
  ).sort(([a], [b]) => {
    if (a === "Sem lista") return -1;
    if (b === "Sem lista") return 1;
    return a.localeCompare(b);
  });

  const orderedCategoryGroups = [...categoryGroups].sort(([a], [b]) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);

    if (aIndex === -1 && bIndex === -1) {
      return a.localeCompare(b);
    }

    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;

    return aIndex - bIndex;
  });

  function moveCategory(categoryName: string, direction: "left" | "right") {
    const currentOrder =
      categoryOrder.length > 0
        ? [...categoryOrder]
        : orderedCategoryGroups.map(([name]) => name);

    const index = currentOrder.indexOf(categoryName);

    if (index === -1) return;

    const targetIndex = direction === "left" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= currentOrder.length) {
      return;
    }

    const nextOrder = [...currentOrder];

    [nextOrder[index], nextOrder[targetIndex]] = [
      nextOrder[targetIndex],
      nextOrder[index],
    ];

    setCategoryOrder(nextOrder);
  }

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

  const dailyRisk = String(dailyData.morning?.challenges || "").trim();
  const dailyResponse = String(dailyData.morning?.virtueOfDay || "").trim();

  const hasDailyAdjustment = Boolean(dailyRisk || dailyResponse);

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

        {hasDailyAdjustment && (
          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-primary/70">
                Condução do dia
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                O que surgiu hoje e como você escolheu responder.
              </p>
            </div>

            {dailyRisk && (
              <div className="rounded-xl border border-border/30 bg-background/60 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  O que surgiu
                </p>
                <p className="mt-1 text-sm leading-relaxed">{dailyRisk}</p>
              </div>
            )}

            {dailyResponse && (
              <div className="rounded-xl border border-border/30 bg-background/60 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Como responder
                </p>
                <p className="mt-1 text-sm leading-relaxed">{dailyResponse}</p>
              </div>
            )}
          </section>
        )}

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
              title="Prioridade"
              items={fazerAgora}
              onMoveTask={moveTaskToQuadrant}
              onCompleteTask={completeLiveTask}
              onCancelTask={cancelLiveTask}
              onEditTask={updateLiveTaskDetails}
            />

            <MatrixCard
              title="Planejar"
              items={planejar}
              onMoveTask={moveTaskToQuadrant}
              onCompleteTask={completeLiveTask}
              onCancelTask={cancelLiveTask}
              onEditTask={updateLiveTaskDetails}
            />

            <MatrixCard
              title="Pendências"
              items={resolverRapido}
              onMoveTask={moveTaskToQuadrant}
              onCompleteTask={completeLiveTask}
              onCancelTask={cancelLiveTask}
              onEditTask={updateLiveTaskDetails}
            />

            <MatrixCard
              title="Refletir"
              items={questionar}
              onMoveTask={moveTaskToQuadrant}
              onCompleteTask={completeLiveTask}
              onCancelTask={cancelLiveTask}
              onEditTask={updateLiveTaskDetails}
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
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Detalhes (opcional)"
            className="bg-transparent border-b border-0 border-border/40 rounded-none focus-visible:ring-0 px-0 h-9 text-sm text-muted-foreground"
          />

          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Lista ou categoria (opcional)"
            className="bg-transparent border-b border-0 border-border/40 rounded-none focus-visible:ring-0 px-0 h-9 text-sm text-muted-foreground"
          />

          {existingCategories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {existingCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategory(category)}
                  className="rounded-full border border-border/40 bg-muted/20 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  {category}
                </button>
              ))}
            </div>
          )}

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

        {categoryGroups.length > 0 && (
          <section className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-primary/70">
                Listas
              </p>
              <p className="text-xs text-muted-foreground">
                Tarefas agrupadas por lista ou categoria.
              </p>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2">
              {orderedCategoryGroups.map(([categoryName, categoryTasks]) => (
                <CategoryListCard
                  key={categoryName}
                  categoryName={categoryName}
                  categoryTasks={categoryTasks}
                  onRenameCategory={renameCategory}
                  onMoveLeft={() => moveCategory(categoryName, "left")}
                  onMoveRight={() => moveCategory(categoryName, "right")}
                  onMarkDone={completeLiveTask}
                  onCancelTask={cancelLiveTask}
                  onEditTask={updateLiveTaskDetails}
                />
              ))}
            </div>
          </section>
        )}

        {loadingTasks && (
          <div className="flex flex-col items-center justify-center text-muted-foreground/50 gap-3 py-10">
            <Circle className="w-10 h-10 stroke-[1.5]" />
            <p className="font-serif italic">Carregando tarefas...</p>
          </div>
        )}

        {!loadingTasks && (tasks.length > 0 || accumulatedTasks.length > 0) && (
          <section className="rounded-3xl border border-border/40 bg-card/80 p-5 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.3em] text-primary/70">
                  Resumo das tarefas
                </p>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  O que continua em aberto e o que já foi concluído.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setTaskHistoryOpen((prev) => !prev)}
                className="text-xs text-muted-foreground"
              >
                {taskHistoryOpen ? "Fechar" : "Ver detalhes"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-border/30 bg-background/70 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Em aberto
                </p>

                <p className="mt-1 font-serif text-2xl">{openTasks.length}</p>
              </div>

              <div className="rounded-2xl border border-border/30 bg-background/70 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Fazer agora
                </p>

                <p className="mt-1 font-serif text-2xl">{fazerAgora.length}</p>
              </div>

              <div className="rounded-2xl border border-border/30 bg-background/70 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Pendentes antigas
                </p>

                <p className="mt-1 font-serif text-2xl">
                  {accumulatedTasks.length}
                </p>
              </div>

              <div className="rounded-2xl border border-border/30 bg-background/70 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Feitas
                </p>

                <p className="mt-1 font-serif text-2xl">{doneTasks.length}</p>
              </div>
            </div>
          </section>
        )}

        {!loadingTasks && taskHistoryOpen && accumulatedTasks.length > 0 && (
          <TaskSection
            title="Pendências acumuladas"
            subtitle="não concluídas em dias anteriores"
            count={accumulatedTasks.length}
            open={showAccumulatedTasks}
            onToggle={() => setShowAccumulatedTasks(!showAccumulatedTasks)}
          >
            {accumulatedTasks.map((task) => (
              <PendingTaskItem
                key={`${task.sourceDate}-${task.id}`}
                task={task}
                onMarkDone={markPendingDone}
                onDiscard={discardPending}
              />
            ))}
          </TaskSection>
        )}

        {!loadingTasks && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center text-muted-foreground/50 gap-3 py-10">
            <Circle className="w-10 h-10 stroke-[1.5]" />
            <p className="font-serif italic">Nenhuma tarefa para hoje</p>
          </div>
        )}

        {!loadingTasks && taskHistoryOpen && tasks.length > 0 && (
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
                  tasks={tasks}
                  saveTasks={saveTasks}
                  onEditTask={updateLiveTaskDetails}
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
                  tasks={tasks}
                  saveTasks={saveTasks}
                  onEditTask={updateLiveTaskDetails}
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
                  tasks={tasks}
                  saveTasks={saveTasks}
                  onEditTask={updateLiveTaskDetails}
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
                  tasks={tasks}
                  saveTasks={saveTasks}
                  onEditTask={updateLiveTaskDetails}
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
                  tasks={tasks}
                  saveTasks={saveTasks}
                  onEditTask={updateLiveTaskDetails}
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

function CategoryListCard({
  categoryName,
  categoryTasks,
  onRenameCategory,
  onMoveLeft,
  onMoveRight,
  onMarkDone,
  onCancelTask,
  onEditTask,
}: {
  categoryName: string;
  categoryTasks: ListTask[];
  onRenameCategory: (oldName: string, newName: string) => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onMarkDone: (task: ListTask) => void;
  onCancelTask: (task: ListTask) => void;
  onEditTask: (
    task: ListTask,
    patch: Pick<Task, "title" | "details" | "category" | "time">,
  ) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(categoryName);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draftTaskTitle, setDraftTaskTitle] = useState("");
  const [draftTaskDetails, setDraftTaskDetails] = useState("");
  const [draftTaskCategory, setDraftTaskCategory] = useState("");
  const [draftTaskTime, setDraftTaskTime] = useState("");

  function saveName() {
    const nextName = draftName.trim();

    if (!nextName) return;

    onRenameCategory(categoryName, nextName);
    setEditing(false);
  }

  function startTaskEdit(task: ListTask) {
    setEditingTaskId(task.id);
    setDraftTaskTitle(task.title);
    setDraftTaskDetails(task.details || "");
    setDraftTaskCategory(task.category || "");
    setDraftTaskTime(task.time || "");
  }

  function cancelTaskEdit() {
    setEditingTaskId(null);
    setDraftTaskTitle("");
    setDraftTaskDetails("");
    setDraftTaskCategory("");
    setDraftTaskTime("");
  }

  async function saveTaskEdit(task: ListTask) {
    if (!draftTaskTitle.trim()) return;

    await onEditTask(task, {
      title: draftTaskTitle,
      details: draftTaskDetails,
      category: draftTaskCategory,
      time: draftTaskTime,
    });

    cancelTaskEdit();
  }

  return (
    <div className="min-w-[240px] max-w-[260px] rounded-2xl border border-border/40 bg-card p-4 space-y-3">
      <div className="space-y-2">
        {editing ? (
          <div className="space-y-2">
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="h-8 bg-background text-sm"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveName}
                className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] text-primary"
              >
                Salvar
              </button>

              <button
                type="button"
                onClick={() => {
                  setDraftName(categoryName);
                  setEditing(false);
                }}
                className="rounded-lg border border-border/40 px-2 py-1 text-[11px] text-muted-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-serif text-lg">{categoryName}</p>
              <p className="text-xs text-muted-foreground">
                {categoryTasks.length} tarefa
                {categoryTasks.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onMoveLeft}
                className="rounded-md border border-border/30 px-1.5 py-0.5 text-[11px] text-muted-foreground/70 transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                ←
              </button>

              <button
                type="button"
                onClick={onMoveRight}
                className="rounded-md border border-border/30 px-1.5 py-0.5 text-[11px] text-muted-foreground/70 transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                →
              </button>

              {categoryName !== "Sem lista" && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-[11px] text-muted-foreground"
                >
                  Editar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {categoryTasks.slice(0, 5).map((task) => (
          <div
            key={task.id}
            className="rounded-xl border border-border/30 bg-background px-3 py-2"
          >
            {editingTaskId === task.id ? (
              <div className="space-y-2">
                <Input
                  value={draftTaskTitle}
                  onChange={(e) => setDraftTaskTitle(e.target.value)}
                  placeholder="Título"
                  className="h-8 bg-background text-sm"
                />

                <Input
                  value={draftTaskDetails}
                  onChange={(e) => setDraftTaskDetails(e.target.value)}
                  placeholder="Detalhes"
                  className="h-8 bg-background text-sm"
                />

                <Input
                  value={draftTaskCategory}
                  onChange={(e) => setDraftTaskCategory(e.target.value)}
                  placeholder="Lista ou categoria"
                  className="h-8 bg-background text-sm"
                />

                <Input
                  value={draftTaskTime}
                  onChange={(e) => setDraftTaskTime(e.target.value)}
                  placeholder="Horário"
                  className="h-8 bg-background text-sm"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveTaskEdit(task)}
                    disabled={!draftTaskTitle.trim()}
                    className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] text-primary disabled:opacity-40"
                  >
                    Salvar
                  </button>

                  <button
                    type="button"
                    onClick={cancelTaskEdit}
                    className="rounded-lg border border-border/40 px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm leading-snug">{task.title}</p>

                <div className="mt-1 flex flex-wrap gap-1">
                  <WeeklyProofBadge task={task} />
                  <MorningPriorityBadge task={task} />
                </div>

                {task.details && (
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {task.details}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-1">
                  {task.alignedToWeek && (
                    <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] text-primary/70">
                      Semana
                    </span>
                  )}

                  {task.mustDoToday && (
                    <span className="rounded-full border border-amber-300/50 bg-amber-50/30 px-2 py-0.5 text-[10px] text-amber-700">
                      Hoje
                    </span>
                  )}

                  <span className="rounded-full border border-border/30 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {task.status}
                  </span>

                  {task.isAccumulated && (
                    <span className="rounded-full border border-amber-300/50 bg-amber-50/30 px-2 py-0.5 text-[10px] text-amber-700">
                      Em aberto
                    </span>
                  )}
                </div>

                <div className="mt-2 grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => startTaskEdit(task)}
                    className="rounded-lg border border-border/40 bg-card px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => onMarkDone(task)}
                    className="rounded-lg border border-border/40 bg-card px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    Marcar feita
                  </button>

                  <button
                    type="button"
                    onClick={() => onCancelTask(task)}
                    className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Descartar
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {categoryTasks.length > 5 && (
          <p className="text-xs text-muted-foreground">
            +{categoryTasks.length - 5} tarefa
            {categoryTasks.length - 5 === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </div>
  );
}

function MatrixCard({
  title,
  items,
  onMoveTask,
  onCompleteTask,
  onCancelTask,
  onEditTask,
}: {
  title: string;
  items: ListTask[];
  onMoveTask: (
    task: ListTask,
    nextAlignedToWeek: boolean,
    nextMustDoToday: boolean,
  ) => void;
  onCompleteTask: (task: ListTask) => void;
  onCancelTask: (task: ListTask) => void;
  onEditTask: (
    task: ListTask,
    patch: Pick<Task, "title" | "details" | "category" | "time">,
  ) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [openMoveTaskId, setOpenMoveTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draftTaskTitle, setDraftTaskTitle] = useState("");
  const [draftTaskDetails, setDraftTaskDetails] = useState("");
  const [draftTaskCategory, setDraftTaskCategory] = useState("");
  const [draftTaskTime, setDraftTaskTime] = useState("");

  function startTaskEdit(task: ListTask) {
    setEditingTaskId(task.id);
    setDraftTaskTitle(task.title);
    setDraftTaskDetails(task.details || "");
    setDraftTaskCategory(task.category || "");
    setDraftTaskTime(task.time || "");
  }

  function cancelTaskEdit() {
    setEditingTaskId(null);
    setDraftTaskTitle("");
    setDraftTaskDetails("");
    setDraftTaskCategory("");
    setDraftTaskTime("");
  }

  async function saveTaskEdit(task: ListTask) {
    if (!draftTaskTitle.trim()) return;

    await onEditTask(task, {
      title: draftTaskTitle,
      details: draftTaskDetails,
      category: draftTaskCategory,
      time: draftTaskTime,
    });

    cancelTaskEdit();
  }

  const hasMore = items.length > 2;
  const visibleItems = expanded ? items : items.slice(0, 2);

  return (
    <div className="rounded-2xl border border-border/40 bg-card p-4 min-h-[150px]">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-primary/70">
          {title}
        </p>
      </div>

      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 italic">
            Nenhuma tarefa
          </p>
        ) : (
          visibleItems.map((task) => (
            <div
              key={task.id}
              className="rounded-xl border border-border/30 bg-background/30 px-3 py-2"
            >
              <p className="text-sm leading-snug">{task.title}</p>

              <div className="mt-1 flex flex-wrap gap-1">
                <WeeklyProofBadge task={task} />
                <MorningPriorityBadge task={task} />
              </div>

              {editingTaskId === task.id && (
                <div className="mt-2 space-y-2">
                  <Input
                    value={draftTaskTitle}
                    onChange={(e) => setDraftTaskTitle(e.target.value)}
                    placeholder="Título"
                    className="h-8 bg-background text-sm"
                  />

                  <Input
                    value={draftTaskDetails}
                    onChange={(e) => setDraftTaskDetails(e.target.value)}
                    placeholder="Detalhes"
                    className="h-8 bg-background text-sm"
                  />

                  <Input
                    value={draftTaskCategory}
                    onChange={(e) => setDraftTaskCategory(e.target.value)}
                    placeholder="Lista ou categoria"
                    className="h-8 bg-background text-sm"
                  />

                  <Input
                    value={draftTaskTime}
                    onChange={(e) => setDraftTaskTime(e.target.value)}
                    placeholder="Horário"
                    className="h-8 bg-background text-sm"
                  />

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveTaskEdit(task)}
                      disabled={!draftTaskTitle.trim()}
                      className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] text-primary disabled:opacity-40"
                    >
                      Salvar
                    </button>

                    <button
                      type="button"
                      onClick={cancelTaskEdit}
                      className="rounded-lg border border-border/40 px-2 py-1 text-[11px] text-muted-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-2 flex flex-col items-start gap-1.5">
                <button
                  type="button"
                  onClick={() => startTaskEdit(task)}
                  className="text-[10px] rounded-full border border-border/40 px-2 py-0.5 text-muted-foreground"
                >
                  Editar
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setOpenMoveTaskId(
                      openMoveTaskId === task.id ? null : task.id,
                    )
                  }
                  className="text-[10px] rounded-full border border-border/40 px-2 py-0.5 text-muted-foreground"
                >
                  Mover ▾
                </button>

                <button
                  type="button"
                  onClick={() => onCompleteTask(task)}
                  className="rounded-full border border-emerald-300/40 bg-emerald-50/40 px-3 py-1 text-[11px] text-emerald-700"
                >
                  ✓ Feita
                </button>

                <button
                  type="button"
                  onClick={() => onCancelTask(task)}
                  className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  Descartar
                </button>

                {openMoveTaskId === task.id && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {title !== "Prioridade" && (
                      <button
                        type="button"
                        onClick={() => {
                          onMoveTask(task, true, true);
                          setOpenMoveTaskId(null);
                        }}
                        className="text-[10px] rounded-full border border-border/40 px-2 py-0.5 text-muted-foreground"
                      >
                        Prioridade
                      </button>
                    )}

                    {title !== "Planejar" && (
                      <button
                        type="button"
                        onClick={() => {
                          onMoveTask(task, true, false);
                          setOpenMoveTaskId(null);
                        }}
                        className="text-[10px] rounded-full border border-border/40 px-2 py-0.5 text-muted-foreground"
                      >
                        Planejar
                      </button>
                    )}

                    {title !== "Pendências" && (
                      <button
                        type="button"
                        onClick={() => {
                          onMoveTask(task, false, true);
                          setOpenMoveTaskId(null);
                        }}
                        className="text-[10px] rounded-full border border-border/40 px-2 py-0.5 text-muted-foreground"
                      >
                        Pendências
                      </button>
                    )}

                    {title !== "Refletir" && (
                      <button
                        type="button"
                        onClick={() => {
                          onMoveTask(task, false, false);
                          setOpenMoveTaskId(null);
                        }}
                        className="text-[10px] rounded-full border border-border/40 px-2 py-0.5 text-muted-foreground"
                      >
                        Refletir
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {(hasMore || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-border/40 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60"
        >
          {expanded ? "Recolher" : `Ver todas · +${items.length - 2}`}

          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
      )}
    </div>
  );
}
