import React, { useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Morning() {
  const dateKey = getCurrentDateKey();
  const [priorities, setPriorities] = useLocalStorage<string[]>(
    `${dateKey}-morning`,
    ["", "", ""]
  );

  const handlePriorityChange = (index: number, value: string) => {
    const newPriorities = [...priorities];
    newPriorities[index] = value;
    setPriorities(newPriorities);
  };

  return (
    <Layout>
      <Header title="Manhã" />
      <div className="flex-1 p-6 flex flex-col gap-8 overflow-y-auto">
        <section className="space-y-4">
          <p className="text-muted-foreground leading-relaxed text-center font-serif italic">
            "Comece o dia com intenção. Quais são as três coisas mais importantes para hoje?"
          </p>
        </section>

        <section className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Label htmlFor={`priority-${i}`} className="text-sm font-medium uppercase tracking-widest text-primary/70">
                Prioridade {i + 1}
              </Label>
              <Input
                id={`priority-${i}`}
                value={priorities[i] || ""}
                onChange={(e) => handlePriorityChange(i, e.target.value)}
                placeholder="O que precisa ser feito?"
                className="bg-transparent border-b border-0 border-border/50 rounded-none focus-visible:ring-0 focus-visible:border-primary px-0 text-lg placeholder:text-muted-foreground/50 h-12"
              />
            </div>
          ))}
        </section>

        <div className="mt-auto pt-8">
          <Button
            className="w-full h-14 rounded-xl text-lg font-serif"
            onClick={() => window.history.back()}
          >
            Salvar e Voltar
          </Button>
        </div>
      </div>
    </Layout>
  );
}
