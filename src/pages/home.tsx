import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { getQuoteOfDay, getCurrentDateKey } from "@/lib/date";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  Sun,
  CheckSquare,
  Wallet,
  Smile,
  Users,
  Moon,
  Repeat,
} from "lucide-react";
import {
  EMPTY_MORNING_RITUAL,
  EMPTY_NIGHT_RITUAL,
  getMorningStatus,
  getNightStatus,
} from "@/lib/ritual";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

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

export default function Home() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [data, setData] = useState<DailyData>({});

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data } = await supabase
        .from("daily_records")
        .select("data")
        .eq("user_id", session.user.id)
        .eq("date", dateKey)
        .maybeSingle();

      setData((data?.data || {}) as DailyData);
    }

    load();
  }, [dateKey]);

  // SAFE (não quebra mais)
  const tasks = data.tasks || [];
  const completedTasks = tasks.filter((t: any) => t.status === "done").length;

  const emotions = data.emotions || {};
  const checkinsDone = [
    emotions.morning?.emotion,
    emotions.afternoon?.emotion,
    emotions.evening?.emotion,
  ].filter(Boolean).length;

  const habits = data.habits || [];
  const completedHabits = data.habitsCompleted || [];

  const morningStatus = getMorningStatus(data.morning || EMPTY_MORNING_RITUAL);

  const nightStatus = getNightStatus(data.evening || EMPTY_NIGHT_RITUAL);

  const modules = [
    {
      title: "Manhã",
      path: "/manha",
      icon: <Sun />,
      status: morningStatus,
    },
    {
      title: "Tarefas",
      path: "/tarefas",
      icon: <CheckSquare />,
      status:
        tasks.length > 0 ? `${completedTasks}/${tasks.length}` : "Nenhuma",
    },
    {
      title: "Financeiro",
      path: "/financeiro",
      icon: <Wallet />,
      status: "Acompanhar",
    },
    {
      title: "Emoções",
      path: "/emocoes",
      icon: <Smile />,
      status: `${checkinsDone}/3`,
    },
    {
      title: "Hábitos",
      path: "/habitos",
      icon: <Repeat />,
      status:
        habits.length > 0
          ? `${completedHabits.length}/${habits.length}`
          : "Nenhum",
    },
    {
      title: "Pessoas",
      path: "/pessoas",
      icon: <Users />,
      status: "Refletir",
    },
    {
      title: "Noite",
      path: "/noite",
      icon: <Moon />,
      status: nightStatus,
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-serif text-center">Planner Estoico</h1>

        <p className="text-center italic">"{getQuoteOfDay()}"</p>

        <div className="grid grid-cols-2 gap-4">
          {modules.map((m) => (
            <Link key={m.title} href={m.path}>
              <div className="p-4 border rounded-xl cursor-pointer hover:shadow-sm">
                <div className="mb-2">{m.icon}</div>
                <h3 className="font-medium">{m.title}</h3>
                <p className="text-sm text-muted-foreground">{m.status}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
