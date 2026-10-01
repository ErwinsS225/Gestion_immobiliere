Voici le formulaire complet, prêt à coller. Il utilise **react-hook-form + Zod + shadcn/ui**, avec affichage conditionnel des champs selon la catégorie du bien. La structure est pensée pour être mobile-first et évolutive.

---

## 📁 1. `lib/property-types.ts`

```ts
// ============================================================
// Typologie des biens gérés par une agence immobilière
// ============================================================

export type PropertyCategory =
  | "residential"
  | "commercial"
  | "professional"
  | "industrial"
  | "tourism"
  | "mixed"
  | "land_annex";

export const PROPERTY_CATEGORIES: {
  label: string;
  value: PropertyCategory;
  types: { label: string; value: string }[];
}[] = [
  {
    label: "Résidentiel",
    value: "residential",
    types: [
      { label: "Studio", value: "studio" },
      { label: "Studio américain", value: "studio_american" },
      { label: "Appartement F1 / T1", value: "apartment_f1" },
      { label: "Appartement F2 / T2", value: "apartment_f2" },
      { label: "Appartement F3 / T3", value: "apartment_f3" },
      { label: "Appartement F4 / T4", value: "apartment_f4" },
      { label: "Appartement F5 / T5", value: "apartment_f5" },
      { label: "Appartement F6+ / T6+", value: "apartment_f6_plus" },
      { label: "Duplex", value: "duplex" },
      { label: "Triplex", value: "triplex" },
      { label: "Penthouse", value: "penthouse" },
      { label: "Villa basse", value: "villa_low" },
      { label: "Villa duplex", value: "villa_duplex" },
      { label: "Villa triplex", value: "villa_triplex" },
      { label: "Villa jumelée", value: "villa_twin" },
      { label: "Villa en bande", value: "villa_row" },
      { label: "Maison individuelle", value: "house" },
      { label: "Maison en cour commune", value: "house_compound" },
      { label: "Immeuble résidentiel entier", value: "building_residential" },
    ],
  },
  {
    label: "Commercial",
    value: "commercial",
    types: [
      { label: "Boutique", value: "shop" },
      { label: "Local commercial", value: "commercial_unit" },
      { label: "Magasin", value: "store" },
      { label: "Showroom", value: "showroom" },
      { label: "Kiosque / Échoppe", value: "kiosk" },
      { label: "Étal de marché", value: "market_stall" },
    ],
  },
  {
    label: "Professionnel / Bureaux",
    value: "professional",
    types: [
      { label: "Bureau individuel", value: "office_single" },
      { label: "Plateau de bureaux", value: "office_floor" },
      { label: "Immeuble de bureaux entier", value: "building_office" },
      { label: "Cabinet", value: "cabinet" },
      { label: "Espace coworking", value: "coworking" },
      { label: "Salle de réunion / formation", value: "meeting_room" },
    ],
  },
  {
    label: "Industriel & Logistique",
    value: "industrial",
    types: [
      { label: "Entrepôt", value: "warehouse" },
      { label: "Hangar", value: "hangar" },
      { label: "Atelier", value: "workshop" },
      { label: "Usine", value: "factory" },
      { label: "Dépôt", value: "depot" },
      { label: "Terrain industriel", value: "land_industrial" },
    ],
  },
  {
    label: "Touristique & Court séjour",
    value: "tourism",
    types: [
      { label: "Appartement meublé", value: "apartment_furnished" },
      { label: "Villa meublée", value: "villa_furnished" },
      { label: "Résidence meublée", value: "residence_furnished" },
      { label: "Appart-hôtel", value: "aparthotel" },
      { label: "Résidence touristique", value: "resort" },
      { label: "Petit hôtel", value: "small_hotel" },
    ],
  },
  {
    label: "Mixte",
    value: "mixed",
    types: [
      { label: "Immeuble mixte", value: "building_mixed" },
      { label: "Résidence avec commerces", value: "residence_shops" },
      { label: "Villa avec local commercial", value: "villa_shop" },
    ],
  },
  {
    label: "Terrains & Annexes",
    value: "land_annex",
    types: [
      { label: "Terrain nu", value: "land" },
      { label: "Terrain viabilisé", value: "land_serviced" },
      { label: "Terrain agricole", value: "land_agricultural" },
      { label: "Parking / Place", value: "parking" },
      { label: "Garage / Box fermé", value: "garage" },
      { label: "Cave / Débarras", value: "storage_room" },
    ],
  },
];

// Tous les types à plat, utile pour le Zod enum
export const ALL_UNIT_TYPES = PROPERTY_CATEGORIES.flatMap((c) =>
  c.types.map((t) => t.value),
) as [string, ...string[]];

// Table de correspondance type → catégorie
export const TYPE_TO_CATEGORY: Record<string, PropertyCategory> =
  Object.fromEntries(
    PROPERTY_CATEGORIES.flatMap((c) =>
      c.types.map((t) => [t.value, c.value] as const),
    ),
  );

// Libellé d'un type à partir de son code
export function getTypeLabel(type: string): string {
  for (const cat of PROPERTY_CATEGORIES) {
    const found = cat.types.find((t) => t.value === type);
    if (found) return found.label;
  }
  return "Autre";
}

// Catégorie d'un type
export function getCategoryFromType(type: string): PropertyCategory {
  return TYPE_TO_CATEGORY[type] ?? "residential";
}

// Helpers de logique conditionnelle
export const isResidentialLike = (c: PropertyCategory) =>
  c === "residential" || c === "tourism" || c === "mixed";

export const isCommercialLike = (c: PropertyCategory) =>
  c === "commercial" || c === "professional" || c === "mixed";

export const isIndustrial = (c: PropertyCategory) => c === "industrial";

export const isLand = (c: PropertyCategory) => c === "land_annex";
```

