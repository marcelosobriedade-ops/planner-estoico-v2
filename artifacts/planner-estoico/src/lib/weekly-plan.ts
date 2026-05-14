import { supabase } from "@/lib/supabase";

export type WeeklyPlanData = {
  change: string;
  proofs: string;
  risks: string;
  prevention: string;
  days: {
    sunday: string;
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
  };
};

export const EMPTY_WEEKLY_PLAN: WeeklyPlanData = {
  change: "",
  proofs: "",
  risks: "",
  prevention: "",
  days: {
    sunday: "",
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
  },
};

export function getWeekStart(dateKey: string): string {
  const date = new Date(dateKey + "T12:00:00");
  const day = date.getDay(); // domingo = 0

  const sunday = new Date(date);
  sunday.setDate(date.getDate() - day);

  return sunday.toISOString().slice(0, 10);
}

export function normalizeWeeklyPlan(value: unknown): WeeklyPlanData {
  const data =
    value && typeof value === "object"
      ? (value as Partial<WeeklyPlanData>)
      : {};

  const days =
    data.days && typeof data.days === "object"
      ? data.days
      : EMPTY_WEEKLY_PLAN.days;

  return {
    change: typeof data.change === "string" ? data.change : "",
    proofs: typeof data.proofs === "string" ? data.proofs : "",
    risks: typeof data.risks === "string" ? data.risks : "",
    prevention: typeof data.prevention === "string" ? data.prevention : "",
    days: {
      sunday: typeof days.sunday === "string" ? days.sunday : "",
      monday: typeof days.monday === "string" ? days.monday : "",
      tuesday: typeof days.tuesday === "string" ? days.tuesday : "",
      wednesday: typeof days.wednesday === "string" ? days.wednesday : "",
      thursday: typeof days.thursday === "string" ? days.thursday : "",
      friday: typeof days.friday === "string" ? days.friday : "",
      saturday: typeof days.saturday === "string" ? days.saturday : "",
    },
  };
}

export async function loadWeeklyPlan(dateKey: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      userId: null,
      weekStart: getWeekStart(dateKey),
      plan: EMPTY_WEEKLY_PLAN,
    };
  }

  const weekStart = getWeekStart(dateKey);

  const { data, error } = await supabase
    .from("weekly_plans")
    .select("data")
    .eq("user_id", session.user.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    userId: session.user.id,
    weekStart,
    plan: normalizeWeeklyPlan(data?.data),
  };
}

export async function saveWeeklyPlan(
  userId: string,
  weekStart: string,
  plan: WeeklyPlanData,
) {
  const { error } = await supabase.from("weekly_plans").upsert(
    {
      user_id: userId,
      week_start: weekStart,
      data: plan,
    },
    {
      onConflict: "user_id,week_start",
    },
  );

  if (error) {
    throw error;
  }
}
