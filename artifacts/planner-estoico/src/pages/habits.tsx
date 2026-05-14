import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Input } from "@/components/ui/input";
import { Check, Plus, Trash2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface Habit {
  id: string;
  title: string;
}

type DailyData = {
  habits?: Habit[];
  habitsCompleted?: string[];
  [key: string]: any;
};

const DEFAULT_HABITS: Habit[] = [
  { id: "1", title: "Meditação (10m)" },
  { id: "2", title: "Leitura (15m)" },
  { id: "3", title: "Exercício físico" },
];

export default function Habits() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [habits, setHabits] = useState<Habit[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [dailyData, setDailyData] = useState<DailyData>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  const [newHabit, setNewHabit] = useState("");

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

      setDailyData(loaded);
      setHabits(loaded.habits || DEFAULT_HABITS);
      setCompleted(loaded.habitsCompleted || []);
    }

    load();
  }, [dateKey]);

  async function save(updatedHabits: Habit[], updatedCompleted: string[]) {
    if (!userId) return;

    const nextData: DailyData = {
      ...dailyData,
      habits: updatedHabits,
      habitsCompleted: updatedCompleted,
    };

    setHabits(updatedHabits);
    setCompleted(updatedCompleted);
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
      setSaveError("Erro ao salvar hábitos");
      console.error(error);
    }
  }

  const addHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabit.trim()) return;

    const updatedHabits = [
      ...habits,
      { id: crypto.randomUUID(), title: newHabit.trim() },
    ];

    save(updatedHabits, completed);
    setNewHabit("");
  };

  const deleteHabit = (id: string) => {
    const updatedHabits = habits.filter((h) => h.id !== id);
    const updatedCompleted = completed.filter((c) => c !== id);

    save(updatedHabits, updatedCompleted);
  };

  const toggleHabit = (id: string) => {
    const updatedCompleted = completed.includes(id)
      ? completed.filter((c) => c !== id)
      : [...completed, id];

    save(habits, updatedCompleted);
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

        {saveError && (
          <div className="text-red-500 text-sm mb-4">{saveError}</div>
        )}

        <form onSubmit={addHabit} className="relative mb-8 flex-shrink-0">
          <Input
            value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)}
            placeholder="Novo hábito..."
            className="h-14 pr-12"
          />

          <button
            type="submit"
            className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-muted rounded-lg"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>

        <div className="flex-1 overflow-y-auto space-y-3 pb-8">
          {habits.map((habit) => {
            const isCompleted = completed.includes(habit.id);

            return (
              <div
                key={habit.id}
                className={cn(
                  "flex items-center gap-4 p-4 bg-card rounded-xl border cursor-pointer",
                  isCompleted && "bg-primary/10 border-primary",
                )}
                onClick={() => toggleHabit(habit.id)}
              >
                <div
                  className={cn(
                    "w-6 h-6 border-2 flex items-center justify-center",
                    isCompleted && "bg-primary text-white",
                  )}
                >
                  <Check className="w-4 h-4" />
                </div>

                <span className="flex-1">{habit.title}</span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteHabit(habit.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
