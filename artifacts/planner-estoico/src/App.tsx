import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";

import Home from "@/pages/home";
import Morning from "@/pages/morning";
import Tasks from "@/pages/tasks";
import Financial from "@/pages/financial";
import Emotions from "@/pages/emotions";
import People from "@/pages/people";
import Evening from "@/pages/evening";
import Habits from "@/pages/habits";
import History from "@/pages/history";
import HistoryDay from "@/pages/history-day";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <AnimatePresence mode="wait">
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/manha" component={Morning} />
        <Route path="/tarefas" component={Tasks} />
        <Route path="/financeiro" component={Financial} />
        <Route path="/emocoes" component={Emotions} />
        <Route path="/pessoas" component={People} />
        <Route path="/noite" component={Evening} />
        <Route path="/habitos" component={Habits} />
        <Route path="/historico" component={History} />
        <Route path="/historico/:date" component={HistoryDay} />
        <Route path="/ajustes" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AnimatePresence>
  );
}

function AppearanceBoot() {
  useEffect(() => {
    const saved = localStorage.getItem("planner-appearance");
    if (saved === "candle") {
      document.documentElement.classList.add("theme-candle");
    }
  }, []);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppearanceBoot />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
