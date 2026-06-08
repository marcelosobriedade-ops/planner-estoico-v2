import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

import Auth from "@/pages/auth";
import Home from "@/pages/home";
import Morning from "@/pages/morning";
import DayOrganization from "@/pages/day-organization";
import Tasks from "@/pages/tasks";
import Financial from "@/pages/financial";
import Emotions from "@/pages/emotions";
import People from "@/pages/people";
import Evening from "@/pages/evening";
import Habits from "@/pages/habits";
import History from "@/pages/history";
import HistoryDay from "@/pages/history-day";
import Settings from "@/pages/settings";
import Weekly from "@/pages/weekly";
import Month from "@/pages/month";
import Year from "@/pages/year";
import SOS from "@/pages/sos";
import DecisionBalance from "@/pages/decision-balance";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ProtectedApp() {
  return (
    <AnimatePresence mode="wait">
      <Switch>
        <Route path="/manha" component={Morning} />
        <Route path="/organizar-dia" component={DayOrganization} />
        <Route path="/tarefas" component={Tasks} />
        <Route path="/financeiro" component={Financial} />
        <Route path="/emocoes" component={Emotions} />
        <Route path="/pessoas" component={People} />
        <Route path="/noite" component={Evening} />
        <Route path="/habitos" component={Habits} />
        <Route path="/historico/:date" component={HistoryDay} />
        <Route path="/historico" component={History} />
        <Route path="/ajustes" component={Settings} />
        <Route path="/plano-semanal" component={Weekly} />
        <Route path="/mes" component={Month} />
        <Route path="/ano" component={Year} />
        <Route path="/sos" component={SOS} />
        <Route path="/balanca" component={DecisionBalance} />
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </AnimatePresence>
  );
}

function AuthGate() {
  const [session, setSession] = useState<any>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) navigate("/auth");
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) navigate("/auth");
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!session) return null;

  return <ProtectedApp />;
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={Auth} />
      <Route>
        <AuthGate />
      </Route>
    </Switch>
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
        <WouterRouter>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