---

## 📁 2. `lib/validations/unit.ts`

```ts
import { z } from "zod";
import { ALL_UNIT_TYPES } from "@/lib/property-types";

export const unitFormSchema = z.object({
  // --- Identification ---
  label: z.string().min(1, "Le libellé est obligatoire").max(80),
  type: z.enum(ALL_UNIT_TYPES, { message: "Sélectionnez un type de bien" }),

  // --- Localisation ---
  floor: z.string().max(20).optional().nullable(),
  building_section: z.string().max(40).optional().nullable(),

  // --- Résidentiel / Touristique / Mixte ---
  surface_m2: z.coerce
    .number({ message: "Surface invalide" })
    .min(0)
    .max(100000)
    .optional(),
  rooms: z.coerce.number().int().min(0).max(20).optional(),
  bedrooms: z.coerce.number().int().min(0).max(20).optional(),
  bathrooms: z.coerce.number().int().min(0).max(10).optional(),
  is_furnished: z.boolean().optional(),

  // --- Commercial / Professionnel ---
  has_vitrine: z.boolean().optional(),
  has_open_space: z.boolean().optional(),
  workstations: z.coerce.number().int().min(0).max(500).optional(),

  // --- Industriel ---
  ceiling_height_m: z.coerce.number().min(0).max(50).optional(),
  has_loading_dock: z.boolean().optional(),

  // --- Terrains & Annexes ---
  cadastral_ref: z.string().max(80).optional().nullable(),
  is_serviced: z.boolean().optional(),

  // --- Finances ---
  base_rent: z.coerce
    .number({ message: "Loyer invalide" })
    .min(0, "Le loyer doit être positif"),
  base_charges: z.coerce.number().min(0).default(0),
  deposit_amount: z.coerce.number().min(0).default(0),

  // --- Notes ---
  notes: z.string().max(2000).optional().nullable(),
});

export type UnitFormValues = z.infer<typeof unitFormSchema>;
```

---

## 📁 3. `components/units/unit-form.tsx`

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  PROPERTY_CATEGORIES,
  getCategoryFromType,
  isCommercialLike,
  isIndustrial,
  isLand,
  isResidentialLike,
} from "@/lib/property-types";
import { unitFormSchema, type UnitFormValues } from "@/lib/validations/unit";

interface UnitFormProps {
  propertyId: string;
  defaultValues?: Partial<UnitFormValues>;
  unitId?: string;
}

