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
  repair?: string;
  nextStep: string;
  boundary: string;
  virtues?: string[];
  outcome?: "success" | "failure";
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

const VIRTUES = [
  "Silêncio",
  "Humildade",
  "Moderação",
  "Coragem",
  "Justiça",
  "Paciência",
  "Prudência",
];

const emptyForm = (): Omit<Interaction, "id"> => ({
  name: "",
  context: "",
  learned: "",
  repair: "",
  nextStep: "",
  boundary: "",
  virtues: [],
  outcome: undefined,
});

function normalizePeople(value: unknown): Interaction[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item: any) => ({
      id: item.id || crypto.randomUUID(),
      name: item.name || "",
      context: item.context || "",
      learned: item.learned || "",
      repair: item.repair || "",
      nextStep: item.nextStep || "",
      boundary: item.boundary || "",
      virtues: Array.isArray(item.virtues) ? item.virtues : [],
      outcome:
        item.outcome === "success" || item.outcome === "failure"
          ? item.outcome
          : undefined,
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

function getOutcomeLabel(outcome?: "success" | "failure") {
  if (outcome === "success") return "Acerto";
  if (outcome === "failure") return "Falha";
  return "";
}

function getInteractionCountLabel(count: number) {
  return `${count} interação${count === 1 ? "" : "es"} registrada${
    count === 1 ? "" : "s"
  }`;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
      {children}
    </span>
  );
}

function InteractionCard({
  interaction,
  onDelete,
  onEdit,
}: {
  interaction: Interaction;
  onDelete: (id: string) => void;
  onEdit: (interaction: Interaction) => void;
}) {
  const [open, setOpen] = useState(false);

  const fields = [
    { label: "O que aconteceu", value: interaction.context },
    { label: "O que aprendi", value: interaction.learned },
    { label: "Reparação", value: interaction.repair || "" },
    { label: "Próximo passo", value: interaction.nextStep },
    { label: "Limite", value: interaction.boundary },
  ].filter((f) => f.value.trim());

  const outcomeLabel = getOutcomeLabel(interaction.outcome);

  return (
    <div className="border rounded-xl bg-card">
      <div
        className="flex justify-between p-4 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="space-y-1">
          <p>{interaction.name}</p>

          <div className="flex flex-wrap gap-2">
            {interaction.virtues?.map((virtue) => (
              <Badge key={virtue}>{virtue}</Badge>
            ))}

            {outcomeLabel && <Badge>{outcomeLabel}</Badge>}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="text-xs text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(interaction);
            }}
          >
            Editar
          </button>

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
              {getInteractionCountLabel(group.items.length)}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNewInteraction(group.name)}
          className="rounded-xl border px-3 py-2 text-xs text-muted-foreground"
        >
          Nova interação
        </button>

        <button type="button" onClick={() => setOpen(!open)}>
          {open ? <ChevronUp /> : <ChevronDown />}
        </button>
      </div>

      {open && (
        <div className="border-t p-4 space-y-4">
          {group.items.map((item) => {
            const fields = [
              { label: "O que aconteceu", value: item.context },
              { label: "O que aprendi", value: item.learned },
              { label: "Reparação", value: item.repair || "" },
              { label: "Próximo passo", value: item.nextStep },
              { label: "Limite", value: item.boundary },
            ].filter((f) => f.value.trim());

            const outcomeLabel = getOutcomeLabel(item.outcome);

            return (
              <div
                key={`${item.date}-${item.id}`}
                className="rounded-xl border bg-background p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {formatDate(item.date)}
                  </p>

                  <div className="flex flex-wrap justify-end gap-2">
                    {item.virtues?.map((virtue) => (
                      <Badge key={virtue}>{virtue}</Badge>
                    ))}

                    {outcomeLabel && <Badge>{outcomeLabel}</Badge>}
                  </div>
                </div>

                {fields.map((field) => (
                  <p key={field.label} className="text-sm">
                    <span className="text-muted-foreground">
                      {field.label}:{" "}
                    </span>
                    {field.value}
                  </p>
                ))}
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
  const [showReflection, setShowReflection] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  function toggleVirtue(virtue: string) {
    setForm((f) => {
      const current = f.virtues || [];

      return {
        ...f,
        virtues: current.includes(virtue)
          ? current.filter((item) => item !== virtue)
          : [...current, virtue],
      };
    });
  }

  function setOutcome(outcome: "success" | "failure") {
    setForm((f) => ({ ...f, outcome }));
  }

  function openNewForm() {
    setEditingId(null);
    setForm(emptyForm());
    setShowReflection(false);
    setShowForm(true);
  }

  function closeForm() {
    setEditingId(null);
    setForm(emptyForm());
    setShowReflection(false);
    setShowForm(false);
  }

  function startInteractionWithPerson(name: string) {
    setEditingId(null);
    setForm({
      ...emptyForm(),
      name,
    });
    setShowReflection(false);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(interaction: Interaction) {
    setEditingId(interaction.id);

    setForm({
      name: interaction.name || "",
      context: interaction.context || "",
      learned: interaction.learned || "",
      nextStep: interaction.nextStep || "",
      boundary: interaction.boundary || "",
      repair: interaction.repair || "",
      virtues: interaction.virtues || [],
      outcome: interaction.outcome,
    });

    setShowForm(true);
    setShowReflection(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) return;

    const next = editingId
      ? interactions.map((item) =>
          item.id === editingId
            ? {
                ...item,
                name: form.name.trim(),
                context: form.context.trim(),
                learned: form.learned.trim(),
                repair: form.repair?.trim() || "",
                nextStep: form.nextStep.trim(),
                boundary: form.boundary.trim(),
                virtues: form.virtues || [],
                outcome: form.outcome,
              }
            : item,
        )
      : [
          {
            id: crypto.randomUUID(),
            name: form.name.trim(),
            context: form.context.trim(),
            learned: form.learned.trim(),
            repair: form.repair?.trim() || "",
            nextStep: form.nextStep.trim(),
            boundary: form.boundary.trim(),
            virtues: form.virtues || [],
            outcome: form.outcome,
          },
          ...interactions,
        ];

    await save(next);

    setEditingId(null);
    setForm(emptyForm());
    setShowReflection(false);
    setShowForm(false);
  }

  async function remove(id: string) {
    await save(interactions.filter((i) => i.id !== id));

    if (editingId === id) {
      setEditingId(null);
      setForm(emptyForm());
      setShowReflection(false);
      setShowForm(false);
    }
  }

  const sortedInteractions = useMemo(() => {
    return [...interactions].sort((a, b) => {
      const aFailure = a.outcome === "failure" ? 1 : 0;
      const bFailure = b.outcome === "failure" ? 1 : 0;

      const aSuccess = a.outcome === "success" ? 1 : 0;
      const bSuccess = b.outcome === "success" ? 1 : 0;

      if (bFailure !== aFailure) return bFailure - aFailure;
      if (bSuccess !== aSuccess) return bSuccess - aSuccess;

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
          <button type="button" onClick={showForm ? closeForm : openNewForm}>
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
                placeholder="O que aconteceu"
                value={form.context}
                onChange={(e) => setField("context", e.target.value)}
              />

              {!showReflection && (
                <button
                  type="button"
                  onClick={() => setShowReflection(true)}
                  className="rounded-xl border px-3 py-2 text-sm text-muted-foreground"
                >
                  Refletir mais
                </button>
              )}

              {showReflection && (
                <>
                  <div className="space-y-2 rounded-xl border p-3">
                    <p className="text-sm">Virtudes envolvidas</p>

                    <div className="flex flex-wrap gap-2">
                      {VIRTUES.map((virtue) => {
                        const selected = form.virtues?.includes(virtue);

                        return (
                          <button
                            key={virtue}
                            type="button"
                            onClick={() => toggleVirtue(virtue)}
                            className={`rounded-full border px-3 py-1 text-xs ${
                              selected
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {selected ? "✓ " : ""}
                            {virtue}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border p-3">
                    <p className="text-sm">Falha ou acerto</p>

                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="outcome"
                          checked={form.outcome === "success"}
                          onChange={() => setOutcome("success")}
                        />
                        Acerto
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="outcome"
                          checked={form.outcome === "failure"}
                          onChange={() => setOutcome("failure")}
                        />
                        Falha
                      </label>
                    </div>
                  </div>

                  <Textarea
                    placeholder="O que aprendi"
                    value={form.learned}
                    onChange={(e) => setField("learned", e.target.value)}
                  />

                  <Textarea
                    placeholder="Reparação"
                    value={form.repair || ""}
                    onChange={(e) => setField("repair", e.target.value)}
                  />

                  <Textarea
                    placeholder="Próximo passo"
                    value={form.nextStep}
                    onChange={(e) => setField("nextStep", e.target.value)}
                  />

                  <Textarea
                    placeholder="Limite"
                    value={form.boundary}
                    onChange={(e) => setField("boundary", e.target.value)}
                  />
                </>
              )}

              <button type="submit">
                {editingId ? "Salvar edição" : "Salvar"}
              </button>
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
                onEdit={startEdit}
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
              Clique em “Nova interação” para registrar uma nova interação com
              uma pessoa já conhecida.
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
