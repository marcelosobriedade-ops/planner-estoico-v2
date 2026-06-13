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
  primaryEmotion?: string;
  intensity?: number;
  bodySignals?: string[];
  refinedName?: string;
  supportAction?: string;
};

type EmotionsData = {
  morning: EmotionState;
  afternoon: EmotionState;
  evening: EmotionState;
};

type DailyData = {
  emotions?: EmotionsData;
  morning?: any;
  [key: string]: unknown;
};

type EmotionOption = {
  value: string;
  label: string;
  emoji: string;
  description: string;
  refinedNames: string[];
  supportActions: string[];
};

const EMPTY_EMOTION: EmotionState = {
  emotion: "",
  note: "",
  primaryEmotion: "",
  intensity: undefined,
  bodySignals: [],
  refinedName: "",
  supportAction: "",
};

const EMPTY: EmotionsData = {
  morning: { ...EMPTY_EMOTION },
  afternoon: { ...EMPTY_EMOTION },
  evening: { ...EMPTY_EMOTION },
};

const EMOTION_OPTIONS: EmotionOption[] = [
  {
    value: "alegria",
    label: "Alegria",
    emoji: "🌞",
    description: "Algo em você reconhece vida, expansão ou gratidão.",
    refinedNames: [
      "grato",
      "animado",
      "satisfeito",
      "esperançoso",
      "orgulhoso",
    ],
    supportActions: [
      "saborear o momento",
      "compartilhar com alguém",
      "registrar uma gratidão",
    ],
  },
  {
    value: "amor",
    label: "Amor",
    emoji: "🤍",
    description: "Algo em você busca vínculo, cuidado ou aproximação.",
    refinedNames: ["acolhido", "conectado", "cuidadoso", "terno", "saudoso"],
    supportActions: [
      "expressar cuidado",
      "aproximar-se com presença",
      "escrever uma mensagem sincera",
    ],
  },
  {
    value: "medo",
    label: "Medo",
    emoji: "🌫️",
    description: "Algo em você percebe risco, incerteza ou falta de proteção.",
    refinedNames: [
      "inseguro",
      "ameaçado",
      "exposto",
      "desprotegido",
      "ansioso",
    ],
    supportActions: [
      "respirar por dois minutos",
      "nomear o risco real",
      "buscar uma próxima ação segura",
    ],
  },
  {
    value: "tristeza",
    label: "Tristeza",
    emoji: "🌧️",
    description:
      "Algo em você reconhece perda, falta, cansaço ou necessidade de acolhimento.",
    refinedNames: [
      "abandonado",
      "desvalorizado",
      "solitário",
      "incapaz",
      "desanimado",
    ],
    supportActions: [
      "acolher sem pressa",
      "escrever o que está doendo",
      "pedir apoio",
    ],
  },
  {
    value: "raiva",
    label: "Raiva",
    emoji: "🔥",
    description:
      "Algo em você percebe limite violado, injustiça ou desrespeito.",
    refinedNames: [
      "ofendido",
      "injustiçado",
      "desrespeitado",
      "violado",
      "frustrado",
    ],
    supportActions: [
      "pausar antes de responder",
      "relaxar o corpo",
      "formular uma resposta assertiva",
    ],
  },
  {
    value: "nojo",
    label: "Nojo",
    emoji: "🪨",
    description:
      "Algo em você rejeita, se afasta ou percebe invasão de limite.",
    refinedNames: [
      "repelido",
      "invadido",
      "saturado",
      "desconfortável",
      "aversivo",
    ],
    supportActions: [
      "reconhecer o limite",
      "afastar-se com respeito",
      "limpar o ambiente",
    ],
  },
  {
    value: "surpresa",
    label: "Surpresa",
    emoji: "⚡",
    description: "Algo inesperado interrompeu seu padrão de expectativa.",
    refinedNames: [
      "impactado",
      "curioso",
      "desorientado",
      "impressionado",
      "alerta",
    ],
    supportActions: [
      "respirar antes de interpretar",
      "observar o que mudou",
      "dar tempo ao corpo",
    ],
  },
  {
    value: "confusão",
    label: "Confusão",
    emoji: "🌀",
    description:
      "Várias emoções podem estar misturadas ou ainda sem nome claro.",
    refinedNames: [
      "indefinido",
      "ambivalente",
      "sobrecarregado",
      "perdido",
      "dividido",
    ],
    supportActions: [
      "escrever sem organizar",
      "escolher uma sensação corporal",
      "dar nome provisório",
    ],
  },
];

