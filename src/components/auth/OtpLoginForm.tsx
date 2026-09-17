"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { RequestOtpState, VerifyOtpState } from "@/lib/auth/login-flow";

// Nom du compte mémorisé côté navigateur uniquement (jamais envoyé au
// serveur) — voir la note sur `showFullName` ci-dessous.
const FULL_NAME_STORAGE_KEY = "sejours:fullName";

function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

const requestErrorKey = (message?: string) => {
  switch (message) {
    case "rate_limited":
      return "rateLimited";
    case "not_recognized":
      return "notRecognized";
    case "invalid_identifier":
      return "invalidIdentifier";
    case "invalid_email":
      return "invalidEmail";
    default:
      return "invalidCode";
  }
};

const verifyErrorKey = (message?: string) => {
  switch (message) {
    case "identifier_taken":
      return "identifierTaken";
    case "expired":
      return "expiredCode";
    case "too_many_attempts":
      return "tooManyAttempts";
    case "not_recognized":
      return "notRecognized";
    case "invalid_identifier":
      return "invalidIdentifier";
    default:
      return "invalidCode";
  }
};

/**
 * Formulaire de connexion partagé par le propriétaire, l'agent et l'admin
 * (CDC §3) — un seul champ « téléphone ou email », le canal étant détecté
 * côté serveur (voir src/lib/auth/login-flow.ts, `classifyIdentifier`)
 * plutôt que deux formulaires séparés (l'admin en portait deux jusqu'au
 * 15/09). Le voyageur garde son propre champ téléphone dans
 * BookingWizard.tsx : CDC §6.2.2 l'impose, ce composant ne le concerne pas.
 *
 * `showFullName` : pertinent uniquement quand l'identifiant saisi est un
 * téléphone — jamais un email, qui ne peut jamais créer de compte (le
 * schéma exige un téléphone, voir login-flow.ts). Le nom saisi est
 * mémorisé dans le stockage local du navigateur (jamais envoyé ailleurs
 * qu'au formulaire) pour ne pas le retaper à chaque connexion sur le même
 * appareil — jamais pré-rempli depuis le serveur : afficher ce champ
 * conditionnellement à un compte déjà existant, avant même la
 * vérification du code, permettrait d'énumérer les numéros enregistrés.
 *
 * `showEmailField` : canal de secours optionnel pour le code (décision
 * 0014), pertinent seulement si l'identifiant saisi est un téléphone —
 * un identifiant déjà email n'a pas besoin d'un second canal.
 */
export function OtpLoginForm({
  requestAction: requestActionProp,
  verifyAction: verifyActionProp,
  showFullName = false,
  showEmailField = false,
}: {
  requestAction: (prev: RequestOtpState, formData: FormData) => Promise<RequestOtpState>;
  verifyAction: (prev: VerifyOtpState, formData: FormData) => Promise<VerifyOtpState>;
  showFullName?: boolean;
  showEmailField?: boolean;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"identifier" | "code">("identifier");
  const identifierIsEmail = looksLikeEmail(identifier);

  // Champ non contrôlé à dessein : une valeur initiale poussée par React
  // state depuis le stockage local causerait un écart entre le rendu
  // serveur (jamais accès au navigateur) et la première passe client, que
  // React signale comme une erreur d'hydratation. Lu et écrit directement
  // sur le nœud DOM, après hydratation, jamais via setState.
  const fullNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showFullName || !fullNameRef.current) return;
    try {
      const saved = window.localStorage.getItem(FULL_NAME_STORAGE_KEY);
      if (saved) fullNameRef.current.value = saved;
    } catch {
      // Stockage indisponible (navigation privée, quota…) : pas grave, on
      // redemandera le nom, comme avant cette optimisation.
    }
  }, [showFullName]);

  const [requestState, requestAction, requestPending] = useActionState(
    async (prev: RequestOtpState, formData: FormData) => {
      const result = await requestActionProp(prev, formData);
      if (result.status === "sent") {
        setStep("code");
        const typedName = fullNameRef.current?.value.trim();
        if (showFullName && typedName) {
          try {
            window.localStorage.setItem(FULL_NAME_STORAGE_KEY, typedName);
          } catch {
            // Idem — la connexion ne doit jamais dépendre de ce stockage.
          }
        }
      }
      return result;
    },
    { status: "idle" as const }
  );

  const [verifyState, verifyAction, verifyPending] = useActionState(verifyActionProp, {
    status: "idle" as const,
  });

  if (step === "identifier") {
    return (
      <form action={requestAction} className="flex w-full max-w-sm flex-col gap-4">
        <Field
          id="identifier"
          name="identifier"
          label={t("identifierLabel")}
          placeholder={t("identifierPlaceholder")}
          autoComplete="username"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        {showEmailField && !identifierIsEmail ? (
          <Field
            id="email"
            name="email"
            label={t("emailLabel")}
            placeholder={t("emailPlaceholder")}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        ) : null}
        {requestState.status === "error" ? (
          <p className="text-sm text-danger">{t(requestErrorKey(requestState.message))}</p>
        ) : null}
        <Button type="submit" disabled={requestPending}>
          {identifierIsEmail ? t("sendEmailCode") : t("sendCode")}
        </Button>
      </form>
    );
  }

  return (
    <form action={verifyAction} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="identifier" value={identifier} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="locale" value={locale} />
      <p className="text-sm text-muted">{t("codeSent", { identifier })}</p>
      {showFullName && !identifierIsEmail ? (
        <Field id="fullName" name="fullName" label={t("fullNameLabel")} autoComplete="name" ref={fullNameRef} />
      ) : null}
      <Field
        id="code"
        name="code"
        label={identifierIsEmail ? t("emailCodeLabel") : t("codeLabel")}
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        autoComplete="one-time-code"
        required
      />
      {verifyState.status === "error" ? (
        <p className="text-sm text-danger">{t(verifyErrorKey(verifyState.message))}</p>
      ) : null}
      <Button type="submit" disabled={verifyPending}>
        {t("verify")}
      </Button>
      <Button type="button" variant="secondary" onClick={() => setStep("identifier")}>
        {t("requestAnotherCode")}
      </Button>
    </form>
  );
}
