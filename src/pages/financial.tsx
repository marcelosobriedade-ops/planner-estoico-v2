import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Transaction {
  id: string;
  type: "income" | "expense";
  description: string;
  amount: number;

  emotion?: string;
  trigger?: string;
  refinedEmotion?: string;
  financialNeed?: string;
}

type WeeklyFinancialInsight = {
  totalExpenses: number;
  topEmotion: [string, number] | null;
  topNeed: [string, number] | null;
  topTrigger: [string, number] | null;
};

type DailyData = {
  financial?: Transaction[];
  [key: string]: any;
};

function FinancialLessonCard({
  emotion,
  emotionLabels,
}: {
  emotion: string;
  emotionLabels: Record<string, string>;
}) {
  const lesson = FINANCIAL_LESSONS[emotion];

  if (!lesson) return null;

  return (
    <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-4">
      <div className="space-y-1">
        <p className="font-serif text-lg">Aprendendo sobre dinheiro</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Microlição conectada ao padrão emocional mais presente nas suas decisões financeiras.
        </p>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-primary/70">
          {emotionLabels[emotion] || emotion}
        </p>

        <p className="font-serif text-base text-foreground">{lesson.title}</p>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {lesson.lesson}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-primary/70">
          Atenções possíveis
        </p>

        <div className="space-y-1">
          {lesson.risks.map((risk) => (
            <p key={risk} className="text-xs text-muted-foreground">
              • {risk}
            </p>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-background/40 p-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="text-foreground">Pergunta:</span> {lesson.question}
        </p>
      </div>
    </section>
  );
}

function WeeklyFinancialInsightCard({
  insight,
  emotionLabels,
}: {
  insight: WeeklyFinancialInsight;
  emotionLabels: Record<string, string>;
}) {
  const emotionText = insight.topEmotion
    ? emotionLabels[insight.topEmotion[0]] || insight.topEmotion[0]
    : "";

  return (
    <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-4">
      <div className="space-y-1">
        <p className="font-serif text-lg">Insight financeiro semanal</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Uma leitura dos últimos 7 dias para entender como emoção, necessidade e dinheiro estão se conectando.
        </p>
      </div>

      {insight.totalExpenses === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda não há despesas suficientes nesta semana para gerar um insight.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            Você registrou {insight.totalExpenses} despesa
            {insight.totalExpenses === 1 ? "" : "s"} nos últimos 7 dias.
          </p>

          <div className="rounded-xl border border-border/40 bg-background/40 p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-primary/70">
              Padrão mais forte
            </p>
            <p className="text-sm text-foreground">
              {insight.topEmotion
                ? `${emotionText} apareceu ${insight.topEmotion[1]} vez${insight.topEmotion[1] === 1 ? "" : "es"} associado a despesas.`
                : "Ainda não há emoção predominante associada às despesas."}
            </p>
          </div>

          <div className="rounded-xl border border-border/40 bg-background/40 p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-primary/70">
              Busca mais comum
            </p>
            <p className="text-sm text-foreground">
              {insight.topNeed
                ? `${insight.topNeed[0]} apareceu como busca financeira principal.`
                : "Ainda não há busca financeira predominante."}
            </p>
          </div>

          <div className="rounded-xl border border-border/40 bg-background/40 p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-primary/70">
              Gatilho recorrente
            </p>
            <p className="text-sm text-foreground">
              {insight.topTrigger
                ? `${insight.topTrigger[0]} foi o gatilho mais frequente.`
                : "Ainda não há gatilho predominante."}
            </p>
          </div>

          <p className="font-serif italic text-sm text-muted-foreground">
            O objetivo não é julgar o gasto. É perceber o padrão antes que ele decida por você.
          </p>
        </div>
      )}
    </section>
  );
}

function getPastDateKey(dateKey: string, daysBack: number) {
  const date = new Date(dateKey + "T12:00:00");
  date.setDate(date.getDate() - daysBack);
  return date.toISOString().slice(0, 10);
}

function summarizeWeeklyFinancialInsight(
  records: { data: DailyData }[],
): WeeklyFinancialInsight {
  const expenses = records.flatMap((record) =>
    (record.data?.financial || []).filter((transaction) => transaction.type === "expense"),
  );

  return {
    totalExpenses: expenses.length,
    topEmotion: getTopItem(expenses.map((transaction) => transaction.emotion || "")),
    topNeed: getTopItem(expenses.map((transaction) => transaction.financialNeed || "")),
    topTrigger: getTopItem(expenses.map((transaction) => transaction.trigger || "")),
  };
}


const FINANCIAL_LESSONS: Record<
  string,
  {
    title: string;
    lesson: string;
    risks: string[];
    question: string;
  }
> = {
  medo: {
    title: "Medo e dinheiro",
    lesson:
      "Quando sentimos insegurança, é comum buscarmos controle financeiro. Isso pode ser prudente, mas também pode virar medo de decidir.",
    risks: ["excesso de controle", "dificuldade de investir", "adiamento de decisões"],
    question: "O que hoje é prudência e o que hoje é medo?",
  },
  tristeza: {
    title: "Tristeza e consumo",
    lesson:
      "Quando estamos emocionalmente cansados, o cérebro procura alívio. Algumas compras funcionam como anestesia temporária.",
    risks: ["comprar para aliviar", "buscar recompensa imediata", "ignorar a necessidade real"],
    question: "Você está comprando algo ou tentando sentir algo?",
  },
  raiva: {
    title: "Raiva e dinheiro",
    lesson:
      "A raiva costuma buscar reparação ou controle. No dinheiro, isso pode aparecer como gasto impulsivo ou decisão precipitada.",
    risks: ["compras por impulso", "decisões reativas", "riscos desnecessários"],
    question: "Você está respondendo com consciência ou apenas reagindo?",
  },
  alegria: {
    title: "Alegria e dinheiro",
    lesson:
      "A alegria pode favorecer generosidade, celebração e gratidão. Mas também pode levar a gastos sem presença.",
    risks: ["exagerar na celebração", "confundir alegria com consumo", "perder clareza"],
    question: "Esse gasto celebra algo real ou tenta prolongar uma sensação?",
  },
  amor: {
    title: "Amor, cuidado e dinheiro",
    lesson:
      "O amor pode aparecer como cuidado financeiro, presente ou apoio. Mas cuidar não deve significar se abandonar.",
    risks: ["gastar para agradar", "dificuldade de dizer não", "confundir afeto com sacrifício"],
    question: "Esse cuidado também respeita seus limites?",
  },
  nojo: {
    title: "Nojo, limite e dinheiro",
    lesson:
      "O nojo pode indicar rejeição, desconforto ou valor violado. No dinheiro, pode aparecer como afastamento de algo que não combina com você.",
    risks: ["decidir por repulsa", "evitar olhar para números", "reagir sem clareza"],
    question: "Que limite essa sensação está tentando proteger?",
  },
  surpresa: {
    title: "Surpresa e decisão financeira",
    lesson:
      "A surpresa interrompe o esperado. Em decisões financeiras, o inesperado pode gerar pressa ou confusão.",
    risks: ["decidir rápido demais", "agir sem informação", "confundir urgência com importância"],
    question: "Você precisa decidir agora ou pode entender melhor primeiro?",
  },
  confusão: {
    title: "Confusão e dinheiro",
    lesson:
      "A confusão aparece quando emoções e informações se misturam. No financeiro, isso pode levar à evitação ou decisões automáticas.",
    risks: ["evitar olhar a realidade", "postergar decisões", "seguir impulso para encerrar desconforto"],
    question: "Qual é a menor informação que traria mais clareza agora?",
  },
};


function getTopItem(items: string[]) {
  const counts = new Map<string, number>();

  items.filter(Boolean).forEach((item) => {
    counts.set(item, (counts.get(item) || 0) + 1);
  });

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || null;
}

export default function Financial() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dailyData, setDailyData] = useState<DailyData>({});
  const [userId, setUserId] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [emotion, setEmotion] = useState("");
  const [trigger, setTrigger] = useState("");
  const [refinedEmotion, setRefinedEmotion] = useState("");
  const [financialNeed, setFinancialNeed] = useState("");
  const [weeklyInsight, setWeeklyInsight] = useState<WeeklyFinancialInsight>({
    totalExpenses: 0,
    topEmotion: null,
    topNeed: null,
    topTrigger: null,
  });

  const emotions = [
    "alegria",
    "amor",
    "medo",
    "tristeza",
    "raiva",
    "nojo",
    "surpresa",
    "confusão",
  ];

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

  const refinedEmotionOptions: Record<string, string[]> = {
    alegria: ["grato", "animado", "satisfeito", "esperançoso", "orgulhoso"],
    amor: ["acolhido", "conectado", "cuidadoso", "terno", "saudoso"],
    medo: ["inseguro", "ameaçado", "exposto", "desprotegido", "ansioso"],
    tristeza: ["abandonado", "desvalorizado", "solitário", "incapaz", "desanimado"],
    raiva: ["ofendido", "injustiçado", "desrespeitado", "violado", "frustrado"],
    nojo: ["repelido", "invadido", "saturado", "desconfortável", "aversivo"],
    surpresa: ["impactado", "curioso", "desorientado", "impressionado", "alerta"],
    confusão: ["indefinido", "ambivalente", "sobrecarregado", "perdido", "dividido"],
  };

  const triggers = [
    "cansaço",
    "estresse",
    "pressão social",
    "urgência",
    "comparação",
    "recompensa",
    "necessidade real",
    "evitação",
  ];

  const financialNeeds = [
    "segurança",
    "alívio",
    "recompensa",
    "conforto",
    "controle",
    "pertencimento",
    "status",
    "necessidade real",
  ];

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
      setTransactions(loaded.financial || []);

      const startDate = getPastDateKey(dateKey, 6);

      const { data: weekRecords, error: weekError } = await supabase
        .from("daily_records")
        .select("data")
        .eq("user_id", session.user.id)
        .gte("date", startDate)
        .lte("date", dateKey);

      if (weekError) {
        console.error("Erro ao carregar insight financeiro semanal:", weekError);
      } else {
        setWeeklyInsight(
          summarizeWeeklyFinancialInsight(
            (weekRecords || []) as { data: DailyData }[],
          ),
        );
      }
    }

    load();
  }, [dateKey]);

  async function save(updated: Transaction[]) {
    if (!userId) return;

    const { data: latest } = await supabase
      .from("daily_records")
      .select("data")
      .eq("user_id", userId)
      .eq("date", dateKey)
      .maybeSingle();

    const latestData = (latest?.data || {}) as DailyData;

    const nextData = {
      ...latestData,
      financial: updated,
    };

    setTransactions(updated);
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

  const addTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;

    const value = parseFloat(amount.replace(",", "."));
    if (isNaN(value)) return;

    const updated = [
      {
        id: crypto.randomUUID(),
        type,
        description: description.trim(),
        amount: value,
        emotion,
        trigger,
        refinedEmotion,
        financialNeed,
      },
      ...transactions,
    ];

    save(updated);
    setDescription("");
    setAmount("");
    setEmotion("");
    setTrigger("");
    setRefinedEmotion("");
    setFinancialNeed("");
  };

  const deleteTransaction = (id: string) => {
    save(transactions.filter((t) => t.id !== id));
  };

  const balance = transactions.reduce((acc, t) => {
    return acc + (t.type === "income" ? t.amount : -t.amount);
  }, 0);

  const expenseTransactions = transactions.filter((t) => t.type === "expense");

  const topEmotion = getTopItem(expenseTransactions.map((t) => t.emotion || ""));
  const topNeed = getTopItem(expenseTransactions.map((t) => t.financialNeed || ""));
  const topTrigger = getTopItem(expenseTransactions.map((t) => t.trigger || ""));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Layout>
      <Header title="Financeiro" />

      <div className="flex-1 p-6 flex flex-col gap-8 overflow-y-auto">
        <div className="bg-primary text-white p-6 rounded-2xl text-center">
          <p className="text-xs uppercase">Balanço Diário</p>
          <h2 className="text-3xl">{formatCurrency(balance)}</h2>
        </div>

        <WeeklyFinancialInsightCard
          insight={weeklyInsight}
          emotionLabels={emotionLabels}
        />

        {topEmotion && (
          <FinancialLessonCard
            emotion={topEmotion[0]}
            emotionLabels={emotionLabels}
          />
        )}

        <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-4">
          <div className="space-y-1">
            <p className="font-serif text-lg">Radar comportamental financeiro</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Uma leitura dos padrões emocionais por trás das suas despesas de hoje.
            </p>
          </div>

          {expenseTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Registre uma despesa para começar a enxergar padrões.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-border/40 bg-background/40 p-3">
                <p className="text-[10px] uppercase tracking-widest text-primary/70">
                  Emoção mais associada
                </p>
                <p className="text-sm text-foreground">
                  {topEmotion
                    ? `${emotionLabels[topEmotion[0]] || topEmotion[0]} · ${topEmotion[1]} vez${topEmotion[1] === 1 ? "" : "es"}`
                    : "Ainda sem emoção registrada."}
                </p>
              </div>

              <div className="rounded-xl border border-border/40 bg-background/40 p-3">
                <p className="text-[10px] uppercase tracking-widest text-primary/70">
                  Busca financeira mais comum
                </p>
                <p className="text-sm text-foreground">
                  {topNeed
                    ? `${topNeed[0]} · ${topNeed[1]} vez${topNeed[1] === 1 ? "" : "es"}`
                    : "Ainda sem busca registrada."}
                </p>
              </div>

              <div className="rounded-xl border border-border/40 bg-background/40 p-3">
                <p className="text-[10px] uppercase tracking-widest text-primary/70">
                  Gatilho mais frequente
                </p>
                <p className="text-sm text-foreground">
                  {topTrigger
                    ? `${topTrigger[0]} · ${topTrigger[1]} vez${topTrigger[1] === 1 ? "" : "es"}`
                    : "Ainda sem gatilho registrado."}
                </p>
              </div>

              <p className="font-serif italic text-sm text-muted-foreground">
                O dinheiro não mostra apenas para onde ele foi. Ele também mostra o que você estava tentando cuidar.
              </p>
            </div>
          )}
        </section>

        <form onSubmit={addTransaction} className="space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => setType("expense")}>
              Despesa
            </button>
            <button type="button" onClick={() => setType("income")}>
              Receita
            </button>
          </div>

          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição"
          />

          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Valor"
          />

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Que emoção pode estar por trás desta decisão financeira?
            </p>

            <div className="flex flex-wrap gap-2">
              {emotions.map((option) => (
                <button
                  key={emotionLabels[option] || option}
                  type="button"
                  onClick={() => {
                    setEmotion(option);
                    setRefinedEmotion("");
                  }}
                  className={`rounded-full border px-3 py-2 text-sm ${
                    emotion === option ? "bg-primary text-white" : ""
                  }`}
                >
                  {emotionLabels[option] || option}
                </button>
              ))}
            </div>
          </div>

          {emotion && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Qual nome chega mais perto?
              </p>

              <div className="flex flex-wrap gap-2">
                {(refinedEmotionOptions[emotion] || []).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      setRefinedEmotion(refinedEmotion === option ? "" : option)
                    }
                    className={`rounded-full border px-3 py-2 text-sm ${
                      refinedEmotion === option ? "bg-primary text-white" : ""
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">
              O que te levou a essa decisão?
            </p>

            <div className="flex flex-wrap gap-2">
              {triggers.map((option) => (
                <button
                  key={emotionLabels[option] || option}
                  type="button"
                  onClick={() => setTrigger(option)}
                  className={`rounded-full border px-3 py-2 text-sm ${
                    trigger === option ? "bg-primary text-white" : ""
                  }`}
                >
                  {emotionLabels[option] || option}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              O que você estava buscando?
            </p>

            <div className="flex flex-wrap gap-2">
              {financialNeeds.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    setFinancialNeed(financialNeed === option ? "" : option)
                  }
                  className={`rounded-full border px-3 py-2 text-sm ${
                    financialNeed === option ? "bg-primary text-white" : ""
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit">
            <Plus /> Adicionar
          </Button>
        </form>

        <div className="space-y-2">
          {transactions.map((t) => (
            <div key={t.id} className="flex justify-between gap-4">
              <div>
                <span>{t.description}</span>

                {(t.emotion || t.trigger) && (
                  <p className="text-sm text-muted-foreground">
                    {[t.emotion ? emotionLabels[t.emotion] || t.emotion : "", t.refinedEmotion, t.financialNeed, t.trigger]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <span>
                  {t.type === "income" ? "+" : "-"}
                  {formatCurrency(t.amount)}
                </span>
                <button onClick={() => deleteTransaction(t.id)}>
                  <Trash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