const BODY_SIGNALS = [
  "respiração curta",
  "peito apertado",
  "garganta travada",
  "estômago contraído",
  "cabeça pesada",
  "ombros tensos",
  "mãos agitadas",
  "corpo cansado",
  "calor no rosto",
  "vontade de chorar",
  "inquietação",
  "corpo leve",
];

function normalizeEmotion(value: unknown): EmotionState {
  const data =
    value && typeof value === "object" ? (value as Partial<EmotionState>) : {};

  return {
    emotion: typeof data.emotion === "string" ? data.emotion : "",
    note: typeof data.note === "string" ? data.note : "",
    primaryEmotion:
      typeof data.primaryEmotion === "string" ? data.primaryEmotion : "",
    intensity: typeof data.intensity === "number" ? data.intensity : undefined,
    bodySignals: Array.isArray(data.bodySignals)
      ? data.bodySignals.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    refinedName: typeof data.refinedName === "string" ? data.refinedName : "",
    supportAction:
      typeof data.supportAction === "string" ? data.supportAction : "",
  };
}

function normalizeEmotions(value: unknown): EmotionsData {
  const data =
    value && typeof value === "object" ? (value as Partial<EmotionsData>) : {};

  return {
    morning: normalizeEmotion(data.morning),
    afternoon: normalizeEmotion(data.afternoon),
    evening: normalizeEmotion(data.evening),
  };
}

