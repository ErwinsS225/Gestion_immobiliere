"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, PlusCircle, Save, X } from "lucide-react";
import { unitSchema } from "@/lib/validations/properties";

export interface UnitValuesForForm {
  id: string;
  label: string;
  unit_type: string;
  surface_area: number | null;
  room_count: number | null;
  base_rent: number;
  charges: number;
  status: "vacant" | "occupied";
}

interface UnitFormProps {
  propertyId: string;
  propertyName: string;
  unit?: UnitValuesForForm;
  onCancel?: () => void;
}

interface ApiResult {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const unitTypeOptions = [
  { value: "apartment", label: "Appartement" },
  { value: "shop", label: "Magasin" },
  { value: "office", label: "Bureau" },
  { value: "parking", label: "Parking" },
  { value: "land", label: "Terrain" },
];

export function UnitForm({ propertyId, propertyName, unit, onCancel }: UnitFormProps) {
  const router = useRouter();
  const [label, setLabel] = useState(unit?.label ?? "");
  const [unitType, setUnitType] = useState(unit?.unit_type ?? "apartment");
  const [surfaceArea, setSurfaceArea] = useState(unit?.surface_area == null ? "" : String(unit.surface_area));
  const [roomCount, setRoomCount] = useState(unit?.room_count == null ? "" : String(unit.room_count));
  const [baseRent, setBaseRent] = useState(String(unit?.base_rent ?? 0));
  const [charges, setCharges] = useState(String(unit?.charges ?? 0));
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

    const parsed = unitSchema.safeParse({
      label,
      unitType,
      surfaceArea,
      roomCount,
      baseRent,
      charges,
    });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "label");
        nextErrors[field] ??= issue.message;
      }
      setFieldErrors(nextErrors);
      setError("Vérifiez les champs signalés avant d’enregistrer le lot.");
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch(
        unit
          ? `/api/properties/${propertyId}/units/${unit.id}`
          : `/api/properties/${propertyId}/units`,
        {
          method: unit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      const result = (await response.json().catch(() => ({}))) as ApiResult;

      if (!response.ok) {
        setError(result.error ?? `Impossible d’enregistrer un lot dans ${propertyName}.`);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      setSuccess(unit ? "Modifications enregistrées." : "Lot ajouté au bien.");
      if (!unit) {
        setLabel("");
        setUnitType("apartment");
        setSurfaceArea("");
        setRoomCount("");
        setBaseRent("0");
        setCharges("0");
      }
      router.refresh();
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau ; vos informations sont conservées.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const formId = `${propertyId}-${unit?.id ?? "new"}`;

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
        <label htmlFor={`unit-label-${formId}`}>Libellé du lot <span aria-hidden="true">*</span></label>
        <input
          id={`unit-label-${formId}`}
          value={label}
          onChange={(event) => {
            setLabel(event.target.value);
            clearError("label");
          }}
          placeholder="Ex. Apt 3B, Magasin 2, Parking P4"
          maxLength={80}
          required
          aria-invalid={Boolean(fieldErrors.label)}
          aria-describedby={fieldErrors.label ? `unit-label-error-${formId}` : undefined}
        />
        {fieldErrors.label ? <small className="field-error" id={`unit-label-error-${formId}`}>{fieldErrors.label}</small> : null}
      </div>

      <div className="field">
        <label htmlFor={`unit-type-${formId}`}>Type de lot <span aria-hidden="true">*</span></label>
        <select
          id={`unit-type-${formId}`}
          value={unitType}
          onChange={(event) => {
            setUnitType(event.target.value);
            clearError("unitType");
          }}
          aria-invalid={Boolean(fieldErrors.unitType)}
          required
        >
          {unitTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {fieldErrors.unitType ? <small className="field-error">{fieldErrors.unitType}</small> : null}
      </div>

      <div className="grid-two">
        <div className="field">
          <label htmlFor={`unit-surface-${formId}`}>Surface <span className="field-hint-inline">m² · facultatif</span></label>
          <input
            id={`unit-surface-${formId}`}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={surfaceArea}
            onChange={(event) => {
              setSurfaceArea(event.target.value);
              clearError("surfaceArea");
            }}
            placeholder="Ex. 68.5"
            aria-invalid={Boolean(fieldErrors.surfaceArea)}
            aria-describedby={fieldErrors.surfaceArea ? `unit-surface-error-${formId}` : undefined}
          />
          {fieldErrors.surfaceArea ? <small className="field-error" id={`unit-surface-error-${formId}`}>{fieldErrors.surfaceArea}</small> : null}
        </div>
        <div className="field">
          <label htmlFor={`unit-rooms-${formId}`}>Pièces <span className="field-hint-inline">facultatif</span></label>
          <input
            id={`unit-rooms-${formId}`}
            type="number"
            min="1"
            max="32767"
            step="1"
            inputMode="numeric"
            value={roomCount}
            onChange={(event) => {
              setRoomCount(event.target.value);
              clearError("roomCount");
            }}
            placeholder="Ex. 3"
            aria-invalid={Boolean(fieldErrors.roomCount)}
            aria-describedby={fieldErrors.roomCount ? `unit-rooms-error-${formId}` : undefined}
          />
          {fieldErrors.roomCount ? <small className="field-error" id={`unit-rooms-error-${formId}`}>{fieldErrors.roomCount}</small> : null}
        </div>
      </div>

      <div className="grid-two">
        <div className="field">
          <label htmlFor={`unit-rent-${formId}`}>Loyer de base mensuel <span aria-hidden="true">*</span></label>
          <div className="amount-input">
            <input
              id={`unit-rent-${formId}`}
              type="number"
              min="0"
              max="9999999999"
              step="1"
              inputMode="numeric"
              value={baseRent}
              onChange={(event) => {
                setBaseRent(event.target.value);
                clearError("baseRent");
              }}
              aria-invalid={Boolean(fieldErrors.baseRent)}
              aria-describedby={fieldErrors.baseRent ? `unit-rent-error-${formId}` : undefined}
              required
            />
            <span>FCFA</span>
          </div>
          {fieldErrors.baseRent ? <small className="field-error" id={`unit-rent-error-${formId}`}>{fieldErrors.baseRent}</small> : null}
        </div>
        <div className="field">
          <label htmlFor={`unit-charges-${formId}`}>Charges mensuelles</label>
          <div className="amount-input">
            <input
              id={`unit-charges-${formId}`}
              type="number"
              min="0"
              max="9999999999"
              step="1"
              inputMode="numeric"
              value={charges}
              onChange={(event) => {
                setCharges(event.target.value);
                clearError("charges");
              }}
              aria-invalid={Boolean(fieldErrors.charges)}
              aria-describedby={fieldErrors.charges ? `unit-charges-error-${formId}` : undefined}
            />
            <span>FCFA</span>
          </div>
          {fieldErrors.charges ? <small className="field-error" id={`unit-charges-error-${formId}`}>{fieldErrors.charges}</small> : null}
        </div>
      </div>

      <p className="unit-status-note">
        {unit ? "Le statut d’occupation est géré par les baux." : "Nouveau lot : disponible. Son occupation sera liée à un bail."}
      </p>

      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="spinner" aria-hidden="true" /> : unit ? <Save aria-hidden="true" /> : <PlusCircle aria-hidden="true" />}
          {isSubmitting ? "Enregistrement…" : unit ? "Enregistrer les modifications" : "Ajouter le lot"}
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
