"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, PlusCircle, X } from "lucide-react";
import { tenantSchema } from "@/lib/validations/tenants";

interface TenantFormProps {
  onCancel?: () => void;
}

interface ApiResult {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export function TenantForm({ onCancel }: TenantFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [idDocument, setIdDocument] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function clearError(field: string) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const parsed = tenantSchema.safeParse({
      fullName,
      phone,
      whatsapp,
      email,
      idDocument,
      notes,
    });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "fullName");
        nextErrors[field] ??= issue.message;
      }
      setFieldErrors(nextErrors);
      setError("Vérifiez les champs signalés avant d’enregistrer le locataire.");
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = (await response.json().catch(() => ({}))) as ApiResult;

      if (!response.ok) {
        setError(result.error ?? "Impossible d’enregistrer ce locataire.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      setSuccess("Locataire enregistré.");
      setFullName("");
      setPhone("");
      setWhatsapp("");
      setEmail("");
      setIdDocument("");
      setNotes("");
      router.refresh();
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau ; vos informations sont conservées.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="panel-form unit-form" onSubmit={onSubmit} noValidate>
      {error ? (
        <div className="onboarding-error" role="alert" aria-live="polite">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="success-message" role="status" aria-live="polite">
          <Check size={15} aria-hidden="true" />
          {success}
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="tenant-name">
          Nom complet <span aria-hidden="true">*</span>
        </label>
        <input
          id="tenant-name"
          value={fullName}
          onChange={(event) => {
            setFullName(event.target.value);
            clearError("fullName");
          }}
          placeholder="Ex. M. Kouassi Jean-Baptiste"
          maxLength={120}
          autoComplete="name"
          required
          aria-invalid={Boolean(fieldErrors.fullName)}
          aria-describedby={fieldErrors.fullName ? "tenant-name-error" : undefined}
        />
        {fieldErrors.fullName ? (
          <small className="field-error" id="tenant-name-error">
            {fieldErrors.fullName}
          </small>
        ) : null}
      </div>

      <div className="grid-two">
        <div className="field">
          <label htmlFor="tenant-phone">
            Téléphone <span aria-hidden="true">*</span>
          </label>
          <input
            id="tenant-phone"
            type="tel"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              clearError("phone");
            }}
            placeholder="Ex. +225 05 22 22 22 22"
            maxLength={30}
            autoComplete="tel"
            required
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={fieldErrors.phone ? "tenant-phone-error" : undefined}
          />
          {fieldErrors.phone ? (
            <small className="field-error" id="tenant-phone-error">
              {fieldErrors.phone}
            </small>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="tenant-whatsapp">
            WhatsApp <span className="field-hint-inline">facultatif</span>
          </label>
          <input
            id="tenant-whatsapp"
            type="tel"
            value={whatsapp}
            onChange={(event) => {
              setWhatsapp(event.target.value);
              clearError("whatsapp");
            }}
            placeholder="Si différent"
            maxLength={30}
            aria-invalid={Boolean(fieldErrors.whatsapp)}
            aria-describedby={fieldErrors.whatsapp ? "tenant-whatsapp-error" : undefined}
          />
          {fieldErrors.whatsapp ? (
            <small className="field-error" id="tenant-whatsapp-error">
              {fieldErrors.whatsapp}
            </small>
          ) : null}
        </div>
      </div>

      <div className="grid-two">
        <div className="field">
          <label htmlFor="tenant-email">
            E-mail <span className="field-hint-inline">facultatif</span>
          </label>
          <input
            id="tenant-email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearError("email");
            }}
            placeholder="Ex. kouassi@mail.ci"
            maxLength={120}
            autoComplete="email"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "tenant-email-error" : undefined}
          />
          {fieldErrors.email ? (
            <small className="field-error" id="tenant-email-error">
              {fieldErrors.email}
            </small>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="tenant-id">
            Pièce d’identité <span className="field-hint-inline">facultatif</span>
          </label>
          <input
            id="tenant-id"
            value={idDocument}
            onChange={(event) => setIdDocument(event.target.value)}
            placeholder="Ex. CNI 123456789"
            maxLength={100}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="tenant-notes">
          Notes internes <span className="field-hint-inline">facultatif</span>
        </label>
        <textarea
          id="tenant-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Repères utiles avant la signature du bail…"
          rows={2}
          maxLength={1000}
        />
      </div>

      <p className="unit-status-note">
        Le téléphone sert aux relances. Sans WhatsApp renseigné, les relances se font par
        appel.
      </p>

      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <LoaderCircle className="spinner" aria-hidden="true" />
          ) : (
            <PlusCircle aria-hidden="true" />
          )}
          {isSubmitting ? "Enregistrement…" : "Ajouter le locataire"}
        </button>
        {onCancel ? (
          <button className="secondary-button" type="button" onClick={onCancel} disabled={isSubmitting}>
            <X size={15} aria-hidden="true" />
            Annuler
          </button>
        ) : null}
      </div>
    </form>
  );
}
