import React from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface EveningState {
  good: string;
  different: string;
  learned: string;
}

export default function Evening() {
  const dateKey = getCurrentDateKey();
  const [reflection, setReflection] = useLocalStorage<EveningState>(`${dateKey}-evening`, {
    good: "",
    different: "",
    learned: "",
  });

  const handleChange = (key: keyof EveningState, value: string) => {
    setReflection({ ...reflection, [key]: value });
  };

  return (
    <Layout>
      <Header title="Noite" />
      <div className="flex-1 p-6 flex flex-col gap-8 overflow-y-auto">
        <p className="text-center font-serif text-muted-foreground italic mb-2">
          "Examine as suas ações do dia. O que fez de errado? O que fez de certo? O que deixou por fazer?"
        </p>

        <div className="space-y-8">
          <div className="space-y-3">
            <Label htmlFor="good" className="text-sm font-medium uppercase tracking-widest text-primary/80">
              1. O que foi bom hoje?
            </Label>
            <Textarea
              id="good"
              value={reflection.good}
              onChange={(e) => handleChange("good", e.target.value)}
              placeholder="Gratidão, vitórias, momentos de paz..."
              className="resize-none bg-card border-border/40 rounded-xl min-h-[120px] focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="different" className="text-sm font-medium uppercase tracking-widest text-primary/80">
              2. O que poderia ter sido diferente?
            </Label>
            <Textarea
              id="different"
              value={reflection.different}
              onChange={(e) => handleChange("different", e.target.value)}
              placeholder="Onde falhei? Como reagi mal?"
              className="resize-none bg-card border-border/40 rounded-xl min-h-[120px] focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="learned" className="text-sm font-medium uppercase tracking-widest text-primary/80">
              3. O que aprendi?
            </Label>
            <Textarea
              id="learned"
              value={reflection.learned}
              onChange={(e) => handleChange("learned", e.target.value)}
              placeholder="Lições, insights, melhorias para amanhã..."
              className="resize-none bg-card border-border/40 rounded-xl min-h-[120px] focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
            />
          </div>
        </div>

        <div className="mt-8 pb-4">
          <Button
            className="w-full h-14 rounded-xl text-lg font-serif"
            onClick={() => window.history.back()}
          >
            Encerrar o Dia
          </Button>
        </div>
      </div>
    </Layout>
  );
}
