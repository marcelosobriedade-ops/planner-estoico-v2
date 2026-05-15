import { supabase } from "@/lib/supabase";

export type WeeklyReviewData = {
  generalFeeling: string;
  mainEvents: string;
  emotionalPattern: string;
  financialImpact: string;
  relationshipImpact: string;
  productivityImpact: string;
  improvements: string;
};

export type WeeklyPlanData = {
  change: string;
  proofs: string;
  risks: string;
  prevention: string;
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

export const EMPTY_WEEKLY_REVIEW: WeeklyReviewData = {
  generalFeeling: "",
  mainEvents: "",
  emotionalPattern: "",
  financialImpact: "",
  relationshipImpact: "",
  productivityImpact: "",
  improvements: "",
};

export const EMPTY_WEEKLY_PLAN: WeeklyPlanData = {
  change: "",
  proofs: "",
  risks: "",
  prevention: "",
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
  const { error } = await supabase.from("weekly_plans").upsert(
    {
      user_id: userId,
      week_start: weekStart,
      data: normalizeWeeklyPlan(plan),
    },
    {
      onConflict: "user_id,week_start",
    },
  );

  if (error) throw error;
}