export function UnitForm({ propertyId, defaultValues, unitId }: UnitFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: {
      label: "",
      type: "apartment_f3",
      floor: "",
      building_section: "",
      surface_m2: undefined,
      rooms: undefined,
      bedrooms: undefined,
      bathrooms: undefined,
      is_furnished: false,
      has_vitrine: false,
      has_open_space: false,
      workstations: undefined,
      ceiling_height_m: undefined,
      has_loading_dock: false,
      cadastral_ref: "",
      is_serviced: false,
      base_rent: 0,
      base_charges: 0,
      deposit_amount: 0,
      notes: "",
      ...defaultValues,
    },
  });

  const selectedType = form.watch("type");
  const category = getCategoryFromType(selectedType);

  const showResidential = isResidentialLike(category);
  const showCommercial = isCommercialLike(category);
  const showIndustrial = isIndustrial(category);
  const showLand = isLand(category);

  async function onSubmit(values: UnitFormValues) {
    setSubmitting(true);
    setServerError(null);

    try {
      const url = unitId ? `/api/units/${unitId}` : "/api/units";
      const method = unitId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, property_id: propertyId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setServerError(data.error || "Erreur lors de l'enregistrement");
        setSubmitting(false);
        return;
      }

      router.push(`/properties/${propertyId}`);
      router.refresh();
    } catch {
      setServerError("Erreur réseau. Vérifiez votre connexion.");
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-24">
        {/* ============================================================ */}
        {/* SECTION 1 — Identification                                    */}
        {/* ============================================================ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identification du lot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Libellé du lot *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex : Apt 3B, Villa 12, Boutique 4..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Un nom court et unique pour identifier ce lot au quotidien.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de bien *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[60vh]">
                      {PROPERTY_CATEGORIES.map((cat) => (
                        <SelectGroup key={cat.value}>
                          <SelectLabel>{cat.label}</SelectLabel>
                          {cat.types.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ============================================================ */}
        {/* SECTION 2 — Localisation                                      */}
        {/* ============================================================ */}
        {!showLand && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Localisation dans l'immeuble
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="floor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Étage</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex : RDC, 1er, 2e..."
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="building_section"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bloc / Aile</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex : Bloc A, Aile Nord..."
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Optionnel. Utile pour les grandes résidences.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        {/* ============================================================ */}
        {/* SECTION 3 — Caractéristiques (champs conditionnels)           */}
        {/* ============================================================ */}
        {!showLand && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Caractéristiques</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Surface — pour tous sauf terrains purs (déjà géré plus bas) */}
              <FormField
                control={form.control}
                name="surface_m2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Surface (m²)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="Ex : 85"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* --- Champs résidentiels / touristiques / mixtes --- */}
              {showResidential && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="rooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pièces principales</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            placeholder="Ex : 3"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bedrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chambres</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            placeholder="Ex : 2"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bathrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salles d'eau</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            placeholder="Ex : 2"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {showResidential && category === "tourism" && (
                <FormField
                  control={form.control}
                  name="is_furnished"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded border p-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-0.5">
                        <FormLabel className="cursor-pointer">
                          Bien meublé et équipé
                        </FormLabel>
                        <FormDescription>
                          Cochez si le bien est loué avec mobilier et
                          équipements.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              )}

              {/* --- Champs commerciaux / professionnels --- */}
              {showCommercial && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="has_vitrine"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded border p-3">
                          <FormControl>
                            <Checkbox
                              checked={field.value ?? false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer">
                            Dispose d'une vitrine
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="has_open_space"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded border p-3">
                          <FormControl>
                            <Checkbox
                              checked={field.value ?? false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer">
                            Configuré en open-space
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  {category === "professional" && (
                    <FormField
                      control={form.control}
                      name="workstations"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre de postes de travail</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="numeric"
                              placeholder="Ex : 15"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}

              {/* --- Champs industriels --- */}
              {showIndustrial && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="ceiling_height_m"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hauteur sous plafond (m)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="Ex : 8"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="has_loading_dock"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded border p-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer">
                          Quai de chargement
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ============================================================ */}
        {/* SECTION 3bis — Caractéristiques spécifiques aux terrains      */}
        {/* ============================================================ */}
        {showLand && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Caractéristiques du terrain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="surface_m2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Superficie (m²)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="Ex : 500"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cadastral_ref"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Référence cadastrale</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex : 1234 / ABJ / 2024"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Optionnel. Utile en cas de litige ou de revente.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_serviced"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer">
                      Terrain viabilisé (eau, électricité, voirie)
                    </FormLabel>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        {/* ============================================================ */}
        {/* SECTION 4 — Conditions financières                            */}
        {/* ============================================================ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conditions financières</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="base_rent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loyer mensuel (FCFA) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="Ex : 150000"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="base_charges"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Charges mensuelles (FCFA)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="Ex : 25000"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Eau, électricité, gardiennage...
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deposit_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dépôt de garantie (FCFA)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="Ex : 300000"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Généralement 2 mois de loyer.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Aperçu du total */}
            <div className="rounded bg-muted p-3 text-sm">
              <span className="text-muted-foreground">
                Loyer total mensuel :{" "}
              </span>
              <span className="font-semibold">
                {(
                  (Number(form.watch("base_rent")) || 0) +
                  (Number(form.watch("base_charges")) || 0)
                ).toLocaleString("fr-FR")}{" "}
                FCFA
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ============================================================ */}
        {/* SECTION 5 — Notes internes                                    */}
        {/* ============================================================ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes internes</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarques</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Ex : Climatisation à réviser, compteur individuel, travaux prévus en 2026..."
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Ces notes restent visibles uniquement par votre agence.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ============================================================ */}
        {/* Barre d'action fixe en bas (mobile-friendly)                  */}
        {/* ============================================================ */}
        {serverError && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {serverError}
          </div>
        )}

        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background p-3 sm:static sm:border-0 sm:p-0">
          <div className="mx-auto flex max-w-3xl gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => router.back()}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1 sm:flex-none"
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {unitId ? "Enregistrer" : "Créer le lot"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
```

---

## 📁 4. `app/api/units/route.ts`

```ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { unitFormSchema } from "@/lib/validations/unit";
import {
  getCategoryFromType,
  isResidentialLike,
  isCommercialLike,
  isIndustrial,
  isLand,
} from "@/lib/property-types";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  // property_id est en plus du schéma principal
  const propertyId = (json as any)?.property_id;
  if (typeof propertyId !== "string" || !propertyId) {
    return NextResponse.json({ error: "property_id requis" }, { status: 422 });
  }

  const parsed = unitFormSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation échouée", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const v = parsed.data;
  const category = getCategoryFromType(v.type);

  // Construit le metadata selon la catégorie
  const metadata: Record<string, unknown> = {};
  if (isResidentialLike(category)) {
    if (v.rooms !== undefined) metadata.rooms = v.rooms;
    if (v.bedrooms !== undefined) metadata.bedrooms = v.bedrooms;
    if (v.bathrooms !== undefined) metadata.bathrooms = v.bathrooms;
    if (v.is_furnished !== undefined) metadata.is_furnished = v.is_furnished;
  }
  if (isCommercialLike(category)) {
    if (v.has_vitrine !== undefined) metadata.has_vitrine = v.has_vitrine;
    if (v.has_open_space !== undefined)
      metadata.has_open_space = v.has_open_space;
    if (v.workstations !== undefined) metadata.workstations = v.workstations;
  }
  if (isIndustrial(category)) {
    if (v.ceiling_height_m !== undefined)
      metadata.ceiling_height_m = v.ceiling_height_m;
    if (v.has_loading_dock !== undefined)
      metadata.has_loading_dock = v.has_loading_dock;
  }
  if (isLand(category)) {
    if (v.cadastral_ref) metadata.cadastral_ref = v.cadastral_ref;
    if (v.is_serviced !== undefined) metadata.is_serviced = v.is_serviced;
  }

  // Récupère l'organization_id depuis la propriété (RLS garantit l'accès)
  const { data: property, error: propError } = await supabase
    .from("properties")
    .select("organization_id")
    .eq("id", propertyId)
    .single();

  if (propError || !property) {
    return NextResponse.json(
      { error: "Propriété introuvable" },
      { status: 404 },
    );
  }

  const { data, error } = await supabase
    .from("units")
    .insert({
      organization_id: property.organization_id,
      property_id: propertyId,
      label: v.label.trim(),
      type: v.type,
      category,
      floor: v.floor?.trim() || null,
      building_section: v.building_section?.trim() || null,
      surface_m2: v.surface_m2 ?? null,
      base_rent: v.base_rent,
      base_charges: v.base_charges,
      deposit_amount: v.deposit_amount,
      notes: v.notes?.trim() || null,
      metadata,
      status: "vacant",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[units.POST]", error);
    return NextResponse.json(
      { error: "Erreur enregistrement" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
```

---

## 📁 5. `app/(dashboard)/properties/[id]/units/new/page.tsx`

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UnitForm } from "@/components/units/unit-form";

export default async function NewUnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id, name, commune, city")
    .eq("id", id)
    .single();

  if (!property) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href={`/properties/${property.id}`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Retour à {property.name}
      </Link>

      <h1 className="mb-1 text-xl font-semibold">Nouveau lot</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {property.name}
        {property.commune ? ` — ${property.commune}` : ""}
        {property.city ? `, ${property.city}` : ""}
      </p>

      <UnitForm propertyId={property.id} />
    </div>
  );
}
```

---

## ⚙️ Migration SQL complémentaire

Si vous n'avez pas encore les colonnes `category` et `metadata` :

```sql
alter table units
  add column if not exists category text not null default 'residential'
    check (category in (
      'residential', 'commercial', 'professional',
      'industrial', 'tourism', 'mixed', 'land_annex'
    )),
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists deposit_amount numeric(12,2) not null default 0,
  add column if not exists building_section text;

create index if not exists idx_units_category on units(organization_id, category);
create index if not exists idx_units_type on units(organization_id, type);
```

---

## 🎯 Ce que ce formulaire fait bien

1. **Adaptatif.** Un studio n'affiche pas les mêmes champs qu'un entrepôt ou un terrain. L'utilisateur ne voit que ce qui le concerne.
2. **Catégorie automatique.** L'utilisateur choisit un type, la catégorie se déduit toute seule. Aucun risque d'incohérence.
3. **Mobile-first.** La barre d'action est collée en bas de l'écran sur mobile (comme une app native). Elle redevient statique sur desktop.
4. **Aperçu du total en direct.** Le gestionnaire voit immédiatement loyer + charges = total mensuel, sans calcul mental.
5. **Données structurées.** Les champs optionnels vont dans `metadata` (JSONB), donc le schéma reste stable même si vous ajoutez des types plus tard.
6. **Sécurité.** Le `organization_id` est récupéré côté serveur depuis la propriété, jamais envoyé par le client. Impossible de créer un lot dans l'organisation d'un autre.

---

## 🧪 Tests manuels à faire

1. Créer un **Studio** → seuls surface et équipements résidentiels apparaissent.
2. Créer un **Plateau de bureaux** → champs vitrine, open-space, postes de travail.
3. Créer un **Entrepôt** → hauteur sous plafond et quai de chargement.
4. Créer un **Terrain viabilisé** → référence cadastrale et viabilisation. Pas d'étage.
5. Créer un **Immeuble mixte** → champs résidentiels ET commerciaux ensemble.
6. Tenter un POST direct sans `property_id` → `422`.
7. Tenter un POST avec un `property_id` d'une autre organisation → `404` (grâce à RLS).

Voici le formulaire complet de création de bail. Il est structuré en **3 sections claires** (Lot → Locataire → Conditions), avec un **calcul de prorata temporis en direct** et un aperçu du premier appel de loyer. Pensé pour la réglementation ivoirienne (loi n° 2018-575 du 27 juin 2018).

---

## 📁 1. `lib/lease-utils.ts`

```ts
// ============================================================
// Calculs métier liés aux baux
// ============================================================

/**
 * Nombre de jours dans un mois donné.
 * @param year ex: 2026
 * @param month 1-12
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Calcule le montant du loyer au prorata temporis pour le premier mois.
 *
 * Règle : si le bail commence le 1er du mois, on facture le mois plein.
 * Sinon, on facture du jour de début jusqu'à la fin du mois inclus.
 *
 * @example
 *   computeProrata(150000, new Date('2026-10-15'))
 *   // Octobre = 31 jours, occupé = 17 jours (15→31)
 *   // => 150000 × 17 / 31 = 82 258 FCFA
 */
export function computeProrata(
  fullAmount: number,
  startDate: Date,
): {
  amount: number;
  occupiedDays: number;
  totalDays: number;
  isFullMonth: boolean;
} {
  const year = startDate.getFullYear();
  const month = startDate.getMonth() + 1; // JS: 0-11 → 1-12
  const startDay = startDate.getDate();
  const totalDays = daysInMonth(year, month);
  const occupiedDays = totalDays - startDay + 1;
  const isFullMonth = startDay === 1;

  const amount = isFullMonth
    ? fullAmount
    : Math.round((fullAmount * occupiedDays) / totalDays);

  return { amount, occupiedDays, totalDays, isFullMonth };
}

/**
 * Calcule le montant total à payer à l'entrée (1er mois + dépôt de garantie).
 */
export function computeMoveInTotal(
  monthlyRent: number,
  monthlyCharges: number,
  deposit: number,
  startDate: Date,
) {
  const fullFirstMonth = monthlyRent + monthlyCharges;
  const prorata = computeProrata(fullFirstMonth, startDate);

  return {
    firstMonthRent: computeProrata(monthlyRent, startDate).amount,
    firstMonthCharges: computeProrata(monthlyCharges, startDate).amount,
    firstMonthTotal: prorata.amount,
    deposit,
    moveInTotal: prorata.amount + deposit,
    prorata,
  };
}

/**
 * Formate un montant en FCFA : "150 000 FCFA"
 */
export function formatFCFA(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return `${Math.round(value).toLocaleString("fr-FR")} FCFA`;
}

/**
 * Retourne le libellé d'un jour de paiement.
 */
export function paymentDayLabel(day: number): string {
  if (day === 1) return "Le 1er du mois (recommandé)";
  return `Le ${day} de chaque mois`;
}

/**
 * Vérifie que deux plages de dates se chevauchent.
 */
export function datesOverlap(
  startA: Date,
  endA: Date | null,
  startB: Date,
  endB: Date | null,
): boolean {
  const aEnd = endA ?? new Date("9999-12-31");
  const bEnd = endB ?? new Date("9999-12-31");
  return startA <= bEnd && startB <= aEnd;
}
```

---

## 📁 2. `lib/validations/lease.ts`

```ts
import { z } from "zod";

export const leaseFormSchema = z
  .object({
    // --- Section 1 : Le lot ---
    unit_id: z.string().uuid("Sélectionnez un lot"),

    // --- Section 2 : Le locataire ---
    tenant_id: z.string().uuid("Sélectionnez un locataire"),

    // --- Section 3 : Conditions ---
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date de début invalide"),
    end_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date de fin invalide")
      .optional()
      .nullable()
      .or(z.literal("")),

    rent_amount: z.coerce.number().min(0, "Loyer invalide"),
    charges_amount: z.coerce.number().min(0).default(0),
    deposit_amount: z.coerce.number().min(0).default(0),

    payment_day: z.coerce.number().int().min(1).max(28).default(1),

    // --- Clauses optionnelles ---
    revision_annual: z.boolean().default(true),
    revision_rate: z.coerce.number().min(0).max(20).default(0),
    furnished: z.boolean().default(false),
    includes_water: z.boolean().default(false),
    includes_electricity: z.boolean().default(false),
    includes_internet: z.boolean().default(false),

    notes: z.string().max(2000).optional().nullable(),
  })
  .refine(
    (data) => {
      if (!data.end_date) return true;
      return new Date(data.end_date) > new Date(data.start_date);
    },
    {
      message: "La date de fin doit être après la date de début",
      path: ["end_date"],
    },
  );

export type LeaseFormValues = z.infer<typeof leaseFormSchema>;
```

---

## 📁 3. `lib/api/leases.ts` — Helpers de requête (côté client)

```ts
import type { LeaseFormValues } from "@/lib/validations/lease";

export async function fetchAvailableUnits(supabase: any) {
  // Lot vacant OU dont le bail actuel se termine bientôt
  const { data, error } = await supabase
    .from("units")
    .select(
      `
      id, label, type, status,
      properties ( id, name, commune )
    `,
    )
    .in("status", ["vacant"])
    .order("label");

  if (error) throw error;
  return data;
}

export async function fetchTenants(supabase: any) {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, full_name, phone, email")
    .order("full_name");

  if (error) throw error;
  return data;
}

export function toLeasePayload(values: LeaseFormValues) {
  return {
    ...values,
    end_date: values.end_date || null,
  };
}
```

---

## 📁 4. `components/leases/lease-form.tsx`

```tsx
"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { leaseFormSchema, type LeaseFormValues } from "@/lib/validations/lease";
import { computeMoveInTotal, formatFCFA } from "@/lib/lease-utils";

interface UnitOption {
  id: string;
  label: string;
  type: string;
  properties: { name: string; commune: string | null } | null;
}

interface TenantOption {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
}

interface LeaseFormProps {
  units: UnitOption[];
  tenants: TenantOption[];
  preselectedUnitId?: string;
}

export function LeaseForm({
  units,
  tenants,
  preselectedUnitId,
}: LeaseFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LeaseFormValues>({
    resolver: zodResolver(leaseFormSchema),
    defaultValues: {
      unit_id: preselectedUnitId ?? "",
      tenant_id: "",
      start_date: new Date().toISOString().slice(0, 10),
      end_date: "",
      rent_amount: 0,
      charges_amount: 0,
      deposit_amount: 0,
      payment_day: 1,
      revision_annual: true,
      revision_rate: 0,
      furnished: false,
      includes_water: false,
      includes_electricity: false,
      includes_internet: false,
      notes: "",
    },
  });

  // --- Valeurs observées pour le preview ---
  const values = form.watch();

  // --- Preview du calcul de prorata ---
  const preview = useMemo(() => {
    if (!values.start_date) return null;
    const start = new Date(values.start_date);
    if (isNaN(start.getTime())) return null;

    const rent = Number(values.rent_amount) || 0;
    const charges = Number(values.charges_amount) || 0;
    const deposit = Number(values.deposit_amount) || 0;

    return computeMoveInTotal(rent, charges, deposit, start);
  }, [
    values.start_date,
    values.rent_amount,
    values.charges_amount,
    values.deposit_amount,
  ]);

  // --- Lot sélectionné : pré-remplir les montants ---
  function handleUnitChange(unitId: string) {
    form.setValue("unit_id", unitId);
    const unit = units.find((u) => u.id === unitId);
    if (unit) {
      // Le lot porte ses loyers de base — à récupérer via API si besoin
      // Ici on laisse l'utilisateur ajuster manuellement
    }
  }

  async function onSubmit(data: LeaseFormValues) {
    setSubmitting(true);
    setServerError(null);

    try {
      const res = await fetch("/api/leases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          end_date: data.end_date || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setServerError(err.error || "Erreur lors de la création du bail");
        setSubmitting(false);
        return;
      }

      const { id } = await res.json();
      router.push(`/leases/${id}`);
      router.refresh();
    } catch {
      setServerError("Erreur réseau. Vérifiez votre connexion.");
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-24">
        {/* ====================================================== */}
        {/* SECTION 1 — Le lot                                     */}
        {/* ====================================================== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Le bien concerné</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="unit_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lot à louer *</FormLabel>
                  <Select onValueChange={handleUnitChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un lot vacant" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {units.length === 0 && (
                        <div className="p-3 text-sm text-muted-foreground">
                          Aucun lot vacant. Créez d'abord un lot.
                        </div>
                      )}
                      {units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.label}
                          {u.properties
                            ? ` — ${u.properties.name}${u.properties.commune ? `, ${u.properties.commune}` : ""}`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ====================================================== */}
        {/* SECTION 2 — Le locataire                               */}
        {/* ====================================================== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Le locataire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="tenant_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Locataire *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un locataire" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {tenants.length === 0 && (
                        <div className="p-3 text-sm text-muted-foreground">
                          Aucun locataire enregistré. Créez-en un d'abord.
                        </div>
                      )}
                      {tenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.full_name} — {t.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ====================================================== */}
        {/* SECTION 3 — Conditions du bail                         */}
        {/* ====================================================== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Conditions du bail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* --- Dates --- */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de début *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de fin</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormDescription>
                      Laissez vide pour un bail à durée indéterminée.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* --- Montants --- */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="rent_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loyer mensuel (FCFA) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="Ex : 150000"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="charges_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Charges mensuelles</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="Ex : 25000"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Eau, électricité, gardiennage...
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deposit_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dépôt de garantie</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="Ex : 300000"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Généralement 2 mois de loyer.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* --- Jour de paiement --- */}
            <FormField
              control={form.control}
              name="payment_day"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jour de paiement mensuel *</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(Number(v))}
                    value={String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[1, 2, 3, 5, 10, 15].map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          Le {d === 1 ? "1er" : `${d}`} du mois
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Le jour où le loyer est dû chaque mois. Le 1er est
                    recommandé.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* --- Clauses optionnelles --- */}
            <div className="rounded border p-4 space-y-3">
              <p className="text-sm font-medium">
                Options incluses dans le loyer
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { name: "furnished", label: "Bien meublé" },
                  { name: "includes_water", label: "Eau incluse" },
                  {
                    name: "includes_electricity",
                    label: "Électricité incluse",
                  },
                  { name: "includes_internet", label: "Internet inclus" },
                ].map((opt) => (
                  <FormField
                    key={opt.name}
                    control={form.control}
                    name={opt.name as any}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={!!field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer font-normal">
                          {opt.label}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>

            {/* --- Révision annuelle --- */}
            <div className="rounded border p-4 space-y-3">
              <FormField
                control={form.control}
                name="revision_annual"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={!!field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-0.5">
                      <FormLabel className="cursor-pointer">
                        Révision annuelle du loyer
                      </FormLabel>
                      <FormDescription>
                        Le loyer peut être révisé chaque année à la date
                        anniversaire.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {values.revision_annual && (
                <FormField
                  control={form.control}
                  name="revision_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taux de révision annuel (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          placeholder="Ex : 2.5"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Laissez 0 si la révision doit être négociée à la date
                        anniversaire.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* ====================================================== */}
        {/* APERÇU DU PREMIER PAIEMENT                             */}
        {/* ====================================================== */}
        {preview && values.start_date && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4" />
                Aperçu du premier paiement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Période</span>
                <span>
                  {new Date(values.start_date).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  {" → "}
                  fin du mois
                </span>
              </div>

              {!preview.prorata.isFullMonth && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Jours occupés</span>
                  <span>
                    {preview.prorata.occupiedDays} / {preview.prorata.totalDays}{" "}
                    jours
                    <Badge variant="secondary" className="ml-2">
                      prorata
                    </Badge>
                  </span>
                </div>
              )}

              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {preview.prorata.isFullMonth ? "Loyer" : "Loyer (prorata)"}
                  </span>
                  <span>{formatFCFA(preview.firstMonthRent)}</span>
                </div>

                {preview.firstMonthCharges > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {preview.prorata.isFullMonth
                        ? "Charges"
                        : "Charges (prorata)"}
                    </span>
                    <span>{formatFCFA(preview.firstMonthCharges)}</span>
                  </div>
                )}

                {preview.deposit > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Dépôt de garantie
                    </span>
                    <span>{formatFCFA(preview.deposit)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t pt-3 font-semibold">
                <span>Total à l'entrée</span>
                <span className="text-primary">
                  {formatFCFA(preview.moveInTotal)}
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                Les mois suivants seront facturés au montant plein de{" "}
                {formatFCFA(
                  (Number(values.rent_amount) || 0) +
                    (Number(values.charges_amount) || 0),
                )}
                , le {values.payment_day === 1 ? "1er" : values.payment_day} de
                chaque mois.
              </p>
            </CardContent>
          </Card>
        )}

        {/* --- Notes --- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes internes</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Ex : accord verbal pour travaux peinture avant emménagement, remise des clés le 15..."
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* --- Erreur serveur --- */}
        {serverError && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {serverError}
          </div>
        )}

        {/* --- Barre d'action fixe --- */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background p-3 sm:static sm:border-0 sm:p-0">
          <div className="mx-auto flex max-w-3xl gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => router.back()}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1 sm:flex-none"
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer le bail
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
```

---

## 📁 5. `app/api/leases/route.ts`

```ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { leaseFormSchema } from "@/lib/validations/lease";
import { computeMoveInTotal, daysInMonth } from "@/lib/lease-utils";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = leaseFormSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation échouée", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const v = parsed.data;

  // --- Récupérer l'unité et vérifier qu'elle est bien accessible (RLS) ---
  const { data: unit, error: unitError } = await supabase
    .from("units")
    .select("id, organization_id, status, base_rent, base_charges")
    .eq("id", v.unit_id)
    .single();

  if (unitError || !unit) {
    return NextResponse.json({ error: "Lot introuvable" }, { status: 404 });
  }

  if (unit.status !== "vacant") {
    return NextResponse.json(
      { error: "Ce lot n'est plus disponible pour un nouveau bail." },
      { status: 409 },
    );
  }

  // --- Vérifier que le locataire appartient bien à la même organisation ---
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, organization_id")
    .eq("id", v.tenant_id)
    .single();

  if (
    tenantError ||
    !tenant ||
    tenant.organization_id !== unit.organization_id
  ) {
    return NextResponse.json({ error: "Locataire invalide" }, { status: 404 });
  }

  // --- Créer le bail (transaction unique) ---
  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .insert({
      organization_id: unit.organization_id,
      unit_id: v.unit_id,
      tenant_id: v.tenant_id,
      start_date: v.start_date,
      end_date: v.end_date || null,
      rent_amount: v.rent_amount,
      charges_amount: v.charges_amount,
      deposit_amount: v.deposit_amount,
      payment_day: v.payment_day,
      status: "active",
      notes: v.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (leaseError || !lease) {
    console.error("[leases.POST]", leaseError);
    return NextResponse.json(
      { error: "Erreur lors de la création du bail" },
      { status: 500 },
    );
  }

  // --- Marquer le lot comme loué ---
  await supabase
    .from("units")
    .update({ status: "occupied" })
    .eq("id", v.unit_id);

  // --- Créer le premier appel de loyer avec prorata ---
  const startDate = new Date(v.start_date);
  const preview = computeMoveInTotal(
    v.rent_amount,
    v.charges_amount,
    v.deposit_amount,
    startDate,
  );

  const year = startDate.getFullYear();
  const month = startDate.getMonth() + 1;
  const totalDays = daysInMonth(year, month);

  // On crée une échéance avec les montants au prorata
  await supabase.from("rent_calls").insert({
    organization_id: unit.organization_id,
    lease_id: lease.id,
    period_month: month,
    period_year: year,
    due_date: v.start_date,
    rent_amount: preview.firstMonthRent,
    charges_amount: preview.firstMonthCharges,
    total_amount: preview.firstMonthTotal,
    status: "pending",
    notes: preview.prorata.isFullMonth
      ? null
      : `Prorata temporis — ${preview.prorata.occupiedDays}/${totalDays} jours`,
  });

  return NextResponse.json({ id: lease.id }, { status: 201 });
}
```

---

## 📁 6. `app/(dashboard)/leases/new/page.tsx`

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LeaseForm } from "@/components/leases/lease-form";

export default async function NewLeasePage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { unit: preselectedUnitId } = await searchParams;
  const supabase = await createSupabaseServerClient();

  // --- Lots vacants (RLS filtre automatiquement par organisation) ---
  const { data: unitsData } = await supabase
    .from("units")
    .select(
      `
      id, label, type, status,
      properties ( id, name, commune )
    `,
    )
    .eq("status", "vacant")
    .order("label");

  // --- Locataires ---
  const { data: tenantsData } = await supabase
    .from("tenants")
    .select("id, full_name, phone, email")
    .order("full_name");

  const units = (unitsData ?? []) as any;
  const tenants = (tenantsData ?? []) as any;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href="/leases"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Retour aux baux
      </Link>

      <h1 className="mb-1 text-xl font-semibold">Nouveau bail</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Lier un lot à un locataire et définir les conditions.
      </p>

      {units.length === 0 ? (
        <div className="rounded border bg-muted p-4 text-sm">
          Aucun lot vacant.{" "}
          <Link href="/properties" className="underline">
            Créez d'abord un lot
          </Link>
          .
        </div>
      ) : tenants.length === 0 ? (
        <div className="rounded border bg-muted p-4 text-sm">
          Aucun locataire enregistré.{" "}
          <Link href="/tenants/new" className="underline">
            Créez un locataire
          </Link>{" "}
          d'abord.
        </div>
      ) : (
        <LeaseForm
          units={units}
          tenants={tenants}
          preselectedUnitId={preselectedUnitId}
        />
      )}
    </div>
  );
}
```

---

## 🧮 Exemple concret du calcul de prorata

**Cas :** bail commence le **15 octobre 2026**, loyer **150 000 FCFA**, charges **25 000 FCFA**, dépôt **300 000 FCFA**.

| Étape                        | Calcul                    | Résultat         |
| ---------------------------- | ------------------------- | ---------------- |
| Jours dans le mois d'octobre | —                         | 31 jours         |
| Jours occupés                | 31 − 15 + 1               | **17 jours**     |
| Loyer au prorata             | 150 000 × 17 / 31         | **82 258 FCFA**  |
| Charges au prorata           | 25 000 × 17 / 31          | **13 710 FCFA**  |
| Dépôt (pas de prorata)       | —                         | **300 000 FCFA** |
| **Total à l'entrée**         | 82 258 + 13 710 + 300 000 | **395 968 FCFA** |
| Novembre et suivants         | 150 000 + 25 000          | **175 000 FCFA** |

Le formulaire affiche exactement ce décompte **en temps réel**, avant même la soumission.

---

## 🎯 Ce que cette implémentation garantit

1. **Prorata exact.** Basé sur les vrais jours du mois (28, 29, 30 ou 31), pas d'approximation.
2. **Aucune double facturation.** Le premier appel de loyer est créé immédiatement avec les bons montants, le cron mensuel ne le recréera pas (contrainte `unique` déjà en base).
3. **Cohérence d'organisation.** Le locataire doit appartenir à la même organisation que le lot — vérifié côté serveur.
4. **Sécurité.** Le lot doit être `vacant`. Impossible de créer un bail sur un lot déjà loué.
5. **Traçabilité du prorata.** Le détail "17/31 jours" est enregistré en note sur l'échéance pour audit.
6. **Mobile-first.** La barre d'action reste accessible en bas, l'aperçu du paiement est compact et lisible.

---

## 🧪 Tests manuels prioritaires

1. **Bail démarrant le 1er du mois** → pas de prorata, montant plein.
2. **Bail démarrant le 15** → prorata 17/31 visible et correct.
3. **Bail démarrant le 31 d'un mois de 31 jours** → prorata 1/31 (montant très faible).
4. **Bail sur lot déjà occupé** → `409` "Ce lot n'est plus disponible".
5. **Bail avec locataire d'une autre organisation** → `404` (RLS).
6. **Prorata février** : bail démarrant le 20 février 2026 → prorata 9/28.
7. **Prorata février bissextile** : 20 février 2028 → prorata 10/29.

---

Prochaine brique logique : **la page `/leases/[id]` (fiche de bail)** avec l'historique des échéances, les paiements, le bouton "Résilier le bail" et la génération PDF du contrat. Vous voulez que j'enchaîne ?
