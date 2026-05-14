import React, { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { Header } from "@/components/header";
import { supabase } from "@/lib/supabase";
import { getCurrentDateKey } from "@/lib/date";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Link } from "wouter";
import { ChevronDown, ChevronUp } from "lucide-react";

type DailyRecord = {
  date: string;
  data: any;
};

function getWeekRange(dateKey: string) {
  const d = new Date(dateKey + "T12:00:00");
  const day = d.getDay(); // domingo = 0

  const start = new Date(d);
  start.setDate(d.getDate() - day);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    startDate: start,
    endDate: end,
  };
}

export default function History() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [open, setOpen] = useState(false);

  const week = getWeekRange(dateKey);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data } = await supabase
        .from("daily_records")
        .select("date, data")
        .eq("user_id", session.user.id)
        .gte("date", week.start)
        .lte("date", week.end)
        .order("date", { ascending: false });

      setRecords(data || []);
    }

    load();
  }, [dateKey]);

  // métricas
  const daysWithData = records.length;

  const nightsCompleted = records.filter(
    (r) => r.data?.evening && Object.values(r.data.evening).some((v: any) => v),
  ).length;

  const totalTasks = records.reduce(
    (acc, r) => acc + (r.data?.tasks?.length || 0),
    0,
  );

  const formatDate = (d: Date) =>
    d.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
    });

  return (
    <Layout>
      <Header title="Histórico" />

      <div className="p-6 space-y-6">
        {/* CARD DA SEMANA */}
        <div className="rounded-2xl border overflow-hidden">
          {/* HEADER CLICÁVEL */}
          <button
            onClick={() => setOpen(!open)}
            className="w-full text-left p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Semana
              </p>

              <h2 className="text-xl font-serif">
                {formatDate(week.startDate)} → {formatDate(week.endDate)}
              </h2>

              <p className="text-sm text-muted-foreground">
                {week.start} até {week.end}
              </p>

              <div className="mt-2 inline-block text-xs px-3 py-1 rounded-full bg-muted">
                Fechamento pendente
              </div>
            </div>

            {open ? <ChevronUp /> : <ChevronDown />}
          </button>

          {/* CONTEÚDO EXPANDIDO */}
          {open && (
            <div className="p-4 pt-0 space-y-6">
              {/* MÉTRICAS */}
              <div className="grid grid-cols-2 gap-4">
                <Metric title="Dias com registro" value={`${daysWithData}/7`} />
                <Metric
                  title="Noites preenchidas"
                  value={`${nightsCompleted}/7`}
                />
                <Metric title="Tarefas" value={`${totalTasks}`} />
                <Metric title="Dias encerrados" value={`0/7`} />
              </div>

              {/* DIAS */}
              <div className="space-y-4">
                {records.map((r) => {
                  const d = new Date(r.date + "T00:00:00");

                  const formatted = d.toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  });

                  const tasks = r.data?.tasks || [];
                  const emotions = r.data?.emotions || {};
                  const financial = r.data?.financial || [];

                  return (
                    <Link key={r.date} href={`/historico/${r.date}`}>
                      <div className="border rounded-xl p-4 space-y-2 cursor-pointer hover:shadow-sm">
                        <p className="text-xs text-muted-foreground">
                          {r.date}
                        </p>

                        <h3 className="font-serif">{formatted}</h3>

                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            {tasks.length > 0
                              ? `${tasks.length} tarefas`
                              : "Sem tarefas"}
                          </p>

                          <p>
                            {emotions?.morning?.emotion ||
                            emotions?.afternoon?.emotion ||
                            emotions?.evening?.emotion
                              ? "Com emoção registrada"
                              : "Sem emoção"}
                          </p>

                          <p>
                            {financial.length > 0
                              ? `${financial.length} registros financeiros`
                              : "R$ 0,00"}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="border rounded-xl p-4">
      <p className="text-xs uppercase text-muted-foreground">{title}</p>
      <p className="text-xl font-serif">{value}</p>
    </div>
  );
}
