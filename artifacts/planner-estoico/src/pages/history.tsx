import React, { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import { Header } from "@/components/header";
import { supabase } from "@/lib/supabase";
import { getCurrentDateKey } from "@/lib/date";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { ChevronDown, ChevronUp } from "lucide-react";

type DailyRecord = {
  date: string;
  data: any;
};

function go(path: string) {
  window.location.assign(path);
}

function getMonthRange(dateKey: string) {
  const d = new Date(dateKey + "T12:00:00");

  const start = new Date(d.getFullYear(), d.getMonth(), 1, 12);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    startDate: start,
    endDate: end,
  };
}

function getWeekStart(dateKey: string) {
  const d = new Date(dateKey + "T12:00:00");
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  return start.toISOString().slice(0, 10);
}

function getWeekEnd(weekStart: string) {
  const d = new Date(weekStart + "T12:00:00");
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

function formatShortDate(dateKey: string) {
  return new Date(dateKey + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
  });
}

function formatFullDate(dateKey: string) {
  return new Date(dateKey + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatMonth(dateKey: string) {
  return new Date(dateKey + "T12:00:00").toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function getFinancialBalance(financial: any[]) {
  return financial.reduce((acc, item) => {
    const amount = Number(item?.amount || 0);
    return acc + (item?.type === "income" ? amount : -amount);
  }, 0);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isNightFilled(evening: any) {
  if (!evening || typeof evening !== "object") return false;
  return Object.values(evening).some((value) => hasText(value));
}

function hasEmotion(emotions: any) {
  return Boolean(
    emotions?.morning?.emotion ||
      emotions?.afternoon?.emotion ||
      emotions?.evening?.emotion,
  );
}

function hasPriorities(morning: any) {
  return Array.isArray(morning?.priorities)
    ? morning.priorities.some((p: any) => hasText(p))
    : false;
}

function getMetrics(records: DailyRecord[]) {
  const daysWithData = records.length;

  const nightsFilled = records.filter((r) =>
    isNightFilled(r.data?.evening),
  ).length;

  const totalTasks = records.reduce(
    (acc, r) => acc + (r.data?.tasks?.length || 0),
    0,
  );

  const doneTasks = records.reduce(
    (acc, r) =>
      acc +
      (r.data?.tasks || []).filter((task: any) => task.status === "done")
        .length,
    0,
  );

  const closedDays = records.filter((r) => r.data?.closed === true).length;

  const balance = records.reduce(
    (acc, r) => acc + getFinancialBalance(r.data?.financial || []),
    0,
  );

  return {
    daysWithData,
    nightsFilled,
    totalTasks,
    doneTasks,
    closedDays,
    balance,
  };
}

export default function History() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [openMonth, setOpenMonth] = useState(true);
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});

  const month = useMemo(() => getMonthRange(dateKey), [dateKey]);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data, error } = await supabase
        .from("daily_records")
        .select("date, data")
        .eq("user_id", session.user.id)
        .gte("date", month.start)
        .lte("date", month.end)
        .order("date", { ascending: false });

      if (error) {
        console.error("Erro ao carregar histórico:", error);
        return;
      }

      setRecords(data || []);
    }

    load();
  }, [month.start, month.end]);

  const monthMetrics = useMemo(() => getMetrics(records), [records]);

  const weeks = useMemo(() => {
    const grouped: Record<string, DailyRecord[]> = {};

    records.forEach((record) => {
      const weekStart = getWeekStart(record.date);
      if (!grouped[weekStart]) grouped[weekStart] = [];
      grouped[weekStart].push(record);
    });

    return Object.entries(grouped)
      .map(([weekStart, weekRecords]) => ({
        weekStart,
        weekEnd: getWeekEnd(weekStart),
        records: weekRecords.sort((a, b) => b.date.localeCompare(a.date)),
        metrics: getMetrics(weekRecords),
      }))
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }, [records]);

  function toggleWeek(weekStart: string) {
    setOpenWeeks((current) => ({
      ...current,
      [weekStart]: !current[weekStart],
    }));
  }

  return (
    <Layout>
      <Header title="Histórico" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-12">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {records.length > 0
              ? `${weeks.length} semana${weeks.length > 1 ? "s" : ""} com registros`
              : "Nenhum registro neste mês"}
          </p>
          <h1 className="font-serif text-2xl">Ciclos</h1>
        </div>

        <section className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setOpenMonth(!openMonth)}
            className="w-full p-4 text-left flex items-start justify-between gap-4"
          >
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Mês
              </p>

              <h2 className="mt-1 font-serif text-xl leading-snug capitalize">
                {formatMonth(month.start)}
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                {month.start} até {month.end}
              </p>

              <div className="mt-3 inline-flex rounded-full border border-border/40 bg-background px-3 py-1 text-xs text-muted-foreground">
                Visão mensal
              </div>
            </div>

            <div className="mt-1 text-muted-foreground">
              {openMonth ? <ChevronUp /> : <ChevronDown />}
            </div>
          </button>

          {openMonth && (
            <div className="border-t border-border/30 p-4 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <Metric
                  title="Dias com registro"
                  value={`${monthMetrics.daysWithData}`}
                />
                <Metric
                  title="Noites preenchidas"
                  value={`${monthMetrics.nightsFilled}`}
                />
                <Metric
                  title="Tarefas"
                  value={`${monthMetrics.doneTasks}/${monthMetrics.totalTasks}`}
                />
                <Metric
                  title="Dias encerrados"
                  value={`${monthMetrics.closedDays}`}
                />
              </div>

              <div className="rounded-xl border border-border/40 bg-background p-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Saldo do mês
                </p>
                <p className="mt-1 font-serif text-xl">
                  {formatCurrency(monthMetrics.balance)}
                </p>
              </div>

              <div className="space-y-4">
                {weeks.length === 0 ? (
                  <div className="rounded-xl border border-border/40 bg-background p-4 text-center">
                    <p className="font-serif text-lg text-muted-foreground">
                      Nenhuma semana registrada neste mês.
                    </p>
                  </div>
                ) : (
                  weeks.map((week) => {
                    const isOpen = openWeeks[week.weekStart] ?? false;

                    return (
                      <section
                        key={week.weekStart}
                        className="rounded-xl border border-border/40 bg-background overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleWeek(week.weekStart)}
                          className="w-full p-4 text-left flex items-start justify-between gap-4"
                        >
                          <div>
                            <p className="text-xs uppercase tracking-widest text-muted-foreground">
                              Semana
                            </p>
                            <h3 className="mt-1 font-serif text-lg">
                              {formatShortDate(week.weekStart)} →{" "}
                              {formatShortDate(week.weekEnd)}
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {week.records.length} dia
                              {week.records.length > 1 ? "s" : ""} registrado
                              {week.records.length > 1 ? "s" : ""}
                            </p>
                          </div>

                          <div className="mt-1 text-muted-foreground">
                            {isOpen ? <ChevronUp /> : <ChevronDown />}
                          </div>
                        </button>

                        {isOpen && (
                          <div className="border-t border-border/30 p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                              <Metric
                                title="Dias"
                                value={`${week.metrics.daysWithData}/7`}
                              />
                              <Metric
                                title="Noites"
                                value={`${week.metrics.nightsFilled}/7`}
                              />
                              <Metric
                                title="Tarefas"
                                value={`${week.metrics.doneTasks}/${week.metrics.totalTasks}`}
                              />
                              <Metric
                                title="Saldo"
                                value={formatCurrency(week.metrics.balance)}
                              />
                            </div>

                            <div className="space-y-3">
                              {week.records.map((record) => {
                                const tasks = record.data?.tasks || [];
                                const financial = record.data?.financial || [];
                                const balance = getFinancialBalance(financial);
                                const emotion = hasEmotion(
                                  record.data?.emotions,
                                );
                                const priorities = hasPriorities(
                                  record.data?.morning,
                                );
                                const night = isNightFilled(
                                  record.data?.evening,
                                );

                                return (
                                  <button
                                    key={record.date}
                                    type="button"
                                    onClick={() =>
                                      go(`/historico/${record.date}`)
                                    }
                                    className="w-full rounded-xl border border-border/40 bg-card p-4 text-left space-y-3 hover:shadow-sm transition-shadow"
                                  >
                                    <div>
                                      <p className="text-xs text-muted-foreground">
                                        {record.date}
                                      </p>
                                      <h3 className="font-serif text-lg capitalize">
                                        {formatFullDate(record.date)}
                                      </h3>
                                    </div>

                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-muted-foreground">
                                      <p>
                                        {priorities
                                          ? "Com prioridades"
                                          : "Sem prioridades"}
                                      </p>

                                      <p>
                                        {tasks.length > 0
                                          ? `${tasks.length} tarefa${
                                              tasks.length > 1 ? "s" : ""
                                            }`
                                          : "Sem tarefas"}
                                      </p>

                                      <p>{formatCurrency(balance)}</p>

                                      <p>
                                        {emotion ? "Com emoção" : "Sem emoção"}
                                      </p>
                                    </div>

                                    {night && (
                                      <div className="border-t border-border/30 pt-3">
                                        <p className="text-xs font-serif italic text-muted-foreground">
                                          Reflexão noturna registrada
                                        </p>
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </section>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <p className="mt-1 font-serif text-xl">{value}</p>
    </div>
  );
}
