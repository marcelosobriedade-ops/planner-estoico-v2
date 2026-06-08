import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  loadMonthlyPlan,
  saveMonthlyPlan,
  getMonthKey,
  EMPTY_MONTHLY_PLAN,
} from "@/lib/monthly-plan";
import { loadYearPlan } from "@/lib/year-plan";

type MonthReading = {
  registeredDays: number;
  evaluatedNights: number;
  goodDays: number;
  failureDays: number;
  emotions: number;
  finances: number;
  people: number;
};

const EMPTY_MONTH_READING: MonthReading = {
  registeredDays: 0,
  evaluatedNights: 0,
  goodDays: 0,
  failureDays: 0,
  emotions: 0,
  finances: 0,
  people: 0,
};

type DailyRecord = Record<string, any>;

function getRequestedMonthKey() {
  const params = new URLSearchParams(window.location.search);
  const month = params.get("month");

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    return month;
  }

  return getMonthKey();
}

function normalizeVirtue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const VIRTUE_ACTION_SUGGESTIONS: Record<string, string[]> = {
  ordem: [
    "Planejar o dia antes de começar",
    "Revisar prioridades pela manhã",
    "Encerrar pendências abertas",
  ],
  resolucao: [
    "Executar a tarefa mais difícil primeiro",
    "Evitar renegociar compromissos consigo mesmo",
    "Finalizar o que começou",
  ],
  temperanca: [
    "Fazer pausas antes de reagir impulsivamente",
    "Evitar excessos durante o dia",
    "Observar desejos antes de agir",
  ],
  silencio: [
    "Ouvir antes de responder",
    "Evitar falar sem propósito",
    "Reservar momentos de observação",
  ],
  frugalidade: [
    "Evitar gastos impulsivos",
    "Comprar apenas o necessário",
    "Revisar despesas antes de decidir",
  ],
  diligencia: [
    "Utilizar bem o tempo disponível",
    "Evitar procrastinação consciente",
    "Concluir tarefas importantes antes das urgentes",
  ],
  sinceridade: [
    "Falar com honestidade",
    "Evitar exageros e distorções",
    "Alinhar discurso e ação",
  ],
  justica: [
    "Cumprir responsabilidades assumidas",
    "Agir com equidade nas decisões",
    "Evitar prejudicar outras pessoas",
  ],
  moderacao: [
    "Buscar equilíbrio diante dos extremos",
    "Evitar reações exageradas",
    "Considerar diferentes perspectivas",
  ],
  limpeza: [
    "Organizar ambiente de trabalho",
    "Cuidar da apresentação pessoal",
    "Manter espaços utilizados em ordem",
  ],
  tranquilidade: [
    "Aceitar contratempos com serenidade",
    "Reduzir preocupações desnecessárias",
    "Focar no que pode controlar",
  ],
  castidade: [
    "Utilizar a energia sexual com responsabilidade",
    "Evitar impulsividade",
    "Agir com respeito por si e pelos outros",
  ],
  humildade: [
    "Reconhecer limitações",
    "Aceitar correções sem defensividade",
    "Valorizar o aprendizado contínuo",
  ],
};

