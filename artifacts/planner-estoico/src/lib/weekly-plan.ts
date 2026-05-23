import { supabase } from "@/lib/supabase";

export type WeeklyReviewData = {
  generalFeeling: string;
  mainEvents: string;
  emotionalPattern: string;
  financialImpact: string;
  relationshipImpact: string;
  productivityImpact: string;
  improvements: string;
  decision: string;
};

export type WeeklyPlanData = {
  change: string;
  proofs: string;
  risks: string;
  prevention: string;
  supportHabits: string;
  review?: WeeklyReviewData;
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

export type WeekToDaySuggestion = {
  id: string;
  title: string;
  source: "change" | "proof" | "day";
};

export const EMPTY_WEEKLY_REVIEW: WeeklyReviewData = {
  generalFeeling: "",
  mainEvents: "",
  emotionalPattern: "",
  financialImpact: "",
  relationshipImpact: "",
  productivityImpact: "",
  improvements: "",
  decision: "",
};

export const EMPTY_WEEKLY_PLAN: WeeklyPlanData = {
  change: "",
  proofs: "",
  risks: "",
  prevention: "",
  supportHabits: "",
  review: EMPTY_WEEKLY_REVIEW,
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

function safeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDayKey(dateKey: string): keyof WeeklyPlanData["days"] {
  const date = new Date(dateKey + "T12:00:00");

  const days: Array<keyof WeeklyPlanData["days"]> = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  return days[date.getDay()];
}

export function getWeekStart(dateKey: string): string {
  const date = new Date(dateKey + "T12:00:00");
  const day = date.getDay();
  const sunday = new Date(date);

  sunday.setDate(date.getDate() - day);

  return sunday.toISOString().slice(0, 10);
}

export function getWeekEnd(weekStart: string): string {
  const date = new Date(weekStart + "T12:00:00");
  date.setDate(date.getDate() + 6);
  return date.toISOString().slice(0, 10);
}

export function normalizeWeeklyReview(value: unknown): WeeklyReviewData {
  const review =
    value && typeof value === "object"
      ? (value as Partial<WeeklyReviewData>)
      : {};

  return {
    generalFeeling: safeText(review.generalFeeling),
    mainEvents: safeText(review.mainEvents),
    emotionalPattern: safeText(review.emotionalPattern),
    financialImpact: safeText(review.financialImpact),
    relationshipImpact: safeText(review.relationshipImpact),
    productivityImpact: safeText(review.productivityImpact),
    improvements: safeText(review.improvements),
    decision: safeText(review.decision),
  };
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
    change: safeText(data.change),
    proofs: safeText(data.proofs),
    risks: safeText(data.risks),
    prevention: safeText(data.prevention),
    supportHabits: safeText(data.supportHabits),
    review: normalizeWeeklyReview(data.review),
    days: {
      sunday: safeText(days.sunday),
      monday: safeText(days.monday),
      tuesday: safeText(days.tuesday),
      wednesday: safeText(days.wednesday),
      thursday: safeText(days.thursday),
      friday: safeText(days.friday),
      saturday: safeText(days.saturday),
    },
  };
}

export function buildWeekToDaySuggestions(
  plan: WeeklyPlanData,
  dateKey: string,
): WeekToDaySuggestion[] {
  const normalizedPlan = normalizeWeeklyPlan(plan);
  const dayKey = getDayKey(dateKey);

  const suggestions: WeekToDaySuggestion[] = [];

  const change = normalizedPlan.change.trim();
  const dayDirection = normalizedPlan.days[dayKey].trim();
  const proofs = splitLines(normalizedPlan.proofs);

  if (change) {
    suggestions.push({
      id: "weekly-change",
      title: change,
      source: "change",
    });
  }

  if (dayDirection) {
    suggestions.push({
      id: `weekly-day-${dayKey}`,
      title: dayDirection,
      source: "day",
    });
  }

  proofs.forEach((proof, index) => {
    suggestions.push({
      id: `weekly-proof-${index}`,
      title: proof,
      source: "proof",
    });
  });

  return suggestions;
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

  if (error) throw error;

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
  const { data: current, error: loadError } = await supabase
    .from("weekly_plans")
    .select("data")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (loadError) throw loadError;

  const latestPlan = normalizeWeeklyPlan(current?.data);
  const nextPlan = normalizeWeeklyPlan(plan);

  const mergedPlan: WeeklyPlanData = {
    ...latestPlan,
    ...nextPlan,
    review: {
      ...(latestPlan.review || EMPTY_WEEKLY_REVIEW),
      ...(nextPlan.review || EMPTY_WEEKLY_REVIEW),
    },
    days: {
      ...latestPlan.days,
      ...nextPlan.days,
    },
  };

  const { error } = await supabase.from("weekly_plans").upsert(
    {
      user_id: userId,
      week_start: weekStart,
      data: mergedPlan,
    },
    {
      onConflict: "user_id,week_start",
    },
  );

  if (error) throw error;
}