function getEmotionOption(value?: string) {
  return EMOTION_OPTIONS.find((option) => option.value === value);
}

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
      const normalized = normalizeEmotions(loaded.emotions);

      const synced: EmotionsData = {
        ...normalized,
        morning: {
          ...normalized.morning,
          emotion: normalized.morning.emotion || loaded.morning?.feeling || "",
          note: normalized.morning.note || loaded.morning?.control || "",
          primaryEmotion:
            normalized.morning.primaryEmotion ||
            normalized.morning.emotion ||
            loaded.morning?.feeling ||
            "",
        },
      };

      setDailyData({
        ...loaded,
        emotions: synced,
      });

      setData(synced);
    }

    load();
  }, [dateKey]);

  async function save(period: keyof EmotionsData, nextEmotion: EmotionState) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    const currentUserId = session.user.id;
    setUserId(currentUserId);

    const { data: latestRecord, error: loadError } = await supabase
      .from("daily_records")
      .select("data")
      .eq("user_id", currentUserId)
      .eq("date", dateKey)
      .maybeSingle();

    if (loadError) {
      console.error(
        "Erro ao carregar registro mais recente de emoções:",
        loadError,
      );
      return;
    }

    const latestData = (latestRecord?.data || {}) as DailyData;
    const latestEmotions = normalizeEmotions(latestData.emotions);

    const nextEmotions: EmotionsData = {
      ...latestEmotions,
      [period]: nextEmotion,
    };

    const nextData: DailyData = {
      ...latestData,
      emotions: nextEmotions,
    };

    if (period === "morning") {
      nextData.morning = {
        ...(latestData.morning || {}),
        feeling: nextEmotion.emotion,
        control: nextEmotion.note,
      };
    }

    setData(nextEmotions);
    setDailyData(nextData);

    const { error } = await supabase.from("daily_records").upsert(
      {
        user_id: currentUserId,
        date: dateKey,
        data: nextData,
      },
      { onConflict: "user_id,date" },
    );

    if (error) {
      console.error("Erro ao salvar emoções:", error);
    }
  }

  function updateEmotionField(
    period: keyof EmotionsData,
    patch: Partial<EmotionState>,
  ) {
    const nextEmotion = {
      ...data[period],
      ...patch,
    };

    setData((current) => ({
      ...current,
      [period]: nextEmotion,
    }));

    save(period, nextEmotion);
  }

  function setPrimaryEmotion(period: keyof EmotionsData, value: string) {
    const current = data[period];
    const selected = getEmotionOption(value);
    const isRemoving =
      current.primaryEmotion === value || current.emotion === value;

    const nextEmotion: EmotionState = isRemoving
      ? {
          ...current,
          emotion: "",
          primaryEmotion: "",
          refinedName: "",
          supportAction: "",
        }
      : {
          ...current,
          emotion: value,
          primaryEmotion: value,
          refinedName: selected?.refinedNames.includes(
            current.refinedName || "",
          )
            ? current.refinedName
            : "",
          supportAction: selected?.supportActions.includes(
            current.supportAction || "",
          )
            ? current.supportAction
            : "",
        };

    setData((currentData) => ({
      ...currentData,
      [period]: nextEmotion,
    }));

    save(period, nextEmotion);
  }

  function toggleBodySignal(period: keyof EmotionsData, signal: string) {
    const currentSignals = data[period].bodySignals || [];
    const nextSignals = currentSignals.includes(signal)
      ? currentSignals.filter((item) => item !== signal)
      : [...currentSignals, signal];

    updateEmotionField(period, { bodySignals: nextSignals });
  }

  return (
    <Layout>
      <Header title="Emoções" />

      <div className="flex-1 px-5 py-6 overflow-y-auto">
        <div className="mx-auto max-w-md space-y-6">
          <div className="space-y-2 text-center">
            <p className="text-center font-serif italic text-muted-foreground">
              "Você não precisa controlar a onda. Precisa aprender a navegar."
            </p>
            <p className="text-xs text-muted-foreground">
              Nomear já é começar a regular.
            </p>
          </div>

          <EmotionBlock
            title="Manhã"
            subtitle="Ponto de partida do dia"
            data={data.morning}
            open={open.morning}
            toggle={() => setOpen((o) => ({ ...o, morning: !o.morning }))}
            onSelect={(v) => setPrimaryEmotion("morning", v)}
            onPatch={(patch) => updateEmotionField("morning", patch)}
            onToggleSignal={(signal) => toggleBodySignal("morning", signal)}
          />

          <EmotionBlock
            title="Tarde"
            subtitle="Meio do dia"
            data={data.afternoon}
            open={open.afternoon}
            toggle={() => setOpen((o) => ({ ...o, afternoon: !o.afternoon }))}
            onSelect={(v) => setPrimaryEmotion("afternoon", v)}
            onPatch={(patch) => updateEmotionField("afternoon", patch)}
            onToggleSignal={(signal) => toggleBodySignal("afternoon", signal)}
          />

          <EmotionBlock
            title="Noite"
            subtitle="Antes de dormir"
            data={data.evening}
            open={open.evening}
            toggle={() => setOpen((o) => ({ ...o, evening: !o.evening }))}
            onSelect={(v) => setPrimaryEmotion("evening", v)}
            onPatch={(patch) => updateEmotionField("evening", patch)}
            onToggleSignal={(signal) => toggleBodySignal("evening", signal)}
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
  onPatch,
  onToggleSignal,
}: {
  title: string;
  subtitle: string;
  data: EmotionState;
  open: boolean;
  toggle: () => void;
  onSelect: (value: string) => void;
  onPatch: (patch: Partial<EmotionState>) => void;
  onToggleSignal: (signal: string) => void;
}) {
  const selectedValue = data.primaryEmotion || data.emotion;
  const selectedEmotion = getEmotionOption(selectedValue);
  const selectedLabel = selectedEmotion?.label || selectedValue;
  const hasEmotion = Boolean(selectedValue);

  return (
    <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-5">
      <div>
        <p className="text-lg font-serif">{title}</p>
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          {subtitle}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">O que está mais presente agora?</p>
          <p className="text-xs text-muted-foreground">
            O que seu corpo está tentando comunicar?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {EMOTION_OPTIONS.map((emotion) => {
            const selected = selectedValue === emotion.value;

            return (
              <button
                key={emotion.value}
                type="button"
                onClick={() => onSelect(emotion.value)}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border/40 bg-background/40",
                )}
              >
                <div className="flex items-center gap-2">
                  <span>{emotion.emoji}</span>
                  <span className="text-sm font-medium">{emotion.label}</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {emotion.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Quão forte está?</p>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((number) => {
            const selected = data.intensity === number;

            return (
              <button
                key={number}
                type="button"
                onClick={() => onPatch({ intensity: number })}
                className={cn(
                  "rounded-xl border py-2 text-xs",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border/40 bg-background/40",
                )}
              >
                {number}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Onde isso aparece no corpo?</p>
        <div className="flex flex-wrap gap-2">
          {BODY_SIGNALS.map((signal) => {
            const selected = data.bodySignals?.includes(signal);

            return (
              <button
                key={signal}
                type="button"
                onClick={() => onToggleSignal(signal)}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border/40 bg-background/40",
                )}
              >
                {signal}
              </button>
            );
          })}
        </div>
      </div>

      {selectedEmotion && (
        <>
          <div className="space-y-3">
            <p className="text-sm font-medium">Qual nome chega mais perto?</p>
            <div className="flex flex-wrap gap-2">
              {selectedEmotion.refinedNames.map((name) => {
                const selected = data.refinedName === name;

                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() =>
                      onPatch({ refinedName: selected ? "" : name })
                    }
                    className={cn(
                      "rounded-full border px-3 py-2 text-xs",
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border/40 bg-background/40",
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">O que pode ajudar agora?</p>
            <div className="space-y-2">
              {selectedEmotion.supportActions.map((action) => {
                const selected = data.supportAction === action;

                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() =>
                      onPatch({ supportAction: selected ? "" : action })
                    }
                    className={cn(
                      "w-full rounded-xl border px-3 py-2 text-left text-xs",
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border/40 bg-background/40",
                    )}
                  >
                    {action}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {hasEmotion && (
        <div className="rounded-2xl border border-border/40 bg-background/50 p-4 space-y-2">
          <p className="text-sm font-serif">Painel emocional do momento</p>
          <p className="text-xs text-muted-foreground">
            Emoção predominante:{" "}
            <span className="text-foreground">{selectedLabel}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Intensidade:{" "}
            <span className="text-foreground">
              {data.intensity ? `${data.intensity}/10` : "não informada"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            No corpo:{" "}
            <span className="text-foreground">
              {data.bodySignals?.length
                ? data.bodySignals.join(", ")
                : "não informado"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Nome mais preciso:{" "}
            <span className="text-foreground">
              {data.refinedName || "não informado"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Ação de apoio:{" "}
            <span className="text-foreground">
              {data.supportAction || "não informada"}
            </span>
          </p>
          <p className="pt-2 text-xs font-serif italic text-muted-foreground">
            "Você é o barco. A emoção é a onda. A onda passa."
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between text-xs uppercase tracking-widest text-muted-foreground"
      >
        O que essa emoção está tentando comunicar?
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <Textarea
          value={data.note}
          onChange={(event) => onPatch({ note: event.target.value })}
          placeholder="Escreva sem precisar organizar tudo agora..."
          className="min-h-[90px]"
        />
      )}
    </section>
  );
}
