import { useEffect, useState } from "react";
import {
  EMPTY_YEAR_PLAN,
  loadYearPlan,
  saveYearPlan,
  getYearKey,
} from "@/lib/year-plan";

function getRequestedYearKey() {
  const params = new URLSearchParams(window.location.search);
  const year = params.get("year");

  if (year && /^\d{4}$/.test(year)) {
    return year;
  }

  return getYearKey();
}

function shiftYear(yearKey: string, amount: number) {
  return String(Number(yearKey) + amount);
}

export default function Year() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [yearKey, setYearKey] = useState(getRequestedYearKey());
  const [plan, setPlan] = useState(EMPTY_YEAR_PLAN);

  async function loadYear(targetYear: string) {
    setLoading(true);

    const result = await loadYearPlan(targetYear);

    setUserId(result.userId);
    setYearKey(result.yearKey);
    setPlan(result.plan);
    setLoading(false);

    window.history.replaceState(null, "", `/ano?year=${result.yearKey}`);
  }

  useEffect(() => {
    loadYear(getRequestedYearKey());
  }, []);

  async function handleSave() {
    if (!userId) return;

    await saveYearPlan(userId, yearKey, plan);
    alert("Ano salvo");
  }

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <a
        href="/"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900"
      >
        ← Home
      </a>

      <div>
        <h1 className="text-3xl font-bold">Ano</h1>
        <p className="text-gray-500 mt-2">
          Retrospectiva, visão e direção do ciclo anual.
        </p>

        <div className="flex items-center gap-4 mt-3">
          <button
            type="button"
            onClick={() => loadYear(shiftYear(yearKey, -1))}
            className="px-3 py-1 border rounded"
          >
            ←
          </button>

          <p className="text-sm font-medium text-gray-700">{yearKey}</p>

          <button
            type="button"
            onClick={() => loadYear(shiftYear(yearKey, 1))}
            className="px-3 py-1 border rounded"
          >
            →
          </button>
        </div>
      </div>

      <Section title="Retrospectiva do Ano">
        <Field
          label="Principais acontecimentos"
          value={plan.mainEvents}
          onChange={(value) => setPlan({ ...plan, mainEvents: value })}
        />

        <Field
          label="Melhores momentos"
          value={plan.bestMoments}
          onChange={(value) => setPlan({ ...plan, bestMoments: value })}
        />

        <Field
          label="Conquistas"
          value={plan.achievements}
          onChange={(value) => setPlan({ ...plan, achievements: value })}
        />

        <Field
          label="Aprendizados"
          value={plan.learnings}
          onChange={(value) => setPlan({ ...plan, learnings: value })}
        />

        <Field
          label="Pessoas marcantes"
          value={plan.importantPeople}
          onChange={(value) => setPlan({ ...plan, importantPeople: value })}
        />

        <Field
          label="Gratidão"
          value={plan.gratitude}
          onChange={(value) => setPlan({ ...plan, gratitude: value })}
        />
      </Section>

      <Section title="Próximo Ano">
        <Field
          label="Mapa dos Sonhos"
          value={plan.dreamMap}
          onChange={(value) => setPlan({ ...plan, dreamMap: value })}
        />

        <Field
          label="O que quero construir"
          value={plan.buildNextYear}
          onChange={(value) => setPlan({ ...plan, buildNextYear: value })}
        />

        <Field
          label="O que quero viver"
          value={plan.liveNextYear}
          onChange={(value) => setPlan({ ...plan, liveNextYear: value })}
        />

        <Field
          label="O que quero conquistar"
          value={plan.conquerNextYear}
          onChange={(value) => setPlan({ ...plan, conquerNextYear: value })}
        />
      </Section>

      <Section title="Direções do Ano">
        <Field
          label="Saúde"
          value={plan.health}
          onChange={(value) => setPlan({ ...plan, health: value })}
        />

        <Field
          label="Relacionamentos"
          value={plan.relationships}
          onChange={(value) => setPlan({ ...plan, relationships: value })}
        />

        <Field
          label="Finanças"
          value={plan.finances}
          onChange={(value) => setPlan({ ...plan, finances: value })}
        />

        <Field
          label="Trabalho / Projeto"
          value={plan.workProject}
          onChange={(value) => setPlan({ ...plan, workProject: value })}
        />

        <Field
          label="Espiritualidade"
          value={plan.spirituality}
          onChange={(value) => setPlan({ ...plan, spirituality: value })}
        />
      </Section>

      <button onClick={handleSave} className="px-4 py-2 border rounded">
        Salvar
      </button>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border rounded-2xl p-6 bg-white space-y-5">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block font-semibold mb-2">{label}</label>
      <textarea
        className="w-full border rounded p-3 min-h-[100px]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
