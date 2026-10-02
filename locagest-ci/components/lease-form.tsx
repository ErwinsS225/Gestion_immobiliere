"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Info, LoaderCircle, PlusCircle, X } from "lucide-react";
import {
  PRORATA_BASES,
  PRORATA_MODES,
  formatFCFA,
  formatDateFr,
  paymentDayLabel,
  type ProrataBasis,
  type ProrataMode,
} from "@/lib/lease-utils";
import { buildMoveInPreview, leaseFormSchema } from "@/lib/validations/lease";

export interface LeaseUnitOption {
  id: string;
  label: string;
  category: string | null;
  base_rent: number;
  charges: number;
  property: { id: string; name: string } | null;
}

export interface LeaseTenantOption {
  id: string;
  full_name: string;
  phone: string;
  whatsapp: string | null;
}

interface LeaseFormProps {
  units: LeaseUnitOption[];
  tenants: LeaseTenantOption[];
  onCancel?: () => void;
}

interface ApiResult {
  error?: string;
  fieldErrors?: Record<string, string>;
  warning?: string;
}

export function LeaseForm({ units, tenants, onCancel }: LeaseFormProps) {
  const router = useRouter();
  const [unitId, setUnitId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [chargesAmount, setChargesAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [paymentDay, setPaymentDay] = useState("1");
  const [prorataMode, setProrataMode] = useState<ProrataMode>("days_remaining");
  const [prorataBasis, setProrataBasis] = useState<ProrataBasis>("calendar_month");
  const [revisionRate, setRevisionRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [avertissement, setAvertissement] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lotChoisi = units.find((unit) => unit.id === unitId);
  const locataireChoisi = tenants.find((tenant) => tenant.id === tenantId);

  // Le recapitulatif est recalcule a chaque frappe : il utilise exactement la
  // fonction qui produira l echeance enregistree, donc aucun ecart possible entre
  // ce qui est affiche et ce qui est enregistre.
  const recap = useMemo(() => {
    const loyer = Number(rentAmount);
    const charges = Number(chargesAmount);
    const depot = Number(depositAmount);
    if (!startDate || !Number.isFinite(loyer) || loyer <= 0) return null;

    return buildMoveInPreview({
      rentAmount: loyer,
      chargesAmount: Number.isFinite(charges) ? charges : 0,
      depositAmount: Number.isFinite(depot) ? depot : 0,
      startDate,
      prorataMode,
      prorataBasis,
    });
  }, [rentAmount, chargesAmount, depositAmount, startDate, prorataMode, prorataBasis]);

  function choisirLot(id: string) {
    setUnitId(id);
    const lot = units.find((unit) => unit.id === id);
    if (!lot) return;
    // Le loyer du lot est propose, sans ecraser une saisie : l agent peut
    // prevoir une negociation avant de signer.
    if (!rentAmount) setRentAmount(String(lot.base_rent ?? 0));
    if (!chargesAmount) setChargesAmount(String(lot.charges ?? 0));
    setFieldErrors({});
  }

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
    setAvertissement("");

    const parsed = leaseFormSchema.safeParse({
      unitId,
      tenantId,
      startDate,
      endDate,
      rentAmount,
      chargesAmount,
      depositAmount,
      paymentDay,
      prorataMode,
      prorataBasis,
      revisionRate,
      notes,
    });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "unitId");
        nextErrors[field] ??= issue.message;
      }
      setFieldErrors(nextErrors);
      setError("Vérifiez les champs signalés avant d’enregistrer le bail.");
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/leases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = (await response.json().catch(() => ({}))) as ApiResult;

      if (!response.ok) {
        setError(result.error ?? "Impossible d’enregistrer ce bail.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      if (result.warning) {
        setAvertissement(result.warning);
        return;
      }

      setUnitId("");
      setTenantId("");
      setStartDate("");
      setEndDate("");
      setRentAmount("");
      setChargesAmount("");
      setDepositAmount("");
      setNotes("");
      router.refresh();
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau ; vos informations sont conservées.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const incomplet = units.length === 0 || tenants.length === 0;

  return (
    <form className="panel-form unit-form" onSubmit={onSubmit} noValidate>
      {error ? (
        <div className="onboarding-error" role="alert" aria-live="polite">
          {error}
        </div>
      ) : null}
      {avertissement ? (
        <div className="inventory-warning" role="alert" aria-live="polite">
          <AlertTriangle size={15} aria-hidden="true" />
          {avertissement}
        </div>
      ) : null}

      {incomplet ? (
        <div className="inventory-warning" role="status">
          <Info size={15} aria-hidden="true" />
          {units.length === 0 && tenants.length === 0
            ? "Ajoutez d’abord un bien avec ses lots, puis un locataire."
            : units.length === 0
              ? "Aucun lot vacant : ajoutez des lots à un bien existant."
              : "Aucun locataire : enregistrez-en au moins un."}
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="lease-unit">
          Lot <span aria-hidden="true">*</span>
        </label>
        <select
          id="lease-unit"
          value={unitId}
          onChange={(event) => choisirLot(event.target.value)}
          required
          disabled={units.length === 0}
          aria-invalid={Boolean(fieldErrors.unitId)}
        >
          <option value="">Sélectionnez un lot vacant</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.property?.name ? `${unit.property.name} — ` : ""}
              {unit.label}
            </option>
          ))}
        </select>
        {fieldErrors.unitId ? <small className="field-error">{fieldErrors.unitId}</small> : null}
        {lotChoisi ? (
          <span className="field-hint-inline">
            Loyer de référence : {formatFCFA(lotChoisi.base_rent)}
          </span>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="lease-tenant">
          Locataire <span aria-hidden="true">*</span>
        </label>
        <select
          id="lease-tenant"
          value={tenantId}
          onChange={(event) => setTenantId(event.target.value)}
          required
          disabled={tenants.length === 0}
          aria-invalid={Boolean(fieldErrors.tenantId)}
        >
          <option value="">Sélectionnez un locataire</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.full_name} — {tenant.phone}
            </option>
          ))}
        </select>
        {fieldErrors.tenantId ? <small className="field-error">{fieldErrors.tenantId}</small> : null}
        {locataireChoisi ? (
          <span className="field-hint-inline">
            {locataireChoisi.whatsapp
              ? "Relance WhatsApp possible"
              : "Relance par appel uniquement"}
          </span>
        ) : null}
      </div>

      <div className="grid-two">
        <div className="field">
          <label htmlFor="lease-start">
            Début du bail <span aria-hidden="true">*</span>
          </label>
          <input
            id="lease-start"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.startDate)}
            aria-describedby={fieldErrors.startDate ? "lease-start-error" : undefined}
          />
          {fieldErrors.startDate ? (
            <small className="field-error" id="lease-start-error">
              {fieldErrors.startDate}
            </small>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="lease-end">
            Fin <span className="field-hint-inline">facultatif</span>
          </label>
          <input
            id="lease-end"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            aria-invalid={Boolean(fieldErrors.endDate)}
            aria-describedby={fieldErrors.endDate ? "lease-end-error" : undefined}
          />
          {fieldErrors.endDate ? (
            <small className="field-error" id="lease-end-error">
              {fieldErrors.endDate}
            </small>
          ) : null}
        </div>
      </div>

      <div className="grid-two">
        <div className="field">
          <label htmlFor="lease-rent">
            Loyer mensuel <span aria-hidden="true">*</span>
          </label>
          <div className="amount-input">
            <input
              id="lease-rent"
              type="number"
              min="1"
              max="9999999999"
              step="1"
              inputMode="numeric"
              value={rentAmount}
              onChange={(event) => {
                setRentAmount(event.target.value);
                clearError("rentAmount");
              }}
              required
              aria-invalid={Boolean(fieldErrors.rentAmount)}
              aria-describedby={fieldErrors.rentAmount ? "lease-rent-error" : undefined}
            />
            <span>FCFA</span>
          </div>
          {fieldErrors.rentAmount ? (
            <small className="field-error" id="lease-rent-error">
              {fieldErrors.rentAmount}
            </small>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="lease-charges">Charges mensuelles</label>
          <div className="amount-input">
            <input
              id="lease-charges"
              type="number"
              min="0"
              max="9999999999"
              step="1"
              inputMode="numeric"
              value={chargesAmount}
              onChange={(event) => setChargesAmount(event.target.value)}
            />
            <span>FCFA</span>
          </div>
        </div>
      </div>

      <div className="grid-two">
        <div className="field">
          <label htmlFor="lease-deposit">Dépôt de garantie</label>
          <div className="amount-input">
            <input
              id="lease-deposit"
              type="number"
              min="0"
              max="9999999999"
              step="1"
              inputMode="numeric"
              value={depositAmount}
              onChange={(event) => {
                setDepositAmount(event.target.value);
                clearError("depositAmount");
              }}
              aria-invalid={Boolean(fieldErrors.depositAmount)}
              aria-describedby={fieldErrors.depositAmount ? "lease-deposit-error" : undefined}
            />
            <span>FCFA</span>
          </div>
          {fieldErrors.depositAmount ? (
            <small className="field-error" id="lease-deposit-error">
              {fieldErrors.depositAmount}
            </small>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="lease-payment-day">Jour de paiement</label>
          <select
            id="lease-payment-day"
            value={paymentDay}
            onChange={(event) => setPaymentDay(event.target.value)}
            aria-invalid={Boolean(fieldErrors.paymentDay)}
          >
            {Array.from({ length: 28 }, (_, index) => index + 1).map((jour) => (
              <option key={jour} value={jour}>
                {paymentDayLabel(jour)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="lease-prorata">
        <legend>Premier mois — prorata</legend>
        <p className="lease-prorata-note">
          La loi ne fixe aucune formule : ces deux réglages suivent votre contrat type et
          doivent figurer au bail.
        </p>
        <div className="grid-two">
          <div className="field">
            <label htmlFor="lease-prorata-mode">Décompte</label>
            <select
              id="lease-prorata-mode"
              value={prorataMode}
              onChange={(event) => setProrataMode(event.target.value as ProrataMode)}
            >
              {PRORATA_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="lease-prorata-basis">Base de calcul</label>
            <select
              id="lease-prorata-basis"
              value={prorataBasis}
              onChange={(event) => setProrataBasis(event.target.value as ProrataBasis)}
            >
              {PRORATA_BASES.map((basis) => (
                <option key={basis.value} value={basis.value}>
                  {basis.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      {recap ? (
        <section className="lease-recap" aria-live="polite">
          <p className="lease-recap-title">À payer à la signature</p>
          <dl>
            <div>
              <dt>Période facturée</dt>
              <dd>
                {recap.prorata.isFullMonth
                  ? "Mois complet"
                  : `${recap.prorata.occupiedDays}/${recap.prorata.totalDays} jours`}
              </dd>
            </div>
            <div>
              <dt>Loyer du 1er mois</dt>
              <dd>{formatFCFA(recap.rentPart)}</dd>
            </div>
            <div>
              <dt>Charges du 1er mois</dt>
              <dd>{formatFCFA(recap.chargesPart)}</dd>
            </div>
            <div>
              <dt>Dépôt de garantie</dt>
              <dd className={recap.depositIsLegal ? undefined : "lease-recap-invalid"}>
                {formatFCFA(Number(depositAmount) || 0)}
              </dd>
            </div>
            <div className="lease-recap-total">
              <dt>Total</dt>
              <dd>{formatFCFA(recap.moveInTotal)}</dd>
            </div>
          </dl>
          {recap.prorata.safetyApplied ? (
            <p className="lease-recap-warning">
              <AlertTriangle size={14} aria-hidden="true" />
              Moins de sept jours facturés : le mois complet est retenu.
            </p>
          ) : null}
          {!recap.depositIsLegal ? (
            <p className="lease-recap-warning">
              <AlertTriangle size={14} aria-hidden="true" />
              Le dépôt dépasse deux mois de loyer, plafond fixé par l’article 416 du Code
              de la Construction et de l’Habitat. Maximum : {formatFCFA(recap.maxDeposit)}.
            </p>
          ) : null}
          <p className="lease-recap-foot">Bail à compter du {formatDateFr(startDate)}.</p>
        </section>
      ) : null}

      <div className="grid-two">
        <div className="field">
          <label htmlFor="lease-revision">
            Révision annuelle <span className="field-hint-inline">%</span>
          </label>
          <input
            id="lease-revision"
            type="number"
            min="0"
            max="20"
            step="0.5"
            inputMode="decimal"
            value={revisionRate}
            onChange={(event) => setRevisionRate(event.target.value)}
            aria-invalid={Boolean(fieldErrors.revisionRate)}
          />
          {fieldErrors.revisionRate ? (
            <small className="field-error">{fieldErrors.revisionRate}</small>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="lease-notes">
            Notes <span className="field-hint-inline">facultatif</span>
          </label>
          <input
            id="lease-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Accords particuliers…"
            maxLength={2000}
          />
        </div>
      </div>

      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={isSubmitting || incomplet}>
          {isSubmitting ? (
            <LoaderCircle className="spinner" aria-hidden="true" />
          ) : (
            <PlusCircle aria-hidden="true" />
          )}
          {isSubmitting ? "Enregistrement…" : "Signer le bail"}
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
