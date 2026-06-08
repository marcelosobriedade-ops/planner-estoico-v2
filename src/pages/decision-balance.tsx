import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { Header } from "@/components/header";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { supabase } from "@/lib/supabase";

type DecisionBalanceData = {
  id: string;
  createdAt: string;
  title: string;
  changePros: string[];
  changeCons: string[];
  stayPros: string[];
  stayCons: string[];
  conclusion: string;
};

type ViewMode = "list" | "read" | "form";

type DayOrganizationData = {
  skipped?: boolean;
  completed?: boolean;
  investigation?: string;
  theme?: string;
  dependencyChain?: string[];
  finalPriority?: string;
  usedDecisionBalance?: boolean;
  decisionBalanceId?: string;
  decisionBalanceConclusion?: string;
  returnToOrganization?: boolean;
  [key: string]: unknown;
};

type DailyData = {
  dayOrganization?: DayOrganizationData;
  decisionBalances?: DecisionBalanceData[];
  [key: string]: unknown;
};

const DECISION_BALANCES_RECORD_DATE = "1970-01-01";

const EMPTY_DECISION_BALANCE: DecisionBalanceData = {
  id: "",
  createdAt: "",
  title: "",
  changePros: [],
  changeCons: [],
  stayPros: [],
  stayCons: [],
  conclusion: "",
};

function go(path: string) {
  window.location.assign(path);
}

