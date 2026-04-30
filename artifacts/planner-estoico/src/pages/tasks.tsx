import React, { useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Circle, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type TaskStatus = "todo" | "done" | "cancelled";
interface Task {
  id: string;
  title: string;
  status: TaskStatus;
}

export default function Tasks() {
  const dateKey = getCurrentDateKey();
  const [tasks, setTasks] = useLocalStorage<Task[]>(`${dateKey}-tasks`, []);
  const [newTask, setNewTask] = useState("");

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    setTasks([
      ...tasks,
      { id: Date.now().toString(), title: newTask.trim(), status: "todo" },
    ]);
    setNewTask("");
  };

  const updateTaskStatus = (id: string, status: TaskStatus) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const completedCount = tasks.filter((t) => t.status === "done").length;

  return (
    <Layout>
      <Header title="Tarefas" />
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="mb-6 flex justify-between items-end">
          <p className="text-muted-foreground font-serif italic text-lg">O dever nos chama.</p>
          <p className="text-sm font-medium tracking-wider text-primary/70 uppercase">
            {completedCount} / {tasks.length} concluídas
          </p>
        </div>

        <form onSubmit={addTask} className="relative mb-8">
          <Input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Adicionar nova tarefa..."
            className="bg-card/50 border-border/50 h-14 rounded-xl pr-12 text-lg focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
          />
          <button
            type="submit"
            className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>

        <div className="flex-1 overflow-y-auto space-y-3 pb-8 -mx-2 px-2">
          {tasks.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground/60 space-y-4">
              <Circle className="w-10 h-10 stroke-[1.5]" />
              <p>Nenhuma tarefa para hoje</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "group flex items-center gap-3 p-4 bg-card rounded-xl border border-border/30 shadow-sm transition-all",
                  task.status === "done" && "opacity-60 bg-transparent border-transparent shadow-none",
                  task.status === "cancelled" && "opacity-40 bg-transparent border-transparent shadow-none"
                )}
              >
                <button
                  onClick={() => updateTaskStatus(task.id, task.status === "done" ? "todo" : "done")}
                  className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                    task.status === "done"
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-primary/40 hover:border-primary text-transparent"
                  )}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <span
                  className={cn(
                    "flex-1 text-lg transition-all",
                    task.status === "done" && "line-through",
                    task.status === "cancelled" && "line-through text-muted-foreground"
                  )}
                >
                  {task.title}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    onClick={() => updateTaskStatus(task.id, task.status === "cancelled" ? "todo" : "cancelled")}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-muted"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-muted"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
