"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import {
  INVENTORY_ROOM_ORDER,
  ITEM_CONDITIONS,
  getConditionMeta,
  requiresNote,
  type ItemCondition,
} from "@/lib/inventory-types";

export interface CatalogItem {
  id: string;
  category: string;
  name: string;
  default_quantity: number;
  organization_id: string | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  condition: ItemCondition;
  notes: string | null;
  photo_url: string | null;
  added_after_move_in: boolean;
}

interface ApiResult {
  error?: string;
  fieldErrors?: Record<string, string>;
}

interface LeaseInventoryProps {
  leaseId: string;
  catalog: CatalogItem[];
  items: InventoryItem[];
}

/** Nombre d'objets dont l'état appelle une action avant la restitution. */
function countProblemes(items: InventoryItem[]) {
  return items.filter((item) => ["damaged", "missing"].includes(item.condition)).length;
}

export function LeaseInventory({ leaseId, catalog, items }: LeaseInventoryProps) {
  const router = useRouter();
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [catalogId, setCatalogId] = useState("");
  const [nom, setNom] = useState("");
  const [piece, setPiece] = useState("");
  const [quantite, setQuantite] = useState("1");
  const [condition, setCondition] = useState<ItemCondition>("good");
  const [note, setNote] = useState("");
  const [erreur, setErreur] = useState("");
  const [champsEnErreur, setChampsEnErreur] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);

  const groupes = useMemo(() => {
    const map = new Map<string, InventoryItem[]>();
    for (const item of items) {
      const cle = item.category ?? "Autres";
      const liste = map.get(cle);
      if (liste) liste.push(item);
      else map.set(cle, [item]);
    }
    return [...map.entries()].sort(([a], [b]) => {
      const rangA = INVENTORY_ROOM_ORDER.indexOf(a);
      const rangB = INVENTORY_ROOM_ORDER.indexOf(b);
      return (rangA === -1 ? 99 : rangA) - (rangB === -1 ? 99 : rangB);
    });
  }, [items]);

  const catalogueParPiece = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const entry of catalog) {
      const liste = map.get(entry.category);
      if (liste) liste.push(entry);
      else map.set(entry.category, [entry]);
    }
    return map;
  }, [catalog]);

  const problemes = countProblemes(items);

  function choisirCatalogue(valeur: string) {
    setCatalogId(valeur);
    const trouve = catalog.find((entry) => entry.id === valeur);
    if (!trouve) return;
    // Le catalogue pré-remplit le nom, la pièce et la quantité : l'agent valide.
    setNom(trouve.name);
    setPiece(trouve.category);
    setQuantite(String(trouve.default_quantity || 1));
    setChampsEnErreur({});
  }

  async function ajouter() {
    setErreur("");
    setEnvoi(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogId: catalogId || null,
          name: nom,
          category: piece || null,
          quantity: quantite,
          condition,
          notes: note || null,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as ApiResult;

      if (!response.ok) {
        setErreur(result.error ?? "Impossible d’enregistrer cet objet.");
        setChampsEnErreur(result.fieldErrors ?? {});
        return;
      }

      setAjoutOuvert(false);
      setCatalogId("");
      setNom("");
      setPiece("");
      setQuantite("1");
      setCondition("good");
      setNote("");
      router.refresh();
    } catch {
      setErreur("Connexion impossible. Vérifiez votre réseau.");
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer(id: string) {
    setErreur("");
    setEnvoi(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/inventory/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as ApiResult;
        setErreur(result.error ?? "Impossible de supprimer cet objet.");
        return;
      }
      router.refresh();
    } catch {
      setErreur("Connexion impossible. Vérifiez votre réseau.");
    } finally {
      setEnvoi(false);
    }
  }

  const noteObligatoire = requiresNote(condition);

  return (
    <section className="panel inventory-panel" aria-labelledby="inventory-title">
      <div className="panel-heading">
        <div>
          <p className="dashboard-eyebrow">Mobilier</p>
          <h2 id="inventory-title">Inventaire des objets</h2>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setAjoutOuvert((ouvert) => !ouvert)}
          aria-expanded={ajoutOuvert}
        >
          {ajoutOuvert ? <X size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
          {ajoutOuvert ? "Fermer" : "Ajouter un objet"}
        </button>
      </div>

      {erreur ? (
        <div className="onboarding-error" role="alert" aria-live="polite">
          {erreur}
        </div>
      ) : null}

      {problemes > 0 ? (
        <p className="inventory-warning" role="status">
          <AlertTriangle size={15} aria-hidden="true" />
          {problemes} objet{problemes > 1 ? "s" : ""} à traiter avant la restitution
          (endommagé{problemes > 1 ? "s" : ""} ou manquant{problemes > 1 ? "s" : ""}).
        </p>
      ) : null}

      {ajoutOuvert ? (
        <div className="inventory-add">
          <div className="field">
            <label htmlFor="inventory-catalog">Depuis le catalogue</label>
            <select
              id="inventory-catalog"
              value={catalogId}
              onChange={(event) => choisirCatalogue(event.target.value)}
            >
              <option value="">Saisir un objet libre</option>
              {[...catalogueParPiece.entries()].map(([categorie, liste]) => (
                <optgroup key={categorie} label={categorie}>
                  {liste.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="grid-two">
            <div className="field">
              <label htmlFor="inventory-name">
                Objet <span aria-hidden="true">*</span>
              </label>
              <input
                id="inventory-name"
                value={nom}
                onChange={(event) => setNom(event.target.value)}
                placeholder="Ex. Réfrigérateur"
                maxLength={120}
                aria-invalid={Boolean(champsEnErreur.name)}
              />
              {champsEnErreur.name ? (
                <small className="field-error">{champsEnErreur.name}</small>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="inventory-category">Pièce</label>
              <input
                id="inventory-category"
                value={piece}
                onChange={(event) => setPiece(event.target.value)}
                placeholder="Ex. Cuisine"
                maxLength={60}
              />
            </div>
          </div>

          <div className="grid-two">
            <div className="field">
              <label htmlFor="inventory-quantity">Quantité</label>
              <input
                id="inventory-quantity"
                type="number"
                min="1"
                max="999"
                step="1"
                inputMode="numeric"
                value={quantite}
                onChange={(event) => setQuantite(event.target.value)}
                aria-invalid={Boolean(champsEnErreur.quantity)}
              />
              {champsEnErreur.quantity ? (
                <small className="field-error">{champsEnErreur.quantity}</small>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="inventory-condition">État</label>
              <select
                id="inventory-condition"
                value={condition}
                onChange={(event) => setCondition(event.target.value as ItemCondition)}
              >
                {ITEM_CONDITIONS.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="inventory-notes">
              Observation{" "}
              {noteObligatoire ? (
                <span aria-hidden="true">*</span>
              ) : (
                <span className="field-hint-inline">facultatif</span>
              )}
            </label>
            <textarea
              id="inventory-notes"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={
                noteObligatoire ? "Décrivez le dommage constaté" : "État, âge, remarque…"
              }
              rows={2}
              maxLength={500}
              aria-invalid={Boolean(champsEnErreur.notes)}
              required={noteObligatoire}
            />
            {champsEnErreur.notes ? (
              <small className="field-error">{champsEnErreur.notes}</small>
            ) : null}
          </div>

          <div className="form-actions">
            <button type="button" className="primary-button" onClick={ajouter} disabled={envoi}>
              {envoi ? (
                <LoaderCircle className="spinner" aria-hidden="true" />
              ) : (
                <Plus aria-hidden="true" />
              )}
              {envoi ? "Enregistrement…" : "Ajouter à l’inventaire"}
            </button>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="inventory-empty">
          Aucun objet enregistré. Ajoutez les meubles et équipements présents dans le
          logement : c’est cette liste qui sera comparée à la sortie du locataire.
        </p>
      ) : (
        <div className="inventory-groups">
          {groupes.map(([categorie, liste]) => (
            <div key={categorie}>
              <h3 className="inventory-group-title">{categorie}</h3>
              <ul className="inventory-list">
                {liste.map((item) => {
                  const meta = getConditionMeta(item.condition);
                  return (
                    <li key={item.id} className="inventory-row">
                      <div className="inventory-row-main">
                        <strong>
                          {item.name}
                          {item.quantity > 1 ? (
                            <span className="inventory-qty">× {item.quantity}</span>
                          ) : null}
                        </strong>
                        <span className={`condition-chip condition-${meta.tone}`}>
                          {meta.label}
                        </span>
                        {item.notes ? (
                          <small className="inventory-note">{item.notes}</small>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => supprimer(item.id)}
                        disabled={envoi}
                        aria-label={`Supprimer ${item.name}`}
                      >
                        {envoi ? (
                          <LoaderCircle className="spinner" size={15} aria-hidden="true" />
                        ) : (
                          <Trash2 size={15} aria-hidden="true" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
