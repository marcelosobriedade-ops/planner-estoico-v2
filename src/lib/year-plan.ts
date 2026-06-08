import { supabase } from "@/lib/supabase";

export type YearPlanData = {
  mainEvents: string;
  bestMoments: string;
  achievements: string;
  learnings: string;
  importantPeople: string;
  gratitude: string;

  dreamMap: string;
  buildNextYear: string;
  liveNextYear: string;
  conquerNextYear: string;

  health: string;
  relationships: string;
  finances: string;
  workProject: string;
  spirituality: string;
};

export const EMPTY_YEAR_PLAN: YearPlanData = {
  mainEvents: "",
  bestMoments: "",
  achievements: "",
  learnings: "",
  importantPeople: "",
  gratitude: "",

  dreamMap: "",
  buildNextYear: "",
  liveNextYear: "",
  conquerNextYear: "",

  health: "",
  relationships: "",
  finances: "",
  workProject: "",
  spirituality: "",
};

function safeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function getYearKey(date = new Date()) {
  return String(date.getFullYear());
}

export function normalizeYearPlan(value: unknown): YearPlanData {
  const data =
    value && typeof value === "object" ? (value as Partial<YearPlanData>) : {};

  return {
    mainEvents: safeText(data.mainEvents),
    bestMoments: safeText(data.bestMoments),
    achievements: safeText(data.achievements),
    learnings: safeText(data.learnings),
    importantPeople: safeText(data.importantPeople),
    gratitude: safeText(data.gratitude),

    dreamMap: safeText(data.dreamMap),
    buildNextYear: safeText(data.buildNextYear),
    liveNextYear: safeText(data.liveNextYear),
    conquerNextYear: safeText(data.conquerNextYear),

    health: safeText(data.health),
    relationships: safeText(data.relationships),
    finances: safeText(data.finances),
    workProject: safeText(data.workProject),
    spirituality: safeText(data.spirituality),
  };
}

export async function loadYearPlan(yearKey = getYearKey()) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      userId: null,
      yearKey,
      plan: EMPTY_YEAR_PLAN,
    };
  }

  const { data, error } = await supabase
    .from("year_plans")
    .select("data")
    .eq("user_id", session.user.id)
    .eq("year_key", yearKey)
    .maybeSingle();

  if (error) throw error;

  return {
    userId: session.user.id,
    yearKey,
    plan: normalizeYearPlan(data?.data),
  };
}

export async function saveYearPlan(
  userId: string,
  yearKey: string,
  plan: YearPlanData,
) {
  const { error } = await supabase.from("year_plans").upsert(
    {
      user_id: userId,
      year_key: yearKey,
      data: normalizeYearPlan(plan),
    },
    {
      onConflict: "user_id,year_key",
    },
  );

  if (error) throw error;
}
