import { supabase } from "@/lib/supabase";

export type MonthlyPlanData = {
  vision: string;
  expectedTransformation: string;
  mainGoal: string;
  mainRisk: string;

  virtue: string;
  virtueMode: "free" | "franklin";

  suggestedHabits: string[];

  monthlyReview: string;
  monthlyClosure: string;
};

export const EMPTY_MONTHLY_PLAN: MonthlyPlanData = {
  vision: "",
  expectedTransformation: "",
  mainGoal: "",
  mainRisk: "",

  virtue: "",
  virtueMode: "free",

  suggestedHabits: [],

  monthlyReview: "",
  monthlyClosure: "",
};

function safeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function getMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export function normalizeMonthlyPlan(value: unknown): MonthlyPlanData {
  const data =
    value && typeof value === "object"
      ? (value as Partial<MonthlyPlanData>)
      : {};

  return {
    vision: safeText(data.vision),

    expectedTransformation: safeText(data.expectedTransformation),

    mainGoal: safeText(data.mainGoal),

    mainRisk: safeText(data.mainRisk),

    virtue: safeText(data.virtue),

    virtueMode: data.virtueMode === "franklin" ? "franklin" : "free",

    suggestedHabits: Array.isArray(data.suggestedHabits)
      ? data.suggestedHabits.filter(
          (item): item is string => typeof item === "string",
        )
      : [],

    monthlyReview: safeText(data.monthlyReview),

    monthlyClosure: safeText(data.monthlyClosure),
  };
}

export async function loadMonthlyPlan(monthKey = getMonthKey()) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      userId: null,
      monthKey,
      plan: EMPTY_MONTHLY_PLAN,
    };
  }

  const { data, error } = await supabase
    .from("monthly_plans")
    .select("data")
    .eq("user_id", session.user.id)
    .eq("month_key", monthKey)
    .maybeSingle();

  if (error) throw error;

  return {
    userId: session.user.id,
    monthKey,
    plan: normalizeMonthlyPlan(data?.data),
  };
}

export async function saveMonthlyPlan(
  userId: string,
  monthKey: string,
  plan: MonthlyPlanData,
) {
  const { error } = await supabase.from("monthly_plans").upsert(
    {
      user_id: userId,
      month_key: monthKey,
      data: plan,
    },
    {
      onConflict: "user_id,month_key",
    },
  );

  if (error) throw error;
}
