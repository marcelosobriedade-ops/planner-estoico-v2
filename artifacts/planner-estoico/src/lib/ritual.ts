export interface DailyRitual {
  morning: {
    feeling: string;
    control: string;
    virtue: string;
    challenges: string;
    actions: string;
  };
  night: {
    learning: string;
    improve: string;
    wins: string;
    feeling: string;
    value: string;
  };
}

export const EMPTY_RITUAL: DailyRitual = {
  morning: {
    feeling: "",
    control: "",
    virtue: "",
    challenges: "",
    actions: "",
  },
  night: {
    learning: "",
    improve: "",
    wins: "",
    feeling: "",
    value: "",
  },
};

export type RitualStatus = "Pendente" | "Em andamento" | "Completo";

export function getRitualStatus(ritual: DailyRitual): RitualStatus {
  const morningFields = Object.values(ritual.morning);
  const nightFields = Object.values(ritual.night);
  const allFields = [...morningFields, ...nightFields];
  const filled = allFields.filter((v) => v.trim() !== "").length;

  if (filled === 0) return "Pendente";
  if (filled === allFields.length) return "Completo";
  return "Em andamento";
}
