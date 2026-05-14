import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type NightData = {
  approach: string;
  away: string;
  wins: string;
  ending: string;
};

type DailyData = {
  evening?: NightData;
  [key: string]: unknown;
};

export default function Evening() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [data, setData] = useState<NightData>({
    approach: "",
    away: "",
    wins: "",
    ending: "",
  });

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
      setData({
        approach: loaded.evening?.approach || "",
        away: loaded.evening?.away || "",
        wins: loaded.evening?.wins || "",
        ending: loaded.evening?.ending || "",
      });
    }

    load();
  }, [dateKey]);

  async function save(updated: NightData) {
    if (!userId) return;

    const next: DailyData = {
      ...dailyData,
      evening: updated,
    };

    setData(updated);
    setDailyData(next);

    await supabase.from("daily_records").upsert(
      {
        user_id: userId,
        date: dateKey,
        data: next,
      },
      { onConflict: "user_id,date" },
    );
  }

  function setField(key: keyof NightData, value: string) {
    save({ ...data, [key]: value });
  }

  return (
    <Layout>
      <Header title="Noite" />

      <div className="flex-1 overflow-y-auto bg-background px-5 py-6 pb-12">
        <div className="mx-auto max-w-md space-y-7">
          <div className="text-center space-y-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {new Date(dateKey + "T00:00:00").toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>

            <h1 className="font-serif text-3xl">Noite</h1>

            <p className="pt-4 font-serif italic text-sm text-muted-foreground leading-relaxed">
              "Examine as suas ações do dia. O que fez de errado? O que fez de
              certo? O que deixou por fazer?"
            </p>
          </div>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-primary/70">
              Fechamento da semana no dia
            </p>
            <p className="text-xs text-muted-foreground">
              A noite revela o dia à luz da direção da semana.
            </p>

            <div className="mt-2 rounded-xl border border-border/40 px-3 py-2 text-sm text-muted-foreground">
              prova teste
            </div>
          </section>

          <NightField
            label="1. O que me aproximou da mudança da semana hoje?"
            value={data.approach}
            onChange={(v) => setField("approach", v)}
            placeholder="O que hoje apoiou a travessia da semana?"
          />

          <NightField
            label="2. O que me afastou ou me derrubou hoje?"
            value={data.away}
            onChange={(v) => setField("away", v)}
            placeholder="Onde desviei, me perdi ou cedi ao automático?"
          />

          <NightField
            label="3. Que prova, passo ou pequena vitória toquei hoje?"
            value={data.wins}
            onChange={(v) => setField("wins", v)}
            placeholder="Quais sinais reais de avanço apareceram no dia?"
          />

          <NightField
            label="4. Como estou terminando este dia?"
            value={data.ending}
            onChange={(v) => setField("ending", v)}
            placeholder="Estado emocional, mental e físico ao fechar o dia..."
          />
        </div>
      </div>
    </Layout>
  );
}

function NightField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <section className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-widest text-primary/70">
        {label}
      </p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[100px] resize-none rounded-xl border-border/40 bg-card"
      />
    </section>
  );
}
