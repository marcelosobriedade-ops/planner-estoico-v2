import React, { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { getFormattedDate, getQuoteOfDay, getCurrentDateKey } from "@/lib/date";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  Sun,
  CheckSquare,
  Wallet,
  Smile,
  Users,
  Moon,
  Repeat,
  Flame,
  CheckCircle2,
  X,
} from "lucide-react";
import { DailyRitual, EMPTY_RITUAL, getRitualStatus } from "@/lib/ritual";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  status: "todo" | "done" | "cancelled";
}
interface Habit {
  id: string;
}
interface EmotionsState {
  morning: { emotion: string | null };
  afternoon: { emotion: string | null };
  evening: { emotion: string | null };
}

const MODULE_KEYS = [
  "morning",
  "tasks",
  "financial",
  "emotions",
  "evening",
  "people",
  "habits-completed",
] as const;

export default function Home() {
  const [dateKey, setDateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const goToPreviousDay = () => {
    const d = new Date(dateKey + "T00:00:00");
    d.setDate(d.getDate() - 1);
    setDateKey(d.toISOString().slice(0, 10));
  };

  const goToNextDay = () => {
    const d = new Date(dateKey + "T00:00:00");
    d.setDate(d.getDate() + 1);
    setDateKey(d.toISOString().slice(0, 10));
  };

  const goToToday = () => {
    setDateKey(getCurrentDateKey());
  };

  const [priorities] = useLocalStorage<string[]>(`${dateKey}-morning`, [
    "",
    "",
    "",
  ]);
  const prioritiesSet = priorities.filter((p) => p.trim() !== "").length;

  const [tasks] = useLocalStorage<Task[]>(`${dateKey}-tasks`, []);
  const completedTasks = tasks.filter((t) => t.status === "done").length;

  const [emotions] = useLocalStorage<EmotionsState>(`${dateKey}-emotions`, {
    morning: { emotion: null },
    afternoon: { emotion: null },
    evening: { emotion: null },
  });
  const checkinsDone = [
    emotions.morning.emotion,
    emotions.afternoon.emotion,
    emotions.evening.emotion,
  ].filter(Boolean).length;

  const [habits] = useLocalStorage<Habit[]>("global-habits", []);
  const [completedHabits] = useLocalStorage<string[]>(
    `${dateKey}-habits-completed`,
    [],
  );

  const [ritual] = useLocalStorage<DailyRitual>(`${dateKey}-ritual`, EMPTY_RITUAL);
  const ritualStatus = getRitualStatus(ritual);

  const [evening] = useLocalStorage<{
    good: string;
    different: string;
    learned: string;
  }>(`${dateKey}-evening`, { good: "", different: "", learned: "" });
  const eveningDone =
    evening.good.trim() !== "" ||
    evening.different.trim() !== "" ||
    evening.learned.trim() !== "";

  // Day cycle state
  const [dayClosed, setDayClosed] = useLocalStorage<boolean>(
    `${dateKey}-closed`,
    false,
  );
  const [showCloseSuccess, setShowCloseSuccess] = useState(false);
  const [newDayStep, setNewDayStep] = useState<"idle" | "confirm">("idle");

  const handleCloseDay = () => {
    setDayClosed(true);
    setShowCloseSuccess(true);
    setTimeout(() => setShowCloseSuccess(false), 3000);
  };

  const handleNewDay = (saveFirst: boolean) => {
    if (saveFirst) {
      localStorage.setItem(`${dateKey}-closed`, JSON.stringify(true));
    }

    MODULE_KEYS.forEach((k) => {
      localStorage.removeItem(`${dateKey}-${k}`);
    });

    setNewDayStep("idle");
    window.location.reload();
  };

  const modules = [
    {
      id: "manha",
      title: "Manhã",
      icon: <Sun className="w-5 h-5" />,
      path: "/manha",
      status: prioritiesSet > 0 ? `${prioritiesSet}/3 definidas` : "A planejar",
      active: prioritiesSet > 0,
      color: "text-amber-600 bg-amber-500/10 border-amber-500/20",
    },
    {
      id: "tarefas",
      title: "Tarefas",
      icon: <CheckSquare className="w-5 h-5" />,
      path: "/tarefas",
      status:
        tasks.length > 0
          ? `${completedTasks}/${tasks.length} concluídas`
          : "Nenhuma tarefa",
      active: completedTasks > 0 && completedTasks === tasks.length,
      color: "text-blue-600 bg-blue-500/10 border-blue-500/20",
    },
    {
      id: "financeiro",
      title: "Financeiro",
      icon: <Wallet className="w-5 h-5" />,
      path: "/financeiro",
      status: "Acompanhar",
      active: false,
      color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      id: "emocoes",
      title: "Emoções",
      icon: <Smile className="w-5 h-5" />,
      path: "/emocoes",
      status: `${checkinsDone}/3 check-ins`,
      active: checkinsDone === 3,
      color: "text-rose-600 bg-rose-500/10 border-rose-500/20",
    },
    {
      id: "habitos",
      title: "Hábitos",
      icon: <Repeat className="w-5 h-5" />,
      path: "/habitos",
      status:
        habits.length > 0
          ? `${completedHabits.length}/${habits.length} feitos`
          : "Nenhum hábito",
      active: habits.length > 0 && completedHabits.length === habits.length,
      color: "text-teal-600 bg-teal-500/10 border-teal-500/20",
    },
    {
      id: "pessoas",
      title: "Pessoas",
      icon: <Users className="w-5 h-5" />,
      path: "/pessoas",
      status: "Refletir",
      active: false,
      color: "text-indigo-600 bg-indigo-500/10 border-indigo-500/20",
    },
    {
      id: "ritual",
      title: "Ritual Diário",
      icon: <Flame className="w-5 h-5" />,
      path: "/ritual",
      status: ritualStatus,
      active: ritualStatus === "Completo",
      color: "text-orange-600 bg-orange-500/10 border-orange-500/20",
    },
    {
      id: "noite",
      title: "Noite",
      icon: <Moon className="w-5 h-5" />,
      path: "/noite",
      status: eveningDone ? "Reflexão feita" : "Pendente",
      active: eveningDone,
      color: "text-slate-600 bg-slate-500/10 border-slate-500/20",
    },
  ];

  return (
    <Layout>
      <div className="flex-1 flex flex-col pt-12 pb-8 px-6 bg-background">
        <header className="mb-10 text-center space-y-3">
          <div className="flex gap-2 justify-center mb-4">
            <button onClick={goToPreviousDay}>←</button>
            <button onClick={goToToday}>Hoje</button>
            <button onClick={goToNextDay}>→</button>
          </div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {new Date(dateKey + "T00:00:00").toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <h1 className="text-3xl font-serif text-foreground">
            Planner Estoico
          </h1>
        </header>

        <section className="mb-10 px-4 py-8 relative">
          <div className="absolute inset-0 bg-primary/5 rounded-2xl border border-primary/10 -rotate-1" />
          <div className="absolute inset-0 bg-card rounded-2xl border border-border/50 shadow-sm" />
          <p className="relative font-serif text-lg leading-relaxed text-center text-foreground italic">
            "{getQuoteOfDay().split("—")[0].trim()}"
          </p>
          <p className="relative text-right mt-4 text-sm font-medium text-muted-foreground uppercase tracking-widest">
            — {getQuoteOfDay().split("—")[1].trim()}
          </p>
        </section>

        <div className="grid grid-cols-2 gap-4">
          {modules.map((m, i) => (
            <Link key={m.id} href={m.path}>
              <div
                className={cn(
                  "h-full p-4 rounded-2xl border bg-card transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col gap-3 shadow-sm hover:shadow-md",
                  m.active ? "border-primary/30" : "border-border/40",
                  i >= 6
                    ? "col-span-2 flex-row items-center justify-between"
                    : "",
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center border",
                    m.color,
                  )}
                >
                  {m.icon}
                </div>
                <div className={i >= 6 ? "flex-1 text-right" : ""}>
                  <h3 className="font-serif font-medium text-foreground text-lg leading-none">
                    {m.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {m.status}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Day cycle */}
        <div className="mt-10 border-t border-border/30 pt-8 space-y-4">
          {/* Success message */}
          {showCloseSuccess && (
            <div className="flex items-center gap-2 justify-center py-2 px-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Dia encerrado com sucesso.
            </div>
          )}

          {/* Encerrar dia */}
          {dayClosed ? (
            <div className="flex items-center justify-center gap-2 text-sm text-primary/70 font-medium py-2">
              <CheckCircle2 className="w-4 h-4" />
              Dia encerrado
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCloseDay}
              className="w-full py-3 rounded-xl border border-primary/30 text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
            >
              Encerrar dia
            </button>
          )}

          {/* Novo dia — confirm dialog */}
          {newDayStep === "idle" ? (
            <button
              type="button"
              onClick={() => setNewDayStep("confirm")}
              className="w-full py-3 rounded-xl border border-border/30 text-muted-foreground text-sm font-medium hover:bg-muted/40 transition-colors"
            >
              Novo dia
            </button>
          ) : (
            <div className="bg-card border border-border/40 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-foreground font-medium leading-relaxed">
                  Deseja encerrar o dia antes de iniciar o novo?
                </p>
                <button
                  type="button"
                  onClick={() => setNewDayStep("idle")}
                  className="p-1 text-muted-foreground/50 hover:text-muted-foreground rounded shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground/70 leading-relaxed">
                Os registros ativos do dia serao apagados. O historico de dias
                anteriores permanece intacto.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleNewDay(true)}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Encerrar e iniciar novo dia
                </button>
                <button
                  type="button"
                  onClick={() => handleNewDay(false)}
                  className="w-full py-2.5 rounded-xl border border-border/40 text-muted-foreground text-sm font-medium hover:bg-muted/50 transition-colors"
                >
                  Iniciar sem encerrar
                </button>
                <button
                  type="button"
                  onClick={() => setNewDayStep("idle")}
                  className="w-full py-2 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
