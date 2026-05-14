import React, { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save } from "lucide-react";
import {
  EMPTY_WEEKLY_PLAN,
  WeeklyPlanData,
  loadWeeklyPlan,
  saveWeeklyPlan,
} from "@/lib/weekly-plan";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";

type Proof = {
  id: string;
  text: string;
  checked: boolean;
};

function parseProofs(raw: string): Proof[] {
  if (!raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({
      id: crypto.randomUUID(),
      text,
      checked: false,
    }));
}

function stringifyProofs(proofs: Proof[]) {
  return JSON.stringify(proofs);
}

export default function Weekly() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [plan, setPlan] = useState<WeeklyPlanData>(EMPTY_WEEKLY_PLAN);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [newProof, setNewProof] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState("");
  const [status, setStatus] = useState("Carregando...");

  useEffect(() => {
    async function load() {
      try {
        const result = await loadWeeklyPlan(dateKey);

        setUserId(result.userId);
        setWeekStart(result.weekStart);
        setPlan(result.plan);
        setProofs(parseProofs(result.plan.proofs));
        setStatus("Nenhuma alteração pendente.");
      } catch (error) {
        console.error(error);
        setStatus("Erro ao carregar plano.");
      }
    }

    load();
  }, [dateKey]);

  async function persist(nextPlan: WeeklyPlanData) {
    if (!userId || !weekStart) return;

    setStatus("Salvando...");

    try {
      await saveWeeklyPlan(userId, weekStart, nextPlan);
      setStatus("Plano salvo.");
    } catch (error) {
      console.error(error);
      setStatus("Erro ao salvar plano.");
    }
  }

  function updateField(key: keyof WeeklyPlanData, value: string) {
    const next = {
      ...plan,
      [key]: value,
    };

    setPlan(next);
    persist(next);
  }

  function addProof() {
    if (!newProof.trim()) return;

    const nextProofs = [
      ...proofs,
      {
        id: crypto.randomUUID(),
        text: newProof.trim(),
        checked: false,
      },
    ];

    const nextPlan = {
      ...plan,
      proofs: stringifyProofs(nextProofs),
    };

    setProofs(nextProofs);
    setNewProof("");
    setPlan(nextPlan);
    persist(nextPlan);
  }

  function toggleProof(id: string) {
    const nextProofs = proofs.map((p) =>
      p.id === id ? { ...p, checked: !p.checked } : p,
    );

    const nextPlan = {
      ...plan,
      proofs: stringifyProofs(nextProofs),
    };

    setProofs(nextProofs);
    setPlan(nextPlan);
    persist(nextPlan);
  }

  function deleteProof(id: string) {
    const nextProofs = proofs.filter((p) => p.id !== id);

    const nextPlan = {
      ...plan,
      proofs: stringifyProofs(nextProofs),
    };

    setProofs(nextProofs);
    setPlan(nextPlan);
    persist(nextPlan);
  }

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto bg-background px-5 py-6 pb-12">
        <div className="mx-auto max-w-md space-y-6">
          <header className="text-center space-y-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Semana iniciada em {weekStart || "..."}
            </p>
            <h1 className="font-serif text-3xl">Plano Semanal</h1>
            <p className="text-xs text-muted-foreground">{status}</p>
          </header>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <h2 className="font-serif text-lg">1. Visão — daqui a 7 dias</h2>
            <Textarea
              value={plan.change}
              onChange={(e) => updateField("change", e.target.value)}
              placeholder="O que precisa ter mudado ao final desta semana?"
              className="min-h-[110px] resize-none rounded-xl bg-background"
            />
          </section>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-4">
            <h2 className="font-serif text-lg">2. Provas da semana</h2>

            <div className="flex gap-2">
              <Input
                value={newProof}
                onChange={(e) => setNewProof(e.target.value)}
                placeholder="Adicionar prova da semana"
                className="bg-background"
              />
              <button
                type="button"
                onClick={addProof}
                className="w-11 rounded-xl border border-border/40 bg-background flex items-center justify-center"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {proofs.map((proof) => (
                <div
                  key={proof.id}
                  className="flex items-center gap-3 rounded-xl border border-border/40 bg-background px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => toggleProof(proof.id)}
                    className="h-6 w-6 rounded-full border border-primary/40 text-xs"
                  >
                    {proof.checked ? "✓" : ""}
                  </button>

                  <p className="flex-1 text-sm">{proof.text}</p>

                  <button
                    type="button"
                    onClick={() => deleteProof(proof.id)}
                    className="text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <h2 className="font-serif text-lg">
              3. O que pode te derrubar nesta semana?
            </h2>
            <Textarea
              value={plan.risks}
              onChange={(e) => updateField("risks", e.target.value)}
              placeholder="Quais riscos, padrões ou obstáculos podem aparecer?"
              className="min-h-[110px] resize-none rounded-xl bg-background"
            />
          </section>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <h2 className="font-serif text-lg">
              4. O que você fará quando isso acontecer?
            </h2>
            <Textarea
              value={plan.prevention}
              onChange={(e) => updateField("prevention", e.target.value)}
              placeholder="Qual será sua resposta concreta?"
              className="min-h-[110px] resize-none rounded-xl bg-background"
            />
          </section>

          <div className="rounded-2xl border border-border/40 bg-card p-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{status}</p>
            <button
              type="button"
              onClick={() => persist(plan)}
              className="rounded-xl bg-primary px-4 py-3 text-sm text-primary-foreground flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Salvar plano
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
