"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClassName } from "@/components/ui/Button";

export type GalleryPhoto = { id: string; src: string; alt: string };
export type GalleryRoom = { id: string; label: string; photos: GalleryPhoto[] };

const arrow = "absolute top-1/2 grid size-12 -translate-y-1/2 place-items-center border border-foreground bg-background/90 text-foreground transition-colors hover:bg-foreground hover:text-background";

/** Galerie « visite en photos » : photos regroupées par pièce, dans l'ordre de la visite, avec visionneuse plein écran. */
export function PropertyGallery({ rooms }: { rooms: GalleryRoom[] }) {
  const t = useTranslations("property.gallery");
  const flat = useMemo(() => rooms.flatMap((room, roomIndex) => room.photos.map(photo => ({ ...photo, roomIndex, roomLabel: room.label }))), [rooms]);
  const firstOfRoom = useMemo(() => {
    const starts: number[] = [];
    let index = 0;
    rooms.forEach((room, roomIndex) => { starts[roomIndex] = index; index += room.photos.length; });
    return starts;
  }, [rooms]);

  const [open, setOpen] = useState<number | null>(null);
  const isOpen = open !== null;
  const trigger = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<number | null>(null);

  const close = useCallback(() => { setOpen(null); trigger.current?.focus(); }, []);
  const go = useCallback((delta: number) => setOpen(index => (index === null ? index : (index + delta + flat.length) % flat.length)), [flat.length]);
  const openAt = (index: number, element: HTMLElement | null) => { trigger.current = element; setOpen(index); };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "Tab" && dialog.current) {
        const items = [...dialog.current.querySelectorAll<HTMLElement>("button")];
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow; };
  }, [isOpen, close, go]);

  if (!flat.length) return null;
  const current = open !== null ? flat[open] : null;

  return (
    <section id="visite" aria-labelledby="visit-heading" className="scroll-mt-[var(--header-h)] border-t border-border">
      <div className="page-shell pb-8 pt-16 sm:pt-24">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="visit-heading" className="t-display">{t("title")}</h2>
            <p className="lede mt-3 max-w-[52ch] text-muted">{t("intro", { photos: flat.length })}</p>
          </div>
          <button type="button" className={buttonClassName("primary", "self-start")} onClick={event => openAt(0, event.currentTarget)}>{t("start")}</button>
        </div>
      </div>

      {rooms.length > 1 ? (
        <nav aria-label={t("jump")} className="sticky top-[var(--header-h)] z-20 border-y border-border bg-background">
          <div className="page-shell flex gap-8 overflow-x-auto">
            {rooms.map(room => (
              <a key={room.id} href={`#${room.id}`} className="caps inline-flex min-h-12 shrink-0 items-center border-b border-transparent text-foreground transition-colors hover:border-foreground">{room.label}</a>
            ))}
          </div>
        </nav>
      ) : null}

      <div className="page-shell pb-16 sm:pb-24">
        {rooms.map((room, roomIndex) => {
          const wideFirst = room.photos.length % 2 === 1;
          return (
            <section key={room.id} id={room.id} aria-labelledby={`${room.id}-title`} className="scroll-mt-[calc(var(--header-h)+3.5rem)] pt-12 sm:pt-16">
              <div className="border-t border-foreground pt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,3.2fr)] lg:gap-12">
                <div className="mb-6 flex items-baseline justify-between gap-4 lg:sticky lg:top-[calc(var(--header-h)+4.5rem)] lg:mb-0 lg:block lg:self-start">
                  <h3 id={`${room.id}-title`} className="t-2">{room.label}</h3>
                  <p className="caps !text-[.625rem] text-muted lg:mt-2">{t("photosCount", { count: room.photos.length })}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {room.photos.map((photo, photoIndex) => {
                    const wide = wideFirst && photoIndex === 0;
                    return (
                      <button
                        key={photo.id}
                        type="button"
                        aria-label={t("open", { room: room.label, n: photoIndex + 1 })}
                        onClick={event => openAt(firstOfRoom[roomIndex] + photoIndex, event.currentTarget)}
                        className={`group relative block w-full cursor-zoom-in overflow-hidden bg-surface-alt aspect-[3/2] ${wide ? "sm:col-span-2 sm:aspect-[21/9]" : ""}`}
                      >
                        <Image src={photo.src} alt="" fill sizes={wide ? "(min-width: 1024px) 1400px, 100vw" : "(min-width: 1024px) 700px, (min-width: 640px) 50vw, 100vw"} className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {current ? (
        <div
          ref={dialog}
          role="dialog"
          aria-modal="true"
          aria-label={t("viewer")}
          className="fixed inset-0 z-[60] flex flex-col bg-background"
          onTouchStart={event => { touchStart.current = event.touches[0].clientX; }}
          onTouchEnd={event => {
            if (touchStart.current === null) return;
            const delta = event.changedTouches[0].clientX - touchStart.current;
            touchStart.current = null;
            if (Math.abs(delta) > 50) go(delta < 0 ? 1 : -1);
          }}
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
            <p className="font-serif text-xl">{current.roomLabel}</p>
            <div className="flex items-center gap-4">
              <span className="caps text-muted" aria-live="polite">{t("counter", { current: (open ?? 0) + 1, total: flat.length })}</span>
              <button ref={closeButton} type="button" aria-label={t("close")} onClick={close} className="grid size-11 place-items-center border border-foreground transition-colors hover:bg-foreground hover:text-background">
                <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
          </div>
          <div className="relative min-h-0 flex-1">
            <Image key={current.id} src={current.src} alt={current.alt} fill sizes="100vw" priority className="object-contain px-0 sm:px-20" />
            <button type="button" aria-label={t("previous")} onClick={() => go(-1)} className={`${arrow} left-2 sm:left-6`}>
              <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
            </button>
            <button type="button" aria-label={t("next")} onClick={() => go(1)} className={`${arrow} right-2 sm:right-6`}>
              <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
            </button>
          </div>
          <nav aria-label={t("rooms")} className="flex gap-2 overflow-x-auto border-t border-border px-4 py-3 sm:px-8">
            {rooms.map((room, roomIndex) => (
              <button
                key={room.id}
                type="button"
                aria-current={roomIndex === current.roomIndex ? "true" : undefined}
                onClick={() => setOpen(firstOfRoom[roomIndex])}
                className={`caps shrink-0 border px-4 py-2.5 transition-colors ${roomIndex === current.roomIndex ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:border-foreground"}`}
              >
                {room.label}
              </button>
            ))}
          </nav>
        </div>
      ) : null}
    </section>
  );
}
