import React from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { getFormattedDate, getQuoteOfDay, getCurrentDateKey } from "@/lib/date";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { 
  Sun, CheckSquare, Wallet, Smile, 
  Users, Moon, Repeat 
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types derived from other pages to compute stats
interface Task { id: string; status: "todo" | "done" | "cancelled" }
interface Habit { id: string }
interface EmotionsState { morning: { emotion: string | null }, afternoon: { emotion: string | null }, evening: { emotion: string | null } }

export default function Home() {
  const dateKey = getCurrentDateKey();
  
  // Fetch stats from local storage for modules
  const [priorities] = useLocalStorage<string[]>(`${dateKey}-morning`, ["", "", ""]);
  const prioritiesSet = priorities.filter(p => p.trim() !== "").length;
  
  const [tasks] = useLocalStorage<Task[]>(`${dateKey}-tasks`, []);
  const completedTasks = tasks.filter(t => t.status === "done").length;
  
  const [emotions] = useLocalStorage<EmotionsState>(`${dateKey}-emotions`, { morning: { emotion: null }, afternoon: { emotion: null }, evening: { emotion: null } });
  const checkinsDone = [emotions.morning.emotion, emotions.afternoon.emotion, emotions.evening.emotion].filter(Boolean).length;
  
  const [habits] = useLocalStorage<Habit[]>("global-habits", []);
  const [completedHabits] = useLocalStorage<string[]>(`${dateKey}-habits-completed`, []);
  
  const [evening] = useLocalStorage<{ good: string, different: string, learned: string }>(`${dateKey}-evening`, { good: "", different: "", learned: "" });
  const eveningDone = (evening.good.trim() !== "" || evening.different.trim() !== "" || evening.learned.trim() !== "");

  const modules = [
    {
      id: "manha",
      title: "Manhã",
      icon: <Sun className="w-5 h-5" />,
      path: "/manha",
      status: prioritiesSet > 0 ? `${prioritiesSet}/3 definidas` : "A planejar",
      active: prioritiesSet > 0,
      color: "text-amber-600 bg-amber-500/10 border-amber-500/20"
    },
    {
      id: "tarefas",
      title: "Tarefas",
      icon: <CheckSquare className="w-5 h-5" />,
      path: "/tarefas",
      status: tasks.length > 0 ? `${completedTasks}/${tasks.length} concluídas` : "Nenhuma tarefa",
      active: completedTasks > 0 && completedTasks === tasks.length,
      color: "text-blue-600 bg-blue-500/10 border-blue-500/20"
    },
    {
      id: "financeiro",
      title: "Financeiro",
      icon: <Wallet className="w-5 h-5" />,
      path: "/financeiro",
      status: "Acompanhar",
      active: false,
      color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
    },
    {
      id: "emocoes",
      title: "Emoções",
      icon: <Smile className="w-5 h-5" />,
      path: "/emocoes",
      status: `${checkinsDone}/3 check-ins`,
      active: checkinsDone === 3,
      color: "text-rose-600 bg-rose-500/10 border-rose-500/20"
    },
    {
      id: "habitos",
      title: "Hábitos",
      icon: <Repeat className="w-5 h-5" />,
      path: "/habitos",
      status: habits.length > 0 ? `${completedHabits.length}/${habits.length} feitos` : "Nenhum hábito",
      active: habits.length > 0 && completedHabits.length === habits.length,
      color: "text-teal-600 bg-teal-500/10 border-teal-500/20"
    },
    {
      id: "pessoas",
      title: "Pessoas",
      icon: <Users className="w-5 h-5" />,
      path: "/pessoas",
      status: "Refletir",
      active: false,
      color: "text-indigo-600 bg-indigo-500/10 border-indigo-500/20"
    },
    {
      id: "noite",
      title: "Noite",
      icon: <Moon className="w-5 h-5" />,
      path: "/noite",
      status: eveningDone ? "Reflexão feita" : "Pendente",
      active: eveningDone,
      color: "text-slate-600 bg-slate-500/10 border-slate-500/20"
    }
  ];

  return (
    <Layout>
      <div className="flex-1 flex flex-col pt-12 pb-8 px-6 bg-background">
        <header className="mb-10 text-center space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {getFormattedDate()}
          </p>
          <h1 className="text-3xl font-serif text-foreground">Planner Estoico</h1>
        </header>

        <section className="mb-10 px-4 py-8 relative">
          <div className="absolute inset-0 bg-primary/5 rounded-2xl border border-primary/10 -rotate-1" />
          <div className="absolute inset-0 bg-card rounded-2xl border border-border/50 shadow-sm" />
          <p className="relative font-serif text-lg leading-relaxed text-center text-foreground italic">
            "{getQuoteOfDay().split('—')[0].trim()}"
          </p>
          <p className="relative text-right mt-4 text-sm font-medium text-muted-foreground uppercase tracking-widest">
            — {getQuoteOfDay().split('—')[1].trim()}
          </p>
        </section>

        <div className="grid grid-cols-2 gap-4">
          {modules.map((m, i) => (
            <Link key={m.id} href={m.path}>
              <div className={cn(
                "h-full p-4 rounded-2xl border bg-card transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col gap-3 shadow-sm hover:shadow-md",
                m.active ? "border-primary/30" : "border-border/40",
                i === 6 ? "col-span-2 flex-row items-center justify-between" : "" // Make evening span full width
              )}>
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", m.color)}>
                  {m.icon}
                </div>
                <div className={i === 6 ? "flex-1 text-right" : ""}>
                  <h3 className="font-serif font-medium text-foreground text-lg leading-none">{m.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{m.status}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
