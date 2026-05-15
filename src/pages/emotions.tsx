import React, { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { Header } from "@/components/header";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { supabase } from "@/lib/supabase";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type EmotionState = {
  emotion: string;
  note: string;
};

type EmotionsData = {
  morning: EmotionState;
  afternoon: EmotionState;
  evening: EmotionState;
};

type DailyData = {
  emotions?: EmotionsData;
  [key: string]: unknown;
};

const EMPTY: EmotionsData = {
  morning: { emotion: "", note: "" },
  afternoon: { emotion: "", note: "" },
  evening: { emotion: "", note: "" },
};

const OPTIONS = [
  { value: "muito mal", emoji: "😵", label: "Muito mal" },
  { value: "mal", emoji: "🙁", label: "Mal" },
  { value: "ok", emoji: "😐", label: "Ok" },
  { value: "bem", emoji: "🙂", label: "Bem" },
  { value: "muito bem", emoji: "😄", label: "Muito bem" },
];

export default function Emotions() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [data, setData] = useState<EmotionsData>(EMPTY);
  const [dailyData, setDailyData] = useState<DailyData>({});
  const [userId, setUserId] = useState<string | null>(null);

  const [open, setOpen] = useState({
    morning: false,
    afternoon: false,
    evening: false,
  });

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
      setData(loaded.emotions || EMPTY);
    }

    load();
  }, [dateKey]);

  async function save(updated: EmotionsData) {
    if (!userId) return;

    const next = {
      ...dailyData,
      emotions: updated,
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

  function setEmotion(period: keyof EmotionsData, value: string) {
    save({
      ...data,
      [period]: {
        ...data[period],
        emotion: value,
      },
    });
  }

  function setNote(period: keyof EmotionsData, value: string) {
    save({
      ...data,
      [period]: {
        ...data[period],
        note: value,
      },
    });
  }

  return (
    <Layout>
      <Header title="Emoções" />

      <div className="flex-1 px-5 py-6 overflow-y-auto">
        <div className="mx-auto max-w-md space-y-6">
          <p className="text-center font-serif italic text-muted-foreground">
            "Observar sem julgar. Sentir sem ser consumido."
          </p>

          <EmotionBlock
            title="Noite"
            subtitle="Antes de dormir"
            data={data.evening}
            open={open.evening}
            toggle={() => setOpen((o) => ({ ...o, evening: !o.evening }))}
            onSelect={(v) => setEmotion("evening", v)}
            onNote={(v) => setNote("evening", v)}
          />

          <EmotionBlock
            title="Manhã"
            subtitle="Ao acordar"
            data={data.morning}
            open={open.morning}
            toggle={() => setOpen((o) => ({ ...o, morning: !o.morning }))}
            onSelect={(v) => setEmotion("morning", v)}
            onNote={(v) => setNote("morning", v)}
          />

          <EmotionBlock
            title="Tarde"
            subtitle="Meio do dia"
            data={data.afternoon}
            open={open.afternoon}
            toggle={() => setOpen((o) => ({ ...o, afternoon: !o.afternoon }))}
            onSelect={(v) => setEmotion("afternoon", v)}
            onNote={(v) => setNote("afternoon", v)}
          />
        </div>
      </div>
    </Layout>
  );
}

function EmotionBlock({
  title,
  subtitle,
  data,
  open,
  toggle,
  onSelect,
  onNote,
}: any) {
  return (
    <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-4">
      <div>
        <p className="text-lg font-serif">{title}</p>
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          {subtitle}
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {OPTIONS.map((o) => {
          const selected = data.emotion === o.value;
          return (
            <button
              key={o.value}
              onClick={() => onSelect(o.value)}
              className={cn(
                "rounded-xl border px-2 py-3 text-center",
                selected ? "border-primary bg-primary/10" : "border-border/40",
              )}
            >
              <div>{o.emoji}</div>
              <div className="text-[10px]">{o.label}</div>
            </button>
          );
        })}
      </div>

      <button
        onClick={toggle}
        className="flex w-full items-center justify-between text-xs uppercase tracking-widest text-muted-foreground"
      >
        Quero registrar algo sobre isso?
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <Textarea
          value={data.note}
          onChange={(e) => onNote(e.target.value)}
          placeholder="Escreva sobre isso..."
          className="min-h-[80px]"
        />
      )}
    </section>
  );
}
