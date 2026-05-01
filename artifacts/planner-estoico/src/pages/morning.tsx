import React from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  MorningRitual,
  EMPTY_MORNING_RITUAL,
  getWeekKey,
} from "@/lib/ritual";

const DAY_MODES: { value: MorningRitual["mode"]; label: string; sub: string }[] = [
  { value: "productive", label: "Produtivo", sub: "Avançar com foco" },
  { value: "normal", label: "Normal", sub: "Manter o ritmo" },
  { value: "survival", label: "Sobrevivência", sub: "Apenas atravessar" },
];

export default function Morning() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const weekKey = getWeekKey(dateKey);

  const [ritual, setRitual] = useLocalStorage<MorningRitual>(
    `${dateKey}-morning-ritual`,
    EMPTY_MORNING_RITUAL,
  );

  const [weekVirtue, setWeekVirtue] = useLocalStorage<string>(
    `planner-week-virtue-${weekKey}`,
    "",
  );

  function setField<K extends keyof MorningRitual>(key: K, value: MorningRitual[K]) {
    setRitual({ ...ritual, [key]: value });
  }

  function setPriority(index: number, value: string) {
    const next: [string, string, string] = [...ritual.priorities] as [string, string, string];
    next[index] = value;
    setRitual({ ...ritual, priorities: next });
  }

  return (
    <Layout>
      <Header title="Manhã" />

      <div className="flex-1 p-6 flex flex-col gap-10 overflow-y-auto pb-12">
        <p className="text-center font-serif text-muted-foreground italic">
          "Que o teu princípio seja este: agir como um estóico."
        </p>

        {/* Ritual Matinal — reflection fields */}
        <section className="space-y-6">
          <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
            Ritual Matinal
          </h2>

          <RitualTextarea
            id="feeling"
            label="Como estou me sentindo agora?"
            placeholder="Estado físico e emocional ao acordar..."
            value={ritual.feeling}
            onChange={(v) => setField("feeling", v)}
          />
          <RitualTextarea
            id="control"
            label="O que está sob meu controle hoje?"
            placeholder="Atitudes, esforço, respostas às situações..."
            value={ritual.control}
            onChange={(v) => setField("control", v)}
          />
          <RitualTextarea
            id="virtue"
            label="Qual virtude vou praticar hoje?"
            placeholder="Coragem, temperança, justiça, sabedoria..."
            value={ritual.virtueOfDay}
            onChange={(v) => setField("virtueOfDay", v)}
          />
          <RitualTextarea
            id="challenges"
            label="Quais desafios posso enfrentar?"
            placeholder="Preveja obstáculos e como você reagirá..."
            value={ritual.challenges}
            onChange={(v) => setField("challenges", v)}
          />
          <RitualTextarea
            id="actions"
            label="Quais ações práticas posso realizar hoje?"
            placeholder="Ações concretas alinhadas aos seus valores..."
            value={ritual.actions}
            onChange={(v) => setField("actions", v)}
          />
        </section>

        {/* Prioridades do dia */}
        <section className="space-y-5">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
              Prioridades do dia
            </h2>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Limite-se a três. Mais que isso já não é prioridade, é dispersão.
            </p>
          </div>

          <div className="space-y-4">
            {([0, 1, 2] as const).map((i) => (
              <div key={i} className="space-y-1.5">
                <Label
                  htmlFor={`priority-${i}`}
                  className="text-xs font-medium uppercase tracking-widest text-primary/60"
                >
                  Prioridade {i + 1}
                </Label>
                <Input
                  id={`priority-${i}`}
                  value={ritual.priorities[i]}
                  onChange={(e) => setPriority(i, e.target.value)}
                  placeholder="O que precisa ser feito?"
                  className="bg-transparent border-b border-0 border-border/50 rounded-none focus-visible:ring-0 focus-visible:border-primary px-0 text-base placeholder:text-muted-foreground/50 h-11"
                />
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground/50 text-right">Máximo de 3 por dia</p>
        </section>

        {/* Modo do dia */}
        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
            Modo do dia
          </h2>

          <div className="flex flex-col gap-2">
            {DAY_MODES.map((m) => {
              const selected = ritual.mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setField("mode", selected ? "" : m.value)}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all",
                    selected
                      ? "bg-primary/8 border-primary/40 text-foreground"
                      : "bg-card border-border/40 text-muted-foreground hover:border-border/70",
                  )}
                >
                  <span className="font-medium text-sm">{m.label}</span>
                  <span className="text-xs opacity-70">{m.sub}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Virtude da semana */}
        <section className="space-y-4 pb-4">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
              Virtude da semana
            </h2>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Uma única virtude para cultivar nesta semana inteira.
            </p>
          </div>

          <Textarea
            id="week-virtue"
            value={weekVirtue}
            onChange={(e) => setWeekVirtue(e.target.value)}
            placeholder="Ex: Paciência, Disciplina, Presença..."
            className="resize-none bg-card border-border/40 rounded-xl min-h-[80px] focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
          />
        </section>
      </div>
    </Layout>
  );
}

function RitualTextarea({
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
    <div className="space-y-2">
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
        className="resize-none bg-card border-border/40 rounded-xl min-h-[90px] focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
      />
    </div>
  );
}
