import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { Textarea } from "@/components/ui/textarea";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { supabase } from "@/lib/supabase";

type DayOrganizationItem = {
  id: string;
  createdAt: string;
  investigation: string;
  theme: string;
  dependencyChain: string[];
  finalPriority: string;
  completed: boolean;
  morningPriorityIndex?: number;
  priorityStatus?: "active" | "cancelled";
};

type DayOrganizationData = {
  skipped?: boolean;
  completed?: boolean;
  investigation?: string;
  theme?: string;
  dependencyChain?: string[];
  finalPriority?: string;
  items?: DayOrganizationItem[];
  usedDecisionBalance?: boolean;
  decisionBalanceId?: string;
  decisionBalanceConclusion?: string;
  returnToOrganization?: boolean;
  [key: string]: unknown;
};

type DailyTask = {
  id: string;
  title: string;
  category: string;
  status: string;
  date?: string;
  mustDoToday?: boolean;
  alignedToWeek?: boolean;
  matrixTouched?: boolean;
  source?: string;
  morningPriorityIndex?: number;
  details?: string;
  subtasks?: unknown[];
  [key: string]: unknown;
};

type DailyData = {
  dayOrganization?: DayOrganizationData;
  morning?: {
    priorities?: string[];
    [key: string]: unknown;
  };
  tasks?: DailyTask[];
  [key: string]: unknown;
};

function go(path: string) {
  window.location.assign(path);
}

function normalizeDayOrganizationItems(value: unknown): DayOrganizationItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => item && typeof item === "object")
    .map((item: any) => ({
      id:
        typeof item.id === "string" && item.id.trim()
          ? item.id
          : crypto.randomUUID(),
      createdAt:
        typeof item.createdAt === "string" && item.createdAt.trim()
          ? item.createdAt
          : new Date().toISOString(),
      investigation:
        typeof item.investigation === "string" ? item.investigation : "",
      theme: typeof item.theme === "string" ? item.theme : "",
      dependencyChain: Array.isArray(item.dependencyChain)
        ? item.dependencyChain
            .map((step: unknown) => String(step || "").trim())
            .filter(Boolean)
        : [],
      finalPriority:
        typeof item.finalPriority === "string" ? item.finalPriority : "",
      completed: Boolean(item.completed),
      morningPriorityIndex:
        typeof item.morningPriorityIndex === "number"
          ? item.morningPriorityIndex
          : undefined,
      priorityStatus:
        item.priorityStatus === "cancelled" ? "cancelled" : "active",
    }))
    .filter((item) => item.finalPriority.trim() || item.theme.trim());
}

