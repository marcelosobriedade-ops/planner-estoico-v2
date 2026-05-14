import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NightRitual, EMPTY_NIGHT_RITUAL } from "@/lib/ritual";
import { supabase } from "@/lib/supabase";

type DailyData = {
  evening?: NightRitual;
  [key: string]: unknown;
};

export default function Evening() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [ritual, setRitual] = useState<NightRitual>(EMPTY_NIGHT_RITUAL);
  const [dailyData, setDailyData] = useState<DailyData>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    async function loadEvening() {
      setSaveError("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setSaveError("Sessão não encontrada. Faça login novamente.");
        return;
      }

      setUserId(session.user.id);

      const { data, error } = await supabase
        .from("daily_records")
        .select("data")
        .eq("user_id", session.user.id)
        .eq("date", dateKey)
        .maybeSingle();

      if (error) {
        setSaveError("Erro ao carregar reflexão da noite.");
        return;
      }

      const loadedData = (data?.data || {}) as DailyData;
      setDailyData(loadedData);
      setRitual(loadedData.evening || EMPTY_NIGHT_RITUAL);
    }

    loadEvening();
  }, [dateKey]);

  async function saveEvening(updatedRitual: NightRitual) {
    if (!userId) {
      setSaveError("Usuário não encontrado. Faça login novamente.");
      return;
    }

    setSaveError("");

    const nextData: DailyData = {
      ...dailyData,
      evening: updatedRitual,
    };

    setRitual(updatedRitual);
    setDailyData(nextData);

    const { error } = await supabase.from("daily_records").upsert(
      {
        user_id: userId,
        date: dateKey,
        data: nextData,
      },
      {
        onConflict: "user_id,date",
      },
    );

    if (error) {
      setSaveError("Erro ao salvar reflexão da noite.");
      console.error("Erro ao salvar noite:", error);
    }
  }

  function setField(key: keyof NightRitual, value: string) {
    const updated = { ...ritual, [key]: value };
    saveEvening(updated);
  }

  return (
    <Layout>
      <Header title="Noite" />

      <div className="flex-1 p-6 flex flex-col gap-8 overflow-y-auto pb-12">
        <p className="text-center font-serif text-muted-foreground italic mb-2">
          "Examine as suas ações do dia. O que fez de errado? O que fez de
          certo? O que deixou por fazer?"
        </p>

        {saveError && (
          <div className="rounded-xl border border-rose-300/50 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {saveError}
          </div>
        )}

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
