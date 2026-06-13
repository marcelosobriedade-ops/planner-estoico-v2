import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type RootEmotion =
  | "alegria"
  | "amor"
  | "medo"
  | "tristeza"
  | "raiva"
  | "nojo"
  | "surpresa"
  | "confusao"
  | "";

export type EmotionalCheckInValue = {
  emotion: string;
  note: string;
  rootEmotion?: RootEmotion;
  intensity?: number;
  bodySignals?: string[];
  refinedName?: string;
  supportAction?: string;
};

export type RootEmotionOption = {
  value: RootEmotion;
  label: string;
  emoji: string;
  description: string;
  refinedNames: string[];
  supportActions: string[];
};

export const EMPTY_EMOTIONAL_CHECK_IN: EmotionalCheckInValue = {
  emotion: "",
  note: "",
  rootEmotion: "",
  intensity: undefined,
  bodySignals: [],
  refinedName: "",
  supportAction: "",
};

export const ROOT_EMOTIONS: RootEmotionOption[] = [
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
    value: "confusao",
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

export const BODY_SIGNALS = [
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

function getRootEmotion(value?: string) {
  return ROOT_EMOTIONS.find((emotion) => emotion.value === value);
}

function getEmotionLabel(value?: string) {
  return getRootEmotion(value)?.label || value || "não informada";
}

function isSameArray(a: string[] = [], b: string[] = []) {
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
}

function normalizeSignals(value?: string[]) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function normalizeEmotionalCheckIn(
  value: Partial<EmotionalCheckInValue> | undefined | null,
): EmotionalCheckInValue {
  const current = value && typeof value === "object" ? value : {};

  const rootEmotion =
    typeof current.rootEmotion === "string"
      ? (current.rootEmotion as RootEmotion)
      : "";

  const emotion = current.emotion || rootEmotion || "";

  return {
    emotion,
    note: current.note || "",
    rootEmotion: rootEmotion || (emotion as RootEmotion) || "",
    intensity:
      typeof current.intensity === "number" ? current.intensity : undefined,
    bodySignals: normalizeSignals(current.bodySignals),
    refinedName: current.refinedName || "",
    supportAction: current.supportAction || "",
  };
}

export function EmotionalCheckIn({
  value,
  onChange,
  title,
  subtitle,
  compact = false,
}: {
  value: EmotionalCheckInValue;
  onChange: (next: EmotionalCheckInValue) => void;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}) {
  const current = normalizeEmotionalCheckIn(value);
  const selectedRoot = getRootEmotion(current.rootEmotion || current.emotion);
  const selectedSignals = normalizeSignals(current.bodySignals);

  function update(patch: Partial<EmotionalCheckInValue>) {
    onChange({
      ...current,
      ...patch,
    });
  }

  function selectRootEmotion(rootEmotion: RootEmotion) {
    const selected = current.rootEmotion === rootEmotion;
    const nextRoot = selected ? "" : rootEmotion;
    const nextOption = getRootEmotion(nextRoot);

    const refinedName =
      nextOption && nextOption.refinedNames.includes(current.refinedName || "")
        ? current.refinedName
        : "";

    const supportAction =
      nextOption &&
      nextOption.supportActions.includes(current.supportAction || "")
        ? current.supportAction
        : "";

    update({
      rootEmotion: nextRoot,
      emotion: nextRoot,
      refinedName,
      supportAction,
    });
  }

  function selectIntensity(intensity: number) {
    update({
      intensity: current.intensity === intensity ? undefined : intensity,
    });
  }

  function toggleBodySignal(signal: string) {
    const hasSignal = selectedSignals.includes(signal);

    const nextSignals = hasSignal
      ? selectedSignals.filter((item) => item !== signal)
      : [...selectedSignals, signal];

    if (isSameArray(selectedSignals, nextSignals)) return;

    update({
      bodySignals: nextSignals,
    });
  }

  function selectRefinedName(refinedName: string) {
    update({
      refinedName: current.refinedName === refinedName ? "" : refinedName,
    });
  }

  function selectSupportAction(supportAction: string) {
    update({
      supportAction:
        current.supportAction === supportAction ? "" : supportAction,
    });
  }

  return (
    <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-5">
      {(title || subtitle) && (
        <div className="space-y-1">
          {title && <h2 className="font-serif text-xl">{title}</h2>}
          {subtitle && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      )}

      <div className="space-y-3">
        <SectionLabel>O que está mais presente agora?</SectionLabel>

        <div className="grid grid-cols-2 gap-2">
          {ROOT_EMOTIONS.map((emotion) => {
            const selected = current.rootEmotion === emotion.value;

            return (
              <button
                key={emotion.value}
                type="button"
                onClick={() => selectRootEmotion(emotion.value)}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition-all",
                  selected
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border/40 bg-background",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{emotion.emoji}</span>
                  <span className="text-sm font-medium">{emotion.label}</span>
                </div>

                {!compact && (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {emotion.description}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <SectionLabel>Qual a intensidade da onda?</SectionLabel>

        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((number) => {
            const selected = current.intensity === number;

            return (
              <button
                key={number}
                type="button"
                onClick={() => selectIntensity(number)}
                className={cn(
                  "rounded-xl border px-2 py-2 text-sm transition-all",
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/40 bg-background text-muted-foreground",
                )}
              >
                {number}
              </button>
            );
          })}
        </div>
      </div>

      {!compact && (
        <div className="space-y-3">
          <SectionLabel>Onde isso aparece no corpo?</SectionLabel>

          <div className="flex flex-wrap gap-2">
            {BODY_SIGNALS.map((signal) => {
              const selected = selectedSignals.includes(signal);

              return (
                <button
                  key={signal}
                  type="button"
                  onClick={() => toggleBodySignal(signal)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition-all",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/40 bg-background text-muted-foreground",
                  )}
                >
                  {signal}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedRoot && (
        <>
          <div className="space-y-3">
            <SectionLabel>Qual nome chega mais perto?</SectionLabel>

            <div className="flex flex-wrap gap-2">
              {selectedRoot.refinedNames.map((name) => {
                const selected = current.refinedName === name;

                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => selectRefinedName(name)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-all",
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/40 bg-background text-muted-foreground",
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <SectionLabel>Como acomodar essa onda?</SectionLabel>

            <div className="space-y-2">
              {selectedRoot.supportActions.map((action) => {
                const selected = current.supportAction === action;

                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => selectSupportAction(action)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2 text-left text-xs transition-all",
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/40 bg-background text-muted-foreground",
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

      <div className="space-y-2">
        <SectionLabel>O que essa emoção está tentando comunicar?</SectionLabel>

        <Textarea
          value={current.note}
          onChange={(event) =>
            update({
              note: event.target.value,
            })
          }
          placeholder="Escreva uma frase curta sobre o que essa emoção pode estar mostrando."
          className="min-h-[86px] resize-none rounded-xl border-border/40 bg-background"
        />
      </div>

      {(current.rootEmotion || current.emotion) && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2">
          <SectionLabel>Painel emocional</SectionLabel>

          <p className="text-sm">
            Emoção predominante:{" "}
            <span className="font-medium">
              {getEmotionLabel(current.rootEmotion || current.emotion)}
            </span>
          </p>

          <p className="text-sm">
            Intensidade:{" "}
            <span className="font-medium">
              {current.intensity ? `${current.intensity}/10` : "não informada"}
            </span>
          </p>

          {!compact && (
            <p className="text-sm">
              No corpo:{" "}
              <span className="font-medium">
                {selectedSignals.length > 0
                  ? selectedSignals.join(", ")
                  : "não informado"}
              </span>
            </p>
          )}

          <p className="text-sm">
            Nome mais preciso:{" "}
            <span className="font-medium">
              {current.refinedName || "em investigação"}
            </span>
          </p>

          <p className="text-sm">
            Ação de apoio:{" "}
            <span className="font-medium">
              {current.supportAction || "escolha uma forma de acomodar a onda"}
            </span>
          </p>

          <p className="pt-2 font-serif italic text-sm text-muted-foreground">
            Você é o barco. A emoção é a onda. A onda passa.
          </p>
        </div>
      )}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary/70">
      {children}
    </p>
  );
}