export default function DayOrganization() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [investigation, setInvestigation] = useState("");
  const [theme, setTheme] = useState("");
  const [dependencyChain, setDependencyChain] = useState<string[]>([""]);
  const [finalPriority, setFinalPriority] = useState("");
  const [manualPriorityEdit, setManualPriorityEdit] = useState(false);
  const [organizationItems, setOrganizationItems] = useState<
    DayOrganizationItem[]
  >([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingPriority, setEditingPriority] = useState("");
  const [lastCompletedPriority, setLastCompletedPriority] = useState("");

  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const suggestedPriority = useMemo(() => {
    const filledSteps = dependencyChain
      .map((step) => step.trim())
      .filter(Boolean);

    return filledSteps[filledSteps.length - 1] || "";
  }, [dependencyChain]);

  useEffect(() => {
    if (!manualPriorityEdit) {
      setFinalPriority(suggestedPriority);
    }
  }, [suggestedPriority, manualPriorityEdit]);

  useEffect(() => {
    loadDayOrganization();
  }, [dateKey]);

  async function getLatestDailyData(userId: string): Promise<DailyData> {
    const { data, error } = await supabase
      .from("daily_records")
      .select("data")
      .eq("user_id", userId)
      .eq("date", dateKey)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar organização do dia:", error);
      return {};
    }

    return (data?.data || {}) as DailyData;
  }

  async function loadDayOrganization() {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setLoading(false);
      return;
    }

    const latestData = await getLatestDailyData(session.user.id);
    const savedOrganization = latestData.dayOrganization || {};
    const savedItems = normalizeDayOrganizationItems(savedOrganization.items);

    setOrganizationItems(savedItems);
    setInvestigation(savedOrganization.investigation || "");
    setTheme(savedOrganization.theme || "");

    const savedChain = Array.isArray(savedOrganization.dependencyChain)
      ? savedOrganization.dependencyChain
      : [];

    setDependencyChain(savedChain.length > 0 ? savedChain : [""]);
    setFinalPriority(savedOrganization.finalPriority || "");
    setManualPriorityEdit(Boolean(savedOrganization.finalPriority));
    setLastCompletedPriority("");

    setLoading(false);
  }

  async function saveDayOrganizationPatch(patch: DayOrganizationData) {
    setSaving(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setSaving(false);
      return false;
    }

    const latestData = await getLatestDailyData(session.user.id);

    const nextData: DailyData = {
      ...latestData,
      dayOrganization: {
        ...(latestData.dayOrganization || {}),
        ...patch,
      },
    };

    const { error } = await supabase.from("daily_records").upsert(
      {
        user_id: session.user.id,
        date: dateKey,
        data: nextData,
      },
      { onConflict: "user_id,date" },
    );

    setSaving(false);

    if (error) {
      console.error("Erro ao salvar organização do dia:", error);
      return false;
    }

    return true;
  }

  function updateDependencyStep(index: number, value: string) {
    setDependencyChain((currentChain) => {
      const nextChain = [...currentChain];
      nextChain[index] = value;
      return nextChain;
    });

    if (!manualPriorityEdit) {
      setMessage("");
    }
  }

  function addDependencyStep() {
    setDependencyChain((currentChain) => [...currentChain, ""]);
  }

  function removeDependencyStep(index: number) {
    setDependencyChain((currentChain) => {
      const nextChain = currentChain.filter((_, currentIndex) => {
        return currentIndex !== index;
      });

      return nextChain.length > 0 ? nextChain : [""];
    });
  }

  function getCleanDependencyChain() {
    return dependencyChain.map((step) => step.trim()).filter(Boolean);
  }

  function findFirstEmptyPriorityIndex(priorities: string[]) {
    for (let index = 0; index < 3; index += 1) {
      if (!String(priorities[index] || "").trim()) {
        return index;
      }
    }

    return -1;
  }

  function resetCurrentOrganizationForm() {
    setInvestigation("");
    setTheme("");
    setDependencyChain([""]);
    setFinalPriority("");
    setManualPriorityEdit(false);
    setMessage("");
    setLastCompletedPriority("");
  }

  function startEditingOrganizationItem(item: DayOrganizationItem) {
    if (item.priorityStatus === "cancelled") return;

    setEditingItemId(item.id);
    setEditingPriority(item.finalPriority);
    setMessage("");
  }

  function cancelEditingOrganizationItem() {
    setEditingItemId(null);
    setEditingPriority("");
  }

  async function saveOrganizationItemPriority(
    itemToUpdate: DayOrganizationItem,
  ) {
    const cleanPriority = editingPriority.trim();

    if (!cleanPriority) {
      setMessage("Defina a prioridade antes de salvar.");
      return;
    }

    if (typeof itemToUpdate.morningPriorityIndex !== "number") {
      setMessage(
        "Esta organização não possui vínculo com prioridade da manhã.",
      );
      return;
    }

    setSaving(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setSaving(false);
      return;
    }

    const latestData = await getLatestDailyData(session.user.id);
    const currentItems = normalizeDayOrganizationItems(
      latestData.dayOrganization?.items,
    );

    const nextItems = currentItems.map((item) =>
      item.id === itemToUpdate.id
        ? {
            ...item,
            finalPriority: cleanPriority,
            priorityStatus: "active" as const,
          }
        : item,
    );

    const currentMorning = latestData.morning || {};
    const currentPriorities = Array.isArray(currentMorning.priorities)
      ? [...currentMorning.priorities]
      : ["", "", ""];

    while (currentPriorities.length <= itemToUpdate.morningPriorityIndex) {
      currentPriorities.push("");
    }

    currentPriorities[itemToUpdate.morningPriorityIndex] = cleanPriority;

    const currentTasks = Array.isArray(latestData.tasks)
      ? latestData.tasks
      : [];

    const nextTasks = syncFinalPriorityAsTask(
      currentTasks,
      cleanPriority,
      itemToUpdate.morningPriorityIndex,
    );

    const nextData: DailyData = {
      ...latestData,
      morning: {
        ...currentMorning,
        priorities: currentPriorities,
      },
      dayOrganization: {
        ...(latestData.dayOrganization || {}),
        items: nextItems,
      },
      tasks: nextTasks,
    };

    const { error } = await supabase.from("daily_records").upsert(
      {
        user_id: session.user.id,
        date: dateKey,
        data: nextData,
      },
      { onConflict: "user_id,date" },
    );

    setSaving(false);

    if (error) {
      console.error("Erro ao atualizar prioridade da organização:", error);
      setMessage("Erro ao atualizar prioridade.");
      return;
    }

    setOrganizationItems(nextItems);
    setEditingItemId(null);
    setEditingPriority("");
    setMessage("Prioridade atualizada.");
  }

  function syncFinalPriorityAsTask(
    currentTasks: DailyTask[],
    cleanFinalPriority: string,
    morningPriorityIndex: number,
  ) {
    const sameIndexTasks = currentTasks
      .map((task, taskIndex) => ({ task, taskIndex }))
      .filter(
        ({ task }) =>
          task?.source === "morning-priority" &&
          task?.morningPriorityIndex === morningPriorityIndex,
      );

    const liveTasks = sameIndexTasks.filter(
      ({ task }) => task.status !== "cancelled",
    );

    if (liveTasks.length > 0) {
      const firstLiveTaskIndex = liveTasks[0].taskIndex;

      return currentTasks.map((task, taskIndex) => {
        if (
          task?.source !== "morning-priority" ||
          task?.morningPriorityIndex !== morningPriorityIndex
        ) {
          return task;
        }

        if (taskIndex !== firstLiveTaskIndex && task.status !== "cancelled") {
          return {
            ...task,
            status: "cancelled",
          };
        }

        if (taskIndex !== firstLiveTaskIndex) {
          return task;
        }

        return {
          ...task,
          title: cleanFinalPriority,
          category: "prioridade",
          status: task.status || "todo",
          date: task.date || dateKey,
          mustDoToday: task.matrixTouched ? task.mustDoToday : true,
          alignedToWeek: task.matrixTouched ? task.alignedToWeek : true,
          matrixTouched: Boolean(task.matrixTouched),
          source: "morning-priority",
          morningPriorityIndex,
          details: task.details || "Prioridade definida em Organizar meu dia.",
          subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
        };
      });
    }

    return [
      ...currentTasks,
      {
        id: crypto.randomUUID(),
        title: cleanFinalPriority,
        category: "prioridade",
        status: "todo",
        date: dateKey,
        mustDoToday: true,
        alignedToWeek: true,
        matrixTouched: false,
        source: "morning-priority",
        morningPriorityIndex,
        details: "Prioridade definida em Organizar meu dia.",
        subtasks: [],
      },
    ];
  }

  async function completeOrganizationWithPriority() {
    setSaving(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setSaving(false);
      return false;
    }

    const cleanFinalPriority = finalPriority.trim();
    const cleanInvestigation = investigation.trim();
    const cleanTheme = theme.trim();
    const cleanDependencyChain = getCleanDependencyChain();

    const latestData = await getLatestDailyData(session.user.id);
    const currentMorning = latestData.morning || {};
    const currentPriorities = Array.isArray(currentMorning.priorities)
      ? [...currentMorning.priorities]
      : ["", "", ""];

    while (currentPriorities.length < 3) {
      currentPriorities.push("");
    }

    const morningPriorityIndex = findFirstEmptyPriorityIndex(currentPriorities);

    if (morningPriorityIndex === -1) {
      setSaving(false);
      setMessage(
        "Você já tem 3 prioridades para hoje. Revise antes de adicionar outra.",
      );
      return false;
    }

    currentPriorities[morningPriorityIndex] = cleanFinalPriority;

    const currentItems = normalizeDayOrganizationItems(
      latestData.dayOrganization?.items,
    );

    const nextItem: DayOrganizationItem = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      investigation: cleanInvestigation,
      theme: cleanTheme,
      dependencyChain: cleanDependencyChain,
      finalPriority: cleanFinalPriority,
      completed: true,
      morningPriorityIndex,
      priorityStatus: "active",
    };

    const nextItems = [...currentItems, nextItem];

    const currentTasks = Array.isArray(latestData.tasks)
      ? latestData.tasks
      : [];

    const nextTasks = syncFinalPriorityAsTask(
      currentTasks,
      cleanFinalPriority,
      morningPriorityIndex,
    );

    const nextData: DailyData = {
      ...latestData,
      morning: {
        ...currentMorning,
        priorities: currentPriorities,
      },
      dayOrganization: {
        ...(latestData.dayOrganization || {}),
        items: nextItems,
        completed: true,
        skipped: false,
        investigation: "",
        theme: "",
        dependencyChain: [],
        finalPriority: "",
      },
      tasks: nextTasks,
    };

    const { error } = await supabase.from("daily_records").upsert(
      {
        user_id: session.user.id,
        date: dateKey,
        data: nextData,
      },
      { onConflict: "user_id,date" },
    );

    setSaving(false);

    if (error) {
      console.error("Erro ao concluir organização do dia:", error);
      return false;
    }

    setOrganizationItems(nextItems);
    setInvestigation("");
    setTheme("");
    setDependencyChain([""]);
    setFinalPriority("");
    setManualPriorityEdit(false);
    setLastCompletedPriority(cleanFinalPriority);
    setMessage("");

    return true;
  }

  async function skipToTasks() {
    const saved = await saveDayOrganizationPatch({
      skipped: true,
      completed: false,
    });

    if (saved) {
      go("/tarefas");
    }
  }

  async function saveClarity() {
    const saved = await saveDayOrganizationPatch({
      investigation,
      theme,
      dependencyChain: getCleanDependencyChain(),
      finalPriority,
      skipped: false,
    });

    if (saved) {
      setMessage("Clareza salva.");
    }
  }

  async function useDecisionBalance() {
    const saved = await saveDayOrganizationPatch({
      investigation,
      theme,
      dependencyChain: getCleanDependencyChain(),
      finalPriority,
      usedDecisionBalance: true,
      returnToOrganization: true,
      skipped: false,
    });

    if (saved) {
      go("/balanca");
    }
  }

  async function completeOrganization() {
    const hasInitialClarity = investigation.trim() || theme.trim();

    if (!hasInitialClarity) {
      setMessage(
        "Escreva a investigação ou defina o tema central antes de concluir.",
      );
      return;
    }

    if (!finalPriority.trim()) {
      setMessage("Defina a prioridade real antes de concluir.");
      return;
    }

    await completeOrganizationWithPriority();
  }

  return (
    <Layout>
      <Header title="" />

      <div className="flex-1 overflow-y-auto bg-background px-5 py-6 pb-12">
        <div className="mx-auto max-w-md space-y-7">
          <div className="space-y-3 text-center">
            <h1 className="font-serif text-3xl text-foreground">
              Organizar meu dia
            </h1>

            <p className="text-sm leading-relaxed text-muted-foreground">
              Antes de transformar tudo em tarefas, encontre clareza sobre o que
              realmente precisa de atenção.
            </p>
          </div>

          {organizationItems.length > 0 && (
            <section className="space-y-4 rounded-2xl border border-border/40 bg-card p-5">
              <div className="space-y-2">
                <p className="font-serif text-2xl leading-snug text-foreground">
                  Organizações de hoje
                </p>

                <p className="text-sm leading-relaxed text-muted-foreground">
                  Pontos já organizados e transformados em prioridade.
                </p>
              </div>

              <div className="space-y-3">
                {organizationItems.map((item, index) => {
                  const isCancelled = item.priorityStatus === "cancelled";
                  const isEditing = editingItemId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border/40 bg-background px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
                          {index + 1}. {item.theme.trim() || "Tema sem nome"}
                        </p>

                        {isCancelled && (
                          <span className="rounded-full border border-border/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                            Cancelada
                          </span>
                        )}
                      </div>

                      {!isEditing && (
                        <>
                          <p className="mt-2 text-sm leading-relaxed text-foreground">
                            Prioridade: {item.finalPriority}
                          </p>

                          {!isCancelled &&
                            typeof item.morningPriorityIndex === "number" && (
                              <button
                                type="button"
                                onClick={() =>
                                  startEditingOrganizationItem(item)
                                }
                                disabled={saving || loading}
                                className="mt-3 rounded-xl border border-border/40 bg-card px-3 py-2 text-xs text-muted-foreground transition-all hover:bg-muted/30 disabled:opacity-50"
                              >
                                Editar prioridade
                              </button>
                            )}
                        </>
                      )}

                      {isEditing && (
                        <div className="mt-3 space-y-2">
                          <Textarea
                            value={editingPriority}
                            onChange={(event) =>
                              setEditingPriority(event.target.value)
                            }
                            className="min-h-[80px] resize-none rounded-xl border-border/40 bg-card"
                            disabled={saving || loading}
                          />

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveOrganizationItemPriority(item)}
                              disabled={
                                saving || loading || !editingPriority.trim()
                              }
                              className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-medium text-primary disabled:opacity-50"
                            >
                              Salvar
                            </button>

                            <button
                              type="button"
                              onClick={cancelEditingOrganizationItem}
                              disabled={saving || loading}
                              className="rounded-xl border border-border/40 px-3 py-2 text-xs text-muted-foreground disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {isCancelled && (
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          Esta prioridade não está mais ativa, mas a organização
                          foi preservada no histórico.
                        </p>
                      )}

                      {item.dependencyChain.length > 0 && (
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Cadeia: {item.dependencyChain.join(" → ")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {lastCompletedPriority && (
            <section className="space-y-5 rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <div className="space-y-3 text-center">
                <p className="font-serif text-3xl leading-snug text-foreground">
                  Organização concluída.
                </p>

                <div className="rounded-xl border border-primary/20 bg-background px-4 py-4 text-left">
                  <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
                    Prioridade definida:
                  </p>

                  <p className="mt-2 text-base leading-relaxed text-foreground">
                    {lastCompletedPriority}
                  </p>
                </div>

                <p className="text-sm leading-relaxed text-muted-foreground">
                  O que você quer fazer agora?
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={resetCurrentOrganizationForm}
                  disabled={saving || loading}
                  className="w-full rounded-2xl border border-primary/20 bg-primary px-4 py-4 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50"
                >
                  Organizar outro ponto
                </button>

                <button
                  type="button"
                  onClick={() => go("/tarefas")}
                  disabled={saving || loading}
                  className="w-full rounded-2xl border border-border/40 bg-background px-4 py-4 text-sm font-medium text-muted-foreground transition-all hover:bg-muted/30 disabled:opacity-50"
                >
                  Ir para tarefas
                </button>
              </div>
            </section>
          )}

          {!lastCompletedPriority && (
            <>
              <section className="space-y-5 rounded-2xl border border-border/40 bg-card p-5">
                <div className="space-y-2">
                  <p className="font-serif text-2xl leading-snug text-foreground">
                    O que está ocupando sua mente hoje?
                  </p>

                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Escreva livremente, como em um caderno. Pode ser uma
                    preocupação, desejo, problema, decisão ou sensação ainda
                    confusa.
                  </p>
                </div>

                <Textarea
                  value={investigation}
                  onChange={(event) => setInvestigation(event.target.value)}
                  placeholder="Escreva como se estivesse organizando o pensamento em um caderno..."
                  className="min-h-[180px] resize-none rounded-xl border-border/40 bg-background"
                  disabled={loading}
                />
              </section>

              <section className="space-y-4 rounded-2xl border border-border/40 bg-card p-5">
                <div className="space-y-2">
                  <p className="font-serif text-2xl leading-snug text-foreground">
                    Qual é o tema central disso?
                  </p>

                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Nomeie o assunto principal por trás do que apareceu.
                  </p>
                </div>

                <Textarea
                  value={theme}
                  onChange={(event) => setTheme(event.target.value)}
                  placeholder="Mobilidade, dinheiro, trabalho, saúde, relacionamento..."
                  className="min-h-[90px] resize-none rounded-xl border-border/40 bg-background"
                  disabled={loading}
                />
              </section>

              <section className="space-y-5 rounded-2xl border border-border/40 bg-card p-5">
                <div className="space-y-2">
                  <p className="font-serif text-2xl leading-snug text-foreground">
                    Para avançar nisso, o que precisa acontecer antes?
                  </p>

                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Construa a cadeia de dependências até encontrar o bloqueio
                    mais básico.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
                    {theme.trim() || "Objetivo / tema"}
                  </div>

                  {dependencyChain.map((step, index) => (
                    <div key={index} className="space-y-2">
                      <div className="text-center text-muted-foreground">↑</div>

                      <div className="flex gap-2">
                        <input
                          value={step}
                          onChange={(event) => {
                            updateDependencyStep(index, event.target.value);
                          }}
                          placeholder="Etapa anterior"
                          disabled={loading}
                          className="min-h-12 flex-1 rounded-xl border border-border/40 bg-background px-4 py-3 text-sm outline-none transition-all focus:border-primary/40 disabled:opacity-50"
                        />

                        <button
                          type="button"
                          onClick={() => removeDependencyStep(index)}
                          disabled={loading || dependencyChain.length === 1}
                          className="rounded-xl border border-border/40 bg-background px-3 text-sm text-muted-foreground transition-all hover:bg-muted/30 disabled:opacity-40"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addDependencyStep}
                  disabled={loading}
                  className="w-full rounded-2xl border border-border/40 bg-background px-4 py-4 text-sm font-medium text-muted-foreground transition-all hover:bg-muted/30 disabled:opacity-50"
                >
                  + Adicionar etapa anterior
                </button>
              </section>

              <section className="space-y-4 rounded-2xl border border-border/40 bg-card p-5">
                <div className="space-y-2">
                  <p className="font-serif text-2xl leading-snug text-foreground">
                    O que está bloqueando seu avanço agora?
                  </p>

                  <p className="text-sm leading-relaxed text-muted-foreground">
                    A prioridade real sugerida é a última etapa preenchida da
                    cadeia, mas você pode editar manualmente.
                  </p>
                </div>

                {suggestedPriority && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                    Sugestão: {suggestedPriority}
                  </div>
                )}

                <Textarea
                  value={finalPriority}
                  onChange={(event) => {
                    setFinalPriority(event.target.value);
                    setManualPriorityEdit(true);
                  }}
                  placeholder="Defina a prioridade real..."
                  className="min-h-[90px] resize-none rounded-xl border-border/40 bg-background"
                  disabled={loading}
                />
              </section>

              <section className="space-y-4 rounded-2xl border border-border/40 bg-card p-5">
                <div className="space-y-2">
                  <p className="font-serif text-2xl leading-snug text-foreground">
                    Balança Decisória
                  </p>

                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Se isso envolve uma decisão importante, você pode usar a
                    Balança Decisória para pensar melhor antes de definir sua
                    prioridade.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={useDecisionBalance}
                  disabled={saving || loading}
                  className="w-full rounded-2xl border border-primary/20 bg-primary/10 px-4 py-4 text-sm font-medium text-primary transition-all hover:bg-primary/15 disabled:opacity-50"
                >
                  Usar Balança Decisória
                </button>
              </section>

              {message && (
                <p className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                  {message}
                </p>
              )}

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={skipToTasks}
                  disabled={saving || loading}
                  className="w-full rounded-2xl border border-border/40 bg-background px-4 py-4 text-sm font-medium text-muted-foreground transition-all hover:bg-muted/30 disabled:opacity-50"
                >
                  Pular para tarefas
                </button>

                <button
                  type="button"
                  onClick={saveClarity}
                  disabled={saving || loading}
                  className="w-full rounded-2xl border border-primary/20 bg-primary/10 px-4 py-4 text-sm font-medium text-primary transition-all hover:bg-primary/15 disabled:opacity-50"
                >
                  Salvar clareza
                </button>

                <button
                  type="button"
                  onClick={completeOrganization}
                  disabled={saving || loading}
                  className="w-full rounded-2xl border border-primary/20 bg-primary px-4 py-4 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50"
                >
                  Concluir organização
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
