import React, { useMemo } from "react";
import { Link, useParams } from "wouter";
import { Layout } from "@/components/layout";
import {
  ArrowLeft,
  CheckSquare,
  Wallet,
  TrendingUp,
  TrendingDown,
  Sun,
  Moon,
  Users,
  Repeat,
  Home,
  Smile,
} from "lucide-react";
import { getDayDetail } from "@/lib/history";
import { getCurrentDateKey } from "@/lib/date";
import { cn } from "@/lib/utils";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function SectionTitle({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border/40 pb-2 mb-4">
      <div className="text-muted-foreground">{icon}</div>
      <h2 className="font-serif text-lg text-foreground">{title}</h2>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <p className="text-sm text-muted-foreground/50 italic font-serif text-center py-3">
      {text}
    </p>
  );
}

export default function HistoryDay() {
  const params = useParams<{ date: string }>();
  const dateKey = params.date;

  const detail = useMemo(() => getDayDetail(dateKey), [dateKey]);

  const isToday = dateKey === getCurrentDateKey();

  const formattedDate = detail.formattedDate;

  const statusColor = {
    done: "text-primary",
    cancelled: "text-muted-foreground line-through",
    todo: "text-foreground",
  };

  return (
    <Layout>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md pb-4 pt-6 px-6 border-b border-border/40">
        <div className="flex items-center justify-between mb-1">
          <Link
            href="/historico"
            className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 rounded-full hover:bg-muted/50"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {dateKey}
          </span>
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors p-2 -mr-2 rounded-full hover:bg-muted/50"
            title="Voltar ao dia atual"
          >
            <Home className="w-5 h-5" />
          </Link>

          <Link
            href="/"
            onClick={() =>
              localStorage.setItem("planner-selected-date", dateKey)
            }
            className="text-xs px-3 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
          >
            Editar este dia
          </Link>
        </div>
        <h1 className="text-xl font-serif text-center mt-2 capitalize leading-snug">
          {formattedDate.split(",").slice(0, 2).join(",")}
          {isToday && (
            <span className="ml-2 text-sm font-sans font-medium text-primary">
              (Hoje)
            </span>
          )}
        </h1>
      </header>

      <div className="flex-1 p-6 overflow-y-auto space-y-8 pb-12">
        {/* Prioridades */}
        <section>
          <SectionTitle icon={<Sun className="w-4 h-4" />} title="Manha" />
          {detail.priorities.filter((p) => p.trim()).length === 0 ? (
            <EmptyNote text="Nenhuma prioridade registrada." />
          ) : (
            <ol className="space-y-2">
              {detail.priorities
                .filter((p) => p.trim())
                .map((p, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-xs font-medium text-muted-foreground mt-0.5 w-4 flex-shrink-0">
                      {i + 1}.
                    </span>
                    <p className="text-foreground text-sm leading-relaxed">
                      {p}
                    </p>
                  </li>
                ))}
            </ol>
          )}
        </section>

        {/* Tarefas */}
        <section>
          <SectionTitle
            icon={<CheckSquare className="w-4 h-4" />}
            title="Tarefas"
          />
          {detail.tasks.length === 0 ? (
            <EmptyNote text="Nenhuma tarefa registrada." />
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">
                {detail.tasks.filter((t) => t.status === "done").length}/
                {detail.tasks.length} concluidas
              </p>
              {detail.tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border-2 flex-shrink-0",
                      t.status === "done"
                        ? "bg-primary border-primary"
                        : "border-primary/40",
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm",
                      t.status === "done" &&
                        "line-through text-muted-foreground",
                      t.status === "cancelled" &&
                        "line-through text-muted-foreground/50",
                    )}
                  >
                    {t.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Financeiro */}
        <section>
          <SectionTitle
            icon={<Wallet className="w-4 h-4" />}
            title="Financeiro"
          />
          <div
            className={cn(
              "text-center p-4 rounded-xl mb-4 font-serif text-2xl",
              detail.balance > 0
                ? "bg-emerald-50 text-emerald-800"
                : detail.balance < 0
                  ? "bg-rose-50 text-rose-800"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {formatCurrency(detail.balance)}
          </div>
          {detail.transactions.length === 0 ? (
            <EmptyNote text="Nenhum lancamento registrado." />
          ) : (
            <div className="space-y-2">
              {detail.transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between text-sm py-1.5 border-b border-border/20 last:border-0"
                >
                  <div className="flex items-center gap-2 text-foreground">
                    {t.type === "income" ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span>{t.description}</span>
                  </div>
                  <span
                    className={
                      t.type === "income"
                        ? "text-emerald-700 font-medium"
                        : "text-rose-700 font-medium"
                    }
                  >
                    {t.type === "income" ? "+" : "-"}
                    {formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Emocoes */}
        <section>
          <SectionTitle icon={<Smile className="w-4 h-4" />} title="Emocoes" />
          {[
            { label: "Manha", data: detail.emotions.morning },
            { label: "Tarde", data: detail.emotions.afternoon },
            { label: "Noite", data: detail.emotions.evening },
          ].map(({ label, data }) => (
            <div key={label} className="mb-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                {label}
              </p>
              {data.emotion ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20">
                      {data.emotion}
                    </span>
                    {data.intensity && (
                      <span className="text-xs text-muted-foreground">
                        Intensidade {data.intensity}/5
                      </span>
                    )}
                  </div>
                  {data.cause && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      <span className="font-medium text-foreground/70">
                        Causa:
                      </span>{" "}
                      {data.cause}
                    </p>
                  )}
                  {data.observations && (
                    <p className="text-sm text-muted-foreground italic leading-relaxed border-l-2 border-primary/20 pl-3">
                      {data.observations}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/50 italic">
                  Sem registo
                </p>
              )}
            </div>
          ))}
        </section>

        {/* Pessoas */}
        {detail.people.length > 0 && (
          <section>
            <SectionTitle
              icon={<Users className="w-4 h-4" />}
              title="Pessoas"
            />
            <div className="space-y-4">
              {detail.people.map((p) => (
                <div
                  key={p.id}
                  className="bg-card border border-border/30 rounded-xl p-4 space-y-2"
                >
                  <p className="font-serif text-lg font-medium text-foreground">
                    {p.name}
                  </p>
                  {[
                    { label: "Contexto", value: p.context },
                    { label: "O que observei", value: p.observed },
                    { label: "O que aprendi", value: p.learned },
                    { label: "Proximo passo", value: p.nextStep },
                    { label: "Limite ou acao futura", value: p.boundary },
                  ]
                    .filter((f) => f.value?.trim())
                    .map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">
                          {label}
                        </p>
                        <p className="text-sm text-foreground leading-relaxed">
                          {value}
                        </p>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Habitos */}
        {detail.habits.length > 0 && (
          <section>
            <SectionTitle
              icon={<Repeat className="w-4 h-4" />}
              title="Habitos"
            />
            <div className="space-y-2">
              {detail.habits.map((h, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-4 h-4 rounded border-2 flex-shrink-0",
                      h.done ? "bg-primary border-primary" : "border-border",
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm",
                      h.done ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {h.name}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Reflexao noturna */}
        <section>
          <SectionTitle
            icon={<Moon className="w-4 h-4" />}
            title="Reflexao Noturna"
          />
          {[
            {
              label: "O que foi bom hoje?",
              value: detail.eveningReflection.good,
            },
            {
              label: "O que poderia ter sido diferente?",
              value: detail.eveningReflection.different,
            },
            {
              label: "O que aprendi?",
              value: detail.eveningReflection.learned,
            },
          ].map(({ label, value }) => (
            <div key={label} className="mb-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                {label}
              </p>
              {value.trim() ? (
                <p className="text-sm text-foreground leading-relaxed font-serif italic border-l-2 border-primary/30 pl-3">
                  {value}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground/50 italic">
                  Sem resposta
                </p>
              )}
            </div>
          ))}
        </section>
      </div>
    </Layout>
  );
}
