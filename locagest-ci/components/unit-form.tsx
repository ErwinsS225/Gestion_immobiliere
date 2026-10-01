"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, PlusCircle, Save, X } from "lucide-react";
import { unitSchema } from "@/lib/validations/properties";
import {
  DEFAULT_UNIT_TYPE,
  PROPERTY_CATEGORIES,
  getCategoryFromType,
  isAnnexeSeule,
  isCommercialLike,
  isIndustrial,
  isResidentialLike,
  isTerrainOrAnnexe,
  type PropertyCategory,
} from "@/lib/property-types";

export interface UnitValuesForForm {
  id: string;
  label: string;
  unit_type: string;
  unit_type_v2?: string | null;
  category?: string | null;
  surface_area: number | null;
  room_count: number | null;
  base_rent: number;
  charges: number;
  deposit_amount?: number | null;
  floor?: string | null;
  building_section?: string | null;
  metadata?: Record<string, unknown> | null;
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

function readMeta(unit: UnitValuesForForm | undefined, key: string): unknown {
  const metadata = unit?.metadata;
  if (!metadata || typeof metadata !== "object") return undefined;
  return (metadata as Record<string, unknown>)[key];
}

export function UnitForm({ propertyId, propertyName, unit, onCancel }: UnitFormProps) {
  const router = useRouter();

  // Un lot enregistre porte unit_type_v2 quand la migration 3 est posee ; sinon
  // on retombe sur l ancien enum, converti vers la nouvelle typologie.
  const initialType = unit?.unit_type_v2 ?? unit?.unit_type ?? DEFAULT_UNIT_TYPE;

  const [label, setLabel] = useState(unit?.label ?? "");
  const [unitType, setUnitType] = useState(initialType);
  const [buildingSection, setBuildingSection] = useState(unit?.building_section ?? "");
  const [floor, setFloor] = useState(unit?.floor ?? "");
  const [surfaceArea, setSurfaceArea] = useState(
    unit?.surface_area == null ? "" : String(unit.surface_area),
  );
  const [roomCount, setRoomCount] = useState(
    unit?.room_count == null ? "" : String(unit.room_count),
  );
  const [bedroomCount, setBedroomCount] = useState(
    readMeta(unit, "bedroom_count") == null ? "" : String(readMeta(unit, "bedroom_count")),
  );
  const [bathroomCount, setBathroomCount] = useState(
    readMeta(unit, "bathroom_count") == null ? "" : String(readMeta(unit, "bathroom_count")),
  );
  const [isFurnished, setIsFurnished] = useState(readMeta(unit, "is_furnished") === true);
  const [hasDisplayWindow, setHasDisplayWindow] = useState(
    readMeta(unit, "has_display_window") === true,
  );
  const [hasOpenSpace, setHasOpenSpace] = useState(readMeta(unit, "has_open_space") === true);
  const [workstationCount, setWorkstationCount] = useState(
    readMeta(unit, "workstation_count") == null ? "" : String(readMeta(unit, "workstation_count")),
  );
  const [ceilingHeight, setCeilingHeight] = useState(
    readMeta(unit, "ceiling_height_m") == null ? "" : String(readMeta(unit, "ceiling_height_m")),
  );
  const [hasLoadingDock, setHasLoadingDock] = useState(
    readMeta(unit, "has_loading_dock") === true,
  );
  const [cadastralReference, setCadastralReference] = useState(
    (readMeta(unit, "cadastral_ref") as string | undefined) ?? "",
  );
  const [isServiced, setIsServiced] = useState(readMeta(unit, "is_serviced") === true);
  const [notes, setNotes] = useState((readMeta(unit, "notes") as string | undefined) ?? "");
  const [depositAmount, setDepositAmount] = useState(String(unit?.deposit_amount ?? 0));
  const [baseRent, setBaseRent] = useState(String(unit?.base_rent ?? 0));
  const [charges, setCharges] = useState(String(unit?.charges ?? 0));
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentCategory = useMemo(() => getCategoryFromType(unitType), [unitType]);
  const showResidential = isResidentialLike(currentCategory);
  const showCommercial = isCommercialLike(currentCategory);
  const showIndustrial = isIndustrial(currentCategory);
  const showLand = isTerrainOrAnnexe(currentCategory);
  const showSurface = !isAnnexeSeule(unitType);
  const showPieces = showResidential && !isAnnexeSeule(unitType);

  const totalMensuel = (Number(baseRent) || 0) + (Number(charges) || 0);

  function clearError(field: string) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  // Le type est la seule donnee saisie : la categorie se deduit du type a
  // chaque rendu, donc le selecteur de categorie ne fait que filtrer la liste
  // des types proposes.
  function onCategoryChange(next: PropertyCategory) {
    // Le type suit la categorie : on selectionne le premier type propose, sinon
    // le formulaire afficherait des champs qui ne correspondent plus au type.
    const premiere = PROPERTY_CATEGORIES.find((entry) => entry.value === next);
    if (premiere && !premiere.types.some((type) => type.value === unitType)) {
      setUnitType(premiere.types[0].value);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const parsed = unitSchema.safeParse({
      label,
      unitType,
      buildingSection,
      floor,
      surfaceArea,
      roomCount,
      bedroomCount,
      bathroomCount,
      isFurnished,
      hasDisplayWindow,
      hasOpenSpace,
      workstationCount,
      ceilingHeight,
      hasLoadingDock,
      cadastralReference,
      isServiced,
      notes,
      depositAmount,
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
        setSurfaceArea("");
        setRoomCount("");
        setBedroomCount("");
        setBathroomCount("");
        setWorkstationCount("");
        setCeilingHeight("");
        setCadastralReference("");
        setNotes("");
        setDepositAmount("0");
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
  const typeOptions =
    PROPERTY_CATEGORIES.find((entry) => entry.value === currentCategory)?.types ?? [];

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

      <div className="grid-two">
        <div className="field">
          <label htmlFor={`unit-category-${formId}`}>Catégorie <span aria-hidden="true">*</span></label>
          <select
            id={`unit-category-${formId}`}
            value={currentCategory}
            onChange={(event) => onCategoryChange(event.target.value as PropertyCategory)}
          >
            {PROPERTY_CATEGORIES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`unit-type-${formId}`}>Type de bien <span aria-hidden="true">*</span></label>
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
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {fieldErrors.unitType ? <small className="field-error">{fieldErrors.unitType}</small> : null}
        </div>
      </div>

      <div className="grid-two">
        <div className="field">
          <label htmlFor={`unit-section-${formId}`}>Bâtiment / îlot <span className="field-hint-inline">facultatif</span></label>
          <input
            id={`unit-section-${formId}`}
            value={buildingSection}
            onChange={(event) => setBuildingSection(event.target.value)}
            placeholder="Ex. Bâtiment A"
            maxLength={40}
          />
        </div>
        <div className="field">
          <label htmlFor={`unit-floor-${formId}`}>Étage <span className="field-hint-inline">facultatif</span></label>
          <input
            id={`unit-floor-${formId}`}
            value={floor}
            onChange={(event) => setFloor(event.target.value)}
            placeholder="Ex. 3e, RDC, SS"
            maxLength={20}
          />
        </div>
      </div>

      {showSurface || showPieces ? (
        <div className="grid-two">
          {showSurface ? (
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
          ) : null}
          {showPieces ? (
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
          ) : null}
        </div>
      ) : null}

      {showResidential ? (
        <div className="grid-two">
          <div className="field">
            <label htmlFor={`unit-bedrooms-${formId}`}>Chambres <span className="field-hint-inline">facultatif</span></label>
            <input
              id={`unit-bedrooms-${formId}`}
              type="number"
              min="0"
              max="32767"
              step="1"
              inputMode="numeric"
              value={bedroomCount}
              onChange={(event) => setBedroomCount(event.target.value)}
              placeholder="Ex. 2"
            />
          </div>
          <div className="field">
            <label htmlFor={`unit-bathrooms-${formId}`}>Salles de bain <span className="field-hint-inline">facultatif</span></label>
            <input
              id={`unit-bathrooms-${formId}`}
              type="number"
              min="0"
              max="32767"
              step="1"
              inputMode="numeric"
              value={bathroomCount}
              onChange={(event) => setBathroomCount(event.target.value)}
              placeholder="Ex. 1"
            />
          </div>
        </div>
      ) : null}

      {showCommercial ? (
        <>
          <div className="grid-two">
            <div className="field checkbox-field">
              <label htmlFor={`unit-vitrine-${formId}`}>
                <input
                  id={`unit-vitrine-${formId}`}
                  type="checkbox"
                  checked={hasDisplayWindow}
                  onChange={(event) => setHasDisplayWindow(event.target.checked)}
                />
                Vitrine sur la rue
              </label>
            </div>
            <div className="field checkbox-field">
              <label htmlFor={`unit-open-space-${formId}`}>
                <input
                  id={`unit-open-space-${formId}`}
                  type="checkbox"
                  checked={hasOpenSpace}
                  onChange={(event) => setHasOpenSpace(event.target.checked)}
                />
                Open space
              </label>
            </div>
          </div>
          <div className="field">
            <label htmlFor={`unit-workstations-${formId}`}>Postes de travail <span className="field-hint-inline">facultatif</span></label>
            <input
              id={`unit-workstations-${formId}`}
              type="number"
              min="0"
              max="5000"
              step="1"
              inputMode="numeric"
              value={workstationCount}
              onChange={(event) => setWorkstationCount(event.target.value)}
              placeholder="Ex. 12"
            />
          </div>
        </>
      ) : null}

      {showIndustrial ? (
        <div className="grid-two">
          <div className="field">
            <label htmlFor={`unit-height-${formId}`}>Hauteur sous plafond <span className="field-hint-inline">m · facultatif</span></label>
            <input
              id={`unit-height-${formId}`}
              type="number"
              min="0"
              max="100"
              step="0.01"
              inputMode="decimal"
              value={ceilingHeight}
              onChange={(event) => setCeilingHeight(event.target.value)}
              placeholder="Ex. 6.5"
            />
          </div>
          <div className="field checkbox-field">
            <label htmlFor={`unit-dock-${formId}`}>
              <input
                id={`unit-dock-${formId}`}
                type="checkbox"
                checked={hasLoadingDock}
                onChange={(event) => setHasLoadingDock(event.target.checked)}
              />
              Quai de chargement
            </label>
          </div>
        </div>
      ) : null}

      {showLand ? (
        <div className="grid-two">
          <div className="field">
            <label htmlFor={`unit-cadastral-${formId}`}>Référence cadastrale <span className="field-hint-inline">facultatif</span></label>
            <input
              id={`unit-cadastral-${formId}`}
              value={cadastralReference}
              onChange={(event) => setCadastralReference(event.target.value)}
              placeholder="Ex. Lot 452, Titre 12.34"
              maxLength={80}
            />
          </div>
          <div className="field checkbox-field">
            <label htmlFor={`unit-serviced-${formId}`}>
              <input
                id={`unit-serviced-${formId}`}
                type="checkbox"
                checked={isServiced}
                onChange={(event) => setIsServiced(event.target.checked)}
              />
              Terrain viabilisé
            </label>
          </div>
        </div>
      ) : null}

      {showResidential ? (
        <div className="field checkbox-field">
          <label htmlFor={`unit-furnished-${formId}`}>
            <input
              id={`unit-furnished-${formId}`}
              type="checkbox"
              checked={isFurnished}
              onChange={(event) => setIsFurnished(event.target.checked)}
            />
            Bien meublé
          </label>
        </div>
      ) : null}

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

      <div className="grid-two">
        <div className="field">
          <label htmlFor={`unit-deposit-${formId}`}>Dépôt de garantie <span className="field-hint-inline">facultatif</span></label>
          <div className="amount-input">
            <input
              id={`unit-deposit-${formId}`}
              type="number"
              min="0"
              max="9999999999"
              step="1"
              inputMode="numeric"
              value={depositAmount}
              onChange={(event) => setDepositAmount(event.target.value)}
              aria-invalid={Boolean(fieldErrors.depositAmount)}
            />
            <span>FCFA</span>
          </div>
          {fieldErrors.depositAmount ? <small className="field-error">{fieldErrors.depositAmount}</small> : null}
        </div>
        <div className="field">
          <label htmlFor={`unit-total-${formId}`}>Total mensuel</label>
          <output className="amount-output" id={`unit-total-${formId}`}>
            {totalMensuel.toLocaleString("fr-FR")} FCFA
          </output>
        </div>
      </div>

      <div className="field">
        <label htmlFor={`unit-notes-${formId}`}>Notes internes <span className="field-hint-inline">facultatif</span></label>
        <textarea
          id={`unit-notes-${formId}`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Équipements, état des lieux, particularités…"
          rows={3}
          maxLength={2000}
        />
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
