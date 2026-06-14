import React, { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Brain,
  CheckCircle2,
} from "lucide-react";
import {
  EMPTY_WEEKLY_PLAN,
  EMPTY_WEEKLY_REVIEW,
  WeeklyPlanData,
  WeeklyReviewData,
  getWeekEnd,
  loadWeeklyPlan,
  saveWeeklyPlan,
} from "@/lib/weekly-plan";
import { getMonthKey, loadMonthlyPlan } from "@/lib/monthly-plan";
import { loadYearPlan } from "@/lib/year-plan";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { supabase } from "@/lib/supabase";

type Proof = {
  id: string;
  text: string;
  checked: boolean;
};

type DailyRecord = {
  date: string;
  data: any;
};

type MonthlyContext = {
  virtue: string;
  mainGoal: string;
  mainRisk: string;
};

const DECISION_OPTIONS = [
  { value: "continuar", label: "Continuar direção" },
  { value: "ajustar", label: "Ajustar rota" },
  { value: "proteger", label: "Reforçar proteção" },
];

function parseProofs(raw: string): Proof[] {
  if (!raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({
      id: crypto.randomUUID(),
      text,
      checked: false,
    }));
}

function stringifyProofs(proofs: Proof[]) {
  return JSON.stringify(proofs);
}

