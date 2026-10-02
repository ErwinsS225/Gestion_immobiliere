"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Info, LoaderCircle, Receipt, X } from "lucide-react";
import {
  PAYMENT_METHODS,
  getPaymentMode,
  type PaymentMethod,
} from "@/lib/payments/mode";
import { formatFCFA } from "@/lib/lease-utils";
import { paymentSchema } from "@/lib/validations/payments";

export interface RentCallForPayment {
  id: string;
  period_year: number;
  period_month: number;
  due_date: string;
  total_amount: number;
  amount_paid: number;
  status: string;
}

interface PaymentFormProps {
  rentCall: RentCallForPayment;
  onDone: () => void;
}

interface ApiResult {
  error?: string;
  fieldErrors?: Record<string, string>;
  warning?: string;
  reference?: string;
  redirectUrl?: string;
}

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function moisLibelle(mois: number): string {
  return MOIS[mois - 1] ?? String(mois);
}

/**
 * Enregistrement d'un règlement sur une échéance.
 *
 * En mode simulation la confirmation est immédiate et aucun débit n'a lieu. Le
 * chemin est pourtant celui de la production : la demande part par le point de
 * bascule serveur, et le statut de l'échéance est recalculé en base par le
 * trigger, jamais par le formulaire.
 */
export function PaymentForm({ rentCall, onDone }: PaymentFormProps) {
  const router = useRouter();
  const reste = Number(rentCall.total_amount) - Number(rentCall.amount_paid);

  const [montant, setMontant] = useState(String(reste));
  const [moyen, setMoyen] = useState<PaymentMethod>("wave");
  const [datePaiement, setDatePaiement] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = useState("");
  const [erreur, setErreur] = useState("");
  const [avertissement, setAvertissement] = useState("");
  const [reference, setReference] = useState("");
  const [champsEnErreur, setChampsEnErreur] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);

  const simulation = getPaymentMode() === "simulation";

  async function enregistrer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErreur("");
    setAvertissement("");
    setReference("");

    const parsed = paymentSchema.safeParse({
      rentCallId: rentCall.id,
      amount: montant,
      method: moyen,
      paidAt: datePaiement,
      notes: note,
    });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "amount");
        nextErrors[field] ??= issue.message;
      }
      setChampsEnErreur(nextErrors);
      setErreur("Vérifiez les champs signalés.");
      return;
    }

    setChampsEnErreur({});
    setEnvoi(true);

    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = (await response.json().catch(() => ({}))) as ApiResult;

      if (!response.ok) {
        setErreur(result.error ?? "Impossible d’enregistrer ce règlement.");
        setChampsEnErreur(result.fieldErrors ?? {});
        return;
      }

      if (result.warning) {
        setAvertissement(result.warning);
        return;
      }

      setReference(result.reference ?? "");
      router.refresh();
      onDone();
    } catch {
      setErreur("Connexion impossible. Vérifiez votre réseau ; vos informations sont conservées.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form className="payment-add" onSubmit={enregistrer} noValidate>
      {erreur ? (
        <div className="onboarding-error" role="alert" aria-live="polite">
          {erreur}
        </div>
      ) : null}
      {avertissement ? (
        <div className="inventory-warning" role="alert" aria-live="polite">
          <AlertTriangle size={15} aria-hidden="true" />
          {avertissement}
        </div>
      ) : null}
      {reference ? (
        <div className="success-message" role="status" aria-live="polite">
          <Receipt size={15} aria-hidden="true" />
          Règlement enregistré · référence {reference}
        </div>
      ) : null}

      {simulation ? (
        <p className="payment-simulation-note">
          <Info size={14} aria-hidden="true" />
          Mode simulation : aucun débit n’est effectué. La référence est générée
          localement, le reste du traitement est identique à la production.
        </p>
      ) : null}

      <div className="field">
        <label htmlFor={`payment-amount-${rentCall.id}`}>
          Montant reçu <span aria-hidden="true">*</span>
        </label>
        <div className="amount-input">
          <input
            id={`payment-amount-${rentCall.id}`}
            type="number"
            min="1"
            max="9999999999"
            step="1"
            inputMode="numeric"
            value={montant}
            onChange={(event) => setMontant(event.target.value)}
            aria-invalid={Boolean(champsEnErreur.amount)}
            aria-describedby={
              champsEnErreur.amount ? `payment-amount-error-${rentCall.id}` : undefined
            }
            required
          />
          <span>FCFA</span>
        </div>
        {champsEnErreur.amount ? (
          <small className="field-error" id={`payment-amount-error-${rentCall.id}`}>
            {champsEnErreur.amount}
          </small>
        ) : (
          <span className="field-hint-inline">
            Reste à encaisser : {formatFCFA(reste)}
          </span>
        )}
      </div>

      <div className="grid-two">
        <div className="field">
          <label htmlFor={`payment-method-${rentCall.id}`}>
            Moyen de paiement <span aria-hidden="true">*</span>
          </label>
          <select
            id={`payment-method-${rentCall.id}`}
            value={moyen}
            onChange={(event) => setMoyen(event.target.value as PaymentMethod)}
            aria-invalid={Boolean(champsEnErreur.method)}
          >
            {PAYMENT_METHODS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`payment-date-${rentCall.id}`}>
            Date du paiement <span aria-hidden="true">*</span>
          </label>
          <input
            id={`payment-date-${rentCall.id}`}
            type="date"
            value={datePaiement}
            onChange={(event) => setDatePaiement(event.target.value)}
            aria-invalid={Boolean(champsEnErreur.paidAt)}
            required
          />
          {champsEnErreur.paidAt ? (
            <small className="field-error">{champsEnErreur.paidAt}</small>
          ) : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor={`payment-notes-${rentCall.id}`}>
          Note interne <span className="field-hint-inline">facultatif</span>
        </label>
        <input
          id={`payment-notes-${rentCall.id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ex. payé par M. Kouassi en espèces au bureau"
          maxLength={500}
        />
      </div>

      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={envoi}>
          {envoi ? (
            <LoaderCircle className="spinner" aria-hidden="true" />
          ) : (
            <Receipt aria-hidden="true" />
          )}
          {envoi ? "Enregistrement…" : "Enregistrer le règlement"}
        </button>
        <button className="secondary-button" type="button" onClick={onDone} disabled={envoi}>
          <X size={15} aria-hidden="true" />
          Fermer
        </button>
      </div>

      <p className="unit-status-note">
        Échéance de {moisLibelle(rentCall.period_month)} {rentCall.period_year} ·{" "}
        {formatFCFA(Number(rentCall.amount_paid))} déjà encaissé sur{" "}
        {formatFCFA(Number(rentCall.total_amount))}.
      </p>
    </form>
  );
}