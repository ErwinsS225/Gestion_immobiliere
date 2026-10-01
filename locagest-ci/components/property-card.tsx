"use client";

import { useState } from "react";
import { DoorOpen, MapPin, Pencil, Plus, UserRound } from "lucide-react";
import { PropertyForm, type PropertyOwner, type PropertyValuesForForm } from "@/components/property-form";
import { UnitForm, type UnitValuesForForm } from "@/components/unit-form";

interface PropertyCardData extends PropertyValuesForForm {
  created_at: string;
  owner: Pick<PropertyOwner, "id" | "full_name" | "phone"> | null;
  units: UnitValuesForForm[];
}

const unitTypeLabels: Record<string, string> = {
  apartment: "Appartement",
  shop: "Magasin",
  office: "Bureau",
  parking: "Parking",
  land: "Terrain",
};

const money = new Intl.NumberFormat("fr-CI", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("fr-CI", { maximumFractionDigits: 2 });

export function PropertyCard({
  property,
  owners,
}: {
  property: PropertyCardData;
  owners: PropertyOwner[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const occupiedCount = property.units.filter((unit) => unit.status === "occupied").length;
  const vacantCount = property.units.filter((unit) => unit.status === "vacant").length;

  return (
    <article className="property-card">
      <header className="property-card-header">
        <div className="property-card-title">
          <p className="property-number">Bien immobilier</p>
          <h3>{property.name}</h3>
          {property.commune ? <span className="badge-soft">{property.commune}</span> : null}
        </div>
        <button
          className="icon-action"
          type="button"
          onClick={() => setIsEditing((value) => !value)}
          aria-expanded={isEditing}
          aria-controls={`property-edit-${property.id}`}
          aria-label={isEditing ? `Fermer la modification de ${property.name}` : `Modifier ${property.name}`}
        >
          <Pencil size={15} aria-hidden="true" />
          <span>{isEditing ? "Fermer" : "Modifier"}</span>
        </button>
      </header>

      {property.address ? (
        <p className="property-address">
          <MapPin size={14} aria-hidden="true" />
          {property.address}
        </p>
      ) : (
        <p className="property-address property-address-empty">Adresse non renseignée</p>
      )}

      <p className="property-owner">
        <UserRound size={14} aria-hidden="true" />
        <span>
          {property.owner ? (
            <>
              <strong>{property.owner.full_name}</strong>
              {property.owner.phone ? ` · ${property.owner.phone}` : ""}
            </>
          ) : (
            "Aucun propriétaire lié"
          )}
        </span>
      </p>

      <div className="property-summary" aria-label="Résumé des lots">
        <div>
          <strong>{property.units.length}</strong>
          <span>lot{property.units.length > 1 ? "s" : ""}</span>
        </div>
        <div className="summary-occupied">
          <strong>{occupiedCount}</strong>
          <span>occupé{occupiedCount > 1 ? "s" : ""}</span>
        </div>
        <div className="summary-vacant">
          <strong>{vacantCount}</strong>
          <span>disponible{vacantCount > 1 ? "s" : ""}</span>
        </div>
      </div>

      {isEditing ? (
        <section className="property-edit-block" id={`property-edit-${property.id}`}>
          <div className="unit-form-header">
            <span>Informations du bien</span>
          </div>
          <PropertyForm
            owners={owners}
            property={property}
            onCancel={() => setIsEditing(false)}
          />
        </section>
      ) : null}

      <section className="property-units-section" aria-label={`Lots de ${property.name}`}>
        <div className="property-units-heading">
          <div>
            <h4>Lots du bien</h4>
            <span>
              {occupiedCount} occupé{occupiedCount > 1 ? "s" : ""} · {vacantCount} disponible{vacantCount > 1 ? "s" : ""}
            </span>
          </div>
          <button
            className="text-button add-unit-trigger"
            type="button"
            onClick={() => {
              setIsAddingUnit((value) => !value);
              setEditingUnitId(null);
            }}
            aria-expanded={isAddingUnit}
            aria-controls={`unit-add-${property.id}`}
          >
            <Plus size={15} aria-hidden="true" />
            {isAddingUnit ? "Fermer" : "Ajouter un lot"}
          </button>
        </div>

        {property.units.length ? (
          <ul className="property-units">
            {property.units.map((unit) => {
              const isUnitEditing = editingUnitId === unit.id;
              const monthlyTotal = Number(unit.base_rent) + Number(unit.charges);
              return (
                <li className="unit-record" key={unit.id}>
                  <div className="unit-item">
                    <div className="unit-record-main">
                      <strong>{unit.label}</strong>
                      <small>
                        {unitTypeLabels[unit.unit_type] ?? unit.unit_type}
                        {unit.surface_area != null ? ` · ${decimal.format(unit.surface_area)} m²` : ""}
                        {unit.room_count != null ? ` · ${unit.room_count} pièce${unit.room_count > 1 ? "s" : ""}` : ""}
                      </small>
                      <small className="unit-price">
                        {money.format(monthlyTotal)} FCFA / mois
                        <span>
                          ({money.format(unit.base_rent)} loyer + {money.format(unit.charges)} charges)
                        </span>
                      </small>
                    </div>
                    <div className="unit-record-actions">
                      <span className={`unit-status ${unit.status === "occupied" ? "occupied" : "vacant"}`}>
                        <span aria-hidden="true" />
                        {unit.status === "vacant" ? "Disponible" : "Occupé"}
                      </span>
                      <button
                        className="unit-edit-button"
                        type="button"
                        onClick={() => {
                          setEditingUnitId(isUnitEditing ? null : unit.id);
                          setIsAddingUnit(false);
                        }}
                        aria-expanded={isUnitEditing}
                        aria-controls={`unit-edit-${unit.id}`}
                        aria-label={`${isUnitEditing ? "Fermer la modification de" : "Modifier"} ${unit.label}`}
                      >
                        {isUnitEditing ? "Fermer" : "Modifier"}
                      </button>
                    </div>
                  </div>
                  {isUnitEditing ? (
                    <div className="unit-edit-form" id={`unit-edit-${unit.id}`}>
                      <UnitForm
                        propertyId={property.id}
                        propertyName={property.name}
                        unit={unit}
                        onCancel={() => setEditingUnitId(null)}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="property-no-units">
            <DoorOpen size={18} aria-hidden="true" />
            <p>Aucun lot enregistré pour ce bien.</p>
            <span>Ajoutez appartements, magasins, bureaux, stationnements ou terrains.</span>
          </div>
        )}

        {isAddingUnit ? (
          <div className="unit-form-block" id={`unit-add-${property.id}`}>
            <div className="unit-form-header">
              <span>Nouveau lot · {property.name}</span>
            </div>
            <UnitForm
              propertyId={property.id}
              propertyName={property.name}
              onCancel={() => setIsAddingUnit(false)}
            />
          </div>
        ) : null}
      </section>
    </article>
  );
}
