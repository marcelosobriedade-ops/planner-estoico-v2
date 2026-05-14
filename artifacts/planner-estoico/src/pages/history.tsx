import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, CalendarDays, Home } from "lucide-react";
import { getCurrentDateKey } from "@/lib/date";
import { supabase } from "@/lib/supabase";

type Record = {
  date: string;
  data: any;
};

export default function History() {
  const [records, setRecords] = useState<Record[]>([]);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data } = await supabase
        .from("daily_records")
        .select("*")
        .eq("user_id", session.user.id)
        .order("date", { ascending: false });

      setRecords(data || []);
    }

    load();
  }, []);

  const today = getCurrentDateKey();

  return (
    <Layout>
      <header className="p-6 border-b">
        <h1 className="text-xl font-serif text-center">Histórico</h1>
      </header>

      <div className="p-6 space-y-4">
        {records.length === 0 ? (
          <p>Nenhum registro ainda</p>
        ) : (
          records.map((r) => {
            const isToday = r.date === today;

            return (
              <Link key={r.date} href={`/historico/${r.date}`}>
                <div className="p-4 border rounded-xl">
                  <p>{r.date}</p>
                  {isToday && <span>Hoje</span>}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </Layout>
  );
}
