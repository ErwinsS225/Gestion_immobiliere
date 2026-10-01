import { NextResponse } from "next/server";
import { getCategoryFromType } from "@/lib/property-types";
import type { UnitValues } from "@/lib/validations/properties";

/**
 * Repartit les attributs variables d'un lot entre les colonnes dediees et la
 * colonne metadata JSONB.
 *
 * Les colonnes correspondent aux informations consultees frequemment (surface,
 * pieces, loyer, charges). Tout le reste vit dans metadata : le schema reste
 * stable quand de nouveaux types de bien apparaissent, sans ajouter une colonne
 * par cas d usage.
 */
export function buildUnitPayload(unit: UnitValues) {
  const {
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
    ...core
  } = unit;

  const metadata = {
    ...(bedroomCount != null ? { bedroom_count: bedroomCount } : {}),
    ...(bathroomCount != null ? { bathroom_count: bathroomCount } : {}),
    ...(isFurnished != null ? { is_furnished: isFurnished } : {}),
    ...(hasDisplayWindow != null ? { has_display_window: hasDisplayWindow } : {}),
    ...(hasOpenSpace != null ? { has_open_space: hasOpenSpace } : {}),
    ...(workstationCount != null ? { workstation_count: workstationCount } : {}),
    ...(ceilingHeight != null ? { ceiling_height_m: ceilingHeight } : {}),
    ...(hasLoadingDock != null ? { has_loading_dock: hasLoadingDock } : {}),
    ...(cadastralReference ? { cadastral_ref: cadastralReference } : {}),
    ...(isServiced != null ? { is_serviced: isServiced } : {}),
    ...(notes ? { notes } : {}),
  };

  return {
    ...core,
    building_section: buildingSection ?? null,
    floor: floor ?? null,
    surface_area: surfaceArea ?? null,
    room_count: roomCount ?? null,
    metadata,
  };
}

/** Repartit un lot enregistre (base) vers la forme attendue par unitSchema. */
export function parseUnitMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

/**
 * Ligne de base telle que renvoyee par PostgREST, avec les colonnes de
 * typologie. Le type retenu est unit_type_v2 quand la migration 3 est posee,
 * sinon l ancien unit_type : l application reste utilisable entre les deux
 * etages de deploiement.
 */
export function resolveUnitType(row: { unit_type_v2?: string | null; unit_type?: string | null }): string {
  if (row.unit_type_v2) return row.unit_type_v2;
  switch (row.unit_type) {
    case "apartment":
      return "apartment_f2";
    case "office":
      return "office_single";
    case "shop":
      return "shop";
    case "parking":
      return "parking";
    case "land":
      return "land";
    default:
      return "apartment_f2";
  }
}

/** Verifie que le type choisi appartient bien a la categorie deduite. */
export function isCategoryConsistent(unit: { unitType: string; category: string }): boolean {
  return unit.category === getCategoryFromType(unit.unitType);
}

export function unitNotFound() {
  return NextResponse.json(
    { error: "Ce lot est introuvable dans votre agence." },
    { status: 404 },
  );
}
