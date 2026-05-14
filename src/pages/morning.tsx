import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MorningRitual, EMPTY_MORNING_RITUAL, getWeekKey } from "@/lib/ritual";
import { supabase } from "@/lib/supabase";

type DailyData = {
  morning?: MorningRitual;
  weekVirtue?: string;
  [key: string]: any;
};

const DAY_MODES: {
  value: MorningRitual["mode"];
  label: string;
  sub: string;
}[] = [
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

  const [ritual, setRitual] = useState<MorningRitual>(EMPTY_MORNING_RITUAL);
  const [weekVirtue, setWeekVirtue] = useState("");

  const [dailyData, setDailyData] = useState<DailyData>({});
  const [userId, setUserId] = useState<string | null>(null);

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
      setRitual(loaded.morning || EMPTY_MORNING_RITUAL);
      setWeekVirtue(loaded.weekVirtue || "");
    }

    load();
  }, [dateKey]);

  async function save(updatedRitual: MorningRitual, updatedWeekVirtue: string) {
    if (!userId) return;

    const nextData: DailyData = {
      ...dailyData,
      morning: updatedRitual,
      weekVirtue: updatedWeekVirtue,
    };

    setDailyData(nextData);
    setRitual(updatedRitual);
    setWeekVirtue(updatedWeekVirtue);

    await supabase.from("daily_records").upsert(
      {
        user_id: userId,
        date: dateKey,
        data: nextData,
      },
      { onConflict: "user_id,date" },
    );
  }

  function setField<K extends keyof MorningRitual>(
    key: K,
    value: MorningRitual[K],
  ) {
    const updated = { ...ritual, [key]: value };
    save(updated, weekVirtue);
  }

  function setPriority(index: number, value: string) {
    const next: [string, string, string] = [...ritual.priorities] as [
      string,
      string,
      string,
    ];
    next[index] = value;

    const updated = { ...ritual, priorities: next };
    save(updated, weekVirtue);
  }

  function updateWeekVirtue(value: string) {
    save(ritual, value);
  }

  return (
    <Layout>
      <Header title="Manhã" />

      <div className="flex-1 p-6 flex flex-col gap-10 overflow-y-auto pb-12">
        <p className="text-center font-serif text-muted-foreground italic">
          "Que o teu princípio seja este: agir como um estóico."
        </p>

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
            placeholder="Preveja obstáculos..."
            value={ritual.challenges}
            onChange={(v) => setField("challenges", v)}
          />

          <RitualTextarea
            id="actions"
            label="Quais ações práticas posso realizar hoje?"
            placeholder="Ações concretas..."
            value={ritual.actions}
            onChange={(v) => setField("actions", v)}
          />
        </section>

        <section className="space-y-5">
          <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
            Prioridades do dia
          </h2>

          {([0, 1, 2] as const).map((i) => (
            <Input
              key={i}
              value={ritual.priorities[i]}
              onChange={(e) => setPriority(i, e.target.value)}
              placeholder={`Prioridade ${i + 1}`}
            />
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
            Modo do dia
          </h2>

          {DAY_MODES.map((m) => (
            <button
              key={m.value}
              onClick={() =>
                setField("mode", ritual.mode === m.value ? "" : m.value)
              }
              className={cn(
                "p-3 border rounded-xl",
                ritual.mode === m.value && "border-primary bg-primary/10",
              )}
            >
              {m.label}
            </button>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
            Virtude da semana
          </h2>

          <Textarea
            value={weekVirtue}
            onChange={(e) => updateWeekVirtue(e.target.value)}
          />
        </section>
      </div>
    </Layout>
  );
}

function RitualTextarea({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
