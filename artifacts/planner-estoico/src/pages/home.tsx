import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { getQuoteOfDay, getCurrentDateKey } from "@/lib/date";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Flame,
  Moon,
  Repeat,
  Smile,
  SunMedium,
  Users,
  Wallet,
} from "lucide-react";
import {
  EMPTY_MORNING_RITUAL,
  EMPTY_NIGHT_RITUAL,
  getMorningStatus,
  getNightStatus,
} from "@/lib/ritual";
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
  const [dateKey, setDateKey] = useLocalStorage<string>(
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

  const goToToday = () => setDateKey(getCurrentDateKey());

  const tasks = data.tasks || [];
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const pendingTask = tasks.find((t) => t.status !== "done");

  const emotions = data.emotions || {};
  const checkinsDone = [
    emotions.morning?.emotion,
    emotions.afternoon?.emotion,
    emotions.evening?.emotion,
  ].filter(Boolean).length;

  const habits = data.habits || [];
  const completedHabits = data.habitsCompleted || [];

  const financial = data.financial || [];
  const balance = financial.reduce(
    (acc, t) => acc + (t.type === "income" ? t.amount : -t.amount),
    0,
  );

  const morningStatus = getMorningStatus(data.morning || EMPTY_MORNING_RITUAL);
  const nightStatus = getNightStatus(data.evening || EMPTY_NIGHT_RITUAL);

  const priorities = (data.morning?.priorities || []).filter((p: string) =>
    p?.trim(),
  );

  const quote = getQuoteOfDay();
  const [quoteText, quoteAuthor] = quote.includes("—")
    ? quote.split("—")
    : [quote, "A Travessia"];

  const nextStep =
    pendingTask?.title || priorities[0] || "Defina o próximo passo do dia.";

  return (
    <Layout>
      <div className="flex-1 bg-background px-4 pt-6 pb-5 overflow-y-auto">
        <div className="mx-auto max-w-md">
          <header className="mb-5 text-center">
            <div className="mb-2 flex items-center justify-center gap-3 text-sm">
              <button
                onClick={goToPreviousDay}
                className="rounded-full px-2 py-1 text-muted-foreground"
              >
                ←
              </button>
              <button
                onClick={goToToday}
                className="rounded-full px-2 py-1 text-primary"
              >
                Hoje
              </button>
              <button
                onClick={goToNextDay}
                className="rounded-full px-2 py-1 text-muted-foreground"
              >
                →
              </button>
            </div>

            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {new Date(dateKey + "T00:00:00").toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>

            <h1 className="mt-2 font-serif text-4xl text-foreground">
              A Travessia
            </h1>
          </header>

          <section className="mb-4 rounded-[28px] border border-border/50 bg-card px-5 py-5 shadow-sm">
            <p className="text-sm text-primary">Hoje</p>
            <p className="mt-2 font-serif text-3xl leading-none text-foreground">
              {new Date(dateKey + "T00:00:00").toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "long",
              })}
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {quoteText.trim()}
            </p>
            <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              — {quoteAuthor.trim()}
            </p>
          </section>

          <div className="mb-4 grid grid-cols-[1.45fr_1fr] gap-3 items-stretch">
            <Link href="/tarefas">
              <section className="h-full cursor-pointer rounded-[30px] border border-border/50 bg-card p-4 shadow-sm">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                    <CalendarDays className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-primary">Trilha do dia</p>
                    <p className="mt-2 font-serif text-2xl leading-tight text-foreground">
                      {nextStep}
                    </p>
                    <div className="mt-3 inline-flex rounded-full border border-border/50 bg-background px-3 py-1 text-xs text-muted-foreground">
                      {tasks.length > 0
                        ? `${completedTasks}/${tasks.length} tarefas concluídas`
                        : "Nenhuma tarefa"}
                    </div>
                  </div>
                </div>
              </section>
            </Link>

            <section className="h-full rounded-[30px] border border-border/50 bg-card p-4 shadow-sm">
              <div className="flex h-full flex-col justify-between gap-2">
                <Link href="/manha">
                  <button className="flex flex-1 flex-col items-center justify-center rounded-[22px] px-3 py-2 text-center hover:bg-muted/30">
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <SunMedium className="h-6 w-6" />
                    </div>
                    <p className="text-lg font-serif text-foreground">Manhã</p>
                    <p className="text-xs text-muted-foreground">
                      {morningStatus}
                    </p>
                  </button>
                </Link>

                <div className="h-px bg-border/40" />

                <Link href="/noite">
                  <button className="flex flex-1 flex-col items-center justify-center rounded-[22px] px-3 py-2 text-center hover:bg-muted/30">
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Flame className="h-6 w-6" />
                    </div>
                    <p className="text-lg font-serif text-foreground">Noite</p>
                    <p className="text-xs text-muted-foreground">
                      {nightStatus}
                    </p>
                  </button>
                </Link>
              </div>
            </section>
          </div>

          {priorities.length > 0 && (
            <section className="mb-4 rounded-[24px] border border-border/50 bg-card px-4 py-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
                Prioridade do dia
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {priorities.map((priority: string, index: number) => (
                  <div
                    key={`${priority}-${index}`}
                    className="rounded-full border border-border/50 bg-background px-3 py-1.5 text-sm text-foreground"
                  >
                    {priority}
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="mb-4 grid grid-cols-4 gap-2">
            <QuickLink
              href="/pessoas"
              label="Pessoas"
              icon={<Users className="h-5 w-5" />}
            />
            <QuickLink
              href="/habitos"
              label="Hábitos"
              icon={<Repeat className="h-5 w-5" />}
            />
            <QuickLink
              href="/financeiro"
              label="Finanças"
              icon={<Wallet className="h-5 w-5" />}
            />
            <QuickLink
              href="/emocoes"
              label="Emoções"
              icon={<Smile className="h-5 w-5" />}
            />
          </div>

          <section className="mb-4 rounded-[28px] border border-border/50 bg-card p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <StatusItem
                icon={<CheckSquare className="h-4 w-4" />}
                label="Tarefas"
                value={
                  tasks.length > 0 ? `${completedTasks}/${tasks.length}` : "0/0"
                }
              />
              <StatusItem
                icon={<Repeat className="h-4 w-4" />}
                label="Hábitos"
                value={
                  habits.length > 0
                    ? `${completedHabits.length}/${habits.length}`
                    : "0/0"
                }
              />
              <StatusItem
                icon={<Smile className="h-4 w-4" />}
                label="Emoções"
                value={`${checkinsDone}/3`}
              />
              <StatusItem
                icon={<Wallet className="h-4 w-4" />}
                label="Saldo"
                value={new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(balance)}
              />
            </div>
          </section>

          <section className="mb-5 rounded-[28px] border border-border/50 bg-card p-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <ChevronRight className="h-7 w-7 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-primary">Próximo passo</p>
                <p className="mt-2 font-serif text-2xl leading-snug text-foreground">
                  {nextStep}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Um passo claro é melhor do que dez intenções soltas.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}

function QuickLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <div className="rounded-[22px] border border-border/50 bg-card px-2 py-3 text-center shadow-sm cursor-pointer">
        <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <p className="text-xs text-foreground leading-tight">{label}</p>
      </div>
    </Link>
  );
}

function StatusItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-background p-3">
      <div className="mb-2 text-primary">{icon}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}
