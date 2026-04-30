export interface DaySummary {
  dateKey: string;
  formattedDate: string;
  priorities: string[];
  tasks: { done: number; total: number };
  balance: number;
  eveningEmotion: string | null;
  eveningDone: boolean;
}

export function getAllDayKeys(): string[] {
  const datePattern = /^(\d{4}-\d{2}-\d{2})-/;
  const dateSet = new Set<string>();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const match = key.match(datePattern);
    if (match) dateSet.add(match[1]);
  }

  return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
}

export function formatDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function readKey<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getDaySummary(dateKey: string): DaySummary {
  const priorities = readKey<string[]>(`${dateKey}-morning`, []).filter(
    (p) => p.trim() !== ""
  );

  const tasks = readKey<{ id: string; status: string }[]>(
    `${dateKey}-tasks`,
    []
  );
  const doneTasks = tasks.filter((t) => t.status === "done").length;

  const transactions = readKey<{ type: string; amount: number }[]>(
    `${dateKey}-financial`,
    []
  );
  const balance = transactions.reduce(
    (acc, t) => acc + (t.type === "income" ? t.amount : -t.amount),
    0
  );

  const emotions = readKey<{
    morning: { emotion: string | null };
    afternoon: { emotion: string | null };
    evening: { emotion: string | null };
  }>(`${dateKey}-emotions`, {
    morning: { emotion: null },
    afternoon: { emotion: null },
    evening: { emotion: null },
  });
  const eveningEmotion =
    emotions.evening.emotion ||
    emotions.afternoon.emotion ||
    emotions.morning.emotion;

  const evening = readKey<{ good: string; different: string; learned: string }>(
    `${dateKey}-evening`,
    { good: "", different: "", learned: "" }
  );
  const eveningDone =
    evening.good.trim() !== "" ||
    evening.different.trim() !== "" ||
    evening.learned.trim() !== "";

  return {
    dateKey,
    formattedDate: formatDateKey(dateKey),
    priorities,
    tasks: { done: doneTasks, total: tasks.length },
    balance,
    eveningEmotion,
    eveningDone,
  };
}

export interface EmotionCheckIn {
  emotion: string | null;
  intensity: number | null;
  cause: string;
  observations: string;
}

export interface DayDetail {
  dateKey: string;
  formattedDate: string;
  priorities: string[];
  tasks: { id: string; title: string; category?: string; status: string }[];
  transactions: { id: string; type: string; description: string; amount: number }[];
  balance: number;
  emotions: {
    morning: EmotionCheckIn;
    afternoon: EmotionCheckIn;
    evening: EmotionCheckIn;
  };
  people: { id: string; name: string; context: string; observed: string; learned: string; nextStep: string; boundary: string }[];
  eveningReflection: { good: string; different: string; learned: string };
  habits: { name: string; done: boolean }[];
}

export function getDayDetail(dateKey: string): DayDetail {
  const priorities = readKey<string[]>(`${dateKey}-morning`, []);
  const tasks = readKey<{ id: string; title: string; status: string }[]>(
    `${dateKey}-tasks`,
    []
  );
  const transactions = readKey<
    { id: string; type: string; description: string; amount: number }[]
  >(`${dateKey}-financial`, []);
  const balance = transactions.reduce(
    (acc, t) => acc + (t.type === "income" ? t.amount : -t.amount),
    0
  );
  const defaultCheckIn: EmotionCheckIn = { emotion: null, intensity: null, cause: "", observations: "" };
  const emotions = readKey<{
    morning: EmotionCheckIn;
    afternoon: EmotionCheckIn;
    evening: EmotionCheckIn;
  }>(`${dateKey}-emotions`, {
    morning: { ...defaultCheckIn },
    afternoon: { ...defaultCheckIn },
    evening: { ...defaultCheckIn },
  });
  const people = readKey<{ id: string; name: string; context: string; observed: string; learned: string; nextStep: string; boundary: string }[]>(
    `${dateKey}-people`,
    []
  );
  const eveningReflection = readKey<{
    good: string;
    different: string;
    learned: string;
  }>(`${dateKey}-evening`, { good: "", different: "", learned: "" });

  const globalHabits = readKey<{ id: string; name: string }[]>(
    "global-habits",
    []
  );
  const completedHabits = readKey<string[]>(
    `${dateKey}-habits-completed`,
    []
  );
  const habits = globalHabits.map((h) => ({
    name: h.name,
    done: completedHabits.includes(h.id),
  }));

  return {
    dateKey,
    formattedDate: formatDateKey(dateKey),
    priorities,
    tasks,
    transactions,
    balance,
    emotions,
    people,
    eveningReflection,
    habits,
  };
}
