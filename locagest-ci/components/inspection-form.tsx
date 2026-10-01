"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Gauge, LoaderCircle, X } from "lucide-react";
import {
  DEFAULT_ROOMS,
  INSPECTION_TYPES,
  ITEM_CONDITIONS,
  getConditionMeta,
  requiresNote,
  type InspectionType,
  type ItemCondition,
} from "@/lib/inventory-types";

/** Une ligne de la grille : une pièce, un élément, un état, une note. */
interface LigneGrille {
  piece: string;
  element: string;
  condition: ItemCondition;
  note: string;
  rang: number;
}

interface InspectionFormProps {
  leaseId: string;
}

interface ApiResult {
  error?: string;
  fieldErrors?: Record<string, string>;
  warning?: string;
}

/** Grille pré-remplie : toutes les pièces à l'état Bon état. */
function grilleInitiale(): LigneGrille[] {
  const lignes: LigneGrille[] = [];
  let rang = 0;
  for (const piece of DEFAULT_ROOMS) {
    for (const element of piece.elements) {
      lignes.push({ piece: piece.name, element, condition: "good", note: "", rang });
      rang += 1;
    }
  }
  return lignes;
}

export function InspectionForm({ leaseId }: InspectionFormProps) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [type, setType] = useState<InspectionType>("move_in");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [locatairePresent, setLocatairePresent] = useState(true);
  const [eau, setEau] = useState("");
  const [electricite, setElectricite] = useState("");
  const [observations, setObservations] = useState("");
  const [lignes, setLignes] = useState<LigneGrille[]>(grilleInitiale);
  const [erreur, setErreur] = useState("");
  const [avertissement, setAvertissement] = useState("");
  const [champsEnErreur, setChampsEnErreur] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);

  const parPiece = useMemo(() => {
    const map = new Map<string, LigneGrille[]>();
    for (const ligne of lignes) {
      const liste = map.get(ligne.piece);
      if (liste) liste.push(ligne);
      else map.set(ligne.piece, [ligne]);
    }
    return [...map.entries()];
  }, [lignes]);

  const aCorriger = lignes.filter((ligne) => requiresNote(ligne.condition) && !ligne.note.trim()).length;
  const endommages = lignes.filter((ligne) => ligne.condition === "damaged").length;

  function majLigne(index: number, patch: Partial<LigneGrille>) {
    setLignes((current) =>
      current.map((ligne, position) => (position === index ? { ...ligne, ...patch } : ligne)),
    );
  }

  async function soumettre() {
    setErreur("");
    setAvertissement("");
    setEnvoi(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/inspections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          inspectionDate: date,
          tenantPresent: locatairePresent,
          waterMeterIndex: eau || null,
          electricityMeterIndex: electricite || null,
          generalNotes: observations || null,
          items: lignes.map((ligne) => ({
            room: ligne.piece,
            element: ligne.element,
            condition: ligne.condition,
            notes: ligne.note || null,
            sortOrder: ligne.rang,
          })),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as ApiResult;

      if (!response.ok) {
        setErreur(result.error ?? "Impossible d’enregistrer l’état des lieux.");
        setChampsEnErreur(result.fieldErrors ?? {});
        return;
      }

      if (result.warning) {
        setAvertissement(result.warning);
        return;
      }

      setOuvert(false);
      setLignes(grilleInitiale());
      router.refresh();
    } catch {
      setErreur("Connexion impossible. Vérifiez votre réseau.");
    } finally {
      setEnvoi(false);
    }
  }

  if (!ouvert) {
    return (
      <section className="panel inspection-panel" aria-labelledby="inspection-title">
        <div className="panel-heading">
          <div>
            <p className="dashboard-eyebrow">Bâti</p>
            <h2 id="inspection-title">État des lieux</h2>
          </div>
          <button type="button" className="secondary-button" onClick={() => setOuvert(true)}>
            <ClipboardCheck size={15} aria-hidden="true" />
            Ouvrir la grille
          </button>
        </div>
        <p className="inventory-empty">
          La grille vérifie le bâti pièce par pièce : murs, sol, plafonds, prises. Elle est
          distincte de l’inventaire du mobilier.
        </p>
      </section>
    );
  }

  return (
    <section className="panel inspection-panel" aria-labelledby="inspection-form-title">
      <div className="panel-heading">
        <div>
          <p className="dashboard-eyebrow">Bâti</p>
          <h2 id="inspection-form-title">État des lieux</h2>
        </div>
        <button type="button" className="secondary-button" onClick={() => setOuvert(false)}>
          <X size={15} aria-hidden="true" />
          Fermer
        </button>
      </div>

      {erreur ? (
        <div className="onboarding-error" role="alert" aria-live="polite">
          {erreur}
        </div>
      ) : null}
      {avertissement ? (
        <div className="success-message" role="alert" aria-live="polite">
          {avertissement}
        </div>
      ) : null}

      <div className="grid-two">
        <div className="field">
          <label htmlFor="inspection-type">
            Type <span aria-hidden="true">*</span>
          </label>
          <select
            id="inspection-type"
            value={type}
            onChange={(event) => setType(event.target.value as InspectionType)}
          >
            {INSPECTION_TYPES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="inspection-date">
            Date <span aria-hidden="true">*</span>
          </label>
          <input
            id="inspection-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            aria-invalid={Boolean(champsEnErreur.inspectionDate)}
          />
          {champsEnErreur.inspectionDate ? (
            <small className="field-error">{champsEnErreur.inspectionDate}</small>
          ) : null}
        </div>
      </div>

      <div className="field checkbox-field">
        <label htmlFor="inspection-tenant-present">
          <input
            id="inspection-tenant-present"
            type="checkbox"
            checked={locatairePresent}
            onChange={(event) => setLocatairePresent(event.target.checked)}
          />
          Le locataire était présent
        </label>
      </div>

      <p className="inspection-meter-title">
        <Gauge size={15} aria-hidden="true" />
        Relevés de compteurs
      </p>
      <div className="grid-two">
        <div className="field">
          <label htmlFor="inspection-water">
            Eau <span className="field-hint-inline">m³ · facultatif</span>
          </label>
          <input
            id="inspection-water"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={eau}
            onChange={(event) => setEau(event.target.value)}
            placeholder="Ex. 125.5"
          />
        </div>
        <div className="field">
          <label htmlFor="inspection-electricity">
            Électricité <span className="field-hint-inline">kWh · facultatif</span>
          </label>
          <input
            id="inspection-electricity"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={electricite}
            onChange={(event) => setElectricite(event.target.value)}
            placeholder="Ex. 340"
          />
        </div>
      </div>

      {aCorriger > 0 ? (
        <p className="inventory-warning" role="status">
          {aCorriger} élément{aCorriger > 1 ? "s" : ""} endommagé{aCorriger > 1 ? "s" : ""} sans
          description. Elle est obligatoire.
        </p>
      ) : null}

      <div className="inspection-grid">
        {parPiece.map(([piece, liste]) => (
          <fieldset key={piece} className="inspection-room">
            <legend>{piece}</legend>
            {liste.map((ligne) => {
              const index = lignes.findIndex((candidate) => candidate.rang === ligne.rang);
              const meta = getConditionMeta(ligne.condition);
              return (
                <div key={`${piece}-${ligne.element}`} className="inspection-line">
                  <span className="inspection-element">{ligne.element}</span>
                  <select
                    value={ligne.condition}
                    onChange={(event) =>
                      majLigne(index, { condition: event.target.value as ItemCondition })
                    }
                    aria-label={`État de ${ligne.element} — ${piece}`}
                    className={`condition-select condition-${meta.tone}`}
                  >
                    {ITEM_CONDITIONS.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                  {requiresNote(ligne.condition) ? (
                    <input
                      className="inspection-note-input"
                      value={ligne.note}
                      onChange={(event) => majLigne(index, { note: event.target.value })}
                      placeholder="Décrivez le dommage"
                      maxLength={500}
                      aria-label={`Description du dommage — ${ligne.element} — ${piece}`}
                      aria-required="true"
                    />
                  ) : null}
                </div>
              );
            })}
          </fieldset>
        ))}
      </div>

      <div className="field">
        <label htmlFor="inspection-notes">Observations générales</label>
        <textarea
          id="inspection-notes"
          value={observations}
          onChange={(event) => setObservations(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Réserves, accords entre les parties, travaux à prévoir…"
        />
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="primary-button"
          onClick={soumettre}
          disabled={envoi || aCorriger > 0}
        >
          {envoi ? (
            <LoaderCircle className="spinner" aria-hidden="true" />
          ) : (
            <ClipboardCheck aria-hidden="true" />
          )}
          {envoi ? "Enregistrement…" : `Enregistrer les ${lignes.length} points`}
        </button>
        {aCorriger > 0 ? (
          <small className="field-error">
            Décrivez d’abord les {aCorriger} dommage{aCorriger > 1 ? "s" : ""} signalé
            {aCorriger > 1 ? "s" : ""}.
          </small>
        ) : endommages > 0 ? (
          <small className="field-hint-inline">
            {endommages} dommage{endommages > 1 ? "s" : ""} consigné
            {endommages > 1 ? "s" : ""}.
          </small>
        ) : null}
      </div>
    </section>
  );
}
