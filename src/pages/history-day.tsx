import React, { useEffect, useState } from "react";
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
import { getCurrentDateKey } from "@/lib/date";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function HistoryDay() {
  const params = useParams<{ date: string }>();
  const dateKey = params.date;

  const [data, setData] = useState<any>(null);

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

      setData(data?.data || {});
    }

    load();
  }, [dateKey]);

  if (!data) {
    return (
      <Layout>
        <div className="p-6">Carregando...</div>
      </Layout>
    );
  }

  const tasks = data.tasks || [];
  const transactions = data.financial || [];
  const emotions = data.emotions || {};
  const people = data.people || [];
  const habits = data.habits || [];
  const habitsCompleted = data.habitsCompleted || [];

  const balance = transactions.reduce(
    (acc: number, t: any) => acc + (t.type === "income" ? t.amount : -t.amount),
    0,
  );

  const isToday = dateKey === getCurrentDateKey();

  return (
    <Layout>
      <header className="p-6 border-b">
        <h1 className="text-xl text-center">
          {dateKey} {isToday && "(Hoje)"}
        </h1>
      </header>

      <div className="p-6 space-y-6">
        {/* TAREFAS */}
        <section>
          <h2>Tarefas</h2>
          {tasks.length === 0 ? (
            <p>Sem tarefas</p>
          ) : (
            tasks.map((t: any) => (
              <div key={t.id}>
                {t.status === "done" ? "✔" : "○"} {t.title}
              </div>
            ))
          )}
        </section>

        {/* FINANCEIRO */}
        <section>
          <h2>Financeiro</h2>
          <p>{formatCurrency(balance)}</p>

          {transactions.map((t: any) => (
            <div key={t.id}>
              {t.type === "income" ? "+" : "-"}
              {formatCurrency(t.amount)} - {t.description}
            </div>
          ))}
        </section>

        {/* EMOÇÕES */}
        <section>
          <h2>Emoções</h2>
          <p>Manhã: {emotions.morning?.emotion || "-"}</p>
          <p>Tarde: {emotions.afternoon?.emotion || "-"}</p>
          <p>Noite: {emotions.evening?.emotion || "-"}</p>
        </section>

        {/* PESSOAS */}
        <section>
          <h2>Pessoas</h2>
          {people.map((p: any) => (
            <div key={p.id}>{p.name}</div>
          ))}
        </section>

        {/* HÁBITOS */}
        <section>
          <h2>Hábitos</h2>
          {habits.map((h: any) => (
            <div key={h.id}>
              {habitsCompleted.includes(h.id) ? "✔" : "○"} {h.name}
            </div>
          ))}
        </section>

        {/* NOITE */}
        <section>
          <h2>Noite</h2>
          <p>{data.evening?.learning || "-"}</p>
        </section>
      </div>
    </Layout>
  );
}
