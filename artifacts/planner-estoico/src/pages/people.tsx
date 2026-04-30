import React, { useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Users } from "lucide-react";

interface Interaction {
  id: string;
  name: string;
  note: string;
}

export default function People() {
  const dateKey = getCurrentDateKey();
  const [interactions, setInteractions] = useLocalStorage<Interaction[]>(`${dateKey}-people`, []);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  const addInteraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setInteractions([
      { id: Date.now().toString(), name: name.trim(), note: note.trim() },
      ...interactions,
    ]);
    setName("");
    setNote("");
  };

  const deleteInteraction = (id: string) => {
    setInteractions(interactions.filter((i) => i.id !== id));
  };

  return (
    <Layout>
      <Header title="Pessoas" />
      <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
        <p className="text-center font-serif text-muted-foreground italic mb-2">
          "Quando acordares, diz a ti mesmo: hoje vou encontrar um intrometido, um ingrato, um arrogante, um falso..."
        </p>

        <form onSubmit={addInteraction} className="bg-card p-5 rounded-2xl border border-border/40 shadow-sm space-y-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da pessoa"
            className="bg-transparent border-b border-0 border-border/50 rounded-none focus-visible:ring-0 px-0 h-10 font-medium"
          />
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Como foi a interação? O que aprendeu?"
            className="resize-none bg-transparent border-b border-0 border-border/50 rounded-none focus-visible:ring-0 px-0 min-h-[60px] placeholder:text-muted-foreground/50"
          />
          <div className="flex justify-end pt-2">
            <Button type="submit" size="sm" className="rounded-lg gap-2" disabled={!name.trim()}>
              <Plus className="w-4 h-4" /> Registrar
            </Button>
          </div>
        </form>

        <div className="flex-1 space-y-4">
          {interactions.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground/60 space-y-4">
              <Users className="w-10 h-10 stroke-[1.5] opacity-50" />
              <p className="font-serif italic text-center">Nenhuma interação<br/>registrada hoje.</p>
            </div>
          ) : (
            interactions.map((interaction) => (
              <div key={interaction.id} className="p-4 bg-card rounded-xl border border-border/30 group relative">
                <button
                  onClick={() => deleteInteraction(interaction.id)}
                  className="absolute top-4 right-4 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <h3 className="font-serif text-lg font-medium text-foreground mb-1">{interaction.name}</h3>
                {interaction.note && (
                  <p className="text-muted-foreground text-sm leading-relaxed">{interaction.note}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
