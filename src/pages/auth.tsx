import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

export default function Auth() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setMessage(mode === "login" ? "Login feito com sucesso." : "Conta criada.");
    navigate("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5"
      >
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-serif text-foreground">
            Planner Estoico
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Entrar na sua conta" : "Criar uma conta"}
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
            required
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
            required
            minLength={6}
          />
        </div>

        {message && (
          <p className="text-sm text-center text-muted-foreground">{message}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setMessage("");
          }}
          className="w-full text-sm text-muted-foreground"
        >
          {mode === "login" ? "Ainda não tenho conta" : "Já tenho conta"}
        </button>
      </form>
    </div>
  );
}