function parseLines(raw: string): string[] {
  return (raw || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringifyLines(items: string[]) {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");
}

function getMonthlyContext(rawPlan: any): MonthlyContext | null {
  if (!rawPlan) return null;

  const virtue = String(
    rawPlan.virtue || rawPlan.monthVirtue || rawPlan.virtude || "",
  ).trim();

  const mainGoal = String(
    rawPlan.mainGoal ||
      rawPlan.objective ||
      rawPlan.goal ||
      rawPlan.primaryGoal ||
      rawPlan.objetivoPrincipal ||
      "",
  ).trim();

  const mainRisk = String(
    rawPlan.mainRisk ||
      rawPlan.risk ||
      rawPlan.primaryRisk ||
      rawPlan.principalRisk ||
      rawPlan.principalRisco ||
      "",
  ).trim();

  if (!virtue && !mainGoal && !mainRisk) return null;

  return {
    virtue,
    mainGoal,
    mainRisk,
  };
}

function isSaturday(dateKey: string) {
  return new Date(dateKey + "T12:00:00").getDay() === 6;
}

function getPreviousWeekDateKey(weekStart: string) {
  const date = new Date(weekStart + "T12:00:00");
  date.setDate(date.getDate() - 7);
  return date.toISOString().slice(0, 10);
}

function getDecisionLabel(value: string) {
  if (value === "continuar") return "Continuar direção";
  if (value === "ajustar") return "Ajustar rota";
  if (value === "proteger") return "Reforçar proteção";
  return "";
}

function getPreviousDecisionGuidance(value: string) {
  if (value === "continuar") {
    return "Na semana anterior você decidiu continuar. Mantenha a direção, mas escolha provas realistas para sustentar o avanço.";
  }

  if (value === "ajustar") {
    return "Na semana anterior você decidiu ajustar a rota. Antes de definir a direção, revise o que não funcionou e simplifique o plano.";
  }

  if (value === "proteger") {
    return "Na semana anterior você decidiu reforçar proteção. Dê mais atenção aos riscos e defina respostas claras para evitar repetir os mesmos erros.";
  }

  return "";
}

function getDirectionGuidance(value: string) {
  if (value === "continuar") {
    return "Você decidiu continuar. Mantenha a mesma direção, mas torne-a mais concreta e sustentável.";
  }

  if (value === "ajustar") {
    return "Você decidiu ajustar. Evite algo genérico — escreva uma direção mais simples, clara e executável.";
  }

  if (value === "proteger") {
    return "Você decidiu se proteger. Sua direção deve considerar os riscos e evitar repetir os mesmos erros.";
  }

  return "";
}

function getProofGuidance(value: string) {
  if (value === "continuar") {
    return "Você decidiu continuar. Foque em provas simples e repetíveis — consistência é mais importante que intensidade.";
  }

  if (value === "ajustar") {
    return "Você decidiu ajustar. Reduza a ambição e escolha provas mais claras e executáveis.";
  }

  if (value === "proteger") {
    return "Você decidiu se proteger. Inclua provas que evitem erros recorrentes e preservem sua energia.";
  }

  return "";
}

function getRiskGuidance(value: string) {
  if (value === "continuar") {
    return "Como você decidiu continuar, observe o que pode quebrar sua consistência nesta semana.";
  }

  if (value === "ajustar") {
    return "Como você decidiu ajustar, identifique o que tornou o plano anterior difícil, confuso ou pesado demais.";
  }

  if (value === "proteger") {
    return "Como você decidiu reforçar proteção, escolha o risco principal que mais pode te derrubar nesta semana.";
  }

  return "";
}

function getPreventionGuidance(value: string) {
  if (value === "continuar") {
    return "Defina uma resposta simples para quando a consistência começar a cair.";
  }

  if (value === "ajustar") {
    return "Defina uma resposta mais realista do que a anterior — menor, mais clara e executável.";
  }

  if (value === "proteger") {
    return "Defina uma proteção concreta: o que você fará no primeiro sinal de queda?";
  }

  return "";
}

function getNextWeekBridgeChecklist(value: string) {
  if (value === "continuar") {
    return [
      "Revisar a direção da próxima semana mantendo o que funcionou.",
      "Escolher provas simples para reforçar consistência.",
      "Definir proteção contra o risco que pode quebrar a constância.",
    ];
  }

  if (value === "ajustar") {
    return [
      "Simplificar a rota da próxima semana.",
      "Reduzir excesso e escolher provas mais realistas.",
      "Definir proteção contra o ponto que tornou o plano pesado.",
    ];
  }

  if (value === "proteger") {
    return [
      "Identificar o risco principal antes de iniciar a próxima semana.",
      "Criar uma proteção concreta para o primeiro sinal de queda.",
      "Evitar repetir o padrão que derrubou o ciclo anterior.",
    ];
  }

  return [
    "Revisar a direção da próxima semana.",
    "Escolher provas menores e mais reais.",
    "Definir proteção contra o risco principal.",
  ];
}

const VALID_WEEKLY_EMOTIONS = new Set([
  "alegria",
  "amor",
  "medo",
  "tristeza",
  "raiva",
  "nojo",
  "surpresa",
  "confusão",
]);

function normalizeWeeklyEmotionValue(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return VALID_WEEKLY_EMOTIONS.has(normalized) ? normalized : "";
}

function sanitizeWeeklyEmotionEntry(value: any) {
  if (!value || typeof value !== "object") return value;

  const validEmotion = normalizeWeeklyEmotionValue(
    value.primaryEmotion || value.emotion,
  );

  if (!validEmotion) {
    return {
      ...value,
      emotion: "",
      primaryEmotion: "",
    };
  }

  return {
    ...value,
    emotion: validEmotion,
    primaryEmotion: validEmotion,
  };
}

function sanitizeWeeklyEmotions(value: any) {
  if (!value || typeof value !== "object") return value;

  return {
    ...value,
    morning: sanitizeWeeklyEmotionEntry(value.morning),
    afternoon: sanitizeWeeklyEmotionEntry(value.afternoon),
    evening: sanitizeWeeklyEmotionEntry(value.evening),
  };
}

function sanitizeWeeklyRecord(record: DailyRecord): DailyRecord {
  const data: any = record.data || {};
  const validMorningFeeling = normalizeWeeklyEmotionValue(
    data.morning?.feeling,
  );

  return {
    ...record,
    data: {
      ...data,
      emotions: sanitizeWeeklyEmotions(data.emotions),
      morning: data.morning
        ? {
            ...data.morning,
            feeling: validMorningFeeling,
          }
        : data.morning,
    },
  };
}

function sanitizeWeeklyRecords(records: DailyRecord[]) {
  return records.map(sanitizeWeeklyRecord);
}

function hasEmotion(record: DailyRecord) {
  const emotions = record.data?.emotions;
  return Boolean(
    emotions?.morning?.emotion ||
      emotions?.afternoon?.emotion ||
      emotions?.evening?.emotion,
  );
}

function hasPeople(record: DailyRecord) {
  return Array.isArray(record.data?.people) && record.data.people.length > 0;
}

function getFinancialCount(record: DailyRecord) {
  return record.data?.financial?.length || 0;
}

function getTasksCount(record: DailyRecord) {
  return record.data?.tasks?.length || 0;
}

function getDoneTasksCount(record: DailyRecord) {
  return (record.data?.tasks || []).filter(
    (task: any) => task.status === "done",
  ).length;
}

function getTaskTitle(task: any): string {
  return String(task?.title || task?.text || "").trim();
}

function isTaskDone(task: any): boolean {
  return task?.status === "done" || task?.completed === true;
}

function isTaskCancelled(task: any): boolean {
  return task?.status === "cancelled";
}

function isWeeklyProofTask(task: any): boolean {
  return task?.source === "weekly-proof" || Boolean(task?.weeklyProofId);
}

function isMorningPriorityTask(task: any): boolean {
  return task?.source === "morning-priority";
}

function uniqueTexts(items: string[]): string[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const text = String(item || "").trim();
    const key = text.toLowerCase();

    if (!text || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

type EmotionPeriod = "morning" | "afternoon" | "evening";

type EmotionalWeekEntry = {
  period: EmotionPeriod;
  emotion: string;
  intensity: number | null;
  bodySignals: string[];
};

type CountItem = {
  label: string;
  count: number;
};

type WeekRelationshipEntry = {
  id: string;
  date: string;
  name: string;
  relationshipType: string;
  context: string;
  learned: string;
  repair: string;
  nextStep: string;
  boundary: string;
  virtues: string[];
  outcome: string;
  memoryCue: string;
  interests: string;
  followUpDate: string;
};

type RelationshipWeekPerson = {
  name: string;
  relationshipType: string;
  interactions: WeekRelationshipEntry[];
};

type FinancialTransactionType = "income" | "expense";

type WeekFinancialEntry = {
  id: string;
  date: string;
  type: FinancialTransactionType;
  description: string;
  amount: number | null;
  emotion: string;
  refinedEmotion: string;
  trigger: string;
  financialNeed: string;
  observation: string;
};

type FinancialWeekPattern = {
  label: string;
  value: string;
  count: number;
};

const EMOTION_PERIODS: { key: EmotionPeriod; label: string }[] = [
  { key: "morning", label: "Manhã" },
  { key: "afternoon", label: "Tarde" },
  { key: "evening", label: "Noite" },
];

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getEmotionName(entry: any): string {
  return normalizeText(entry?.primaryEmotion) || normalizeText(entry?.emotion);
}

function getEmotionIntensity(entry: any): number | null {
  const value = entry?.intensity;

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(Math.max(value, 0), 10);
  }

  return null;
}

function getBodySignals(entry: any): string[] {
  if (!Array.isArray(entry?.bodySignals)) return [];

  return entry.bodySignals
    .map((signal: unknown) => normalizeText(signal))
    .filter(Boolean);
}

function collectWeekEmotions(records: DailyRecord[]): EmotionalWeekEntry[] {
  return records.flatMap((record) => {
    const emotions = record.data?.emotions || {};

    return EMOTION_PERIODS.map(({ key }) => {
      const entry = emotions?.[key] || {};
      const emotion = getEmotionName(entry);

      if (!emotion) return null;

      return {
        period: key,
        emotion,
        intensity: getEmotionIntensity(entry),
        bodySignals: getBodySignals(entry),
      };
    }).filter((entry): entry is EmotionalWeekEntry => Boolean(entry));
  });
}

function countByText(items: string[]): CountItem[] {
  const counts = new Map<string, { label: string; count: number }>();

  items.forEach((item) => {
    const label = normalizeText(item);
    const key = label.toLowerCase();

    if (!label) return;

    const current = counts.get(key) || { label, count: 0 };
    counts.set(key, {
      ...current,
      count: current.count + 1,
    });
  });

  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

function getAverage(values: number[]): number | null {
  if (values.length === 0) return null;

  return (
    Math.round(
      (values.reduce((total, value) => total + value, 0) / values.length) * 10,
    ) / 10
  );
}

function getBarWidth(count: number, max: number): string {
  if (max <= 0) return "0%";

  return `${Math.max(Math.round((count / max) * 100), 8)}%`;
}

function getEmotionIcon(label: string): string {
  const value = label.trim().toLowerCase();

  if (value === "alegria") return "😊";
  if (value === "amor") return "🤍";
  if (value === "medo") return "😨";
  if (value === "tristeza") return "😢";
  if (value === "raiva") return "😡";
  if (value === "nojo") return "🤢";
  if (value === "surpresa") return "😮";
  if (value === "confusão") return "😵‍💫";

  return "•";
}

function getEmotionPercentage(count: number, total: number): number {
  if (total <= 0) return 0;

  return Math.round((count / total) * 100);
}

function getInteractionId(
  interaction: any,
  date: string,
  index: number,
): string {
  return String(
    interaction?.id ||
      [
        date,
        index,
        interaction?.name,
        interaction?.context,
        interaction?.learned,
        interaction?.nextStep,
        interaction?.boundary,
        interaction?.memoryCue,
        interaction?.relationshipType,
      ]
        .map((value) =>
          String(value || "")
            .trim()
            .toLowerCase(),
        )
        .join("|"),
  );
}

function normalizeInteraction(
  interaction: any,
  date: string,
  index: number,
): WeekRelationshipEntry | null {
  const name = normalizeText(interaction?.name);

  if (!name) return null;

  return {
    id: getInteractionId(interaction, date, index),
    date,
    name,
    relationshipType: normalizeText(interaction?.relationshipType),
    context: normalizeText(interaction?.context),
    learned: normalizeText(interaction?.learned),
    repair: normalizeText(interaction?.repair),
    nextStep: normalizeText(interaction?.nextStep),
    boundary: normalizeText(interaction?.boundary),
    virtues: Array.isArray(interaction?.virtues)
      ? interaction.virtues
          .map((virtue: unknown) => normalizeText(virtue))
          .filter(Boolean)
      : [],
    outcome: normalizeText(interaction?.outcome),
    memoryCue: normalizeText(interaction?.memoryCue),
    interests: normalizeText(interaction?.interests),
    followUpDate: normalizeText(interaction?.followUpDate),
  };
}

function collectWeekRelationships(
  records: DailyRecord[],
): WeekRelationshipEntry[] {
  return records.flatMap((record) => {
    const people = Array.isArray(record.data?.people) ? record.data.people : [];

    return people
      .map((interaction: any, index: number) =>
        normalizeInteraction(interaction, record.date, index),
      )
      .filter((entry): entry is WeekRelationshipEntry => Boolean(entry));
  });
}

function getRelationshipDateLabel(dateKey: string): string {
  return new Date(dateKey + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function getOutcomeText(outcome: string): string {
  if (outcome === "success") return "Acerto";
  if (outcome === "failure") return "Falha";
  return "";
}

function getRelationshipDetails(entry: WeekRelationshipEntry): string[] {
  return [
    entry.relationshipType ? `Vínculo: ${entry.relationshipType}` : "",
    entry.context ? `O que aconteceu: ${entry.context}` : "",
    entry.learned ? `O que aprendi: ${entry.learned}` : "",
    entry.repair ? `Reparação: ${entry.repair}` : "",
    entry.nextStep ? `Próximo passo: ${entry.nextStep}` : "",
    entry.boundary ? `Limite: ${entry.boundary}` : "",
    entry.memoryCue ? `Gancho de memória: ${entry.memoryCue}` : "",
    entry.interests ? `Interesses: ${entry.interests}` : "",
    entry.followUpDate
      ? `Follow-up: ${getRelationshipDateLabel(entry.followUpDate)}`
      : "",
    entry.virtues.length > 0 ? `Virtudes: ${entry.virtues.join(", ")}` : "",
    getOutcomeText(entry.outcome)
      ? `Resultado: ${getOutcomeText(entry.outcome)}`
      : "",
  ].filter(Boolean);
}

function hasStrengtheningRelationshipData(
  entry: WeekRelationshipEntry,
): boolean {
  return Boolean(
    entry.learned ||
      entry.nextStep ||
      entry.memoryCue ||
      entry.interests ||
      entry.virtues.length > 0 ||
      entry.outcome === "success",
  );
}

function hasEnergyRelationshipData(entry: WeekRelationshipEntry): boolean {
  return Boolean(entry.boundary || entry.repair || entry.outcome === "failure");
}

function hasMeaningfulEncounterData(entry: WeekRelationshipEntry): boolean {
  return Boolean(
    entry.context ||
      entry.memoryCue ||
      entry.nextStep ||
      entry.followUpDate ||
      entry.relationshipType,
  );
}

function groupRelationshipsByPerson(
  entries: WeekRelationshipEntry[],
): RelationshipWeekPerson[] {
  const map = new Map<string, RelationshipWeekPerson>();

  entries.forEach((entry) => {
    const key = entry.name.toLowerCase();
    const current = map.get(key);

    if (!current) {
      map.set(key, {
        name: entry.name,
        relationshipType: entry.relationshipType,
        interactions: [entry],
      });
      return;
    }

    current.interactions.push(entry);

    if (!current.relationshipType && entry.relationshipType) {
      current.relationshipType = entry.relationshipType;
    }
  });

  return Array.from(map.values());
}

function normalizeFinancialType(value: unknown): FinancialTransactionType {
  return value === "income" ? "income" : "expense";
}

function normalizeFinancialAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value.replace(".", "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getFinancialEntryId(
  transaction: any,
  date: string,
  index: number,
): string {
  return String(
    transaction?.id ||
      [
        date,
        index,
        transaction?.type,
        transaction?.description,
        transaction?.amount,
        transaction?.emotion,
        transaction?.trigger,
        transaction?.financialNeed,
      ]
        .map((value) =>
          String(value || "")
            .trim()
            .toLowerCase(),
        )
        .join("|"),
  );
}

function normalizeFinancialEntry(
  transaction: any,
  date: string,
  index: number,
): WeekFinancialEntry | null {
  const description = normalizeText(transaction?.description);
  const amount = normalizeFinancialAmount(transaction?.amount);
  const emotion = normalizeText(transaction?.emotion);
  const refinedEmotion = normalizeText(transaction?.refinedEmotion);
  const trigger = normalizeText(transaction?.trigger);
  const financialNeed = normalizeText(transaction?.financialNeed);
  const observation =
    normalizeText(transaction?.observation) ||
    normalizeText(transaction?.observations) ||
    normalizeText(transaction?.notes) ||
    normalizeText(transaction?.note) ||
    normalizeText(transaction?.comment);

  if (
    !description &&
    amount === null &&
    !emotion &&
    !refinedEmotion &&
    !trigger &&
    !financialNeed &&
    !observation
  ) {
    return null;
  }

  return {
    id: getFinancialEntryId(transaction, date, index),
    date,
    type: normalizeFinancialType(transaction?.type),
    description,
    amount,
    emotion,
    refinedEmotion,
    trigger,
    financialNeed,
    observation,
  };
}

function collectWeekFinancialEntries(
  records: DailyRecord[],
): WeekFinancialEntry[] {
  return records.flatMap((record) => {
    const financial = Array.isArray(record.data?.financial)
      ? record.data.financial
      : [];

    return financial
      .map((transaction: any, index: number) =>
        normalizeFinancialEntry(transaction, record.date, index),
      )
      .filter((entry): entry is WeekFinancialEntry => Boolean(entry));
  });
}

function getFinancialDateLabel(dateKey: string): string {
  return new Date(dateKey + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function getFinancialTypeLabel(type: FinancialTransactionType): string {
  return type === "income" ? "Receita" : "Despesa";
}

function formatFinancialCurrency(value: number | null): string {
  if (value === null) return "Valor não informado";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getFinancialEmotionLabel(value: string): string {
  const emotionLabels: Record<string, string> = {
    alegria: "🌞 Alegria",
    amor: "🤍 Amor",
    medo: "🌫️ Medo",
    tristeza: "🌧️ Tristeza",
    raiva: "🔥 Raiva",
    nojo: "🪨 Nojo",
    surpresa: "⚡ Surpresa",
    confusão: "🌀 Confusão",
  };

  return emotionLabels[value] || value;
}

function getFinancialEntryDetails(entry: WeekFinancialEntry): string[] {
  return [
    entry.description ? `Descrição: ${entry.description}` : "",
    entry.amount !== null
      ? `Valor: ${formatFinancialCurrency(entry.amount)}`
      : "",
    entry.emotion ? `Emoção: ${getFinancialEmotionLabel(entry.emotion)}` : "",
    entry.refinedEmotion ? `Nome mais próximo: ${entry.refinedEmotion}` : "",
    entry.financialNeed ? `Busca financeira: ${entry.financialNeed}` : "",
    entry.trigger ? `Gatilho: ${entry.trigger}` : "",
    entry.observation ? `Observação: ${entry.observation}` : "",
  ].filter(Boolean);
}

function getFinancialPatternItems(
  label: string,
  items: CountItem[],
): FinancialWeekPattern[] {
  return items.map((item) => ({
    label,
    value: item.label,
    count: item.count,
  }));
}

type WeeklySynthesisGroup = {
  title: string;
  items: string[];
};

function formatCountSuffix(count: number): string {
  return `vez${count === 1 ? "" : "es"}`;
}

function getTopCountItem(items: CountItem[]): CountItem | null {
  return items.length > 0 ? items[0] : null;
}

function isDifficultEmotion(label: string): boolean {
  const value = label.trim().toLowerCase();

  return ["medo", "tristeza", "raiva", "nojo", "confusão"].includes(value);
}

function getWeeklyTheme(
  emotionalPanel: { emotionCounts: CountItem[]; bodySignals: CountItem[] },
  peopleAnalysis: {
    entries: WeekRelationshipEntry[];
    strengthening: WeekRelationshipEntry[];
  },
  financialAnalysis: { needCounts: CountItem[]; triggerCounts: CountItem[] },
  directionOfWeek: {
    completedDirectionItems: number;
    pendingDirectionItems: number;
  },
): string {
  const topEmotion = getTopCountItem(emotionalPanel.emotionCounts);
  const topNeed = getTopCountItem(financialAnalysis.needCounts);
  const relationshipText = peopleAnalysis.entries
    .flatMap((entry) => [
      entry.name,
      entry.relationshipType,
      entry.context,
      entry.memoryCue,
      entry.interests,
    ])
    .join(" ")
    .toLowerCase();
  const bodyText = emotionalPanel.bodySignals
    .map((item) => item.label)
    .join(" ")
    .toLowerCase();

  if (
    /(filho|filha|pai|mãe|mae|irmão|irmao|irmã|irma|família|familia)/.test(
      relationshipText,
    )
  ) {
    return "Família";
  }

  if (
    /(dor|sono|cansaço|cansaco|corpo|saúde|saude|respiração|respiracao)/.test(
      bodyText,
    )
  ) {
    return "Saúde";
  }

  if (
    topNeed &&
    ["segurança", "controle", "alívio", "alivio", "necessidade real"].includes(
      topNeed.label.toLowerCase(),
    )
  ) {
    return "Proteção";
  }

  if (peopleAnalysis.strengthening.length > 0) {
    return "Reconexão";
  }

  if (directionOfWeek.completedDirectionItems > 0) {
    return "Crescimento";
  }

  if (
    topEmotion &&
    ["amor", "alegria"].includes(topEmotion.label.toLowerCase())
  ) {
    return topEmotion.label.charAt(0).toUpperCase() + topEmotion.label.slice(1);
  }

  if (
    financialAnalysis.triggerCounts.length > 0 ||
    directionOfWeek.pendingDirectionItems > 0
  ) {
    return "Aprendizado";
  }

  return "Sem tema dominante";
}

function getWeeklySynthesisItems(
  emotionalPanel: { emotionCounts: CountItem[] },
  peopleAnalysis: { presentPeople: RelationshipWeekPerson[] },
  financialAnalysis: { needCounts: CountItem[]; triggerCounts: CountItem[] },
  directionOfWeek: {
    completedDirectionItems: number;
    pendingDirectionItems: number;
  },
): string[] {
  const topEmotion = getTopCountItem(emotionalPanel.emotionCounts);
  const topPerson = peopleAnalysis.presentPeople[0];
  const topNeed = getTopCountItem(financialAnalysis.needCounts);
  const topTrigger = getTopCountItem(financialAnalysis.triggerCounts);

  return uniqueTexts([
    topPerson
      ? `${topPerson.name} apareceu entre as relações mais presentes.`
      : "",
    topEmotion
      ? `${topEmotion.label} foi uma das emoções predominantes da semana.`
      : "",
    topNeed ? `${topNeed.label} apareceu entre os padrões financeiros.` : "",
    topTrigger
      ? `${topTrigger.label} apareceu como gatilho financeiro recorrente.`
      : "",
    directionOfWeek.completedDirectionItems > 0
      ? `Houve avanço em ${directionOfWeek.completedDirectionItems} prova${
          directionOfWeek.completedDirectionItems === 1 ? "" : "s"
        } ou marco${directionOfWeek.completedDirectionItems === 1 ? "" : "s"} importante${
          directionOfWeek.completedDirectionItems === 1 ? "" : "s"
        }.`
      : "",
    directionOfWeek.pendingDirectionItems > 0
      ? `${directionOfWeek.pendingDirectionItems} prova${
          directionOfWeek.pendingDirectionItems === 1 ? "" : "s"
        } ou marco${directionOfWeek.pendingDirectionItems === 1 ? "" : "s"} ficaram pendentes.`
      : "",
  ]).slice(0, 5);
}

function getWeeklySynthesisGroups(
  emotionalPanel: { emotionCounts: CountItem[] },
  peopleAnalysis: {
    presentPeople: RelationshipWeekPerson[];
    strengthening: WeekRelationshipEntry[];
    energy: WeekRelationshipEntry[];
  },
  financialAnalysis: {
    needCounts: CountItem[];
    triggerCounts: CountItem[];
  },
  directionOfWeek: {
    completedProofs: string[];
    completedMilestones: string[];
    pendingProofs: string[];
    pendingMilestones: string[];
  },
  risks: string,
): WeeklySynthesisGroup[] {
  const completedDirection = uniqueTexts([
    ...directionOfWeek.completedMilestones,
    ...directionOfWeek.completedProofs,
  ]);
  const pendingDirection = uniqueTexts([
    ...directionOfWeek.pendingMilestones,
    ...directionOfWeek.pendingProofs,
  ]);
  const difficultEmotions = emotionalPanel.emotionCounts.filter((item) =>
    isDifficultEmotion(item.label),
  );
  const riskItems = parseLines(risks || "");

  return [
    {
      title: "O que moveu a semana",
      items: uniqueTexts([
        ...emotionalPanel.emotionCounts
          .slice(0, 3)
          .map(
            (item) =>
              `${item.label} apareceu ${item.count} ${formatCountSuffix(
                item.count,
              )} nos registros emocionais.`,
          ),
        ...peopleAnalysis.presentPeople
          .slice(0, 3)
          .map((person) => `${person.name} esteve presente na semana.`),
        ...completedDirection
          .slice(0, 3)
          .map((item) => `Marco/prova concluída: ${item}`),
      ]),
    },
    {
      title: "O que consumiu energia",
      items: uniqueTexts([
        ...difficultEmotions.map(
          (item) =>
            `${item.label} apareceu ${item.count} ${formatCountSuffix(
              item.count,
            )} nos registros emocionais.`,
        ),
        ...financialAnalysis.triggerCounts
          .slice(0, 3)
          .map(
            (item) =>
              `Gatilho financeiro registrado: ${item.label} · ${item.count} ${formatCountSuffix(
                item.count,
              )}.`,
          ),
        ...pendingDirection
          .slice(0, 3)
          .map((item) => `Pendente de direção: ${item}`),
      ]),
    },
    {
      title: "O que produziu crescimento",
      items: uniqueTexts([
        ...peopleAnalysis.strengthening
          .filter((entry) => entry.learned)
          .slice(0, 3)
          .map(
            (entry) =>
              `${entry.name}: aprendizado registrado — ${entry.learned}`,
          ),
        ...peopleAnalysis.strengthening
          .filter((entry) => entry.nextStep)
          .slice(0, 3)
          .map(
            (entry) =>
              `${entry.name}: próximo passo registrado — ${entry.nextStep}`,
          ),
        ...completedDirection
          .slice(0, 3)
          .map((item) => `Avanço de direção: ${item}`),
      ]),
    },
    {
      title: "O que merece atenção",
      items: uniqueTexts([
        ...riskItems.slice(0, 3).map((item) => `Risco definido: ${item}`),
        ...peopleAnalysis.energy
          .filter((entry) => entry.boundary)
          .slice(0, 3)
          .map(
            (entry) => `${entry.name}: limite registrado — ${entry.boundary}`,
          ),
        ...peopleAnalysis.energy
          .filter((entry) => entry.repair)
          .slice(0, 3)
          .map(
            (entry) => `${entry.name}: reparação registrada — ${entry.repair}`,
          ),
        ...financialAnalysis.needCounts
          .slice(0, 3)
          .map(
            (item) =>
              `Busca financeira recorrente: ${item.label} · ${item.count} ${formatCountSuffix(
                item.count,
              )}.`,
          ),
        ...pendingDirection
          .slice(0, 3)
          .map((item) => `Ponto pendente: ${item}`),
      ]),
    },
  ];
}

export default function Weekly() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [plan, setPlan] = useState<WeeklyPlanData>(EMPTY_WEEKLY_PLAN);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [newProof, setNewProof] = useState("");
  const [newSupportHabit, setNewSupportHabit] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState("");
  const [status, setStatus] = useState("Carregando...");
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [reviewOpen, setReviewOpen] = useState(isSaturday(dateKey));
  const [previousDecision, setPreviousDecision] = useState("");
  const [previousImprovement, setPreviousImprovement] = useState("");
  const [monthlyContext, setMonthlyContext] = useState<MonthlyContext | null>(
    null,
  );
  const [yearContext, setYearContext] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await loadWeeklyPlan(dateKey);

        try {
          const yearKey = dateKey.slice(0, 4);
          const yearResult = await loadYearPlan(yearKey);
          setYearContext(yearResult.plan);
        } catch (yearError) {
          console.error("Erro ao carregar contexto anual:", yearError);
          setYearContext(null);
        }

        try {
          const monthlyResult = await loadMonthlyPlan(
            getMonthKey(new Date(dateKey + "T12:00:00")),
          );
          setMonthlyContext(getMonthlyContext(monthlyResult.plan));
        } catch (monthlyError) {
          console.error("Erro ao carregar contexto mensal:", monthlyError);
          setMonthlyContext(null);
        }

        setUserId(result.userId);
        setWeekStart(result.weekStart);
        setPlan(result.plan);
        setProofs(parseProofs(result.plan.proofs));
        setStatus("Nenhuma alteração pendente.");

        const previousWeekDateKey = getPreviousWeekDateKey(result.weekStart);
        const previous = await loadWeeklyPlan(previousWeekDateKey);

        setPreviousDecision(previous.plan.review?.decision || "");
        setPreviousImprovement(previous.plan.review?.improvements || "");

        if (result.userId) {
          const { data } = await supabase
            .from("daily_records")
            .select("date, data")
            .eq("user_id", result.userId)
            .gte("date", result.weekStart)
            .lte("date", getWeekEnd(result.weekStart))
            .order("date", { ascending: true });

          setRecords(data || []);
        }
      } catch (error) {
        console.error(error);
        setStatus("Erro ao carregar plano.");
      }
    }

    load();
  }, [dateKey]);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");

    if (!["evidencias", "interpretacao", "decisao"].includes(hash)) {
      return;
    }

    setReviewOpen(true);

    const timeout = window.setTimeout(() => {
      const element = document.getElementById(hash);

      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [dateKey, records.length, proofs.length]);

  useEffect(() => {
    if (!userId || !weekStart) return;

    void syncProofsToTasks(proofs);
  }, [userId, weekStart]);

  const summary = useMemo(() => {
    const days = records.length;
    const emotions = records.filter(hasEmotion).length;
    const people = records.filter(hasPeople).length;
    const tasks = records.reduce((acc, r) => acc + getTasksCount(r), 0);
    const doneTasks = records.reduce((acc, r) => acc + getDoneTasksCount(r), 0);
    const financial = records.reduce((acc, r) => acc + getFinancialCount(r), 0);
    const checkedProofs = proofs.filter((p) => p.checked).length;

    const importantTasks = records.reduce(
      (acc, record) =>
        acc +
        (record.data?.tasks || []).filter((task: any) =>
          Boolean(task.alignedToWeek),
        ).length,
      0,
    );

    const completedImportantTasks = records.reduce(
      (acc, record) =>
        acc +
        (record.data?.tasks || []).filter(
          (task: any) => Boolean(task.alignedToWeek) && task.status === "done",
        ).length,
      0,
    );

    const unfinishedImportantTasks = records.reduce(
      (acc, record) =>
        acc +
        (record.data?.tasks || []).filter(
          (task: any) => Boolean(task.alignedToWeek) && task.status !== "done",
        ).length,
      0,
    );

    const unfinishedUrgentTasks = records.reduce(
      (acc, record) =>
        acc +
        (record.data?.tasks || []).filter(
          (task: any) => Boolean(task.mustDoToday) && task.status !== "done",
        ).length,
      0,
    );

    return {
      days,
      emotions,
      people,
      tasks,
      doneTasks,
      financial,
      checkedProofs,
      totalProofs: proofs.length,
      importantTasks,
      completedImportantTasks,
      unfinishedImportantTasks,
      unfinishedUrgentTasks,
    };
  }, [records, proofs]);

  const directionOfWeek = useMemo(() => {
    const weekTasks = records.flatMap((record) =>
      Array.isArray(record.data?.tasks)
        ? record.data.tasks.map((task: any) => ({
            ...task,
            recordDate: record.date,
          }))
        : [],
    );

    const completedProofs = uniqueTexts([
      ...proofs.filter((proof) => proof.checked).map((proof) => proof.text),
      ...weekTasks
        .filter((task: any) => isWeeklyProofTask(task) && isTaskDone(task))
        .map(getTaskTitle),
    ]);

    const pendingProofs = uniqueTexts([
      ...proofs.filter((proof) => !proof.checked).map((proof) => proof.text),
      ...weekTasks
        .filter(
          (task: any) =>
            isWeeklyProofTask(task) &&
            !isTaskDone(task) &&
            !isTaskCancelled(task),
        )
        .map(getTaskTitle),
    ]);

    const milestoneTasks = weekTasks.filter(
      (task: any) =>
        Boolean(task.alignedToWeek) &&
        !isWeeklyProofTask(task) &&
        !isMorningPriorityTask(task),
    );

    const completedMilestones = uniqueTexts(
      milestoneTasks.filter(isTaskDone).map(getTaskTitle),
    );

    const pendingMilestones = uniqueTexts(
      milestoneTasks
        .filter((task: any) => !isTaskDone(task) && !isTaskCancelled(task))
        .map(getTaskTitle),
    );

    const priorities = uniqueTexts(
      weekTasks
        .filter(
          (task: any) => isMorningPriorityTask(task) && !isTaskCancelled(task),
        )
        .sort((a: any, b: any) =>
          String(a.recordDate || a.date || "").localeCompare(
            String(b.recordDate || b.date || ""),
          ),
        )
        .map(getTaskTitle),
    );

    const totalDirectionItems = uniqueTexts([
      ...completedProofs,
      ...pendingProofs,
      ...completedMilestones,
      ...pendingMilestones,
    ]).length;

    const completedDirectionItems = uniqueTexts([
      ...completedProofs,
      ...completedMilestones,
    ]).length;

    const pendingDirectionItems = Math.max(
      totalDirectionItems - completedDirectionItems,
      0,
    );

    const alignmentPercent =
      totalDirectionItems > 0
        ? Math.round((completedDirectionItems / totalDirectionItems) * 100)
        : 0;

    return {
      completedProofs,
      pendingProofs,
      completedMilestones,
      pendingMilestones,
      priorities,
      totalDirectionItems,
      completedDirectionItems,
      pendingDirectionItems,
      alignmentPercent,
    };
  }, [records, proofs]);

  const peopleAnalysis = useMemo(() => {
    const entries = collectWeekRelationships(records);
    const people = groupRelationshipsByPerson(entries);

    const presentPeople = people.slice(0, 6);
    const strengthening = entries.filter(hasStrengtheningRelationshipData);
    const energy = entries.filter(hasEnergyRelationshipData);
    const meaningful = entries.filter(hasMeaningfulEncounterData);
    const observations = uniqueTexts(
      entries.flatMap((entry) =>
        getRelationshipDetails(entry).map(
          (detail) =>
            `${entry.name} · ${getRelationshipDateLabel(entry.date)} · ${detail}`,
        ),
      ),
    ).slice(0, 8);

    let interpretation = "";

    if (entries.length === 0) {
      interpretation =
        "Nenhuma relação registrada nos dias carregados desta semana.";
    } else {
      interpretation = "Relações encontradas nos registros reais da semana.";
    }

    return {
      entries,
      people,
      presentPeople,
      strengthening,
      energy,
      meaningful,
      observations,
      interpretation,
    };
  }, [records]);

  const financialAnalysis = useMemo(() => {
    const entries = collectWeekFinancialEntries(records);
    const expenses = entries.filter((entry) => entry.type === "expense");
    const incomes = entries.filter((entry) => entry.type === "income");
    const totalExpenses = expenses.reduce(
      (total, entry) => total + (entry.amount || 0),
      0,
    );
    const totalIncome = incomes.reduce(
      (total, entry) => total + (entry.amount || 0),
      0,
    );
    const balance = totalIncome - totalExpenses;

    const categoryCounts = countByText(entries.map((entry) => entry.type)).map(
      (item) => ({
        ...item,
        label: getFinancialTypeLabel(
          item.label === "income" ? "income" : "expense",
        ),
      }),
    );
    const maxCategoryCount = Math.max(
      ...categoryCounts.map((item) => item.count),
      0,
    );

    const emotionCounts = countByText(
      expenses.map((entry) => entry.emotion),
    ).map((item) => ({
      ...item,
      label: getFinancialEmotionLabel(item.label),
    }));
    const needCounts = countByText(
      expenses.map((entry) => entry.financialNeed),
    );
    const triggerCounts = countByText(expenses.map((entry) => entry.trigger));

    const patterns = [
      ...getFinancialPatternItems("Emoção", emotionCounts),
      ...getFinancialPatternItems("Busca financeira", needCounts),
      ...getFinancialPatternItems("Gatilho", triggerCounts),
    ].slice(0, 8);

    const meaningfulExpenses = expenses.filter(
      (entry) =>
        entry.description ||
        entry.emotion ||
        entry.refinedEmotion ||
        entry.financialNeed ||
        entry.trigger ||
        entry.observation,
    );

    const importantDecisions = entries.filter(
      (entry) =>
        entry.financialNeed ||
        entry.trigger ||
        entry.emotion ||
        entry.refinedEmotion ||
        entry.observation,
    );

    const observations = uniqueTexts(
      entries
        .filter((entry) => entry.observation)
        .map(
          (entry) =>
            `${getFinancialDateLabel(entry.date)} · ${entry.observation}`,
        ),
    );

    const associatedEmotions = expenses.filter(
      (entry) => entry.emotion || entry.refinedEmotion,
    );

    return {
      entries,
      expenses,
      incomes,
      totalExpenses,
      totalIncome,
      balance,
      categoryCounts,
      maxCategoryCount,
      emotionCounts: emotionCounts.slice(0, 5),
      needCounts: needCounts.slice(0, 5),
      triggerCounts: triggerCounts.slice(0, 5),
      patterns,
      meaningfulExpenses,
      importantDecisions,
      observations,
      associatedEmotions,
    };
  }, [records]);

  const emotionalPanel = useMemo(() => {
    const entries = collectWeekEmotions(records);
    const emotionCounts = countByText(entries.map((entry) => entry.emotion));
    const maxEmotionCount = Math.max(
      ...emotionCounts.map((item) => item.count),
      0,
    );
    const intensities = entries
      .map((entry) => entry.intensity)
      .filter((value): value is number => typeof value === "number");
    const averageIntensity = getAverage(intensities);
    const bodySignals = countByText(
      entries.flatMap((entry) => entry.bodySignals),
    ).slice(0, 5);
    const maxBodySignalCount = Math.max(
      ...bodySignals.map((item) => item.count),
      0,
    );
    const periodCounts = EMOTION_PERIODS.map(({ key, label }) => ({
      key,
      label,
      count: entries.filter((entry) => entry.period === key).length,
    }));
    const maxPeriodCount = Math.max(
      ...periodCounts.map((item) => item.count),
      0,
    );

    return {
      entries,
      emotionCounts: emotionCounts.slice(0, 5),
      maxEmotionCount,
      averageIntensity,
      bodySignals,
      maxBodySignalCount,
      periodCounts,
      maxPeriodCount,
    };
  }, [records]);

  const weeklySynthesis = useMemo(() => {
    const theme = getWeeklyTheme(
      emotionalPanel,
      peopleAnalysis,
      financialAnalysis,
      directionOfWeek,
    );
    const evidences = getWeeklySynthesisItems(
      emotionalPanel,
      peopleAnalysis,
      financialAnalysis,
      directionOfWeek,
    );
    const groups = getWeeklySynthesisGroups(
      emotionalPanel,
      peopleAnalysis,
      financialAnalysis,
      directionOfWeek,
      plan.risks,
    );

    return {
      theme,
      evidences,
      groups,
      hasData:
        evidences.length > 0 || groups.some((group) => group.items.length > 0),
    };
  }, [
    emotionalPanel,
    peopleAnalysis,
    financialAnalysis,
    directionOfWeek,
    plan.risks,
  ]);

  async function persist(nextPlan: WeeklyPlanData) {
    if (!userId || !weekStart) return;

    setStatus("Salvando...");

    try {
      await saveWeeklyPlan(userId, weekStart, nextPlan);
      setStatus("Plano salvo.");
    } catch (error) {
      console.error(error);
      setStatus("Erro ao salvar plano.");
    }
  }

  async function loadWeekDailyRecords(currentUserId: string) {
    const { data, error } = await supabase
      .from("daily_records")
      .select("date, data")
      .eq("user_id", currentUserId)
      .gte("date", weekStart)
      .lte("date", getWeekEnd(weekStart))
      .order("date", { ascending: true });

    if (error) {
      console.error("Erro ao carregar registros da semana:", error);
      return [];
    }

    return (data || []) as DailyRecord[];
  }

  async function syncProofsToTasks(nextProofs: Proof[]) {
    if (!userId || !weekStart) return;

    const activeProofs = nextProofs
      .map((proof) => ({
        ...proof,
        text: String(proof.text || "").trim(),
      }))
      .filter((proof) => proof.id && proof.text);

    const activeProofIds = new Set(activeProofs.map((proof) => proof.id));
    const weekRecords = await loadWeekDailyRecords(userId);
    const recordsByDate = new Map<string, DailyRecord>();

    weekRecords.forEach((record) => {
      recordsByDate.set(record.date, {
        date: record.date,
        data: record.data || {},
      });
    });

    if (!recordsByDate.has(dateKey)) {
      recordsByDate.set(dateKey, {
        date: dateKey,
        data: {},
      });
    }

    const workingRecords = Array.from(recordsByDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const originalByDate = new Map(
      workingRecords.map((record) => [
        record.date,
        JSON.stringify(
          Array.isArray(record.data?.tasks) ? record.data.tasks : [],
        ),
      ]),
    );

    const linkedTasksByProofId = new Map<
      string,
      { record: DailyRecord; taskIndex: number; task: any }[]
    >();

    workingRecords.forEach((record) => {
      const tasks = Array.isArray(record.data?.tasks) ? record.data.tasks : [];

      tasks.forEach((task: any, taskIndex: number) => {
        const proofId =
          typeof task?.weeklyProofId === "string" ? task.weeklyProofId : "";

        if (!proofId) return;

        if (!linkedTasksByProofId.has(proofId)) {
          linkedTasksByProofId.set(proofId, []);
        }

        linkedTasksByProofId.get(proofId)!.push({
          record,
          taskIndex,
          task,
        });
      });
    });

    activeProofs.forEach((proof) => {
      const linkedTasks = linkedTasksByProofId.get(proof.id) || [];
      let keeper = linkedTasks[0];

      if (!keeper) {
        const targetRecord = recordsByDate.get(dateKey)!;
        const targetTasks = Array.isArray(targetRecord.data?.tasks)
          ? [...targetRecord.data.tasks]
          : [];

        const newTask = {
          id: crypto.randomUUID(),
          title: proof.text,
          category: "semana",
          status: proof.checked ? "done" : "todo",
          date: dateKey,
          source: "weekly-proof",
          weeklyProofId: proof.id,
          alignedToWeek: true,
          mustDoToday: true,
          matrixTouched: false,
          details:
            "Prova da semana — se isso for feito, você está no rumo certo.",
          subtasks: [],
        };

        targetTasks.push(newTask);
        targetRecord.data = {
          ...targetRecord.data,
          tasks: targetTasks,
        };

        keeper = {
          record: targetRecord,
          taskIndex: targetTasks.length - 1,
          task: newTask,
        };
      }

      linkedTasks.slice(1).forEach(({ record, taskIndex }) => {
        const tasks = Array.isArray(record.data?.tasks)
          ? [...record.data.tasks]
          : [];

        tasks[taskIndex] = {
          ...tasks[taskIndex],
          status: "cancelled",
          source: "weekly-proof",
          weeklyProofId: proof.id,
          category: "semana",
          alignedToWeek: tasks[taskIndex]?.matrixTouched
            ? tasks[taskIndex].alignedToWeek
            : true,
          mustDoToday: tasks[taskIndex]?.matrixTouched
            ? tasks[taskIndex].mustDoToday
            : true,
          matrixTouched: Boolean(tasks[taskIndex]?.matrixTouched),
        };

        record.data = {
          ...record.data,
          tasks,
        };
      });

      const keeperTasks = Array.isArray(keeper.record.data?.tasks)
        ? [...keeper.record.data.tasks]
        : [];

      const existingKeeperTask = keeperTasks[keeper.taskIndex];

      keeperTasks[keeper.taskIndex] = {
        ...existingKeeperTask,
        title: proof.text,
        category: "semana",
        status: proof.checked ? "done" : "todo",
        date: existingKeeperTask?.date || keeper.record.date,
        source: "weekly-proof",
        weeklyProofId: proof.id,
        alignedToWeek: existingKeeperTask?.matrixTouched
          ? existingKeeperTask.alignedToWeek
          : true,
        mustDoToday: existingKeeperTask?.matrixTouched
          ? existingKeeperTask.mustDoToday
          : true,
        matrixTouched: Boolean(existingKeeperTask?.matrixTouched),
        details:
          "Prova da semana — se isso for feito, você está no rumo certo.",
        subtasks: Array.isArray(existingKeeperTask?.subtasks)
          ? existingKeeperTask.subtasks
          : [],
      };

      keeper.record.data = {
        ...keeper.record.data,
        tasks: keeperTasks,
      };
    });

    workingRecords.forEach((record) => {
      const tasks = Array.isArray(record.data?.tasks)
        ? [...record.data.tasks]
        : [];
      let changed = false;

      const nextTasks = tasks.map((task: any) => {
        const isWeeklyProof =
          task?.source === "weekly-proof" || Boolean(task?.weeklyProofId);
        const proofId =
          typeof task?.weeklyProofId === "string" ? task.weeklyProofId : "";

        if (!isWeeklyProof || !proofId || activeProofIds.has(proofId)) {
          return task;
        }

        changed = true;

        return {
          ...task,
          status: "cancelled",
          source: "weekly-proof",
          category: "semana",
          alignedToWeek: task.matrixTouched ? task.alignedToWeek : true,
          mustDoToday: task.matrixTouched ? task.mustDoToday : true,
          matrixTouched: Boolean(task.matrixTouched),
        };
      });

      if (changed) {
        record.data = {
          ...record.data,
          tasks: nextTasks,
        };
      }
    });

    for (const record of workingRecords) {
      const nextTasks = Array.isArray(record.data?.tasks)
        ? record.data.tasks
        : [];
      const originalTasks = originalByDate.get(record.date) || "[]";

      if (JSON.stringify(nextTasks) === originalTasks) continue;

      const { error } = await supabase.from("daily_records").upsert(
        {
          user_id: userId,
          date: record.date,
          data: {
            ...record.data,
            tasks: nextTasks,
          },
        },
        { onConflict: "user_id,date" },
      );

      if (error) {
        console.error("Erro ao sincronizar provas como tarefas:", error);
      }
    }

    setRecords(workingRecords);
  }

  function updateField(key: keyof WeeklyPlanData, value: string) {
    const next = {
      ...plan,
      [key]: value,
    };

    setPlan(next);
    persist(next);
  }

  function updateReviewField(key: keyof WeeklyReviewData, value: string) {
    const nextReview = {
      ...(plan.review || EMPTY_WEEKLY_REVIEW),
      [key]: value,
    };

    const nextPlan = {
      ...plan,
      review: nextReview,
    };

    setPlan(nextPlan);
    persist(nextPlan);
  }

  async function addProof() {
    if (!newProof.trim()) return;

    const nextProofs = [
      ...proofs,
      {
        id: crypto.randomUUID(),
        text: newProof.trim(),
        checked: false,
      },
    ];

    const nextPlan = {
      ...plan,
      proofs: stringifyProofs(nextProofs),
    };

    setProofs(nextProofs);
    setNewProof("");
    setPlan(nextPlan);
    await persist(nextPlan);
    await syncProofsToTasks(nextProofs);
  }

  async function toggleProof(id: string) {
    const nextProofs = proofs.map((p) =>
      p.id === id ? { ...p, checked: !p.checked } : p,
    );

    const nextPlan = {
      ...plan,
      proofs: stringifyProofs(nextProofs),
    };

    setProofs(nextProofs);
    setPlan(nextPlan);
    await persist(nextPlan);
    await syncProofsToTasks(nextProofs);
  }

  async function deleteProof(id: string) {
    const nextProofs = proofs.filter((p) => p.id !== id);

    const nextPlan = {
      ...plan,
      proofs: stringifyProofs(nextProofs),
    };

    setProofs(nextProofs);
    setPlan(nextPlan);
    await persist(nextPlan);
    await syncProofsToTasks(nextProofs);
  }

  async function updateProofText(id: string, text: string) {
    const cleanText = text.trim();

    if (!cleanText) return;

    const nextProofs = proofs.map((proof) =>
      proof.id === id
        ? {
            ...proof,
            text: cleanText,
          }
        : proof,
    );

    const nextPlan = {
      ...plan,
      proofs: stringifyProofs(nextProofs),
    };

    setProofs(nextProofs);
    setPlan(nextPlan);
    await persist(nextPlan);
    await syncProofsToTasks(nextProofs);
  }

  function addSupportHabit() {
    if (!newSupportHabit.trim()) return;

    const current = parseLines(plan.supportHabits || "");
    const nextList = [...current, newSupportHabit.trim()];

    updateField("supportHabits", stringifyLines(nextList));
    setNewSupportHabit("");
  }

  function deleteSupportHabit(index: number) {
    const current = parseLines(plan.supportHabits || "");
    const nextList = current.filter((_, i) => i !== index);

    updateField("supportHabits", stringifyLines(nextList));
  }

  const review = plan.review || EMPTY_WEEKLY_REVIEW;
  const previousDecisionLabel = getDecisionLabel(previousDecision);
  const previousGuidance = getPreviousDecisionGuidance(previousDecision);
  const directionGuidance = getDirectionGuidance(previousDecision);
  const proofGuidance = getProofGuidance(previousDecision);
  const riskGuidance = getRiskGuidance(previousDecision);
  const preventionGuidance = getPreventionGuidance(previousDecision);
  const nextCycleDirectionGuidance = getDirectionGuidance(review.decision);
  const nextCycleProofGuidance = getProofGuidance(review.decision);
  const nextCycleRiskGuidance = getRiskGuidance(review.decision);
  const nextCyclePreventionGuidance = getPreventionGuidance(review.decision);
  const nextWeekBridgeChecklist = getNextWeekBridgeChecklist(review.decision);
  const nextWeekDecisionLabel =
    getDecisionLabel(review.decision) || "Nenhuma decisão escolhida";
  const nextWeekImprovement =
    review.improvements || "Nenhuma melhoria principal registrada.";
  const nextWeekAttention =
    plan.risks ||
    previousImprovement ||
    "Nenhuma atenção principal registrada.";
  const bridgeDirection = plan.change || "Direção ainda não definida.";
  const bridgeProofs = proofs.length;
  const bridgePrevention = plan.prevention || "Proteção ainda não definida.";
  const habitsList = parseLines(plan.supportHabits || "");
  const hasYearContext = Boolean(
    String(yearContext?.dreamMap || "").trim() ||
      String(yearContext?.buildNextYear || "").trim() ||
      String(yearContext?.liveNextYear || "").trim() ||
      String(yearContext?.conquerNextYear || "").trim(),
  );

  const [yearContextOpen, setYearContextOpen] = useState(false);
  const [monthContextOpen, setMonthContextOpen] = useState(false);
  const [directionExpanded, setDirectionExpanded] = useState(false);
  const [emotionExpanded, setEmotionExpanded] = useState(false);
  const [relationshipsExpanded, setRelationshipsExpanded] = useState(false);
  const [financialExpanded, setFinancialExpanded] = useState(false);
  const [synthesisExpanded, setSynthesisExpanded] = useState(false);

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto bg-background px-5 py-6 pb-12">
        <div className="mx-auto max-w-md space-y-6">
          <header className="text-center space-y-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Semana iniciada em {weekStart || "..."}
            </p>
            <h1 className="font-serif text-3xl">Plano Semanal</h1>
            <p className="text-xs text-muted-foreground">{status}</p>
          </header>

          {hasYearContext && (
            <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
              <button
                type="button"
                onClick={() => setYearContextOpen((current) => !current)}
                className="flex w-full items-center justify-between text-left"
              >
                <h2 className="font-serif text-lg">Contexto do Ano</h2>
                <span className="text-xs text-muted-foreground">
                  {yearContextOpen ? "ocultar" : "ver"}
                </span>
              </button>

              {yearContextOpen && (
                <>
                  {String(yearContext?.dreamMap || "").trim() && (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-primary/70">
                        Mapa dos Sonhos
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {yearContext.dreamMap}
                      </p>
                    </div>
                  )}

                  {String(yearContext?.buildNextYear || "").trim() && (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-primary/70">
                        O que quero construir
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {yearContext.buildNextYear}
                      </p>
                    </div>
                  )}

                  {String(yearContext?.liveNextYear || "").trim() && (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-primary/70">
                        O que quero viver
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {yearContext.liveNextYear}
                      </p>
                    </div>
                  )}

                  {String(yearContext?.conquerNextYear || "").trim() && (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-primary/70">
                        O que quero conquistar
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {yearContext.conquerNextYear}
                      </p>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {monthlyContext && (
            <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
              <button
                type="button"
                onClick={() => setMonthContextOpen((current) => !current)}
                className="flex w-full items-center justify-between text-left"
              >
                <h2 className="font-serif text-lg">Contexto do Mês</h2>
                <span className="text-xs text-muted-foreground">
                  {monthContextOpen ? "ocultar" : "ver"}
                </span>
              </button>

              {monthContextOpen && (
                <>
                  {monthlyContext.virtue && (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-primary/70">
                        Virtude
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {monthlyContext.virtue}
                      </p>
                    </div>
                  )}

                  {monthlyContext.mainGoal && (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-primary/70">
                        Objetivo
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {monthlyContext.mainGoal}
                      </p>
                    </div>
                  )}

                  {monthlyContext.mainRisk && (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-primary/70">
                        Risco
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {monthlyContext.mainRisk}
                      </p>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {(previousImprovement || previousDecisionLabel) && (
            <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-primary/70">
                Continuidade da semana anterior
              </p>

              {previousImprovement && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Baseado na última semana:
                  </p>

                  <p className="text-sm text-foreground leading-relaxed">
                    {previousImprovement}
                  </p>
                </div>
              )}

              {previousDecisionLabel && (
                <p className="text-sm text-foreground">
                  Última decisão:{" "}
                  <span className="font-medium">{previousDecisionLabel}</span>
                </p>
              )}

              {previousGuidance && (
                <p className="text-sm text-foreground leading-relaxed">
                  {previousGuidance}
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Use isso como contexto para definir direção, forma de agir,
                riscos e prevenção — sem copiar automaticamente.
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <h2 className="font-serif text-lg">1. Direção da semana</h2>

            {directionGuidance && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {directionGuidance}
              </p>
            )}

            <Textarea
              value={plan.change}
              onChange={(e) => updateField("change", e.target.value)}
              placeholder="Que direção precisa guiar estes 7 dias?"
              className="min-h-[110px] resize-none rounded-xl bg-background"
            />
          </section>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <h2 className="font-serif text-lg">Forma de agir da semana</h2>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Que forma de agir precisa sustentar esta semana?
            </p>

            <p className="text-[11px] text-muted-foreground">
              Isso será usado na Noite e no Fechamento como lente de reflexão.
            </p>

            <div className="flex gap-2">
              <Input
                value={newSupportHabit}
                onChange={(e) => setNewSupportHabit(e.target.value)}
                placeholder="Adicionar uma forma de agir"
                className="bg-background"
              />

              <button
                type="button"
                onClick={addSupportHabit}
                className="w-11 rounded-xl border border-border/40 bg-background flex items-center justify-center"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {habitsList.length > 0 && (
              <div className="space-y-2">
                {habitsList.map((habit, index) => (
                  <div
                    key={`${habit}-${index}`}
                    className="flex items-center gap-3 rounded-xl border border-border/40 bg-background px-3 py-2"
                  >
                    <p className="flex-1 text-sm">{habit}</p>

                    <button
                      type="button"
                      onClick={() => deleteSupportHabit(index)}
                      className="text-muted-foreground"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-4">
            <h2 className="font-serif text-lg">2. Provas da semana</h2>

            {proofGuidance && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {proofGuidance}
              </p>
            )}

            <div className="flex gap-2">
              <Input
                value={newProof}
                onChange={(e) => setNewProof(e.target.value)}
                placeholder="Adicionar prova da semana"
                className="bg-background"
              />
              <button
                type="button"
                onClick={addProof}
                className="w-11 rounded-xl border border-border/40 bg-background flex items-center justify-center"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {proofs.map((proof) => (
                <div
                  key={proof.id}
                  className="flex items-center gap-3 rounded-xl border border-border/40 bg-background px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => toggleProof(proof.id)}
                    className="h-6 w-6 rounded-full border border-primary/40 text-xs"
                  >
                    {proof.checked ? "✓" : ""}
                  </button>

                  <Input
                    value={proof.text}
                    onChange={(e) => {
                      const value = e.target.value;

                      setProofs((current) =>
                        current.map((item) =>
                          item.id === proof.id
                            ? { ...item, text: value }
                            : item,
                        ),
                      );
                    }}
                    onBlur={(e) => updateProofText(proof.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                    className="flex-1 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
                  />

                  <button
                    type="button"
                    onClick={() => deleteProof(proof.id)}
                    className="text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <h2 className="font-serif text-lg">
              3. O que pode te derrubar nesta semana?
            </h2>

            {riskGuidance && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {riskGuidance}
              </p>
            )}

            <Textarea
              value={plan.risks}
              onChange={(e) => updateField("risks", e.target.value)}
              placeholder="Quais riscos, padrões ou obstáculos podem aparecer?"
              className="min-h-[110px] resize-none rounded-xl bg-background"
            />
          </section>

          <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <h2 className="font-serif text-lg">
              4. O que você fará quando isso acontecer?
            </h2>

            {preventionGuidance && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {preventionGuidance}
              </p>
            )}

            <Textarea
              value={plan.prevention}
              onChange={(e) => updateField("prevention", e.target.value)}
              placeholder="Qual será sua resposta concreta?"
              className="min-h-[110px] resize-none rounded-xl bg-background"
            />
          </section>

          <section className="rounded-2xl border border-border/40 bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setReviewOpen(!reviewOpen)}
              className="w-full p-4 text-left flex items-center justify-between"
            >
              <div>
                <p className="text-[10px] uppercase tracking-widest text-primary/70">
                  Fechamento da semana
                </p>
                <h2 className="font-serif text-lg">
                  {isSaturday(dateKey)
                    ? "Fechamento disponível"
                    : "Disponível no sábado"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Evidências · interpretação · decisão
                </p>
              </div>

              {reviewOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {reviewOpen && (
              <div className="border-t border-border/30 p-4 space-y-5">
                <section id="evidencias" className="space-y-4 scroll-mt-6">
                  <SectionTitle
                    icon={<BarChart3 className="h-4 w-4" />}
                    title="Direção da Semana"
                    subtitle="Evidências concretas da direção vivida."
                  />

                  <div className="rounded-xl border border-border/40 bg-background p-4 space-y-4">
                    <p className="text-sm font-medium">
                      Alinhamento da direção
                    </p>

                    {directionOfWeek.totalDirectionItems === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma prova ou marco definido para esta semana.
                      </p>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div
                          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
                          style={{
                            background: `conic-gradient(hsl(var(--primary)) ${directionOfWeek.alignmentPercent}%, hsl(var(--border)) ${directionOfWeek.alignmentPercent}% 100%)`,
                          }}
                        >
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background">
                            <span className="font-serif text-xl">
                              {directionOfWeek.alignmentPercent}%
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 space-y-2">
                          <div className="rounded-xl border border-border/40 bg-card px-3 py-2">
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                              Concluídos
                            </p>
                            <p className="font-serif text-xl">
                              {directionOfWeek.completedDirectionItems}
                            </p>
                          </div>

                          <div className="rounded-xl border border-border/40 bg-card px-3 py-2">
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                              Pendentes
                            </p>
                            <p className="font-serif text-xl">
                              {directionOfWeek.pendingDirectionItems}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setDirectionExpanded((current) => !current)
                      }
                      className="w-full rounded-xl border border-border/40 bg-card px-3 py-2 text-sm text-primary"
                    >
                      {directionExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                    </button>
                  </div>

                  {directionExpanded && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-border/40 bg-background p-4 space-y-3">
                        <p className="text-sm font-medium">
                          O que sustentou minha direção
                        </p>
                        {[
                          ...directionOfWeek.completedMilestones,
                          ...directionOfWeek.completedProofs,
                        ].length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Nenhuma prova ou marco concluído registrado nesta
                            semana.
                          </p>
                        ) : (
                          [
                            ...directionOfWeek.completedMilestones,
                            ...directionOfWeek.completedProofs,
                          ].map((item, index) => (
                            <p key={`${item}-${index}`} className="text-sm">
                              ✓ {item}
                            </p>
                          ))
                        )}
                      </div>

                      <div className="rounded-xl border border-border/40 bg-background p-4 space-y-3">
                        <p className="text-sm font-medium">
                          O que ficou para trás
                        </p>
                        {[
                          ...directionOfWeek.pendingMilestones,
                          ...directionOfWeek.pendingProofs,
                        ].length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Nenhuma prova ou marco pendente registrado nesta
                            semana.
                          </p>
                        ) : (
                          [
                            ...directionOfWeek.pendingMilestones,
                            ...directionOfWeek.pendingProofs,
                          ].map((item, index) => (
                            <p key={`${item}-${index}`} className="text-sm">
                              ✗ {item}
                            </p>
                          ))
                        )}
                      </div>

                      <div className="rounded-xl border border-border/40 bg-background p-4 space-y-3">
                        <p className="text-sm font-medium">
                          Onde minha atenção esteve
                        </p>
                        {directionOfWeek.priorities.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Nenhuma prioridade da manhã registrada nesta semana.
                          </p>
                        ) : (
                          directionOfWeek.priorities.map((priority, index) => (
                            <p key={`${priority}-${index}`} className="text-sm">
                              • {priority}
                            </p>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </section>

                <section id="interpretacao" className="space-y-4 scroll-mt-6">
                  <SectionTitle
                    icon={<Brain className="h-4 w-4" />}
                    title="2. Ler e interpretar"
                    subtitle="O que funcionou, o que pesou e que padrão apareceu."
                  />

                  <div className="rounded-xl border border-border/40 bg-background p-4 space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-primary/70">
                        Painel emocional da semana
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Leitura visual dos registros emocionais feitos na manhã,
                        tarde e noite.
                      </p>
                    </div>

                    {emotionalPanel.entries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum dado emocional registrado nesta semana.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <p className="text-sm font-medium">
                            Emoções predominantes
                          </p>

                          <div className="grid grid-cols-2 gap-2">
                            {emotionalPanel.emotionCounts.map((item) => (
                              <div
                                key={item.label}
                                className="rounded-xl border border-border/40 bg-card px-3 py-2"
                              >
                                <p className="text-sm capitalize text-foreground">
                                  {getEmotionIcon(item.label)} {item.label}
                                </p>
                                <p className="mt-1 font-serif text-xl">
                                  {getEmotionPercentage(
                                    item.count,
                                    emotionalPanel.entries.length,
                                  )}
                                  %
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setEmotionExpanded((current) => !current)
                          }
                          className="w-full rounded-xl border border-border/40 bg-card px-3 py-2 text-sm text-primary"
                        >
                          {emotionExpanded
                            ? "Ocultar leitura emocional"
                            : "Ver leitura emocional"}
                        </button>

                        {emotionExpanded && (
                          <div className="space-y-4">
                            <div className="space-y-3">
                              <p className="text-sm font-medium">
                                Intensidade emocional
                              </p>

                              {emotionalPanel.averageIntensity === null ? (
                                <p className="text-sm text-muted-foreground">
                                  Intensidade ainda não registrada nesta semana.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-sm text-muted-foreground">
                                    Intensidade média:{" "}
                                    {emotionalPanel.averageIntensity}
                                    /10
                                  </p>
                                  <div className="h-3 rounded-full bg-card overflow-hidden border border-border/40">
                                    <div
                                      className="h-full rounded-full bg-primary"
                                      style={{
                                        width: `${emotionalPanel.averageIntensity * 10}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="space-y-3">
                              <p className="text-sm font-medium">
                                Sinais corporais recorrentes
                              </p>

                              {emotionalPanel.bodySignals.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Nenhum sinal corporal recorrente registrado.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {emotionalPanel.bodySignals.map((item) => (
                                    <div key={item.label} className="space-y-1">
                                      <div className="flex items-center justify-between gap-3 text-xs">
                                        <span className="text-foreground">
                                          • {item.label}
                                        </span>
                                        <span className="text-muted-foreground">
                                          {item.count}
                                        </span>
                                      </div>

                                      <div className="h-2 rounded-full bg-card overflow-hidden border border-border/40">
                                        <div
                                          className="h-full rounded-full bg-primary"
                                          style={{
                                            width: getBarWidth(
                                              item.count,
                                              emotionalPanel.maxBodySignalCount,
                                            ),
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="space-y-3">
                              <p className="text-sm font-medium">
                                Períodos mais carregados
                              </p>

                              <div className="space-y-2">
                                {emotionalPanel.periodCounts.map((item) => (
                                  <div key={item.key} className="space-y-1">
                                    <div className="flex items-center justify-between gap-3 text-xs">
                                      <span className="text-foreground">
                                        {item.label}
                                      </span>
                                      <span className="text-muted-foreground">
                                        {item.count}
                                      </span>
                                    </div>

                                    <div className="h-2 rounded-full bg-card overflow-hidden border border-border/40">
                                      <div
                                        className="h-full rounded-full bg-primary"
                                        style={{
                                          width: getBarWidth(
                                            item.count,
                                            emotionalPanel.maxPeriodCount,
                                          ),
                                        }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/40 bg-background p-4 space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-primary/70">
                        Relacionamentos da semana
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Pessoas e encontros registrados na página Pessoas
                        durante a semana.
                      </p>
                    </div>

                    {peopleAnalysis.entries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma relação registrada nesta semana.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <p className="text-sm font-medium">
                            Pessoas mais presentes na semana
                          </p>

                          <div className="flex flex-wrap gap-2">
                            {peopleAnalysis.presentPeople.map((person) => (
                              <span
                                key={person.name}
                                className="rounded-full border border-border/40 bg-card px-3 py-1 text-sm"
                              >
                                👤 {person.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setRelationshipsExpanded((current) => !current)
                          }
                          className="w-full rounded-xl border border-border/40 bg-card px-3 py-2 text-sm text-primary"
                        >
                          {relationshipsExpanded
                            ? "Ocultar leitura das relações"
                            : "Ver leitura das relações"}
                        </button>

                        {relationshipsExpanded && (
                          <div className="space-y-4">
                            <div className="rounded-xl border border-border/40 bg-card p-3 space-y-2">
                              <p className="text-sm font-medium">
                                Relações que fortaleceram a semana
                              </p>

                              {peopleAnalysis.strengthening.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Nenhum dado de fortalecimento relacional
                                  registrado nesta semana.
                                </p>
                              ) : (
                                peopleAnalysis.strengthening.map((entry) => (
                                  <div
                                    key={`${entry.date}-${entry.id}-strength`}
                                    className="rounded-xl border border-border/40 bg-background/40 p-3 space-y-1"
                                  >
                                    <p className="text-sm font-medium">
                                      {entry.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {getRelationshipDateLabel(entry.date)}
                                      {entry.relationshipType
                                        ? ` · ${entry.relationshipType}`
                                        : ""}
                                    </p>
                                    {entry.learned && (
                                      <p className="text-sm">
                                        <span className="text-muted-foreground">
                                          Aprendizado:
                                        </span>
                                        {entry.learned}
                                      </p>
                                    )}
                                    {entry.nextStep && (
                                      <p className="text-sm">
                                        <span className="text-muted-foreground">
                                          Próximo passo:
                                        </span>
                                        {entry.nextStep}
                                      </p>
                                    )}
                                    {entry.memoryCue && (
                                      <p className="text-sm">
                                        <span className="text-muted-foreground">
                                          Gancho:
                                        </span>
                                        {entry.memoryCue}
                                      </p>
                                    )}
                                    {entry.interests && (
                                      <p className="text-sm">
                                        <span className="text-muted-foreground">
                                          Interesses:
                                        </span>
                                        {entry.interests}
                                      </p>
                                    )}
                                    {entry.virtues.length > 0 && (
                                      <p className="text-sm">
                                        <span className="text-muted-foreground">
                                          Virtudes:
                                        </span>
                                        {entry.virtues.join(", ")}
                                      </p>
                                    )}
                                    {entry.outcome === "success" && (
                                      <p className="text-sm">
                                        Resultado: Acerto
                                      </p>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="rounded-xl border border-border/40 bg-card p-3 space-y-2">
                              <p className="text-sm font-medium">
                                Relações que exigiram energia
                              </p>

                              {peopleAnalysis.energy.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Nenhum limite, reparação ou falha relacional
                                  registrado nesta semana.
                                </p>
                              ) : (
                                peopleAnalysis.energy.map((entry) => (
                                  <div
                                    key={`${entry.date}-${entry.id}-energy`}
                                    className="rounded-xl border border-border/40 bg-background/40 p-3 space-y-1"
                                  >
                                    <p className="text-sm font-medium">
                                      {entry.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {getRelationshipDateLabel(entry.date)}
                                      {entry.relationshipType
                                        ? ` · ${entry.relationshipType}`
                                        : ""}
                                    </p>
                                    {entry.boundary && (
                                      <p className="text-sm">
                                        <span className="text-muted-foreground">
                                          Limite:
                                        </span>
                                        {entry.boundary}
                                      </p>
                                    )}
                                    {entry.repair && (
                                      <p className="text-sm">
                                        <span className="text-muted-foreground">
                                          Reparação:
                                        </span>
                                        {entry.repair}
                                      </p>
                                    )}
                                    {entry.outcome === "failure" && (
                                      <p className="text-sm">
                                        Resultado: Falha
                                      </p>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="rounded-xl border border-border/40 bg-card p-3 space-y-2">
                              <p className="text-sm font-medium">
                                Encontros significativos
                              </p>

                              {peopleAnalysis.meaningful.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Nenhum encontro com contexto, memória ou
                                  próximo passo registrado nesta semana.
                                </p>
                              ) : (
                                peopleAnalysis.meaningful.map((entry) => (
                                  <div
                                    key={`${entry.date}-${entry.id}-meaningful`}
                                    className="rounded-xl border border-border/40 bg-background/40 p-3 space-y-1"
                                  >
                                    <p className="text-sm font-medium">
                                      {entry.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {getRelationshipDateLabel(entry.date)}
                                      {entry.relationshipType
                                        ? ` · ${entry.relationshipType}`
                                        : ""}
                                    </p>
                                    {entry.context && (
                                      <p className="text-sm">
                                        <span className="text-muted-foreground">
                                          O que aconteceu:
                                        </span>
                                        {entry.context}
                                      </p>
                                    )}
                                    {entry.memoryCue && (
                                      <p className="text-sm">
                                        <span className="text-muted-foreground">
                                          Gancho:
                                        </span>
                                        {entry.memoryCue}
                                      </p>
                                    )}
                                    {entry.nextStep && (
                                      <p className="text-sm">
                                        <span className="text-muted-foreground">
                                          Próximo passo:
                                        </span>
                                        {entry.nextStep}
                                      </p>
                                    )}
                                    {entry.followUpDate && (
                                      <p className="text-sm">
                                        <span className="text-muted-foreground">
                                          Follow-up:
                                        </span>
                                        {getRelationshipDateLabel(
                                          entry.followUpDate,
                                        )}
                                      </p>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="rounded-xl border border-border/40 bg-card p-3 space-y-2">
                              <p className="text-sm font-medium">
                                Observações relevantes encontradas nos dados
                              </p>

                              {peopleAnalysis.observations.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Nenhuma observação adicional registrada.
                                </p>
                              ) : (
                                peopleAnalysis.observations.map(
                                  (item, index) => (
                                    <p
                                      key={`${item}-${index}`}
                                      className="text-sm"
                                    >
                                      • {item}
                                    </p>
                                  ),
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/40 bg-background p-4 space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-primary/70">
                        Finanças da semana
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Registros financeiros encontrados na página Finanças
                        durante a semana.
                      </p>
                    </div>

                    {financialAnalysis.entries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum registro financeiro encontrado nesta semana.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-xl border border-border/40 bg-card p-3 text-center">
                            <p className="text-[10px] uppercase tracking-widest text-primary/70">
                              Receitas
                            </p>
                            <p className="text-sm font-medium">
                              {formatFinancialCurrency(
                                financialAnalysis.totalIncome,
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl border border-border/40 bg-card p-3 text-center">
                            <p className="text-[10px] uppercase tracking-widest text-primary/70">
                              Despesas
                            </p>
                            <p className="text-sm font-medium">
                              {formatFinancialCurrency(
                                financialAnalysis.totalExpenses,
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl border border-border/40 bg-card p-3 text-center">
                            <p className="text-[10px] uppercase tracking-widest text-primary/70">
                              Balanço
                            </p>
                            <p className="text-sm font-medium">
                              {formatFinancialCurrency(
                                financialAnalysis.balance,
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <p className="text-sm font-medium">
                            Principais categorias financeiras
                          </p>

                          {financialAnalysis.categoryCounts.map((item) => (
                            <div key={item.label} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span>{item.label}</span>
                                <span className="text-muted-foreground">
                                  {item.count}
                                </span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary/70"
                                  style={{
                                    width: getBarWidth(
                                      item.count,
                                      financialAnalysis.maxCategoryCount,
                                    ),
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="rounded-xl border border-border/40 bg-card p-3">
                            <p className="text-[10px] uppercase tracking-widest text-primary/70">
                              Emoção mais associada
                            </p>
                            <p className="text-foreground">
                              {financialAnalysis.emotionCounts[0]
                                ? `${financialAnalysis.emotionCounts[0].label} · ${financialAnalysis.emotionCounts[0].count} vez${financialAnalysis.emotionCounts[0].count === 1 ? "" : "es"}`
                                : "Ainda sem emoção registrada nas despesas."}
                            </p>
                          </div>

                          <div className="rounded-xl border border-border/40 bg-card p-3">
                            <p className="text-[10px] uppercase tracking-widest text-primary/70">
                              Busca financeira mais comum
                            </p>
                            <p className="text-foreground">
                              {financialAnalysis.needCounts[0]
                                ? `${financialAnalysis.needCounts[0].label} · ${financialAnalysis.needCounts[0].count} vez${financialAnalysis.needCounts[0].count === 1 ? "" : "es"}`
                                : "Ainda sem busca financeira registrada."}
                            </p>
                          </div>

                          <div className="rounded-xl border border-border/40 bg-card p-3">
                            <p className="text-[10px] uppercase tracking-widest text-primary/70">
                              Gatilho recorrente
                            </p>
                            <p className="text-foreground">
                              {financialAnalysis.triggerCounts[0]
                                ? `${financialAnalysis.triggerCounts[0].label} · ${financialAnalysis.triggerCounts[0].count} vez${financialAnalysis.triggerCounts[0].count === 1 ? "" : "es"}`
                                : "Ainda sem gatilho financeiro registrado."}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setFinancialExpanded((current) => !current)
                          }
                          className="w-full rounded-xl border border-border/40 bg-card px-3 py-2 text-sm text-primary"
                        >
                          {financialExpanded
                            ? "Ocultar leitura financeira"
                            : "Ver leitura financeira"}
                        </button>

                        {financialExpanded && (
                          <div className="space-y-4">
                            <div className="rounded-xl border border-border/40 bg-card p-3 space-y-2">
                              <p className="text-sm font-medium">
                                Gastos significativos
                              </p>

                              {financialAnalysis.meaningfulExpenses.length ===
                              0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Nenhuma despesa com descrição ou contexto
                                  registrada nesta semana.
                                </p>
                              ) : (
                                financialAnalysis.meaningfulExpenses.map(
                                  (entry) => (
                                    <div
                                      key={`${entry.date}-${entry.id}-expense`}
                                      className="rounded-xl border border-border/40 bg-background/40 p-3 space-y-1"
                                    >
                                      <p className="text-sm font-medium">
                                        {entry.description || "Despesa"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {getFinancialDateLabel(entry.date)} ·{" "}
                                        {formatFinancialCurrency(entry.amount)}
                                      </p>
                                      {entry.financialNeed && (
                                        <p className="text-sm">
                                          <span className="text-muted-foreground">
                                            Busca financeira:
                                          </span>
                                          {entry.financialNeed}
                                        </p>
                                      )}
                                      {entry.trigger && (
                                        <p className="text-sm">
                                          <span className="text-muted-foreground">
                                            Gatilho:
                                          </span>
                                          {entry.trigger}
                                        </p>
                                      )}
                                      {entry.emotion && (
                                        <p className="text-sm">
                                          <span className="text-muted-foreground">
                                            Emoção:
                                          </span>
                                          {getFinancialEmotionLabel(
                                            entry.emotion,
                                          )}
                                        </p>
                                      )}
                                    </div>
                                  ),
                                )
                              )}
                            </div>

                            <div className="rounded-xl border border-border/40 bg-card p-3 space-y-2">
                              <p className="text-sm font-medium">
                                Decisões financeiras importantes
                              </p>

                              {financialAnalysis.importantDecisions.length ===
                              0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Nenhuma decisão financeira com emoção,
                                  gatilho, busca ou observação registrada nesta
                                  semana.
                                </p>
                              ) : (
                                financialAnalysis.importantDecisions.map(
                                  (entry) => (
                                    <div
                                      key={`${entry.date}-${entry.id}-decision`}
                                      className="rounded-xl border border-border/40 bg-background/40 p-3 space-y-1"
                                    >
                                      <p className="text-sm font-medium">
                                        {entry.description ||
                                          getFinancialTypeLabel(entry.type)}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {getFinancialDateLabel(entry.date)} ·{" "}
                                        {getFinancialTypeLabel(entry.type)} ·{" "}
                                        {formatFinancialCurrency(entry.amount)}
                                      </p>
                                      {getFinancialEntryDetails(entry).map(
                                        (detail) => (
                                          <p key={detail} className="text-sm">
                                            • {detail}
                                          </p>
                                        ),
                                      )}
                                    </div>
                                  ),
                                )
                              )}
                            </div>

                            <div className="rounded-xl border border-border/40 bg-card p-3 space-y-2">
                              <p className="text-sm font-medium">
                                Padrões percebidos nos registros
                              </p>

                              {financialAnalysis.patterns.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Nenhum padrão de emoção, busca financeira ou
                                  gatilho registrado nesta semana.
                                </p>
                              ) : (
                                financialAnalysis.patterns.map((pattern) => (
                                  <p
                                    key={`${pattern.label}-${pattern.value}`}
                                    className="text-sm"
                                  >
                                    • {pattern.label}: {pattern.value} ·{" "}
                                    {pattern.count} vez
                                    {pattern.count === 1 ? "" : "es"}
                                  </p>
                                ))
                              )}
                            </div>

                            <div className="rounded-xl border border-border/40 bg-card p-3 space-y-2">
                              <p className="text-sm font-medium">
                                Observações registradas durante a semana
                              </p>

                              {financialAnalysis.observations.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  A estrutura atual de Finanças não possui campo
                                  próprio de observação nos registros
                                  encontrados.
                                </p>
                              ) : (
                                financialAnalysis.observations.map(
                                  (item, index) => (
                                    <p
                                      key={`${item}-${index}`}
                                      className="text-sm"
                                    >
                                      • {item}
                                    </p>
                                  ),
                                )
                              )}
                            </div>

                            <div className="rounded-xl border border-border/40 bg-card p-3 space-y-2">
                              <p className="text-sm font-medium">
                                Emoções associadas ao dinheiro
                              </p>

                              {financialAnalysis.associatedEmotions.length ===
                              0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Nenhuma emoção financeira registrada nesta
                                  semana.
                                </p>
                              ) : (
                                financialAnalysis.associatedEmotions.map(
                                  (entry) => (
                                    <div
                                      key={`${entry.date}-${entry.id}-emotion`}
                                      className="rounded-xl border border-border/40 bg-background/40 p-3 space-y-1"
                                    >
                                      <p className="text-sm font-medium">
                                        {entry.description ||
                                          "Registro financeiro"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {getFinancialDateLabel(entry.date)} ·{" "}
                                        {formatFinancialCurrency(entry.amount)}
                                      </p>
                                      {entry.emotion && (
                                        <p className="text-sm">
                                          Emoção:{" "}
                                          {getFinancialEmotionLabel(
                                            entry.emotion,
                                          )}
                                        </p>
                                      )}
                                      {entry.refinedEmotion && (
                                        <p className="text-sm">
                                          Nome mais próximo:{" "}
                                          {entry.refinedEmotion}
                                        </p>
                                      )}
                                    </div>
                                  ),
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/40 bg-background p-4 space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-primary/70">
                        Síntese da semana
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Leitura final gerada apenas a partir dos dados reais já
                        calculados nesta página.
                      </p>
                    </div>

                    {!weeklySynthesis.hasData ? (
                      <p className="text-sm text-muted-foreground">
                        Ainda não há dados suficientes para sintetizar a semana.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-border/40 bg-card p-3 space-y-2">
                          <p className="text-[10px] uppercase tracking-widest text-primary/70">
                            Tema da semana
                          </p>
                          <p className="font-serif text-2xl">
                            {weeklySynthesis.theme}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm font-medium">
                            Principais evidências
                          </p>

                          {weeklySynthesis.evidences.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Nenhuma evidência suficiente encontrada.
                            </p>
                          ) : (
                            weeklySynthesis.evidences.map((item, index) => (
                              <p key={`${item}-${index}`} className="text-sm">
                                ✓ {item}
                              </p>
                            ))
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setSynthesisExpanded((current) => !current)
                          }
                          className="w-full rounded-xl border border-border/40 bg-card px-3 py-2 text-sm text-primary"
                        >
                          {synthesisExpanded
                            ? "Ocultar leitura completa"
                            : "Ver leitura completa"}
                        </button>

                        {synthesisExpanded && (
                          <div className="space-y-3">
                            {weeklySynthesis.groups.map((group) => (
                              <div
                                key={group.title}
                                className="rounded-xl border border-border/40 bg-card p-3 space-y-2"
                              >
                                <p className="text-sm font-medium">
                                  {group.title}
                                </p>

                                {group.items.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">
                                    Nenhum dado real suficiente neste grupo.
                                  </p>
                                ) : (
                                  group.items.map((item, index) => (
                                    <p
                                      key={`${group.title}-${item}-${index}`}
                                      className="text-sm"
                                    >
                                      • {item}
                                    </p>
                                  ))
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <section id="decisao" className="space-y-3 scroll-mt-6">
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest text-primary/70">
                          Decisão do próximo ciclo
                        </p>
                        <h3 className="font-serif text-lg">
                          3. Decidir o próximo passo
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Depois de compreender a semana, escolha a decisão que
                          vai orientar a próxima.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {DECISION_OPTIONS.map((option) => {
                          const selected = review.decision === option.value;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() =>
                                updateReviewField(
                                  "decision",
                                  selected ? "" : option.value,
                                )
                              }
                              className={
                                selected
                                  ? "rounded-xl border border-primary bg-primary/10 px-3 py-3 text-left text-sm text-primary flex items-center gap-2"
                                  : "rounded-xl border border-border/40 bg-background px-3 py-3 text-left text-sm text-muted-foreground flex items-center gap-2"
                              }
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              {option.label}
                            </button>
                          );
                        })}
                      </div>

                      {review.decision && (
                        <div className="rounded-xl border border-border/40 bg-background p-3 space-y-3">
                          <p className="text-[10px] uppercase tracking-widest text-primary/70">
                            Orientação prática para a próxima semana
                          </p>

                          <div className="space-y-2 text-sm leading-relaxed">
                            {nextCycleDirectionGuidance && (
                              <p>
                                <span className="font-medium">
                                  Direção sugerida:
                                </span>{" "}
                                {nextCycleDirectionGuidance}
                              </p>
                            )}

                            {nextCycleProofGuidance && (
                              <p>
                                <span className="font-medium">
                                  Prova sugerida:
                                </span>{" "}
                                {nextCycleProofGuidance}
                              </p>
                            )}

                            {nextCycleRiskGuidance && (
                              <p>
                                <span className="font-medium">
                                  Risco a observar:
                                </span>{" "}
                                {nextCycleRiskGuidance}
                              </p>
                            )}

                            {nextCyclePreventionGuidance && (
                              <p>
                                <span className="font-medium">
                                  Proteção necessária:
                                </span>{" "}
                                {nextCyclePreventionGuidance}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest text-primary/70">
                          Ponte para a próxima semana
                        </p>
                        <h3 className="font-serif text-lg">
                          Preparar o próximo ciclo
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Transforme a decisão desta revisão em preparação
                          concreta para a próxima semana.
                        </p>
                      </div>

                      <div className="rounded-xl border border-border/40 bg-background p-3 space-y-3">
                        <p className="text-[10px] uppercase tracking-widest text-primary/70">
                          Resumo
                        </p>

                        <div className="space-y-2 text-sm leading-relaxed">
                          <p>
                            <span className="font-medium">
                              Decisão escolhida:
                            </span>{" "}
                            {nextWeekDecisionLabel}
                          </p>

                          <p>
                            <span className="font-medium">
                              Melhoria principal:
                            </span>{" "}
                            {nextWeekImprovement}
                          </p>

                          <p>
                            <span className="font-medium">
                              Próxima atenção:
                            </span>{" "}
                            {nextWeekAttention}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/40 bg-background p-3 space-y-3">
                        <p className="text-[10px] uppercase tracking-widest text-primary/70">
                          Checklist de preparação
                        </p>

                        <div className="space-y-3">
                          {nextWeekBridgeChecklist.map((item, index) => (
                            <div
                              key={`${item}-${index}`}
                              className="flex gap-3 text-sm leading-relaxed"
                            >
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs text-primary">
                                {index + 1}
                              </span>
                              <div className="space-y-1">
                                <p>{item}</p>

                                {index === 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    Base atual: {bridgeDirection}
                                  </p>
                                )}

                                {index === 1 && (
                                  <p className="text-xs text-muted-foreground">
                                    Provas atuais: {bridgeProofs}
                                  </p>
                                )}

                                {index === 2 && (
                                  <p className="text-xs text-muted-foreground">
                                    Proteção atual: {bridgePrevention}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  <div className="rounded-xl border border-border/40 bg-background p-3 space-y-3">
                    <p className="text-[10px] uppercase tracking-widest text-primary/70">
                      Leitura da execução
                    </p>

                    <div className="grid grid-cols-1 gap-1 text-sm text-muted-foreground">
                      <p>Tarefas alinhadas: {summary.importantTasks}</p>
                      <p>
                        Tarefas alinhadas concluídas:{" "}
                        {summary.completedImportantTasks}
                      </p>
                      <p>
                        Tarefas alinhadas pendentes:{" "}
                        {summary.unfinishedImportantTasks}
                      </p>
                      <p>
                        Urgências não concluídas:{" "}
                        {summary.unfinishedUrgentTasks}
                      </p>
                    </div>

                    <div className="space-y-1 text-sm text-foreground leading-relaxed">
                      {summary.importantTasks === 0 && (
                        <p>Nenhuma tarefa alinhada à semana foi registrada.</p>
                      )}

                      {summary.completedImportantTasks > 0 && (
                        <p>A execução sustentou parte da direção semanal.</p>
                      )}

                      {summary.unfinishedImportantTasks > 0 && (
                        <p>Parte do que era importante ficou sem execução.</p>
                      )}

                      {summary.unfinishedUrgentTasks > 0 && (
                        <p>
                          Existiram urgências não concluídas ao longo da semana.
                        </p>
                      )}

                      {summary.completedImportantTasks ===
                        summary.importantTasks &&
                        summary.importantTasks > 0 && (
                          <p>
                            As tarefas alinhadas à direção da semana foram
                            concluídas.
                          </p>
                        )}
                    </div>
                  </div>

                  {habitsList.length > 0 && (
                    <div className="rounded-xl border border-border/40 bg-background px-3 py-3 space-y-2">
                      <p className="text-[10px] uppercase tracking-widest text-primary/70">
                        Forma de agir da semana
                      </p>

                      <div className="space-y-1">
                        {habitsList.map((habit, index) => (
                          <p
                            key={`${habit}-${index}`}
                            className="text-sm text-foreground"
                          >
                            • {habit}
                          </p>
                        ))}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Isso apareceu no seu comportamento ao longo da semana?
                      </p>
                    </div>
                  )}

                  <ReviewField
                    label="Como esta semana foi sentida no geral?"
                    evidence={`${summary.days} dia${
                      summary.days === 1 ? "" : "s"
                    } com registro nesta semana.`}
                    value={review.generalFeeling}
                    onChange={(v) => updateReviewField("generalFeeling", v)}
                    placeholder="Ex: Foi uma semana instável, mas com alguns avanços reais..."
                  />

                  <ReviewField
                    label="O que marcou esta semana?"
                    evidence={`${summary.days} dia${
                      summary.days === 1 ? "" : "s"
                    } com algum registro no período.`}
                    value={review.mainEvents}
                    onChange={(v) => updateReviewField("mainEvents", v)}
                    placeholder="Eventos, decisões ou situações que definiram a semana..."
                  />

                  <ReviewField
                    label="Que padrão emocional apareceu?"
                    evidence="Use o Painel Emocional da Semana acima como base para responder."
                    value={review.emotionalPattern}
                    onChange={(v) => updateReviewField("emotionalPattern", v)}
                    placeholder="O que se repetiu emocionalmente?"
                  />

                  <ReviewField
                    label="O que ajudou ou prejudicou sua execução?"
                    evidence={`${summary.doneTasks}/${summary.tasks} tarefa${
                      summary.tasks === 1 ? "" : "s"
                    } concluída${summary.tasks === 1 ? "" : "s"} na semana.`}
                    value={review.productivityImpact}
                    onChange={(v) => updateReviewField("productivityImpact", v)}
                    placeholder="O que puxou sua ação para frente ou travou sua execução?"
                  />

                  <ReviewField
                    label="Como as finanças impactaram sua semana?"
                    evidence={`${summary.financial} registro${
                      summary.financial === 1 ? "" : "s"
                    } financeiro${summary.financial === 1 ? "" : "s"} na semana.`}
                    value={review.financialImpact}
                    onChange={(v) => updateReviewField("financialImpact", v)}
                    placeholder="Como o dinheiro influenciou sua semana?"
                  />

                  <ReviewField
                    label="Como as relações impactaram sua semana?"
                    evidence={`${summary.people} dia${
                      summary.people === 1 ? "" : "s"
                    } com interações registradas.`}
                    value={review.relationshipImpact}
                    onChange={(v) => updateReviewField("relationshipImpact", v)}
                    placeholder="Pessoas, conversas, conflitos ou apoios que marcaram a semana..."
                  />

                  <ReviewField
                    label="O que precisa melhorar no próximo ciclo?"
                    evidence={`${summary.checkedProofs}/${summary.totalProofs} prova${
                      summary.totalProofs === 1 ? "" : "s"
                    } da semana marcada${summary.checkedProofs === 1 ? "" : "s"}.`}
                    value={review.improvements}
                    onChange={(v) => updateReviewField("improvements", v)}
                    placeholder="Que correção, hábito ou proteção precisa entrar na próxima semana?"
                  />
                </section>
              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>

      <div>
        <h3 className="font-serif text-lg">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-xl">{value}</p>
    </div>
  );
}

function ReviewField({
  label,
  evidence,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  evidence: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-primary/70">
          {label}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{evidence}</p>
      </div>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[90px] resize-none rounded-xl bg-background"
      />
    </div>
  );
}