export default function DecisionBalance() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [balances, setBalances] = useState<DecisionBalanceData[]>([]);
  const [draft, setDraft] = useState<DecisionBalanceData>(
    EMPTY_DECISION_BALANCE,
  );
  const [activeBalanceId, setActiveBalanceId] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("list");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shouldShowReturnToOrganization, setShouldShowReturnToOrganization] =
    useState(false);

  const activeBalance =
    balances.find((balance) => balance.id === activeBalanceId) ?? null;

  useEffect(() => {
    loadDecisionBalances();
    loadOrganizationReturnIntent();
  }, [dateKey]);

  async function loadDecisionBalances() {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("daily_records")
      .select("data")
      .eq("user_id", session.user.id)
      .eq("date", DECISION_BALANCES_RECORD_DATE)
      .maybeSingle();

    const savedBalances = data?.data?.decisionBalances;

    if (Array.isArray(savedBalances)) {
      setBalances(
        savedBalances
          .map(normalizeDecisionBalance)
          .filter((balance): balance is DecisionBalanceData =>
            Boolean(balance),
          ),
      );
    }

    setLoading(false);
  }

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

  async function loadOrganizationReturnIntent() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return;
    }

    const latestData = await getLatestDailyData(session.user.id);

    setShouldShowReturnToOrganization(
      Boolean(latestData.dayOrganization?.returnToOrganization),
    );
  }

  async function markDecisionBalanceUsed(balance: DecisionBalanceData) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return;
    }

    const latestData = await getLatestDailyData(session.user.id);

    await supabase.from("daily_records").upsert(
      {
        user_id: session.user.id,
        date: dateKey,
        data: {
          ...latestData,
          dayOrganization: {
            ...(latestData.dayOrganization || {}),
            usedDecisionBalance: true,
            decisionBalanceId: balance.id,
            decisionBalanceConclusion: balance.conclusion,
            returnToOrganization: true,
          },
        },
      },
      { onConflict: "user_id,date" },
    );
  }

  async function persistDecisionBalances(nextBalances: DecisionBalanceData[]) {
    setSaving(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setSaving(false);
      return;
    }

    const { data: existingRecord } = await supabase
      .from("daily_records")
      .select("data")
      .eq("user_id", session.user.id)
      .eq("date", DECISION_BALANCES_RECORD_DATE)
      .maybeSingle();

    const existingData = existingRecord?.data ?? {};
    const { decisionBalance: _legacyDecisionBalance, ...safeExistingData } =
      existingData;

    await supabase.from("daily_records").upsert(
      {
        user_id: session.user.id,
        date: DECISION_BALANCES_RECORD_DATE,
        data: {
          ...safeExistingData,
          decisionBalances: nextBalances,
        },
      },
      {
        onConflict: "user_id,date",
      },
    );

    setSaving(false);
  }

  function startNewBalance() {
    const now = new Date().toISOString();

    setDraft({
      ...EMPTY_DECISION_BALANCE,
      id: crypto.randomUUID(),
      createdAt: now,
    });
    setActiveBalanceId(null);
    setMode("form");
  }

  function openBalance(balanceId: string) {
    setActiveBalanceId(balanceId);
    setMode("read");
  }

  function editBalance(balanceId: string) {
    const balance = balances.find((item) => item.id === balanceId);

    if (!balance) return;

    setDraft({
      ...balance,
      changePros: [...balance.changePros],
      changeCons: [...balance.changeCons],
      stayPros: [...balance.stayPros],
      stayCons: [...balance.stayCons],
    });
    setActiveBalanceId(balanceId);
    setMode("form");
  }

  async function deleteBalance(balanceId: string) {
    const nextBalances = balances.filter((balance) => balance.id !== balanceId);

    setBalances(nextBalances);
    await persistDecisionBalances(nextBalances);

    if (activeBalanceId === balanceId) {
      setActiveBalanceId(null);
      setMode("list");
    }
  }

  async function saveDraft() {
    const normalizedDraft: DecisionBalanceData = {
      ...draft,
      title: draft.title.trim(),
      changePros: cleanList(draft.changePros),
      changeCons: cleanList(draft.changeCons),
      stayPros: cleanList(draft.stayPros),
      stayCons: cleanList(draft.stayCons),
      conclusion: draft.conclusion.trim(),
    };

    if (!normalizedDraft.title) return;

    const alreadyExists = balances.some(
      (balance) => balance.id === normalizedDraft.id,
    );

    const nextBalances = alreadyExists
      ? balances.map((balance) =>
          balance.id === normalizedDraft.id ? normalizedDraft : balance,
        )
      : [normalizedDraft, ...balances];

    setBalances(nextBalances);
    setActiveBalanceId(normalizedDraft.id);
    setDraft(normalizedDraft);
    setMode("read");

    await persistDecisionBalances(nextBalances);

    if (shouldShowReturnToOrganization) {
      await markDecisionBalanceUsed(normalizedDraft);
    }
  }

  function cancelForm() {
    setDraft(EMPTY_DECISION_BALANCE);
    setActiveBalanceId(null);
    setMode("list");
  }

  function updateField(field: keyof DecisionBalanceData, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function addListItem(
    field: keyof Pick<
      DecisionBalanceData,
      "changePros" | "changeCons" | "stayPros" | "stayCons"
    >,
  ) {
    setDraft((current) => ({
      ...current,
      [field]: [...current[field], ""],
    }));
  }

  function updateListItem(
    field: keyof Pick<
      DecisionBalanceData,
      "changePros" | "changeCons" | "stayPros" | "stayCons"
    >,
    index: number,
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      [field]: current[field].map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    }));
  }

  function removeListItem(
    field: keyof Pick<
      DecisionBalanceData,
      "changePros" | "changeCons" | "stayPros" | "stayCons"
    >,
    index: number,
  ) {
    setDraft((current) => ({
      ...current,
      [field]: current[field].filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  return (
    <Layout>
      <Header
        title="Balança Decisória"
        subtitle="Um acervo permanente para decisões importantes."
      />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-10">
        <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-stone-800">
              Balança Decisória
            </h1>
            <p className="text-sm text-stone-600">
              Crie, consulte, edite ou exclua suas balanças quando precisar.
            </p>
            <p className="mt-2 text-sm text-stone-500">
              Use esta ferramenta quando uma decisão aparecer dentro da
              organização do dia.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => go("/organizar-dia")}
              className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
            >
              Organizar meu dia
            </button>

            <button
              type="button"
              onClick={startNewBalance}
              disabled={loading || saving}
              className="rounded-xl bg-stone-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:opacity-50"
            >
              Nova balança
            </button>
          </div>
        </section>

        {mode === "list" && (
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">
              Lista de balanças existentes
            </h2>

            {loading ? (
              <p className="text-sm text-stone-500">Carregando...</p>
            ) : balances.length === 0 ? (
              <p className="text-sm text-stone-500">
                Nenhuma balança criada ainda.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-stone-100">
                {balances.map((balance) => (
                  <article key={balance.id} className="py-5 first:pt-0">
                    <h3 className="text-base font-semibold text-stone-800">
                      {balance.title}
                    </h3>

                    {balance.conclusion && (
                      <p className="mt-1 text-sm text-stone-600">
                        {balance.conclusion}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openBalance(balance.id)}
                        className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                      >
                        Abrir
                      </button>

                      <button
                        type="button"
                        onClick={() => editBalance(balance.id)}
                        className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteBalance(balance.id)}
                        disabled={saving}
                        className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        Excluir
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {mode === "read" && activeBalance && (
          <ReadOnlyBalance
            balance={activeBalance}
            onBack={() => setMode("list")}
            onEdit={() => editBalance(activeBalance.id)}
            onDelete={() => deleteBalance(activeBalance.id)}
            onReturnToOrganization={() => go("/organizar-dia")}
            showReturnToOrganization={shouldShowReturnToOrganization}
            saving={saving}
          />
        )}

        {mode === "form" && (
          <BalanceForm
            balance={draft}
            loading={loading || saving}
            onCancel={cancelForm}
            onSave={saveDraft}
            onUpdateField={updateField}
            onAddListItem={addListItem}
            onUpdateListItem={updateListItem}
            onRemoveListItem={removeListItem}
          />
        )}
      </main>
    </Layout>
  );
}

type BalanceFormProps = {
  balance: DecisionBalanceData;
  loading: boolean;
  onCancel: () => void;
  onSave: () => void;
  onUpdateField: (field: keyof DecisionBalanceData, value: string) => void;
  onAddListItem: (
    field: keyof Pick<
      DecisionBalanceData,
      "changePros" | "changeCons" | "stayPros" | "stayCons"
    >,
  ) => void;
  onUpdateListItem: (
    field: keyof Pick<
      DecisionBalanceData,
      "changePros" | "changeCons" | "stayPros" | "stayCons"
    >,
    index: number,
    value: string,
  ) => void;
  onRemoveListItem: (
    field: keyof Pick<
      DecisionBalanceData,
      "changePros" | "changeCons" | "stayPros" | "stayCons"
    >,
    index: number,
  ) => void;
};

function BalanceForm({
  balance,
  loading,
  onCancel,
  onSave,
  onUpdateField,
  onAddListItem,
  onUpdateListItem,
  onRemoveListItem,
}: BalanceFormProps) {
  return (
    <>
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-stone-500">
          Título
        </label>

        <input
          value={balance.title}
          onChange={(event) => onUpdateField("title", event.target.value)}
          placeholder="Trocar de emprego"
          className="w-full rounded-xl border border-stone-200 bg-stone-50 p-4 text-stone-800 outline-none transition focus:border-stone-400 focus:bg-white"
          disabled={loading}
        />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <DecisionColumn
          title="Mudar"
          pros={balance.changePros}
          cons={balance.changeCons}
          onAddPros={() => onAddListItem("changePros")}
          onAddCons={() => onAddListItem("changeCons")}
          onChangePros={(index, value) =>
            onUpdateListItem("changePros", index, value)
          }
          onChangeCons={(index, value) =>
            onUpdateListItem("changeCons", index, value)
          }
          onRemovePros={(index) => onRemoveListItem("changePros", index)}
          onRemoveCons={(index) => onRemoveListItem("changeCons", index)}
          disabled={loading}
        />

        <DecisionColumn
          title="Não mudar"
          pros={balance.stayPros}
          cons={balance.stayCons}
          onAddPros={() => onAddListItem("stayPros")}
          onAddCons={() => onAddListItem("stayCons")}
          onChangePros={(index, value) =>
            onUpdateListItem("stayPros", index, value)
          }
          onChangeCons={(index, value) =>
            onUpdateListItem("stayCons", index, value)
          }
          onRemovePros={(index) => onRemoveListItem("stayPros", index)}
          onRemoveCons={(index) => onRemoveListItem("stayCons", index)}
          disabled={loading}
        />
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-stone-500">
          Conclusão
        </label>

        <p className="mb-3 text-sm text-stone-600">Qual lado pesa mais hoje?</p>

        <textarea
          value={balance.conclusion}
          onChange={(event) => onUpdateField("conclusion", event.target.value)}
          placeholder="Hoje a balança pesa para mudar."
          className="min-h-28 w-full rounded-xl border border-stone-200 bg-stone-50 p-4 text-stone-800 outline-none transition focus:border-stone-400 focus:bg-white"
          disabled={loading}
        />

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={loading || !balance.title.trim()}
            className="rounded-xl bg-stone-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:opacity-50"
          >
            Salvar
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </section>
    </>
  );
}

type ReadOnlyBalanceProps = {
  balance: DecisionBalanceData;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReturnToOrganization: () => void;
  showReturnToOrganization: boolean;
  saving: boolean;
};

function ReadOnlyBalance({
  balance,
  onBack,
  onEdit,
  onDelete,
  onReturnToOrganization,
  showReturnToOrganization,
  saving,
}: ReadOnlyBalanceProps) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-stone-800">
            {balance.title}
          </h2>

          <p className="mt-1 text-xs uppercase tracking-wide text-stone-400">
            Criada em {formatDate(balance.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            Voltar
          </button>

          {showReturnToOrganization && (
            <button
              type="button"
              onClick={onReturnToOrganization}
              className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-700"
            >
              Voltar para Organizar meu dia
            </button>
          )}

          <button
            type="button"
            onClick={onEdit}
            className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            Editar
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
          >
            Excluir
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ReadOnlyColumn
          title="Mudar"
          pros={balance.changePros}
          cons={balance.changeCons}
        />

        <ReadOnlyColumn
          title="Não mudar"
          pros={balance.stayPros}
          cons={balance.stayCons}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-stone-100 bg-stone-50 p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Conclusão
        </h3>

        <p className="whitespace-pre-wrap text-sm text-stone-700">
          {balance.conclusion || "Sem conclusão registrada."}
        </p>
      </div>
    </section>
  );
}

type ReadOnlyColumnProps = {
  title: string;
  pros: string[];
  cons: string[];
};

function ReadOnlyColumn({ title, pros, cons }: ReadOnlyColumnProps) {
  return (
    <section className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
      <h3 className="mb-4 text-base font-semibold text-stone-800">{title}</h3>

      <ReadOnlyList title="Vantagens" items={pros} />

      <div className="mt-5">
        <ReadOnlyList title="Desvantagens" items={cons} />
      </div>
    </section>
  );
}

type ReadOnlyListProps = {
  title: string;
  items: string[];
};

function ReadOnlyList({ title, items }: ReadOnlyListProps) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
        {title}
      </h4>

      {items.length === 0 ? (
        <p className="text-sm text-stone-400">Nenhum item registrado.</p>
      ) : (
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-stone-700">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="whitespace-pre-wrap">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type DecisionColumnProps = {
  title: string;
  pros: string[];
  cons: string[];
  onAddPros: () => void;
  onAddCons: () => void;
  onChangePros: (index: number, value: string) => void;
  onChangeCons: (index: number, value: string) => void;
  onRemovePros: (index: number) => void;
  onRemoveCons: (index: number) => void;
  disabled?: boolean;
};

function DecisionColumn({
  title,
  pros,
  cons,
  onAddPros,
  onAddCons,
  onChangePros,
  onChangeCons,
  onRemovePros,
  onRemoveCons,
  disabled,
}: DecisionColumnProps) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="mb-5 text-lg font-semibold text-stone-800">{title}</h2>

      <DynamicList
        title="Vantagens"
        items={pros}
        buttonLabel="+ Adicionar vantagem"
        onAdd={onAddPros}
        onChange={onChangePros}
        onRemove={onRemovePros}
        disabled={disabled}
      />

      <div className="mt-6">
        <DynamicList
          title="Desvantagens"
          items={cons}
          buttonLabel="+ Adicionar desvantagem"
          onAdd={onAddCons}
          onChange={onChangeCons}
          onRemove={onRemoveCons}
          disabled={disabled}
        />
      </div>
    </section>
  );
}

type DynamicListProps = {
  title: string;
  items: string[];
  buttonLabel: string;
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
};

function DynamicList({
  title,
  items,
  buttonLabel,
  onAdd,
  onChange,
  onRemove,
  disabled,
}: DynamicListProps) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
        {title}
      </h3>

      <div className="flex flex-col gap-3">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <textarea
              value={item}
              onChange={(event) => onChange(index, event.target.value)}
              className="min-h-12 flex-1 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-800 outline-none transition focus:border-stone-400 focus:bg-white"
              disabled={disabled}
            />

            <button
              type="button"
              onClick={() => onRemove(index)}
              disabled={disabled}
              className="rounded-xl border border-stone-200 px-3 text-sm text-stone-500 transition hover:bg-stone-100 disabled:opacity-50"
              aria-label="Remover item"
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          className="rounded-xl border border-dashed border-stone-300 px-4 py-3 text-left text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function normalizeDecisionBalance(value: unknown): DecisionBalanceData | null {
  if (!value || typeof value !== "object") return null;

  const balance = value as Partial<DecisionBalanceData>;

  return {
    id: typeof balance.id === "string" ? balance.id : crypto.randomUUID(),
    createdAt:
      typeof balance.createdAt === "string"
        ? balance.createdAt
        : new Date().toISOString(),
    title: typeof balance.title === "string" ? balance.title : "",
    changePros: Array.isArray(balance.changePros) ? balance.changePros : [],
    changeCons: Array.isArray(balance.changeCons) ? balance.changeCons : [],
    stayPros: Array.isArray(balance.stayPros) ? balance.stayPros : [],
    stayCons: Array.isArray(balance.stayCons) ? balance.stayCons : [],
    conclusion:
      typeof balance.conclusion === "string" ? balance.conclusion : "",
  };
}

function cleanList(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "data não registrada";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
