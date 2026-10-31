import type { ReactNode } from "react";

/** Mise en page commune des trois connexions : titre et explication à gauche, formulaire dans un panneau à droite. */
export function LoginLayout({ title, lede, aside, split = true, children }: { title: string; lede: string; aside?: ReactNode; split?: boolean; children: ReactNode }) {
  return (
    <section className={split ? "grid gap-10 lg:grid-cols-2 lg:gap-24" : "max-w-xl"}>
      <div>
        <h1 className="t-hero">{title}</h1>
        <p className="lede mt-6 max-w-[44ch] text-muted">{lede}</p>
        {aside ? <div className="mt-10 border-t border-border pt-5 text-sm">{aside}</div> : null}
      </div>
      <div className={`bg-surface p-6 sm:p-10 lg:self-start ${split ? "" : "mt-8"}`}>{children}</div>
    </section>
  );
}
