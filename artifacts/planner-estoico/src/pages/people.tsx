import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash2,
  Users,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface Interaction {
  id: string;
  name: string;
  context: string;
  observed: string;
  learned: string;
  nextStep: string;
  boundary: string;
}

type DailyData = {
  people?: Interaction[];
  [key: string]: any;
};

const emptyForm = (): Omit<Interaction, "id"> => ({
  name: "",
  context: "",
  observed: "",
  learned: "",
  nextStep: "",
  boundary: "",
});

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
    { label: "O que observei", value: interaction.observed },
    { label: "O que aprendi", value: interaction.learned },
    { label: "Proximo passo", value: interaction.nextStep },
    { label: "Limite ou acao futura", value: interaction.boundary },
  ].filter((f) => f.value.trim() !== "");

  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div>
          <p className="font-serif text-lg">{interaction.name}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
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
              <p className="text-xs">{f.label}</p>
              <p>{f.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function People() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [dailyData, setDailyData] = useState<DailyData>({});
  const [userId, setUserId] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      setUserId(session.user.id);

      const { data } = await supabase
        .from("daily_records")
        .select("data")
        .eq("user_id", session.user.id)
        .eq("date", dateKey)
        .maybeSingle();

      const loaded = (data?.data || {}) as DailyData;

      setDailyData(loaded);
      setInteractions(loaded.people || []);
    }

    load();
  }, [dateKey]);

  async function save(updated: Interaction[]) {
    if (!userId) return;

    const nextData = {
      ...dailyData,
      people: updated,
    };

    setInteractions(updated);
    setDailyData(nextData);

    await supabase.from("daily_records").upsert(
      {
        user_id: userId,
        date: dateKey,
        data: nextData,
      },
      { onConflict: "user_id,date" },
    );
  }

  const setField = (field: keyof Omit<Interaction, "id">, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addInteraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const updated = [{ id: crypto.randomUUID(), ...form }, ...interactions];

    save(updated);
    setForm(emptyForm());
    setShowForm(false);
  };

  const deleteInteraction = (id: string) => {
    save(interactions.filter((i) => i.id !== id));
  };

  const filtered = interactions.filter((i) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();

    return (
      i.name.toLowerCase().includes(q) ||
      i.context.toLowerCase().includes(q) ||
      i.observed.toLowerCase().includes(q) ||
      i.learned.toLowerCase().includes(q) ||
      i.nextStep.toLowerCase().includes(q) ||
      i.boundary.toLowerCase().includes(q)
    );
  });

  return (
    <Layout>
      <Header title="Pessoas" />

      <div className="p-6 space-y-6">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
        />

        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancelar" : "Nova interação"}
        </button>

        {showForm && (
          <form onSubmit={addInteraction} className="space-y-2">
            <Input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Nome"
            />
            <Textarea
              value={form.context}
              onChange={(e) => setField("context", e.target.value)}
              placeholder="Contexto"
            />
            <button type="submit">Salvar</button>
          </form>
        )}

        {filtered.map((i) => (
          <InteractionCard
            key={i.id}
            interaction={i}
            onDelete={deleteInteraction}
          />
        ))}
      </div>
    </Layout>
  );
}
