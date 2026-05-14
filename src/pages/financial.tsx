import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface Transaction {
  id: string;
  type: "income" | "expense";
  description: string;
  amount: number;
}

type DailyData = {
  financial?: Transaction[];
  [key: string]: any;
};

export default function Financial() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dailyData, setDailyData] = useState<DailyData>({});
  const [userId, setUserId] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");

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
      setTransactions(loaded.financial || []);
    }

    load();
  }, [dateKey]);

  async function save(updated: Transaction[]) {
    if (!userId) return;

    const nextData = {
      ...dailyData,
      financial: updated,
    };

    setTransactions(updated);
    setDailyData(nextData);

    await supabase.from("daily_records").upsert(
      {
        user_id: userId,
        date: dateKey,
        data: nextData,
      },
      { onConflict: "user_id,date" },
    );
  }

  const addTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;

    const value = parseFloat(amount.replace(",", "."));
    if (isNaN(value)) return;

    const updated = [
      {
        id: crypto.randomUUID(),
        type,
        description: description.trim(),
        amount: value,
      },
      ...transactions,
    ];

    save(updated);
    setDescription("");
    setAmount("");
  };

  const deleteTransaction = (id: string) => {
    save(transactions.filter((t) => t.id !== id));
  };

  const balance = transactions.reduce((acc, t) => {
    return acc + (t.type === "income" ? t.amount : -t.amount);
  }, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Layout>
      <Header title="Financeiro" />

      <div className="flex-1 p-6 flex flex-col gap-8 overflow-y-auto">
        <div className="bg-primary text-white p-6 rounded-2xl text-center">
          <p className="text-xs uppercase">Balanço Diário</p>
          <h2 className="text-3xl">{formatCurrency(balance)}</h2>
        </div>

        <form onSubmit={addTransaction} className="space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => setType("expense")}>
              Despesa
            </button>
            <button type="button" onClick={() => setType("income")}>
              Receita
            </button>
          </div>

          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição"
          />

          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Valor"
          />

          <Button type="submit">
            <Plus /> Adicionar
          </Button>
        </form>

        <div className="space-y-2">
          {transactions.map((t) => (
            <div key={t.id} className="flex justify-between">
              <span>{t.description}</span>
              <div className="flex gap-2">
                <span>
                  {t.type === "income" ? "+" : "-"}
                  {formatCurrency(t.amount)}
                </span>
                <button onClick={() => deleteTransaction(t.id)}>
                  <Trash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
