import React, { useEffect, useState } from "react";
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

export default function Home() {
  const [dateKey, setDateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [data, setData] = useState<DailyData>({});
  const [weeklyPlan, setWeeklyPlan] =
    useState<WeeklyPlanData>(EMPTY_WEEKLY_PLAN);

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

      const weekly = await loadWeeklyPlan(dateKey);
      setWeeklyPlan(weekly.plan);
    }

    load();
  }, [dateKey]);

  const morningStatus = getMorningStatus(data.morning || EMPTY_MORNING_RITUAL);

  const nightStatus = getNightStatus(data.evening || EMPTY_NIGHT_RITUAL);

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

          <h1 className="text-3xl font-serif">A Travessia</h1>
        </div>

        <div className="rounded-2xl border p-5 space-y-2">
          <p className="text-sm text-muted-foreground italic">
            {getQuoteOfDay()}
          </p>
          <p className="text-xs text-muted-foreground uppercase">— Sêneca</p>
        </div>

        <div className="grid grid-cols-[1.45fr_1fr] gap-3 items-stretch">
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
                <p className="text-sm text-primary">Mudança da semana</p>

                <p
                  className="mt-2 font-serif text-2xl leading-tight text-foreground break-words overflow-hidden"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {shortText(
                    weeklyPlan.change,
                    "Nenhuma mudança definida ainda",
                  )}
                </p>

                <div className="mt-3 inline-flex rounded-full border px-3 py-1 text-xs text-muted-foreground">
                  Em andamento
                </div>
              </div>
            </div>
          </button>

          <div className="h-full rounded-[30px] border border-border/50 bg-card p-4 shadow-sm flex flex-col justify-between">
            <button
              type="button"
              onClick={() => go("/manha")}
              className="flex flex-1 flex-col items-center justify-center w-full"
            >
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Sun className="h-6 w-6" />
              </div>
              <p className="text-lg font-serif">Manhã</p>
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

        <div className="border rounded-xl p-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-muted-foreground">Marcos da semana</p>
            <p className="text-xl font-serif">0 de 1</p>
          </div>
          <div className="w-24 h-6 rounded-full bg-muted" />
        </div>

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
          onClick={() => go("/tarefas")}
          className="w-full text-left border rounded-xl p-5 space-y-2 cursor-pointer hover:shadow-sm transition-shadow"
        >
          <p className="text-xs text-muted-foreground">Trilha de hoje</p>
          <p
            className="text-lg font-serif break-words overflow-hidden"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
            }}
          >
            {data.morning?.actions || "Defina o próximo passo do dia."}
          </p>
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
