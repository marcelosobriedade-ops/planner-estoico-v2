import React, { useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Input } from "@/components/ui/input";
import { Check, Plus, Trash2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Habit {
  id: string;
  title: string;
}

const DEFAULT_HABITS: Habit[] = [
  { id: "1", title: "Meditação (10m)" },
  { id: "2", title: "Leitura (15m)" },
  { id: "3", title: "Exercício físico" },
];

export default function Habits() {
  // Global list of habits
  const [habits, setHabits] = useLocalStorage<Habit[]>(
    "global-habits",
    DEFAULT_HABITS,
  );

  // Completed habits for today
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );
  const [completed, setCompleted] = useLocalStorage<string[]>(
    `${dateKey}-habits-completed`,
    [],
  );

  const [newHabit, setNewHabit] = useState("");

  const addHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabit.trim()) return;

    setHabits([
      ...habits,
      { id: Date.now().toString(), title: newHabit.trim() },
    ]);
    setNewHabit("");
  };

  const deleteHabit = (id: string) => {
    setHabits(habits.filter((h) => h.id !== id));
    // also remove from completed if there
    setCompleted(completed.filter((c) => c !== id));
  };

  const toggleHabit = (id: string) => {
    if (completed.includes(id)) {
      setCompleted(completed.filter((c) => c !== id));
    } else {
      setCompleted([...completed, id]);
    }
  };

  return (
    <Layout>
      <Header title="Hábitos" />
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="mb-6 flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <p className="text-muted-foreground font-serif italic text-center">
            "A excelência não é um ato, mas um hábito."
          </p>
        </div>

        <form onSubmit={addHabit} className="relative mb-8 flex-shrink-0">
          <Input
            value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)}
            placeholder="Novo hábito..."
            className="bg-card/50 border-border/50 h-14 rounded-xl pr-12 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
          />
          <button
            type="submit"
            className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>

        <div className="flex-1 overflow-y-auto space-y-3 pb-8 -mx-2 px-2">
          {habits.length === 0 ? (
            <p className="text-center text-muted-foreground/60 py-8 italic font-serif">
              Nenhum hábito configurado.
            </p>
          ) : (
            habits.map((habit) => {
              const isCompleted = completed.includes(habit.id);

              return (
                <div
                  key={habit.id}
                  className={cn(
                    "group flex items-center gap-4 p-4 bg-card rounded-xl border transition-all cursor-pointer",
                    isCompleted
                      ? "border-primary/50 shadow-sm bg-primary/5"
                      : "border-border/30 hover:border-border/60 shadow-sm",
                  )}
                  onClick={() => toggleHabit(habit.id)}
                >
                  <div
                    className={cn(
                      "flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors",
                      isCompleted
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-primary/30 text-transparent",
                    )}
                  >
                    <Check className="w-4 h-4" />
                  </div>
                  <span
                    className={cn(
                      "flex-1 font-medium transition-all text-lg",
                      isCompleted ? "text-foreground" : "text-foreground/80",
                    )}
                  >
                    {habit.title}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteHabit(habit.id);
                    }}
                    className="p-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Layout>
  );
}