export default function Month() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [monthKey, setMonthKey] = useState(getRequestedMonthKey());
  const [plan, setPlan] = useState(EMPTY_MONTHLY_PLAN);
  const [yearContext, setYearContext] = useState<any>(null);
  const [monthReading, setMonthReading] =
    useState<MonthReading>(EMPTY_MONTH_READING);

  const selectedVirtue = normalizeVirtue(plan.virtue);
  const virtueSuggestions = VIRTUE_ACTION_SUGGESTIONS[selectedVirtue];
  const monthSynthesis = getMonthSynthesis(monthReading);

  const yearContextItems = [
    {
      label: "Mapa dos Sonhos",
      value: yearContext?.dreamMap,
    },
    {
      label: "O que quero construir",
      value: yearContext?.buildNextYear,
    },
    {
      label: "O que quero viver",
      value: yearContext?.liveNextYear,
    },
    {
      label: "O que quero conquistar",
      value: yearContext?.conquerNextYear,
    },
  ].filter((item) => hasFilledValue(item.value));

  useEffect(() => {
    async function init() {
      const requestedMonthKey = getRequestedMonthKey();
      const result = await loadMonthlyPlan(requestedMonthKey);
      const yearKey = result.monthKey.slice(0, 4);
      const yearResult = await loadYearPlan(yearKey);

      setUserId(result.userId);
      setMonthKey(result.monthKey);
      setPlan(result.plan);
      setYearContext(yearResult.plan);

      setLoading(false);
    }

    init();
  }, []);

  useEffect(() => {
    if (!userId || !monthKey) return;

    async function loadMonthReading() {
      const [year, month] = monthKey.split("-").map(Number);
      const firstDay = `${monthKey}-01`;
      const lastDay = new Date(year, month, 0).toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("daily_records")
        .select("*")
        .eq("user_id", userId)
        .gte("date", firstDay)
        .lte("date", lastDay);

      if (error || !data) {
        setMonthReading(EMPTY_MONTH_READING);
        return;
      }

      const records = data as DailyRecord[];

      setMonthReading({
        registeredDays: records.length,

        evaluatedNights: records.filter((record) =>
          hasAnyValue(getRecordData(record), [
            "nightRating",
            "night_rating",
            "sleepQuality",
            "sleep_quality",
            "nightReview",
            "night_review",
            "evening",
          ]),
        ).length,

        goodDays: records.filter((record) => isGoodDay(getRecordData(record)))
          .length,

        failureDays: records.filter((record) =>
          isFailureDay(getRecordData(record)),
        ).length,

        emotions: records.reduce(
          (total, record) =>
            total +
            countRecordItems(getRecordData(record), [
              "emotions",
              "emotion",
              "registeredEmotions",
              "registered_emotions",
            ]),
          0,
        ),

        finances: records.reduce(
          (total, record) =>
            total +
            countRecordItems(getRecordData(record), [
              "finances",
              "finance",
              "financial",
              "financialRecords",
              "financial_records",
            ]),
          0,
        ),

        people: records.reduce(
          (total, record) =>
            total +
            countRecordItems(getRecordData(record), [
              "people",
              "persons",
              "peopleRecords",
              "people_records",
            ]),
          0,
        ),
      });
    }

    loadMonthReading();
  }, [userId, monthKey]);

  async function handleSave() {
    if (!userId) return;

    await saveMonthlyPlan(userId, monthKey, plan);

    alert("Mês salvo");
  }

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <a
        href="/"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        ← Home
      </a>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Mês</h1>
        <p className="text-gray-500 mt-2">
          Defina a direção do ciclo que deseja construir.
        </p>
        <p className="text-sm font-medium text-gray-700 mt-3">{monthKey}</p>
      </div>

      {yearContextItems.length > 0 && (
        <div className="border rounded-2xl p-6 bg-gray-50 mb-6 space-y-4">
          <h2 className="text-xl font-bold">Contexto do Ano</h2>

          <div className="space-y-4">
            {yearContextItems.map((item) => (
              <div key={item.label}>
                <h3 className="font-semibold mb-1">{item.label}</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border rounded-2xl p-6 bg-white space-y-6">
        <div>
          <label className="block font-semibold mb-1">Visão do Mês</label>
          <p className="text-sm text-gray-500 mb-2">
            Quero que este seja o mês em que...
          </p>
          <textarea
            className="w-full border rounded p-3 min-h-[120px]"
            placeholder="Visão do mês"
            value={plan.vision}
            onChange={(e) =>
              setPlan({
                ...plan,
                vision: e.target.value,
              })
            }
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">
            Transformação Esperada
          </label>
          <p className="text-sm text-gray-500 mb-2">
            Quem desejo me tornar ao final deste mês?
          </p>
          <textarea
            className="w-full border rounded p-3 min-h-[120px]"
            placeholder="Transformação Esperada"
            value={plan.expectedTransformation}
            onChange={(e) =>
              setPlan({
                ...plan,
                expectedTransformation: e.target.value,
              })
            }
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Objetivo Principal</label>
          <p className="text-sm text-gray-500 mb-2">
            O principal resultado que desejo construir.
          </p>
          <textarea
            className="w-full border rounded p-3 min-h-[120px]"
            placeholder="Objetivo Principal"
            value={plan.mainGoal}
            onChange={(e) =>
              setPlan({
                ...plan,
                mainGoal: e.target.value,
              })
            }
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Principal Risco</label>
          <p className="text-sm text-gray-500 mb-2">
            O que pode comprometer este mês?
          </p>
          <textarea
            className="w-full border rounded p-3 min-h-[120px]"
            placeholder="Principal Risco"
            value={plan.mainRisk}
            onChange={(e) =>
              setPlan({
                ...plan,
                mainRisk: e.target.value,
              })
            }
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Virtude do Mês</label>
          <p className="text-sm text-gray-500 mb-2">
            Qual virtude desejo cultivar conscientemente?
          </p>
          <textarea
            className="w-full border rounded p-3 min-h-[120px]"
            placeholder="Virtude do Mês"
            value={plan.virtue}
            onChange={(e) =>
              setPlan({
                ...plan,
                virtue: e.target.value,
              })
            }
          />
        </div>

        {selectedVirtue && (
          <div className="border rounded-xl p-4 bg-gray-50">
            <h2 className="font-semibold mb-3">Formas de agir sugeridas</h2>

            {virtueSuggestions ? (
              <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                {virtueSuggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">
                Nenhuma sugestão disponível para esta virtude.
              </p>
            )}
          </div>
        )}

        <div className="border-t pt-6">
          <h2 className="text-xl font-bold mb-4">Reflexão de Fechamento</h2>

          <label className="block font-semibold mb-1">
            Reflexão de Fechamento
          </label>
          <p className="text-sm text-gray-500 mb-2">
            O que este mês me ensinou?
          </p>
          <textarea
            className="w-full border rounded p-3 min-h-[120px]"
            placeholder="Reflexão de Fechamento"
            value={plan.monthlyReview}
            onChange={(e) =>
              setPlan({
                ...plan,
                monthlyReview: e.target.value,
              })
            }
          />
        </div>

        <div className="border-t pt-6">
          <h2 className="text-xl font-bold mb-1">Leitura do Mês</h2>
          <p className="text-sm text-gray-500 mb-4">
            Um retrato simples do ciclo vivido.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ReadingItem
              label="Dias registrados"
              value={monthReading.registeredDays}
            />

            <ReadingItem
              label="Noites avaliadas"
              value={monthReading.evaluatedNights}
            />

            <ReadingItem label="Dias bons" value={monthReading.goodDays} />

            <ReadingItem
              label="Dias de falha"
              value={monthReading.failureDays}
            />

            <ReadingItem
              label="Emoções registradas"
              value={monthReading.emotions}
            />

            <ReadingItem
              label="Registros financeiros"
              value={monthReading.finances}
            />

            <ReadingItem
              label="Registros de pessoas"
              value={monthReading.people}
            />
          </div>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-xl font-bold mb-1">Síntese do Mês</h2>
          <p className="text-sm text-gray-500 mb-4">
            Uma interpretação simples do ciclo vivido.
          </p>

          <p className="text-sm text-gray-700 leading-relaxed">
            {monthSynthesis}
          </p>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-xl font-bold mb-1">Ajuste para o Próximo Mês</h2>
          <p className="text-sm text-gray-500 mb-4">
            O que devo manter, abandonar ou ajustar no próximo ciclo?
          </p>

          <textarea
            className="w-full border rounded p-3 min-h-[120px]"
            placeholder="Ajuste para o Próximo Mês"
            value={plan.monthlyClosure}
            onChange={(e) =>
              setPlan({
                ...plan,
                monthlyClosure: e.target.value,
              })
            }
          />
        </div>

        <button onClick={handleSave} className="px-4 py-2 border rounded">
          Salvar
        </button>
      </div>
    </div>
  );
}

function ReadingItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-xl p-4 bg-gray-50">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function getMonthSynthesis(monthReading: MonthReading) {
  const synthesis: string[] = [];

  if (monthReading.registeredDays >= 20) {
    synthesis.push("Você manteve boa consistência de registros durante o mês.");
  } else if (monthReading.registeredDays >= 10) {
    synthesis.push(
      "Você registrou parte importante do mês, mas ainda há lacunas na observação.",
    );
  } else {
    synthesis.push("Há poucos registros para compreender o mês com clareza.");
  }

  if (monthReading.evaluatedNights >= 15) {
    synthesis.push("Você dedicou atenção frequente à reflexão noturna.");
  } else if (monthReading.evaluatedNights >= 5) {
    synthesis.push("Há alguma prática de reflexão, mas ainda irregular.");
  } else {
    synthesis.push("A reflexão noturna apareceu poucas vezes.");
  }

  if (monthReading.emotions > 20) {
    synthesis.push("As emoções tiveram presença significativa no mês.");
  } else if (monthReading.emotions >= 5) {
    synthesis.push("As emoções foram observadas em alguns momentos.");
  } else {
    synthesis.push("O registro emocional foi pouco explorado.");
  }

  if (monthReading.people > 10) {
    synthesis.push("As relações tiveram presença relevante no ciclo.");
  } else if (monthReading.people >= 1) {
    synthesis.push("As relações apareceram ocasionalmente.");
  } else {
    synthesis.push("As relações praticamente não apareceram nos registros.");
  }

  if (monthReading.finances > 10) {
    synthesis.push("A dimensão financeira recebeu atenção constante.");
  } else if (monthReading.finances >= 1) {
    synthesis.push("A dimensão financeira apareceu em alguns momentos.");
  } else {
    synthesis.push("As finanças não receberam registros neste ciclo.");
  }

  return synthesis.join(" ");
}

function getRecordData(record: DailyRecord) {
  return record.data && typeof record.data === "object" ? record.data : record;
}

function hasAnyValue(record: DailyRecord, keys: string[]) {
  return keys.some((key) => {
    const value = record[key];

    return value !== null && value !== undefined && value !== "";
  });
}

function countRecordItems(record: DailyRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value.length;
    }

    if (value && typeof value === "object") {
      return Object.keys(value).length;
    }

    if (typeof value === "string" && value.trim()) {
      return 1;
    }

    if (typeof value === "number") {
      return value;
    }
  }

  return 0;
}

function isGoodDay(record: DailyRecord) {
  const value =
    record.dayStatus ??
    record.day_status ??
    record.dayResult ??
    record.day_result ??
    record.status;

  return ["bom", "good", "success", "sucesso"].includes(
    String(value ?? "").toLowerCase(),
  );
}

function isFailureDay(record: DailyRecord) {
  const value =
    record.dayStatus ??
    record.day_status ??
    record.dayResult ??
    record.day_result ??
    record.status;

  return ["falha", "failure", "fail", "erro"].includes(
    String(value ?? "").toLowerCase(),
  );
}

function hasFilledValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}
