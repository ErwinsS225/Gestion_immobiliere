"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Plus, Save, X } from "lucide-react";
import { propertySchema } from "@/lib/validations/properties";

export interface PropertyOwner {
  id: string;
  full_name: string;
  phone: string | null;
}

export interface PropertyValuesForForm {
  id: string;
  name: string;
  address: string | null;
  commune: string | null;
  owner_id: string | null;
}

interface PropertyFormProps {
  owners: PropertyOwner[];
  property?: PropertyValuesForForm;
  onCancel?: () => void;
}

interface ApiResult {
  error?: string;
  fieldErrors?: Record<string, string>;
  property?: {
    id: string;
    owner_id: string | null;
  };
}

const communes = [
  "Abobo",
  "Adjamé",
  "Anyama",
  "Attécoubé",
  "Bingerville",
  "Cocody",
  "Koumassi",
  "Marcory",
  "Plateau",
  "Port-Bouët",
  "Treichville",
  "Yopougon",
];

export function PropertyForm({ owners, property, onCancel }: PropertyFormProps) {
  const router = useRouter();
  const isEditing = Boolean(property);
  const [name, setName] = useState(property?.name ?? "");
  const [address, setAddress] = useState(property?.address ?? "");
  const [commune, setCommune] = useState(property?.commune ?? "");
  const [ownerId, setOwnerId] = useState(property?.owner_id ?? "");
  const [isAddingOwner, setIsAddingOwner] = useState(false);
  const [ownerFullName, setOwnerFullName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerIdDocument, setOwnerIdDocument] = useState("");
  const [ownerNotes, setOwnerNotes] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const communeListId = `property-communes-${property?.id ?? "new"}`;

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

    const payload = {
      name,
      address,
      commune,
      ownerId: isAddingOwner ? null : ownerId || null,
      newOwner: isAddingOwner
        ? {
            fullName: ownerFullName,
            phone: ownerPhone,
            email: ownerEmail,
            idDocument: ownerIdDocument,
            notes: ownerNotes,
          }
        : null,
    };
    const parsed = propertySchema.safeParse(payload);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "name");
        nextErrors[field] ??= issue.message;
      }
      setFieldErrors(nextErrors);
      setError("Quelques informations sont à corriger avant l’enregistrement.");
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch(
        property ? `/api/properties/${property.id}` : "/api/properties",
        {
          method: property ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      const result = (await response.json().catch(() => ({}))) as ApiResult;

      if (!response.ok) {
        setError(result.error ?? "Impossible d’enregistrer ce bien.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      setSuccess(isEditing ? "Modifications enregistrées." : "Bien enregistré dans le patrimoine.");
      if (!isEditing) {
        setName("");
        setAddress("");
        setCommune("");
        setOwnerId("");
      } else {
        setOwnerId(result.property?.owner_id ?? "");
      }
      setIsAddingOwner(false);
      setOwnerFullName("");
      setOwnerPhone("");
      setOwnerEmail("");
      setOwnerIdDocument("");
      setOwnerNotes("");
      router.refresh();
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau ; vos informations sont conservées.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="panel-form property-form" onSubmit={onSubmit} noValidate>
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
        <label htmlFor={`property-name-${property?.id ?? "new"}`}>
          Nom du bien <span aria-hidden="true">*</span>
        </label>
        <input
          id={`property-name-${property?.id ?? "new"}`}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            clearError("name");
          }}
          placeholder="Ex. Résidence Les Cocotiers"
          maxLength={120}
          required
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? `property-name-error-${property?.id ?? "new"}` : undefined}
        />
        {fieldErrors.name ? (
          <small className="field-error" id={`property-name-error-${property?.id ?? "new"}`}>
            {fieldErrors.name}
          </small>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor={`property-address-${property?.id ?? "new"}`}>Adresse</label>
        <input
          id={`property-address-${property?.id ?? "new"}`}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Ex. Rue des Jardins, Riviera 3"
          maxLength={200}
        />
      </div>

      <div className="field">
        <label htmlFor={`property-commune-${property?.id ?? "new"}`}>Commune</label>
        <input
          id={`property-commune-${property?.id ?? "new"}`}
          list={communeListId}
          value={commune}
          onChange={(event) => {
            setCommune(event.target.value);
            clearError("commune");
          }}
          placeholder="Ex. Cocody"
          maxLength={80}
          aria-invalid={Boolean(fieldErrors.commune)}
        />
        <datalist id={communeListId}>
          {communes.map((item) => <option key={item} value={item} />)}
        </datalist>
        {fieldErrors.commune ? <small className="field-error">{fieldErrors.commune}</small> : null}
      </div>

      <div className="owner-form-section">
        <div className="owner-form-heading">
          <div>
            <span className="owner-form-title">Propriétaire</span>
            <span className="owner-form-optional">Facultatif</span>
          </div>
          {isAddingOwner ? (
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setIsAddingOwner(false);
                setOwnerFullName("");
                setOwnerPhone("");
                setOwnerEmail("");
                setOwnerIdDocument("");
                setOwnerNotes("");
              }}
            >
              Choisir un propriétaire existant
            </button>
          ) : (
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setIsAddingOwner(true);
                setOwnerId("");
              }}
            >
              <Plus size={14} aria-hidden="true" />
              Nouveau propriétaire
            </button>
          )}
        </div>

        {isAddingOwner ? (
          <div className="owner-fields">
            <div className="field">
              <label htmlFor={`owner-name-${property?.id ?? "new"}`}>
                Nom complet <span aria-hidden="true">*</span>
              </label>
              <input
                id={`owner-name-${property?.id ?? "new"}`}
                value={ownerFullName}
                onChange={(event) => {
                  setOwnerFullName(event.target.value);
                  clearError("newOwner");
                }}
                placeholder="Ex. Aïssata Koné"
                maxLength={120}
                required
                aria-invalid={Boolean(fieldErrors.newOwner)}
              />
              {fieldErrors.newOwner ? <small className="field-error">{fieldErrors.newOwner}</small> : null}
            </div>
            <div className="field">
              <label htmlFor={`owner-phone-${property?.id ?? "new"}`}>Téléphone <span className="field-hint-inline">recommandé</span></label>
              <input
                id={`owner-phone-${property?.id ?? "new"}`}
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={ownerPhone}
                onChange={(event) => {
                  setOwnerPhone(event.target.value);
                  clearError("newOwner");
                }}
                placeholder="+225 07 00 00 00 00"
                maxLength={30}
              />
            </div>
            <div className="field">
              <label htmlFor={`owner-email-${property?.id ?? "new"}`}>E-mail</label>
              <input
                id={`owner-email-${property?.id ?? "new"}`}
                type="email"
                autoComplete="email"
                value={ownerEmail}
                onChange={(event) => {
                  setOwnerEmail(event.target.value);
                  clearError("newOwner");
                }}
                placeholder="nom@exemple.ci"
                maxLength={120}
              />
            </div>
            <div className="field">
              <label htmlFor={`owner-document-${property?.id ?? "new"}`}>Pièce d’identité <span className="field-hint-inline">CNI, passeport…</span></label>
              <input
                id={`owner-document-${property?.id ?? "new"}`}
                value={ownerIdDocument}
                onChange={(event) => setOwnerIdDocument(event.target.value)}
                placeholder="Référence du document"
                maxLength={100}
              />
            </div>
            <div className="field">
              <label htmlFor={`owner-notes-${property?.id ?? "new"}`}>Notes</label>
              <textarea
                id={`owner-notes-${property?.id ?? "new"}`}
                rows={3}
                value={ownerNotes}
                onChange={(event) => setOwnerNotes(event.target.value)}
                placeholder="Informations utiles pour le suivi"
                maxLength={1000}
              />
            </div>
          </div>
        ) : (
          <>
            <label className="visually-hidden" htmlFor={`owner-select-${property?.id ?? "new"}`}>
              Sélectionner un propriétaire
            </label>
            <select
              id={`owner-select-${property?.id ?? "new"}`}
              value={ownerId}
              onChange={(event) => {
                setOwnerId(event.target.value);
                clearError("ownerId");
              }}
              aria-invalid={Boolean(fieldErrors.ownerId)}
            >
              <option value="">Aucun propriétaire lié</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.full_name}{owner.phone ? ` · ${owner.phone}` : ""}
                </option>
              ))}
            </select>
            {fieldErrors.ownerId ? <small className="field-error">{fieldErrors.ownerId}</small> : null}
          </>
        )}
      </div>

      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="spinner" aria-hidden="true" /> : isEditing ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {isSubmitting ? "Enregistrement…" : isEditing ? "Enregistrer les modifications" : "Enregistrer le bien"}
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
