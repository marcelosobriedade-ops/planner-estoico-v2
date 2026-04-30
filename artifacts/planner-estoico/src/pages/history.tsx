import React, { useMemo } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, CalendarDays, CheckSquare, Wallet, Smile, BookOpen, Home } from "lucide-react";
import { getAllDayKeys, getDaySummary, DaySummary } from "@/lib/history";
import { getCurrentDateKey } from "@/lib/date";
import { cn } from "@/lib/utils";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function DayCard({ summary }: { summary: DaySummary }) {
  const isToday = summary.dateKey === getCurrentDateKey();

  return (
    <Link href={`/historico/${summary.dateKey}`}>
      <div className={cn(
        "bg-card border rounded-2xl p-5 shadow-sm hover:shadow-md active:scale-[0.98] transition-all cursor-pointer",
        isToday ? "border-primary/40" : "border-border/40"
      )}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-0.5">
              {summary.dateKey}
            </p>
            <h3 className="font-serif text-lg text-foreground capitalize leading-tight">
              {summary.formattedDate.split(",").slice(0, 2).join(",")}
            </h3>
          </div>
          {isToday && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              Hoje
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="w-4 h-4 flex-shrink-0" />
            <span>
              {summary.priorities.length > 0
                ? `${summary.priorities.length} prioridade${summary.priorities.length > 1 ? "s" : ""}`
                : "Sem prioridades"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckSquare className="w-4 h-4 flex-shrink-0" />
            <span>
              {summary.tasks.total > 0
                ? `${summary.tasks.done}/${summary.tasks.total} tarefas`
                : "Sem tarefas"}
            </span>
          </div>

          <div className={cn(
            "flex items-center gap-2 text-sm",
            summary.balance > 0
              ? "text-emerald-700"
              : summary.balance < 0
              ? "text-rose-700"
              : "text-muted-foreground"
          )}>
            <Wallet className="w-4 h-4 flex-shrink-0" />
            <span>{formatCurrency(summary.balance)}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Smile className="w-4 h-4 flex-shrink-0" />
            <span>{summary.eveningEmotion ?? "Sem emoção"}</span>
          </div>
        </div>

        {summary.eveningDone && (
          <div className="mt-3 pt-3 border-t border-border/30">
            <span className="text-xs text-muted-foreground/70 italic font-serif">
              Reflexao noturna registrada
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

export default function History() {
  const summaries = useMemo(() => {
    const keys = getAllDayKeys();
    return keys.map((k) => getDaySummary(k));
  }, []);

  const today = getCurrentDateKey();

  return (
    <Layout>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md pb-4 pt-6 px-6 border-b border-border/40">
        <div className="flex items-center justify-between mb-1">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 rounded-full hover:bg-muted/50"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Registros
          </span>
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors p-2 -mr-2 rounded-full hover:bg-muted/50"
            title="Voltar ao dia atual"
          >
            <Home className="w-5 h-5" />
          </Link>
        </div>
        <h1 className="text-2xl font-serif text-center mt-2">Historico</h1>
      </header>

      <div className="flex-1 p-6 overflow-y-auto">
        {summaries.length === 0 ? (
          <div className="h-60 flex flex-col items-center justify-center text-center space-y-4">
            <CalendarDays className="w-12 h-12 text-muted-foreground/30 stroke-[1.5]" />
            <div className="space-y-1">
              <p className="font-serif text-xl text-foreground/60">Nenhum registro ainda</p>
              <p className="text-sm text-muted-foreground/60">
                Os seus dias apareceram aqui conforme forem preenchidos.
              </p>
            </div>
            <Link href="/">
              <span className="text-sm text-primary underline underline-offset-4">
                Comecar hoje
              </span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4 pb-8">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-6">
              {summaries.length} dia{summaries.length !== 1 ? "s" : ""} com registros
            </p>
            {summaries.map((s) => (
              <DayCard key={s.dateKey} summary={s} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
