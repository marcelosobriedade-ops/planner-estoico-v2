export interface MorningRitual {
  feeling: string;
  control: string;
  virtueOfDay: string;
  challenges: string;
  actions: string;
  priorities: [string, string, string];
  mode: "productive" | "normal" | "survival" | "";
}

export const EMPTY_MORNING_RITUAL: MorningRitual = {
  feeling: "",
  control: "",
  virtueOfDay: "",
  challenges: "",
  actions: "",
  priorities: ["", "", ""],
  mode: "",
};

export interface NightRitual {
  learning: string;
  improve: string;
  wins: string;
  feeling: string;
  value: string;
}

export const EMPTY_NIGHT_RITUAL: NightRitual = {
  learning: "",
  improve: "",
  wins: "",
  feeling: "",
  value: "",
};

export type RitualStatus = "Pendente" | "Em andamento" | "Completo";

function safeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function safePriorities(value: unknown): [string, string, string] {
  if (!Array.isArray(value)) return ["", "", ""];

  return [safeText(value[0]), safeText(value[1]), safeText(value[2])];
}

export function normalizeMorningRitual(value: unknown): MorningRitual {
  const r =
    value && typeof value === "object" ? (value as Partial<MorningRitual>) : {};

  return {
    feeling: safeText(r.feeling),
    control: safeText(r.control),
    virtueOfDay: safeText(r.virtueOfDay),
    challenges: safeText(r.challenges),
    actions: safeText(r.actions),
    priorities: safePriorities(r.priorities),
    mode:
      r.mode === "productive" || r.mode === "normal" || r.mode === "survival"
        ? r.mode
        : "",
  };
}

export function normalizeNightRitual(value: unknown): NightRitual {
  const r =
    value && typeof value === "object" ? (value as Partial<NightRitual>) : {};

  return {
    learning: safeText(r.learning),
    improve: safeText(r.improve),
    wins: safeText(r.wins),
    feeling: safeText(r.feeling),
    value: safeText(r.value),
  };
}

export function getMorningStatus(
  r: Partial<MorningRitual> | null | undefined,
): RitualStatus {
  const ritual = normalizeMorningRitual(r);

  const reflections = [
    ritual.feeling,
    ritual.control,
    ritual.virtueOfDay,
    ritual.challenges,
    ritual.actions,
  ];

  const filled = reflections.filter((v) => v.trim() !== "").length;
  const hasPriority = ritual.priorities.some((p) => p.trim() !== "");

  if (filled === 0 && !hasPriority && ritual.mode === "") return "Pendente";
  if (filled === reflections.length && hasPriority && ritual.mode !== "")
    return "Completo";

  return "Em andamento";
}

export function getNightStatus(
  r: Partial<NightRitual> | null | undefined,
): RitualStatus {
  const ritual = normalizeNightRitual(r);

  const fields = [
    ritual.learning,
    ritual.improve,
    ritual.wins,
    ritual.feeling,
    ritual.value,
  ];

  const filled = fields.filter((v) => v.trim() !== "").length;

  if (filled === 0) return "Pendente";
  if (filled === fields.length) return "Completo";

  return "Em andamento";
}

export function getWeekKey(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00");
  const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay();
  const monday = new Date(d);

  monday.setDate(d.getDate() - dayOfWeek + 1);

  return monday.toISOString().slice(0, 10);
}
