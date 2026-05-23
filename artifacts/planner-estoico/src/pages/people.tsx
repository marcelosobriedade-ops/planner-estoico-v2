import React, { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Interaction {
  id: string;
  name: string;
  context: string;
  learned: string;
  nextStep: string;
  boundary: string;
}

type DailyData = {
  people?: Interaction[];
  [key: string]: any;
};

type DailyRecord = {
  date: string;
  data: DailyData;
};

type PersonHistoryItem = Interaction & {
  date: string;
};

type PersonHistoryGroup = {
  name: string;
  items: PersonHistoryItem[];
};

const emptyForm = (): Omit<Interaction, "id"> => ({
  name: "",
  context: "",
  learned: "",
  nextStep: "",
  boundary: "",
});

function normalizePeople(value: unknown): Interaction[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item: any) => ({
      id: item.id || crypto.randomUUID(),
      name: item.name || "",
      context: item.context || "",
      learned: item.learned || "",
      nextStep: item.nextStep || "",
      boundary: item.boundary || "",
    }))
    .filter((item) => item.name.trim());
}

function formatDate(dateKey: string) {
  return new Date(dateKey + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getPersonSignal(interaction: Interaction) {
  const helped = interaction.learned.trim();
  const drained = interaction.boundary.trim();

  if (helped && drained) return "Ajudou e drenou";
  if (drained) return "Drenou";
  if (helped) return "Ajudou";
  return "";
}

function InteractionCard({
  interaction,
  onDelete,
}: {
  interaction: Interaction;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const fields = [
    { label: "Contexto", value: interaction.context },
    { label: "O que aprendi", value: interaction.learned },
    { label: "Próximo passo", value: interaction.nextStep },
    { label: "Limite", value: interaction.boundary },
  ].filter((f) => f.value.trim());

  return (
    <div className="border rounded-xl bg-card">
      <div
        className="flex justify-between p-4 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="space-y-1">
          <p>{interaction.name}</p>

          <div className="flex gap-2">
            {interaction.learned.trim() && (
              <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                Ajudou
              </span>
            )}

            {interaction.boundary.trim() && (
              <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                Drenou
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(interaction.id);
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {open ? <ChevronUp /> : <ChevronDown />}
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-2">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="text-sm">{f.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonHistoryCard({
  group,
  onNewInteraction,
}: {
  group: PersonHistoryGroup;
  onNewInteraction: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const helpedCount = group.items.filter((item) => item.learned.trim()).length;
  const drainedCount = group.items.filter((item) =>
    item.boundary.trim(),
  ).length;

  return (
    <div className="border rounded-xl bg-card">
      <div className="flex items-center justify-between p-4 gap-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex-1 text-left"
        >
          <div className="space-y-1">
            <p className="font-serif text-lg">{group.name}</p>

            <p className="text-xs text-muted-foreground">
              {group.items.length} interação
              {group.items.length === 1 ? "" : "es"}
              {helpedCount > 0 ? ` · ${helpedCount} ajudou` : ""}
              {drainedCount > 0 ? ` · ${drainedCount} drenou` : ""}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNewInteraction(group.name)}
          className="rounded-xl border px-3 py-2 text-xs text-muted-foreground"
        >
          Nova
        </button>

        <button type="button" onClick={() => setOpen(!open)}>
          {open ? <ChevronUp /> : <ChevronDown />}
        </button>
      </div>

      {open && (
        <div className="border-t p-4 space-y-4">
          {group.items.map((item) => {
            const signal = getPersonSignal(item);

            return (
              <div
                key={`${item.date}-${item.id}`}
                className="rounded-xl border bg-background p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {formatDate(item.date)}
                  </p>

                  {signal && (
                    <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                      {signal}
                    </span>
                  )}
                </div>

                {item.context && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Contexto: </span>
                    {item.context}
                  </p>
                )}

                {item.learned && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">
                      O que aprendi:{" "}
                    </span>
                    {item.learned}
                  </p>
                )}

                {item.nextStep && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">
                      Próximo passo:{" "}
                    </span>
                    {item.nextStep}
                  </p>
                )}

                {item.boundary && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Limite: </span>
                    {item.boundary}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function People() {
  const [dateKey] = useLocalStorage(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState("");

  async function reload() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    const { data: currentDay } = await supabase
      .from("daily_records")
      .select("data")
      .eq("user_id", session.user.id)
      .eq("date", dateKey)
      .maybeSingle();

    const people = normalizePeople(currentDay?.data?.people);
    setInteractions(people);

    const { data: allRecords, error } = await supabase
      .from("daily_records")
      .select("date, data")
      .eq("user_id", session.user.id)
      .order("date", { ascending: false });

    if (error) {
      console.error("Erro ao carregar histórico de pessoas:", error);
      setStatus("Erro ao carregar histórico.");
      return;
    }

    setRecords((allRecords || []) as DailyRecord[]);
  }

  useEffect(() => {
    reload();
  }, [dateKey]);

  async function save(next: Interaction[]) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    setStatus("Salvando...");

    const { data } = await supabase
      .from("daily_records")
      .select("data")
      .eq("user_id", session.user.id)
      .eq("date", dateKey)
      .maybeSingle();

    const latest = data?.data || {};

    const { error } = await supabase.from("daily_records").upsert(
      {
        user_id: session.user.id,
        date: dateKey,
        data: {
          ...latest,
          people: next,
        },
      },
      { onConflict: "user_id,date" },
    );

    if (!error) {
      await reload();
      setStatus("Salvo");
    } else {
      console.error("Erro ao salvar pessoas:", error);
      setStatus("Erro ao salvar.");
    }
  }

  function setField(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function startInteractionWithPerson(name: string) {
    setForm({
      ...emptyForm(),
      name,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) return;

    const next = [
      {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        context: form.context.trim(),
        learned: form.learned.trim(),
        nextStep: form.nextStep.trim(),
        boundary: form.boundary.trim(),
      },
      ...interactions,
    ];

    await save(next);

    setForm(emptyForm());
    setShowForm(false);
  }

  async function remove(id: string) {
    await save(interactions.filter((i) => i.id !== id));
  }

  const sortedInteractions = useMemo(() => {
    return [...interactions].sort((a, b) => {
      const aDrain = a.boundary.trim() ? 1 : 0;
      const bDrain = b.boundary.trim() ? 1 : 0;

      const aHelp = a.learned.trim() ? 1 : 0;
      const bHelp = b.learned.trim() ? 1 : 0;

      if (bDrain !== aDrain) return bDrain - aDrain;
      if (bHelp !== aHelp) return bHelp - aHelp;

      return 0;
    });
  }, [interactions]);

  const historyGroups = useMemo(() => {
    const map: Record<string, PersonHistoryGroup> = {};

    records.forEach((record) => {
      const people = normalizePeople(record.data?.people);

      people.forEach((interaction) => {
        const key = interaction.name.trim().toLowerCase();

        if (!key) return;

        if (!map[key]) {
          map[key] = {
            name: interaction.name.trim(),
            items: [],
          };
        }

        map[key].items.push({
          ...interaction,
          date: record.date,
        });
      });
    });

    return Object.values(map).sort((a, b) => b.items.length - a.items.length);
  }, [records]);

  return (
    <Layout>
      <Header title="Pessoas" />

      <div className="p-5 space-y-5">
        <p className="text-sm text-muted-foreground">{status}</p>

        <section className="space-y-3">
          <button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancelar" : "Nova interação"}
          </button>

          {showForm && (
            <form onSubmit={add} className="space-y-3">
              <Input
                placeholder="Pessoa"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />

              <Textarea
                placeholder="Contexto"
                value={form.context}
                onChange={(e) => setField("context", e.target.value)}
              />

              <Textarea
                placeholder="O que aprendi"
                value={form.learned}
                onChange={(e) => setField("learned", e.target.value)}
              />

              <Textarea
                placeholder="Próximo passo"
                value={form.nextStep}
                onChange={(e) => setField("nextStep", e.target.value)}
              />

              <Textarea
                placeholder="Limite ou ação futura"
                value={form.boundary}
                onChange={(e) => setField("boundary", e.target.value)}
              />

              <button type="submit">Salvar</button>
            </form>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <p className="font-serif text-lg">Interações do dia</p>
            <p className="text-xs text-muted-foreground">
              Registros salvos para a data atual.
            </p>
          </div>

          {sortedInteractions.length > 0 ? (
            sortedInteractions.map((interaction) => (
              <InteractionCard
                key={interaction.id}
                interaction={interaction}
                onDelete={remove}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma interação registrada neste dia.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <p className="font-serif text-lg">Histórico por pessoa</p>
            <p className="text-xs text-muted-foreground">
              Clique em “Nova” para registrar uma nova interação com uma pessoa
              já conhecida.
            </p>
          </div>

          {historyGroups.length > 0 ? (
            historyGroups.map((group) => (
              <PersonHistoryCard
                key={group.name}
                group={group}
                onNewInteraction={startInteractionWithPerson}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Ainda não há histórico de pessoas.
            </p>
          )}
        </section>
      </div>
    </Layout>
  );
}
