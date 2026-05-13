import React from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NightRitual, EMPTY_NIGHT_RITUAL } from "@/lib/ritual";

export default function Evening() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [ritual, setRitual] = useLocalStorage<NightRitual>(
    `${dateKey}-night-ritual`,
    EMPTY_NIGHT_RITUAL,
  );

  function setField(key: keyof NightRitual, value: string) {
    setRitual({ ...ritual, [key]: value });
  }

  return (
    <Layout>
      <Header title="Noite" />

      <div className="flex-1 p-6 flex flex-col gap-8 overflow-y-auto pb-12">
        <p className="text-center font-serif text-muted-foreground italic mb-2">
          "Examine as suas ações do dia. O que fez de errado? O que fez de certo? O que deixou por fazer?"
        </p>

        <div className="space-y-8">
          <NightField
            id="learning"
            label="1. O que aprendi hoje?"
            placeholder="Lições, descobertas, insights..."
            value={ritual.learning}
            onChange={(v) => setField("learning", v)}
          />
          <NightField
            id="improve"
            label="2. Onde posso melhorar?"
            placeholder="Áreas de crescimento, atitudes a ajustar..."
            value={ritual.improve}
            onChange={(v) => setField("improve", v)}
          />
          <NightField
            id="wins"
            label="3. Quais pequenas vitórias conquistei hoje?"
            placeholder="Progressos, momentos de virtude, gratidão..."
            value={ritual.wins}
            onChange={(v) => setField("wins", v)}
          />
          <NightField
            id="feeling"
            label="4. Como estou me sentindo agora?"
            placeholder="Reflexão sobre o estado ao final do dia..."
            value={ritual.feeling}
            onChange={(v) => setField("feeling", v)}
          />
          <NightField
            id="value"
            label="5. O que realmente teve valor hoje?"
            placeholder="O que foi verdadeiramente importante..."
            value={ritual.value}
            onChange={(v) => setField("value", v)}
          />
        </div>
      </div>
    </Layout>
  );
}

function NightField({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Label
        htmlFor={id}
        className="text-sm font-medium uppercase tracking-widest text-primary/80"
      >
        {label}
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="resize-none bg-card border-border/40 rounded-xl min-h-[110px] focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
      />
    </div>
  );
}
