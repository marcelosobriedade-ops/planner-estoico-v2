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
  memoryCue?: string;
  relationshipType?: string;
  interests?: string;
  followUpDate?: string;
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
  memoryCue: "",
  relationshipType: "",
  interests: "",
  followUpDate: "",
});

function createStableInteractionId(item: any) {
  if (item.id) return item.id;

  return [
    item.name,
    item.context,
    item.learned,
    item.nextStep,
    item.boundary,
    item.memoryCue,
    item.relationshipType,
    item.interests,
    item.followUpDate,
  ]
    .map((value) =>
      String(value || "")
        .trim()
        .toLowerCase(),
    )
    .join("|");
}

function normalizePeople(value: unknown): Interaction[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item: any) => ({
      id: createStableInteractionId(item),
      name: item.name || "",
      context: item.context || "",
      learned: item.learned || "",
      repair: item.repair || "",
      nextStep: item.nextStep || "",
      boundary: item.boundary || "",
      virtues: Array.isArray(item.virtues) ? item.virtues : [],
      memoryCue: item.memoryCue || "",
      relationshipType: item.relationshipType || "",
      interests: item.interests || "",
      followUpDate: item.followUpDate || "",
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




function splitTopics(value?: string) {
  return String(value || "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function getDaysSince(dateKey: string, todayKey: string) {
  const today = new Date(todayKey + "T12:00:00");
  const date = new Date(dateKey + "T12:00:00");

  return Math.max(
    0,
    Math.round((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function getDateDistanceLabel(targetDate: string, todayKey: string) {
  const today = new Date(todayKey + "T12:00:00");
  const target = new Date(targetDate + "T12:00:00");
  const diff = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diff < 0) return `atrasado há ${Math.abs(diff)} dia${Math.abs(diff) === 1 ? "" : "s"}`;
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  return `em ${diff} dias`;
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
    { label: "Vínculo", value: interaction.relationshipType || "" },
    { label: "Gancho de memória", value: interaction.memoryCue || "" },
    { label: "Interesses", value: interaction.interests || "" },
    { label: "Follow-up", value: interaction.followUpDate || "" },
    { label: "O que aconteceu", value: interaction.context },
    { label: "O que aprendi", value: interaction.learned },
    { label: "Reparação", value: interaction.repair || "" },
    { label: "Próximo passo", value: interaction.nextStep },
    { label: "Limite", value: interaction.boundary },
  ].filter((f) => f.value.trim());

  const outcomeLabel = getOutcomeLabel(interaction.outcome);

  return (
    <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
      <div
        className="flex justify-between gap-4 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="space-y-2">
          <div>
            <p className="font-serif text-lg">{interaction.name}</p>

            {(interaction.relationshipType || interaction.memoryCue) && (
              <p className="text-xs text-muted-foreground">
                {[interaction.relationshipType, interaction.memoryCue]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>

          {(interaction.interests ||
            interaction.nextStep ||
            interaction.followUpDate) && (
            <div className="space-y-1 text-sm">
              {interaction.interests && (
                <p>
                  <span className="text-muted-foreground">Interesses: </span>
                  {interaction.interests}
                </p>
              )}

              {interaction.nextStep && (
                <p>
                  <span className="text-muted-foreground">Próximo passo: </span>
                  {interaction.nextStep}
                </p>
              )}

              {interaction.followUpDate && (
                <p>
                  <span className="text-muted-foreground">Follow-up: </span>
                  {formatDate(interaction.followUpDate)}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {interaction.virtues?.map((virtue) => (
              <Badge key={virtue}>{virtue}</Badge>
            ))}

            {outcomeLabel && <Badge>{outcomeLabel}</Badge>}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
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
        <div className="border-t border-border/40 pt-3 space-y-2">
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
  onEdit,
  onDelete,
}: {
  group: PersonHistoryGroup;
  onNewInteraction: (name: string) => void;
  onEdit: (interaction: PersonHistoryItem) => void;
  onDelete: (interaction: PersonHistoryItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [meetModeOpen, setMeetModeOpen] = useState(false);

  const latest = group.items[0];

  return (
    <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex-1 text-left"
        >
          <div className="space-y-2">
            <div>
              <p className="font-serif text-lg">{group.name}</p>

              <p className="text-xs text-muted-foreground">
                {getInteractionCountLabel(group.items.length)}
              </p>
            </div>

            {latest && (
              <div className="rounded-xl border border-border/40 bg-background/40 p-3 space-y-1 text-sm">
                <p className="text-[10px] uppercase tracking-widest text-primary/70">
                  Resumo da pessoa
                </p>

                {latest.relationshipType && (
                  <p>
                    <span className="text-muted-foreground">Vínculo: </span>
                    {latest.relationshipType}
                  </p>
                )}

                {latest.memoryCue && (
                  <p>
                    <span className="text-muted-foreground">Gancho: </span>
                    {latest.memoryCue}
                  </p>
                )}

                {latest.interests && (
                  <p>
                    <span className="text-muted-foreground">Interesses: </span>
                    {latest.interests}
                  </p>
                )}

                {latest.context && (
                  <p>
                    <span className="text-muted-foreground">
                      Último assunto:{" "}
                    </span>
                    {latest.context}
                  </p>
                )}

                {latest.nextStep && (
                  <p>
                    <span className="text-muted-foreground">
                      Próximo passo:{" "}
                    </span>
                    {latest.nextStep}
                  </p>
                )}

                {latest.followUpDate && (
                  <p>
                    <span className="text-muted-foreground">Follow-up: </span>
                    {formatDate(latest.followUpDate)}
                  </p>
                )}
              </div>
            )}
          </div>
        </button>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setMeetModeOpen((current) => !current)}
            className="rounded-xl border px-3 py-2 text-xs text-muted-foreground"
          >
            Preparar reencontro
          </button>

          <button
            type="button"
            onClick={() => onNewInteraction(group.name)}
            className="rounded-xl border px-3 py-2 text-xs text-muted-foreground"
          >
            Nova interação
          </button>
        </div>

        <button type="button" onClick={() => setOpen(!open)}>
          {open ? <ChevronUp /> : <ChevronDown />}
        </button>
      </div>

      {meetModeOpen && latest && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-4">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-primary/70">
              Preparar reencontro
            </p>
            <p className="font-serif text-xl">{group.name}</p>
            <p className="text-xs text-muted-foreground">
              Recupere o contexto essencial antes de falar com essa pessoa.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            {latest.relationshipType && (
              <p>
                <span className="text-muted-foreground">Vínculo: </span>
                {latest.relationshipType}
              </p>
            )}

            {latest.memoryCue && (
              <p>
                <span className="text-muted-foreground">Gancho: </span>
                {latest.memoryCue}
              </p>
            )}

            {latest.interests && (
              <p>
                <span className="text-muted-foreground">Interesses: </span>
                {latest.interests}
              </p>
            )}

            {latest.context && (
              <p>
                <span className="text-muted-foreground">Último assunto: </span>
                {latest.context}
              </p>
            )}

            {latest.nextStep && (
              <p>
                <span className="text-muted-foreground">Próximo passo: </span>
                {latest.nextStep}
              </p>
            )}

            {latest.followUpDate && (
              <p>
                <span className="text-muted-foreground">Follow-up: </span>
                {formatDate(latest.followUpDate)}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border/40 bg-background/40 p-3 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-primary/70">
              Treinador de conversa
            </p>

            {latest.nextStep && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Promessa ou ponto pendente
                </p>
                <p className="text-sm">{latest.nextStep}</p>
              </div>
            )}

            {latest.context && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Último assunto para retomar
                </p>
                <p className="text-sm">{latest.context}</p>
              </div>
            )}

            {splitTopics(latest.interests).length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Pontos de conexão
                </p>

                <div className="flex flex-wrap gap-2">
                  {splitTopics(latest.interests).map((topic) => (
                    <Badge key={topic}>{topic}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Perguntas possíveis
              </p>

              <div className="space-y-1 text-sm">
                {latest.nextStep && <p>• Como ficou aquilo sobre {latest.nextStep}?</p>}
                {latest.context && <p>• Como evoluiu o assunto: {latest.context}?</p>}
                {splitTopics(latest.interests)[0] && (
                  <p>• Você ainda está envolvido com {splitTopics(latest.interests)[0]}?</p>
                )}
                <p>• Como você está desde nossa última conversa?</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onNewInteraction(group.name)}
              className="rounded-xl border border-primary/30 bg-background px-3 py-2 text-xs"
            >
              Registrar nova interação
            </button>

            <button
              type="button"
              onClick={() => setMeetModeOpen(false)}
              className="rounded-xl border px-3 py-2 text-xs text-muted-foreground"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="border-t border-border/40 pt-4 space-y-4">
          {group.items.map((item) => {
            const fields = [
              { label: "Vínculo", value: item.relationshipType || "" },
              { label: "Gancho de memória", value: item.memoryCue || "" },
              { label: "Interesses", value: item.interests || "" },
              { label: "Follow-up", value: item.followUpDate || "" },
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

                <div className="flex justify-end gap-3 text-xs text-muted-foreground">
                  <button type="button" onClick={() => onEdit(item)}>
                    Editar
                  </button>

                  <button type="button" onClick={() => onDelete(item)}>
                    Apagar
                  </button>
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





function OpenLoopsSection({
  items,
  onNewInteraction,
}: {
  items: PersonHistoryItem[];
  onNewInteraction: (name: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-4">
      <div className="space-y-1">
        <p className="font-serif text-lg">Pendências relacionais</p>
        <p className="text-xs text-muted-foreground">
          Próximos passos assumidos em conversas para manter continuidade sem depender só da memória.
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={`${item.date}-${item.id}-open-loop`}
            className="rounded-xl border border-border/40 bg-background/40 p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.name}</p>

                {item.followUpDate && (
                  <p className="text-xs text-primary/80">
                    {getDateDistanceLabel(item.followUpDate, getCurrentDateKey())}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => onNewInteraction(item.name)}
                className="rounded-xl border px-3 py-2 text-xs text-muted-foreground"
              >
                Nova interação
              </button>
            </div>

            <p className="text-sm">
              <span className="text-muted-foreground">Próximo passo: </span>
              {item.nextStep}
            </p>

            {item.memoryCue && (
              <p className="text-sm">
                <span className="text-muted-foreground">Gancho: </span>
                {item.memoryCue}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ImportantPeopleSection({
  groups,
  onNewInteraction,
}: {
  groups: Record<string, PersonHistoryGroup[]>;
  onNewInteraction: (name: string) => void;
}) {
  const entries = Object.entries(groups).filter(([, people]) => people.length > 0);

  if (entries.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-4">
      <div className="space-y-1">
        <p className="font-serif text-lg">Pessoas importantes</p>
        <p className="text-xs text-muted-foreground">
          Agrupadas pelo tipo de vínculo para recuperar contexto com mais rapidez.
        </p>
      </div>

      <div className="space-y-4">
        {entries.map(([relationship, people]) => (
          <div key={relationship} className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-primary/70">
              {relationship}
            </p>

            <div className="space-y-2">
              {people.slice(0, 4).map((group) => {
                const latest = group.items[0];

                return (
                  <div
                    key={group.name}
                    className="rounded-xl border border-border/40 bg-background/40 p-3 space-y-1"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{group.name}</p>

                        {latest?.memoryCue && (
                          <p className="text-xs text-muted-foreground">
                            {latest.memoryCue}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onNewInteraction(group.name)}
                        className="rounded-xl border px-3 py-2 text-xs text-muted-foreground"
                      >
                        Nova interação
                      </button>
                    </div>

                    {latest?.nextStep && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Retomar: </span>
                        {latest.nextStep}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RelationshipReviewSection({
  items,
  dateKey,
  onPrepare,
  onNewInteraction,
}: {
  items: PersonHistoryGroup[];
  dateKey: string;
  onPrepare: (name: string) => void;
  onNewInteraction: (name: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-4">
      <div className="space-y-1">
        <p className="font-serif text-lg">Revisão relacional</p>
        <p className="text-xs text-muted-foreground">
          Relações que talvez mereçam uma revisão de contexto antes de esfriar demais.
        </p>
      </div>

      <div className="space-y-3">
        {items.map((group) => {
          const latest = group.items[0];
          const days = latest ? getDaysSince(latest.date, dateKey) : 0;

          return (
            <div
              key={group.name}
              className="rounded-xl border border-border/40 bg-background/40 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{group.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Última interação há {days} dias
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onNewInteraction(group.name)}
                  className="rounded-xl border px-3 py-2 text-xs text-muted-foreground"
                >
                  Nova interação
                </button>
              </div>

              {latest?.memoryCue && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Gancho: </span>
                  {latest.memoryCue}
                </p>
              )}

              {latest?.nextStep && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Retomar: </span>
                  {latest.nextStep}
                </p>
              )}

              <p className="font-serif italic text-xs text-muted-foreground">
                Antes de procurar essa pessoa, revise o contexto para retomar com presença.
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FollowUpSection({
  items,
  dateKey,
  onNewInteraction,
}: {
  items: PersonHistoryItem[];
  dateKey: string;
  onNewInteraction: (name: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border/40 bg-card p-4 space-y-4">
      <div className="space-y-1">
        <p className="font-serif text-lg">Atenção relacional</p>
        <p className="text-xs text-muted-foreground">
          Pessoas com follow-up marcado para retomar no momento certo.
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={`${item.date}-${item.id}-follow-up`}
            className="rounded-xl border border-border/40 bg-background/40 p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-primary/80">
                  {getDateDistanceLabel(item.followUpDate || "", dateKey)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNewInteraction(item.name)}
                className="rounded-xl border px-3 py-2 text-xs text-muted-foreground"
              >
                Nova interação
              </button>
            </div>

            {item.nextStep && (
              <p className="text-sm">
                <span className="text-muted-foreground">Próximo passo: </span>
                {item.nextStep}
              </p>
            )}

            {item.memoryCue && (
              <p className="text-sm">
                <span className="text-muted-foreground">Gancho: </span>
                {item.memoryCue}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
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
  const [editingDate, setEditingDate] = useState<string | null>(null);
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

  async function saveForDate(targetDate: string, next: Interaction[]) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    setStatus("Salvando...");

    const { data } = await supabase
      .from("daily_records")
      .select("data")
      .eq("user_id", session.user.id)
      .eq("date", targetDate)
      .maybeSingle();

    const latest = data?.data || {};

    const { error } = await supabase.from("daily_records").upsert(
      {
        user_id: session.user.id,
        date: targetDate,
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
    setEditingDate(null);
    setForm(emptyForm());
    setShowReflection(false);
    setShowForm(true);
  }

  function closeForm() {
    setEditingId(null);
    setEditingDate(null);
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

  function startEdit(interaction: Interaction | PersonHistoryItem) {
    setEditingId(interaction.id);
    setEditingDate("date" in interaction ? interaction.date : dateKey);

    setForm({
      name: interaction.name || "",
      context: interaction.context || "",
      learned: interaction.learned || "",
      nextStep: interaction.nextStep || "",
      boundary: interaction.boundary || "",
      repair: interaction.repair || "",
      memoryCue: interaction.memoryCue || "",
      relationshipType: interaction.relationshipType || "",
      interests: interaction.interests || "",
      followUpDate: interaction.followUpDate || "",
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

    const targetDate = editingDate || dateKey;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    const { data } = await supabase
      .from("daily_records")
      .select("data")
      .eq("user_id", session.user.id)
      .eq("date", targetDate)
      .maybeSingle();

    const latestData = data?.data || {};
    const targetPeople = normalizePeople(latestData.people);

    const next = editingId
      ? targetPeople.map((item) =>
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
                memoryCue: form.memoryCue?.trim() || "",
                relationshipType: form.relationshipType?.trim() || "",
                interests: form.interests?.trim() || "",
                followUpDate: form.followUpDate?.trim() || "",
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
            memoryCue: form.memoryCue?.trim() || "",
            relationshipType: form.relationshipType?.trim() || "",
            interests: form.interests?.trim() || "",
            followUpDate: form.followUpDate?.trim() || "",
          },
          ...targetPeople,
        ];

    await saveForDate(targetDate, next);

    setEditingId(null);
    setEditingDate(null);
    setForm(emptyForm());
    setShowReflection(false);
    setShowForm(false);
  }

  async function remove(id: string) {
    await save(interactions.filter((i) => i.id !== id));

    if (editingId === id) {
      setEditingId(null);
      setEditingDate(null);
      setForm(emptyForm());
      setShowReflection(false);
      setShowForm(false);
    }
  }

  async function removeHistoryItem(interaction: PersonHistoryItem) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    const { data } = await supabase
      .from("daily_records")
      .select("data")
      .eq("user_id", session.user.id)
      .eq("date", interaction.date)
      .maybeSingle();

    const latestData = data?.data || {};
    const people = normalizePeople(latestData.people);
    const next = people.filter((item) => item.id !== interaction.id);

    await saveForDate(interaction.date, next);

    if (editingId === interaction.id) {
      setEditingId(null);
      setEditingDate(null);
      setForm(emptyForm());
      setShowReflection(false);
      setShowForm(false);
    }
  }

  const sortedInteractions = useMemo(() => {
    const unique = new Map<string, Interaction>();

    interactions.forEach((interaction) => {
      const duplicateKey = [
        interaction.name,
        interaction.context,
        interaction.learned,
        interaction.nextStep,
        interaction.boundary,
      ]
        .map((value) =>
          String(value || "")
            .trim()
            .toLowerCase(),
        )
        .join("|");

      if (!unique.has(duplicateKey)) {
        unique.set(duplicateKey, interaction);
      }
    });

    return Array.from(unique.values()).sort((a, b) => {
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

        const duplicateKey = [
          record.date,
          interaction.name,
          interaction.context,
          interaction.learned,
          interaction.nextStep,
          interaction.boundary,
        ]
          .map((value) =>
            String(value || "")
              .trim()
              .toLowerCase(),
          )
          .join("|");

        const alreadyExists = map[key].items.some((item) => {
          const existingKey = [
            item.date,
            item.name,
            item.context,
            item.learned,
            item.nextStep,
            item.boundary,
          ]
            .map((value) =>
              String(value || "")
                .trim()
                .toLowerCase(),
            )
            .join("|");

          return existingKey === duplicateKey;
        });

        if (!alreadyExists) {
          map[key].items.push({
            ...interaction,
            date: record.date,
          });
        }
      });
    });

    return Object.values(map).sort((a, b) => b.items.length - a.items.length);
  }, [records]);





  const openLoopItems = useMemo(() => {
    return historyGroups
      .flatMap((group) => group.items)
      .filter((item) => item.nextStep?.trim())
      .sort((a, b) => {
        const aDate = a.followUpDate || "9999-12-31";
        const bDate = b.followUpDate || "9999-12-31";

        return aDate.localeCompare(bDate);
      })
      .slice(0, 8);
  }, [historyGroups]);

  const importantPeopleGroups = useMemo(() => {
    return historyGroups.reduce<Record<string, PersonHistoryGroup[]>>(
      (acc, group) => {
        const latest = group.items[0];
        const relationship = latest?.relationshipType?.trim();

        if (!relationship) return acc;

        const key = relationship.toLowerCase();

        if (!acc[key]) acc[key] = [];
        acc[key].push(group);

        return acc;
      },
      {},
    );
  }, [historyGroups]);

  const reviewGroups = useMemo(() => {
    return historyGroups
      .filter((group) => {
        const latest = group.items[0];
        if (!latest) return false;

        return getDaysSince(latest.date, dateKey) >= 30;
      })
      .slice(0, 5);
  }, [historyGroups, dateKey]);

  const followUpItems = useMemo(() => {
    return historyGroups
      .flatMap((group) => group.items)
      .filter((item) => item.followUpDate)
      .sort((a, b) =>
        String(a.followUpDate).localeCompare(String(b.followUpDate)),
      )
      .slice(0, 5);
  }, [historyGroups]);

  return (
    <Layout>
      <Header title="Pessoas" />

      <div className="p-5 space-y-5">
        <p className="text-sm text-muted-foreground">{status}</p>

        <FollowUpSection
          items={followUpItems}
          dateKey={dateKey}
          onNewInteraction={startInteractionWithPerson}
        />

        <RelationshipReviewSection
          items={reviewGroups}
          dateKey={dateKey}
          onPrepare={startInteractionWithPerson}
          onNewInteraction={startInteractionWithPerson}
        />

        <ImportantPeopleSection
          groups={importantPeopleGroups}
          onNewInteraction={startInteractionWithPerson}
        />

        <OpenLoopsSection
          items={openLoopItems}
          onNewInteraction={startInteractionWithPerson}
        />

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

              <Input
                placeholder="Vínculo com essa pessoa. Ex: família, trabalho, amigo, networking"
                value={form.relationshipType || ""}
                onChange={(e) => setField("relationshipType", e.target.value)}
              />

              <Input
                placeholder="Gancho de memória. Ex: pai do João, curso de inglês, gosta de café"
                value={form.memoryCue || ""}
                onChange={(e) => setField("memoryCue", e.target.value)}
              />

              <Input
                placeholder="Interesses ou temas importantes"
                value={form.interests || ""}
                onChange={(e) => setField("interests", e.target.value)}
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

                  <Input
                    type="date"
                    placeholder="Data de follow-up"
                    value={form.followUpDate || ""}
                    onChange={(e) => setField("followUpDate", e.target.value)}
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
            <p className="font-serif text-lg">Hoje</p>
            <p className="text-xs text-muted-foreground">
              Pessoas e conversas registradas neste dia.
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
            <p className="font-serif text-lg">Memória de relacionamento</p>
            <p className="text-xs text-muted-foreground">
              Cards para recuperar contexto rápido antes de reencontrar alguém.
            </p>
          </div>

          {historyGroups.length > 0 ? (
            historyGroups.map((group) => (
              <PersonHistoryCard
                key={group.name}
                group={group}
                onNewInteraction={startInteractionWithPerson}
                onEdit={startEdit}
                onDelete={removeHistoryItem}
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
