import React from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DailyRitual, EMPTY_RITUAL } from "@/lib/ritual";
import { Sun, Moon } from "lucide-react";

export default function Ritual() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey()
  );

  const [ritual, setRitual] = useLocalStorage<DailyRitual>(
    `${dateKey}-ritual`,
    EMPTY_RITUAL
  );

  const formattedDate = new Date(dateKey + "T00:00:00").toLocaleDateString(
    "pt-BR",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" }
  );

  function setMorning(key: keyof DailyRitual["morning"], value: string) {
    setRitual({ ...ritual, morning: { ...ritual.morning, [key]: value } });
  }

  function setNight(key: keyof DailyRitual["night"], value: string) {
    setRitual({ ...ritual, night: { ...ritual.night, [key]: value } });
  }

  return (
    <Layout>
      <Header title="Ritual Diário" />

      <div className="flex-1 p-6 flex flex-col gap-8 overflow-y-auto">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground capitalize">
          {formattedDate}
        </p>

        {/* Ritual Matinal */}
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20 text-amber-600">
              <Sun className="w-4 h-4" />
            </div>
            <h2 className="font-serif text-xl text-foreground">Ritual Matinal</h2>
          </div>

          <RitualField
            id="m-feeling"
            label="1. Como estou me sentindo agora?"
            placeholder="Descreva seu estado físico e emocional..."
            value={ritual.morning.feeling}
            onChange={(v) => setMorning("feeling", v)}
          />
          <RitualField
            id="m-control"
            label="2. O que está sob meu controle hoje?"
            placeholder="Atitudes, esforço, respostas às situações..."
            value={ritual.morning.control}
            onChange={(v) => setMorning("control", v)}
          />
          <RitualField
            id="m-virtue"
            label="3. Qual virtude vou praticar hoje?"
            placeholder="Coragem, temperança, justiça, sabedoria..."
            value={ritual.morning.virtue}
            onChange={(v) => setMorning("virtue", v)}
          />
          <RitualField
            id="m-challenges"
            label="4. Quais desafios posso enfrentar?"
            placeholder="Preveja obstáculos e como você reagirá..."
            value={ritual.morning.challenges}
            onChange={(v) => setMorning("challenges", v)}
          />
          <RitualField
            id="m-actions"
            label="5. Quais ações práticas posso realizar hoje?"
            placeholder="Ações concretas alinhadas aos seus valores..."
            value={ritual.morning.actions}
            onChange={(v) => setMorning("actions", v)}
          />
        </section>

        {/* Ritual Noturno */}
        <section className="space-y-6 pb-8">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-500/10 border border-slate-500/20 text-slate-600">
              <Moon className="w-4 h-4" />
            </div>
            <h2 className="font-serif text-xl text-foreground">Ritual Noturno</h2>
          </div>

          <RitualField
            id="n-learning"
            label="1. O que aprendi hoje?"
            placeholder="Lições, descobertas, insights..."
            value={ritual.night.learning}
            onChange={(v) => setNight("learning", v)}
          />
          <RitualField
            id="n-improve"
            label="2. Onde posso melhorar?"
            placeholder="Áreas de crescimento, atitudes a ajustar..."
            value={ritual.night.improve}
            onChange={(v) => setNight("improve", v)}
          />
          <RitualField
            id="n-wins"
            label="3. Quais pequenas vitórias conquistei hoje?"
            placeholder="Progressos, momentos de virtude, gratidão..."
            value={ritual.night.wins}
            onChange={(v) => setNight("wins", v)}
          />
          <RitualField
            id="n-feeling"
            label="4. Como estou me sentindo agora?"
            placeholder="Reflexão sobre o estado ao final do dia..."
            value={ritual.night.feeling}
            onChange={(v) => setNight("feeling", v)}
          />
          <RitualField
            id="n-value"
            label="5. O que realmente teve valor hoje?"
            placeholder="O que foi verdadeiramente importante..."
            value={ritual.night.value}
            onChange={(v) => setNight("value", v)}
          />
        </section>
      </div>
    </Layout>
  );
}

function RitualField({
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
        className="resize-none bg-card border-border/40 rounded-xl min-h-[100px] focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
      />
    </div>
  );
}
