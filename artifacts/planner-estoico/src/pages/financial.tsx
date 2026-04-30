import React, { useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: "income" | "expense";
  description: string;
  amount: number;
}

export default function Financial() {
  const dateKey = getCurrentDateKey();
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>(`${dateKey}-financial`, []);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");

  const addTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;

    const value = parseFloat(amount.replace(",", "."));
    if (isNaN(value)) return;

    setTransactions([
      { id: Date.now().toString(), type, description: description.trim(), amount: value },
      ...transactions,
    ]);
    setDescription("");
    setAmount("");
  };

  const deleteTransaction = (id: string) => {
    setTransactions(transactions.filter((t) => t.id !== id));
  };

  const balance = transactions.reduce((acc, t) => {
    return acc + (t.type === "income" ? t.amount : -t.amount);
  }, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <Layout>
      <Header title="Financeiro" />
      <div className="flex-1 p-6 flex flex-col gap-8 overflow-y-auto">
        <div className="bg-primary text-primary-foreground p-6 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <TrendingUp className="w-32 h-32" />
          </div>
          <p className="text-primary-foreground/70 uppercase tracking-widest text-xs font-medium mb-2 z-10">Balanço Diário</p>
          <h2 className="text-4xl font-serif z-10">{formatCurrency(balance)}</h2>
        </div>

        <form onSubmit={addTransaction} className="space-y-4 bg-card p-5 rounded-2xl border border-border/40 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={cn(
                "py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
                type === "expense" ? "bg-destructive text-destructive-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <TrendingDown className="w-4 h-4" /> Despesa
            </button>
            <button
              type="button"
              onClick={() => setType("income")}
              className={cn(
                "py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
                type === "income" ? "bg-accent text-accent-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <TrendingUp className="w-4 h-4" /> Receita
            </button>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="desc" className="sr-only">Descrição</Label>
              <Input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição"
                className="bg-transparent border-b border-0 border-border/50 rounded-none focus-visible:ring-0 px-0 h-10"
              />
            </div>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="amount" className="sr-only">Valor</Label>
                <div className="relative">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    className="bg-transparent border-b border-0 border-border/50 rounded-none focus-visible:ring-0 pl-8 pr-0 h-10 text-lg"
                  />
                </div>
              </div>
              <Button type="submit" size="icon" className="rounded-xl h-10 w-10 flex-shrink-0">
                <Plus className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </form>

        <div className="flex-1">
          <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">Lançamentos de Hoje</h3>
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground/60 py-8 italic font-serif">Sem lançamentos registrados.</p>
            ) : (
              transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-4 bg-card rounded-xl border border-border/30 group">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      t.type === "income" ? "bg-accent/20 text-accent-foreground" : "bg-destructive/10 text-destructive"
                    )}>
                      {t.type === "income" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{t.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className={cn(
                      "font-medium",
                      t.type === "income" ? "text-accent-foreground" : "text-destructive"
                    )}>
                      {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                    </p>
                    <button
                      onClick={() => deleteTransaction(t.id)}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
