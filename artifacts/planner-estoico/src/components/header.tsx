import React from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { getFormattedDate } from "@/lib/date";

export function Header({ title, showBack = true }: { title?: string; showBack?: boolean }) {
  const formattedDate = getFormattedDate();

  return (
    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md pb-4 pt-6 px-6 border-b border-border/40">
      <div className="flex items-center justify-between mb-1">
        {showBack ? (
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 rounded-full hover:bg-muted/50">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        ) : (
          <div className="w-9" />
        )}
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {formattedDate}
        </span>
        <div className="w-9" />
      </div>
      {title && (
        <h1 className="text-2xl font-serif text-center mt-2">{title}</h1>
      )}
    </header>
  );
}
