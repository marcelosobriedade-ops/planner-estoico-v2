import React, { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { Header } from "@/components/header";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Heart, ShieldCheck } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { supabase } from "@/lib/supabase";

type SOSData = {
  whatHappened: string;
  feeling: string;
  helpNow: string;
  nextAction: string;
};

type DailyData = {
  sos?: SOSData;
  [key: string]: unknown;
};

const EMPTY_SOS: SOSData = {
  whatHappened: "",
  feeling: "",
  helpNow: "",
  nextAction: "",
};

export default function SOS() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [sos, setSos] = useState<SOSData>(EMPTY_SOS);
  const [dailyData, setDailyData] = useState<DailyData>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState("Carregando...");

  useEffect(() => {
    async function loadSOS() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setStatus("Sessão não encontrada.");
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
        console.error(error);
        setStatus("Erro ao carregar SOS.");
        return;
      }

      const loaded = (data?.data || {}) as DailyData;

      setDailyData(loaded);
      setSos({
        ...EMPTY_SOS,
        ...(loaded.sos || {}),
      });
      setStatus("SOS carregado.");
    }

    loadSOS();
  }, [dateKey]);

  async function saveSOS(updated: SOSData) {
    if (!userId) return;

    setSos(updated);
    setStatus("Salvando...");

    const { data, error: loadError } = await supabase
      .from("daily_records")
      .select("data")
      .eq("user_id", userId)
      .eq("date", dateKey)
      .maybeSingle();

    if (loadError) {
      console.error(loadError);
      setStatus("Erro ao salvar SOS.");
      return;
    }

    const latest = (data?.data || {}) as DailyData;

    const nextData: DailyData = {
      ...latest,
      sos: updated,
    };

    setDailyData(nextData);

    const { error } = await supabase.from("daily_records").upsert(
      {
        user_id: userId,
        date: dateKey,
        data: nextData,
      },
      { onConflict: "user_id,date" },
    );

    if (error) {
      console.error(error);
      setStatus("Erro ao salvar SOS.");
      return;
    }

    setStatus("SOS salvo.");
  }

  function setField(key: keyof SOSData, value: string) {
    saveSOS({
      ...sos,
      [key]: value,
    });
  }

  return (
    <Layout>
      <Header title="SOS" />

      <div className="flex-1 overflow-y-auto bg-background px-5 py-6 pb-12">
        <div className="mx-auto max-w-md space-y-6">
          <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <h1 className="font-serif text-2xl">Pausa de emergência</h1>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Este espaço não é para resolver a vida inteira. É só para
              atravessar os próximos minutos com mais consciência e menos
              impulso.
            </p>

            <p className="text-xs text-muted-foreground">{status}</p>
          </section>

          <SOSField
            label="1. O que está acontecendo agora?"
            value={sos.whatHappened}
            onChange={(v) => setField("whatHappened", v)}
            placeholder="Descreva a situação sem julgamento..."
          />

          <SOSField
            label="2. O que estou sentindo?"
            value={sos.feeling}
            onChange={(v) => setField("feeling", v)}
            placeholder="Raiva, medo, vergonha, ansiedade, confusão..."
          />

          <SOSField
            label="3. O que pode me ajudar agora?"
            value={sos.helpNow}
            onChange={(v) => setField("helpNow", v)}
            placeholder="Respirar, sair do ambiente, mandar mensagem para alguém, beber água..."
          />

          <SOSField
            label="4. O que vou fazer nos próximos 10 minutos?"
            value={sos.nextAction}
            onChange={(v) => setField("nextAction", v)}
            placeholder="Uma ação simples, concreta e segura..."
          />

          <section className="rounded-2xl border border-border/40 bg-card p-5 space-y-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <p className="font-serif text-lg">Regra dos 10 minutos</p>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Não decida tudo agora. Não responda tudo agora. Primeiro
              estabilize o corpo, reduza o impulso e escolha apenas o próximo
              passo.
            </p>
          </section>

          <section className="rounded-2xl border border-border/40 bg-card p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Heart className="h-5 w-5 text-primary" />
              <p className="font-serif text-lg">Frase de retorno</p>
            </div>

            <p className="text-sm text-muted-foreground italic leading-relaxed">
              “Eu não preciso vencer este momento inteiro. Só preciso não piorar
              ele agora.”
            </p>
          </section>
        </div>
      </div>
    </Layout>
  );
}

function SOSField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
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
        className="min-h-[90px] resize-none rounded-xl border-border/40 bg-card"
      />
    </section>
  );
}
