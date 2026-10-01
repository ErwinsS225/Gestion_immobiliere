Bonne nouvelle : **il n'y a pas de champ "état des lieux" dans le schéma actuel**. Il faut le créer. Mais avant de coder, il faut distinguer **deux concepts** que tout le monde confond et qui, dans une agence, sont distincts :

| Concept                    | Ce qu'on vérifie                | Exemple                                         |
| -------------------------- | ------------------------------- | ----------------------------------------------- |
| **Inventaire du mobilier** | Les objets mobiles présents     | Frigo, TV, canapé, machine à laver...           |
| **État des lieux**         | L'état du bâti, pièce par pièce | Murs, sol, plafond, portes, fenêtres, prises... |

Un appartement meublé a **besoin des deux** : à l'entrée on fait un état des lieux (le bâti est-il en bon état ?) **et** un inventaire (quels objets sont présents et dans quel état ?). À la sortie, on refait les deux et on compare. C'est cette comparaison qui protège juridiquement l'agence et le propriétaire.

Voici l'implémentation complète.

---

## 📁 1. `supabase/migrations/xxx_inventory_and_inspection.sql`

```sql
-- ============================================================
-- Énumérations
-- ============================================================

create type item_condition as enum (
  'new',        -- Neuf
  'good',       -- Bon état
  'fair',       -- État d'usage
  'worn',       -- Usé
  'damaged',    -- Endommagé
  'missing',    -- Manquant
  'replaced'    -- Remplacé
);

create type inspection_type as enum (
  'move_in',     -- Entrée
  'move_out',    -- Sortie
  'periodic',    -- Périodique (contrôle en cours de bail)
  'pre_rental'   -- Avant mise en location
);

create type inspection_status as enum (
  'draft',                -- Brouillon
  'tenant_signed',        -- Signé par le locataire
  'landlord_signed',      -- Signé par le bailleur
  'completed',            -- Signé par les deux
  'disputed'              -- Contesté
);

-- ============================================================
-- Catalogue d'items (référentiel partagé)
-- ============================================================

create table public.inventory_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  -- null = catalogue système partagé par toutes les organisations
  category text not null,
  name text not null,
  default_quantity int not null default 1,
  icon text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index on inventory_catalog(organization_id);
create index on inventory_catalog(category);

-- ============================================================
-- Inventaire du mobilier par bail
-- ============================================================

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  lease_id uuid not null references leases(id) on delete cascade,
  catalog_id uuid references inventory_catalog(id) on delete set null,

  -- Snapshot du nom (protège contre les changements du catalogue)
  name text not null,
  category text,

  quantity int not null default 1 check (quantity > 0),
  condition item_condition not null default 'good',
  notes text,
  photo_url text,

  -- Suivi : ajouté après l'entrée ? remplacé ?
  added_after_move_in boolean not null default false,
  replaced_item_id uuid references inventory_items(id) on delete set null,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on inventory_items(lease_id);
create index on inventory_items(organization_id);

-- ============================================================
-- État des lieux (bâti)
-- ============================================================

create table public.inspection_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  lease_id uuid not null references leases(id) on delete cascade,

  type inspection_type not null,
  status inspection_status not null default 'draft',
  inspection_date date not null,
  conducted_by uuid references auth.users(id),

  tenant_present boolean not null default false,

  -- Relevés de compteurs (utiles en Côte d'Ivoire : eau, électricité)
  water_meter_index numeric(12,2),
  electricity_meter_index numeric(12,2),

  general_notes text,

  -- Signatures (URLs vers Supabase Storage)
  tenant_signature_url text,
  landlord_signature_url text,
  tenant_signed_at timestamptz,
  landlord_signed_at timestamptz,

  pdf_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on inspection_reports(lease_id);
create index on inspection_reports(organization_id);
create index on inspection_reports(type);

-- Détails : un enregistrement par élément vérifié
create table public.inspection_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references inspection_reports(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,

  room text not null,        -- 'Salon', 'Cuisine', 'Chambre 1'...
  element text not null,     -- 'Murs', 'Sol', 'Plafond', 'Portes', 'Fenêtres'...

  condition item_condition not null,
  notes text,
  photo_url text,

  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index on inspection_items(report_id);
create index on inspection_items(organization_id);

-- ============================================================
-- Triggers updated_at
-- ============================================================

create trigger set_updated_at before update on inventory_items
for each row execute function public.tg_set_updated_at();

create trigger set_updated_at before update on inspection_reports
for each row execute function public.tg_set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

alter table inventory_catalog     enable row level security;
alter table inventory_items       enable row level security;
alter table inspection_reports    enable row level security;
alter table inspection_items      enable row level security;

-- ---- inventory_catalog ----
-- Lecture : tout le monde voit le catalogue système (organization_id is null)
-- + le catalogue de son organisation
create policy "catalog: read system or own"
on inventory_catalog for select
using (
  organization_id is null
  or is_org_member(organization_id)
);

create policy "catalog: write own"
on inventory_catalog for all
using (organization_id is not null and can_write_org(organization_id))
with check (organization_id is not null and can_write_org(organization_id));

-- ---- inventory_items ----
create policy "inv_items: read"
on inventory_items for select
using (is_org_member(organization_id));

create policy "inv_items: write"
on inventory_items for all
using (can_write_org(organization_id))
with check (can_write_org(organization_id));

-- ---- inspection_reports ----
create policy "reports: read"
on inspection_reports for select
using (is_org_member(organization_id));

create policy "reports: write"
on inspection_reports for all
using (can_write_org(organization_id))
with check (can_write_org(organization_id));

-- ---- inspection_items ----
create policy "insp_items: read"
on inspection_items for select
using (is_org_member(organization_id));

create policy "insp_items: write"
on inspection_items for all
using (can_write_org(organization_id))
with check (can_write_org(organization_id));

-- ============================================================
-- Storage bucket pour les photos
-- ============================================================

insert into storage.buckets (id, name, public)
values ('inspection-photos', 'inspection-photos', false)
on conflict (id) do nothing;

-- Politique : un membre de l'org peut lire/écrire ses photos
create policy "photos: org members read"
on storage.objects for select
using (
  bucket_id = 'inspection-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] in (
    select organization_id::text from memberships where user_id = auth.uid()
  )
);

create policy "photos: writers upload"
on storage.objects for insert
with check (
  bucket_id = 'inspection-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] in (
    select m.organization_id::text
    from memberships m
    where m.user_id = auth.uid()
      and m.role in ('owner', 'manager')
  )
);
```

---

## 📁 2. `supabase/migrations/xxx_seed_inventory_catalog.sql`

Catalogue système pré-rempli. **`organization_id = null`** signifie qu'il est partagé par toutes les agences. Chaque agence peut ensuite ajouter ses propres items.

```sql
insert into inventory_catalog (organization_id, category, name, default_quantity, sort_order) values
-- Salon / Séjour
(null, 'Salon', 'Canapé 3 places', 1, 10),
(null, 'Salon', 'Canapé 2 places', 1, 11),
(null, 'Salon', 'Fauteuil', 1, 12),
(null, 'Salon', 'Table basse', 1, 13),
(null, 'Salon', 'Table à manger', 1, 14),
(null, 'Salon', 'Chaise', 4, 15),
(null, 'Salon', 'Buffet / Vaisselier', 1, 16),
(null, 'Salon', 'Meuble TV', 1, 17),
(null, 'Salon', 'Télévision', 1, 18),
(null, 'Salon', 'Décodeur TV', 1, 19),
(null, 'Salon', 'Ventilateur plafond', 1, 20),
(null, 'Salon', 'Ventilateur sur pied', 1, 21),
(null, 'Salon', 'Climatiseur split', 1, 22),
(null, 'Salon', 'Rideaux', 1, 23),
(null, 'Salon', 'Tapis', 1, 24),
(null, 'Salon', 'Lustre / Luminaire', 1, 25),
(null, 'Salon', 'Miroir', 1, 26),

-- Chambre
(null, 'Chambre', 'Lit simple', 1, 30),
(null, 'Chambre', 'Lit double', 1, 31),
(null, 'Chambre', 'Lit superposé', 1, 32),
(null, 'Chambre', 'Matelas simple', 1, 33),
(null, 'Chambre', 'Matelas double', 1, 34),
(null, 'Chambre', 'Sommier', 1, 35),
(null, 'Chambre', 'Armoire / Penderie', 1, 36),
(null, 'Chambre', 'Commode', 1, 37),
(null, 'Chambre', 'Table de chevet', 1, 38),
(null, 'Chambre', 'Coiffeuse', 1, 39),
(null, 'Chambre', 'Miroir', 1, 40),
(null, 'Chambre', 'Ventilateur', 1, 41),
(null, 'Chambre', 'Climatiseur', 1, 42),
(null, 'Chambre', 'Rideaux', 1, 43),
(null, 'Chambre', 'Tapis', 1, 44),

-- Cuisine
(null, 'Cuisine', 'Réfrigérateur', 1, 50),
(null, 'Cuisine', 'Congélateur', 1, 51),
(null, 'Cuisine', 'Cuisinière gaz', 1, 52),
(null, 'Cuisine', 'Cuisinière électrique', 1, 53),
(null, 'Cuisine', 'Plaque de cuisson', 1, 54),
(null, 'Cuisine', 'Four', 1, 55),
(null, 'Cuisine', 'Micro-ondes', 1, 56),
(null, 'Cuisine', 'Hotte aspirante', 1, 57),
(null, 'Cuisine', 'Évier', 1, 58),
(null, 'Cuisine', 'Lave-vaisselle', 1, 59),
(null, 'Cuisine', 'Bouilloire', 1, 60),
(null, 'Cuisine', 'Cafetière', 1, 61),
(null, 'Cuisine', 'Grille-pain', 1, 62),
(null, 'Cuisine', 'Blender / Mixeur', 1, 63),
(null, 'Cuisine', 'Batterie de cuisine', 1, 64),
(null, 'Cuisine', 'Service de vaisselle', 1, 65),
(null, 'Cuisine', 'Couverts (set)', 1, 66),
(null, 'Cuisine', 'Verres', 6, 67),
(null, 'Cuisine', 'Tasses', 6, 68),
(null, 'Cuisine', 'Poubelle', 1, 69),
(null, 'Cuisine', 'Balai', 1, 70),
(null, 'Cuisine', 'Serpillière + seau', 1, 71),

-- Salle de bain
(null, 'Salle de bain', 'Douche', 1, 80),
(null, 'Salle de bain', 'Baignoire', 1, 81),
(null, 'Salle de bain', 'Lavabo', 1, 82),
(null, 'Salle de bain', 'WC', 1, 83),
(null, 'Salle de bain', 'Miroir', 1, 84),
(null, 'Salle de bain', 'Porte-serviettes', 1, 85),
(null, 'Salle de bain', 'Chauffe-eau', 1, 86),
(null, 'Salle de bain', 'Rideau de douche', 1, 87),
(null, 'Salle de bain', 'Pommeau de douche', 1, 88),

-- Buanderie
(null, 'Buanderie', 'Machine à laver', 1, 90),
(null, 'Buanderie', 'Fer à repasser', 1, 91),
(null, 'Buanderie', 'Table à repasser', 1, 92),
(null, 'Buanderie', 'Étendoir à linge', 1, 93),
(null, 'Buanderie', 'Panier à linge', 1, 94),

-- Divers
(null, 'Divers', 'Extincteur', 1, 100),
(null, 'Divers', 'Détecteur de fumée', 1, 101),
(null, 'Divers', 'Groupe électrogène', 1, 102),
(null, 'Divers', 'Clés (jeu)', 2, 103),
(null, 'Divers', 'Badges / Télécommandes portail', 1, 104),

-- Extérieur (villa)
(null, 'Extérieur', 'Mobilier de jardin', 1, 110),
(null, 'Extérieur', 'Barbecue', 1, 111),
(null, 'Extérieur', 'Parasol', 1, 112),
(null, 'Extérieur', 'Transat', 1, 113)
on conflict do nothing;
```

---

## 📁 3. `lib/inventory-types.ts`

```ts
// ============================================================
// Constantes et libellés
// ============================================================

export type ItemCondition =
  | "new"
  | "good"
  | "fair"
  | "worn"
  | "damaged"
  | "missing"
  | "replaced";

export const ITEM_CONDITIONS: {
  value: ItemCondition;
  label: string;
  color: string;
}[] = [
  { value: "new", label: "Neuf", color: "bg-emerald-100 text-emerald-800" },
  { value: "good", label: "Bon état", color: "bg-green-100 text-green-800" },
  {
    value: "fair",
    label: "État d'usage",
    color: "bg-yellow-100 text-yellow-800",
  },
  { value: "worn", label: "Usé", color: "bg-orange-100 text-orange-800" },
  { value: "damaged", label: "Endommagé", color: "bg-red-100 text-red-800" },
  { value: "missing", label: "Manquant", color: "bg-gray-200 text-gray-800" },
  { value: "replaced", label: "Remplacé", color: "bg-blue-100 text-blue-800" },
];

export function getConditionMeta(c: ItemCondition) {
  return ITEM_CONDITIONS.find((x) => x.value === c) ?? ITEM_CONDITIONS[1];
}

export type InspectionType = "move_in" | "move_out" | "periodic" | "pre_rental";

export const INSPECTION_TYPES: { value: InspectionType; label: string }[] = [
  { value: "move_in", label: "État des lieux d'entrée" },
  { value: "move_out", label: "État des lieux de sortie" },
  { value: "periodic", label: "Contrôle périodique" },
  { value: "pre_rental", label: "État des lieux avant location" },
];

// ============================================================
// Grille type d'état des lieux (bâti)
// ============================================================

export const DEFAULT_ROOMS: { name: string; elements: string[] }[] = [
  {
    name: "Entrée",
    elements: [
      "Sol",
      "Murs",
      "Plafond",
      "Porte principale",
      "Interrupteurs",
      "Serrure",
    ],
  },
  {
    name: "Salon / Séjour",
    elements: [
      "Sol",
      "Murs",
      "Plafond",
      "Portes",
      "Fenêtres",
      "Prises électriques",
      "Interrupteurs",
      "Luminaires",
    ],
  },
  {
    name: "Cuisine",
    elements: [
      "Sol",
      "Murs",
      "Plafond",
      "Portes",
      "Fenêtres",
      "Évier",
      "Robinetterie",
      "Prises électriques",
      "Placards",
    ],
  },
  {
    name: "Chambre 1",
    elements: [
      "Sol",
      "Murs",
      "Plafond",
      "Porte",
      "Fenêtre",
      "Prises électriques",
      "Interrupteurs",
    ],
  },
  {
    name: "Chambre 2",
    elements: [
      "Sol",
      "Murs",
      "Plafond",
      "Porte",
      "Fenêtre",
      "Prises électriques",
      "Interrupteurs",
    ],
  },
  {
    name: "Salle de bain",
    elements: [
      "Sol",
      "Murs",
      "Plafond",
      "Porte",
      "Douche / Baignoire",
      "Lavabo",
      "WC",
      "Robinetterie",
      "Ventilation",
    ],
  },
  {
    name: "WC",
    elements: [
      "Sol",
      "Murs",
      "Plafond",
      "Porte",
      "WC",
      "Lavabo",
      "Ventilation",
    ],
  },
  {
    name: "Balcon / Terrasse",
    elements: ["Sol", "Murs", "Plafond", "Garde-corps", "Porte-fenêtre"],
  },
];
```

---

## 📁 4. `app/api/leases/[id]/inventory/route.ts`

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const itemSchema = z.object({
  catalog_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(120),
  category: z.string().max(60).optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
  condition: z.enum([
    "new",
    "good",
    "fair",
    "worn",
    "damaged",
    "missing",
    "replaced",
  ]),
  notes: z.string().max(500).optional().nullable(),
  photo_url: z.string().url().optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: leaseId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = itemSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation échouée", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Récupérer l'organization_id du bail (RLS filtre déjà)
  const { data: lease } = await supabase
    .from("leases")
    .select("organization_id")
    .eq("id", leaseId)
    .single();

  if (!lease)
    return NextResponse.json({ error: "Bail introuvable" }, { status: 404 });

  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      organization_id: lease.organization_id,
      lease_id: leaseId,
      catalog_id: parsed.data.catalog_id ?? null,
      name: parsed.data.name.trim(),
      category: parsed.data.category?.trim() || null,
      quantity: parsed.data.quantity,
      condition: parsed.data.condition,
      notes: parsed.data.notes?.trim() || null,
      photo_url: parsed.data.photo_url ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[inventory.POST]", error);
    return NextResponse.json(
      { error: "Erreur enregistrement" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
```

---

## 📁 5. `components/leases/lease-inventory.tsx`

```tsx
"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ITEM_CONDITIONS,
  getConditionMeta,
  type ItemCondition,
} from "@/lib/inventory-types";

interface CatalogItem {
  id: string;
  category: string;
  name: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  condition: ItemCondition;
  notes: string | null;
  photo_url: string | null;
}

interface Props {
  leaseId: string;
  catalog: CatalogItem[];
  items: InventoryItem[];
}

export function LeaseInventory({ leaseId, catalog, items }: Props) {
  const [open, setOpen] = useState(false);

  // Grouper par catégorie
  const grouped = useMemo(() => {
    const map = new Map<string, InventoryItem[]>();
    for (const it of items) {
      const key = it.category ?? "Autres";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          Inventaire du mobilier ({items.length} objets)
        </CardTitle>
        <AddItemDialog
          leaseId={leaseId}
          catalog={catalog}
          open={open}
          onOpenChange={setOpen}
        />
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun objet enregistré. Ajoutez les meubles et équipements présents
            dans le logement.
          </p>
        ) : (
          <div className="space-y-6">
            {grouped.map(([category, list]) => (
              <div key={category}>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </h4>
                <ul className="divide-y rounded border">
                  {list.map((it) => {
                    const meta = getConditionMeta(it.condition);
                    return (
                      <li key={it.id} className="flex items-center gap-3 p-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">
                              {it.name}
                            </span>
                            {it.quantity > 1 && (
                              <Badge variant="outline">×{it.quantity}</Badge>
                            )}
                          </div>
                          {it.notes && (
                            <p className="mt-0.5 text-xs text-muted-foreground truncate">
                              {it.notes}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Dialogue d'ajout
// ============================================================

function AddItemDialog({
  leaseId,
  catalog,
  open,
  onOpenChange,
}: {
  leaseId: string;
  catalog: CatalogItem[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<ItemCondition>("good");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const catalogGrouped = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const c of catalog) {
      if (!map.has(c.category)) map.set(c.category, []);
      map.get(c.category)!.push(c);
    }
    return Array.from(map.entries());
  }, [catalog]);

  function selectFromCatalog(id: string) {
    const item = catalog.find((c) => c.id === id);
    if (item) {
      setName(item.name);
      setCategory(item.category);
    }
  }

  async function submit() {
    if (!name.trim()) return;
    setSubmitting(true);

    const res = await fetch(`/api/leases/${leaseId}/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        category,
        quantity,
        condition,
        notes: notes || null,
      }),
    });

    setSubmitting(false);
    if (!res.ok) return;

    onOpenChange(false);
    setName("");
    setCategory("");
    setQuantity(1);
    setCondition("good");
    setNotes("");
    window.location.reload();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Ajouter un objet
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter un objet à l'inventaire</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sélection rapide depuis le catalogue */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Choisir depuis le catalogue
            </label>
            <Select onValueChange={selectFromCatalog}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un objet courant" />
              </SelectTrigger>
              <SelectContent className="max-h-[40vh]">
                {catalogGrouped.map(([cat, list]) => (
                  <div key={cat}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {cat}
                    </div>
                    {list.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Nom *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Catégorie
              </label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Quantité</label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 1)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">État *</label>
              <Select
                value={condition}
                onValueChange={(v) => setCondition(v as ItemCondition)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_CONDITIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Notes</label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex : rayure sur le côté gauche, télécommande manquante..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting || !name.trim()}>
            {submitting ? "Ajout…" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 📁 6. `components/leases/inspection-form.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ITEM_CONDITIONS,
  INSPECTION_TYPES,
  DEFAULT_ROOMS,
  type ItemCondition,
  type InspectionType,
} from "@/lib/inventory-types";

type RoomState = Record<string, { condition: ItemCondition; notes: string }>;

interface Props {
  leaseId: string;
  defaultType?: InspectionType;
  rooms?: { name: string; elements: string[] }[];
}

export function InspectionForm({
  leaseId,
  defaultType = "move_in",
  rooms = DEFAULT_ROOMS,
}: Props) {
  const router = useRouter();
  const [type, setType] = useState<InspectionType>(defaultType);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [waterIndex, setWaterIndex] = useState("");
  const [elecIndex, setElecIndex] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [tenantPresent, setTenantPresent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Structure : rooms[roomName][element] = { condition, notes }
  const [state, setState] = useState<Record<string, RoomState>>(() => {
    const init: Record<string, RoomState> = {};
    for (const r of rooms) {
      init[r.name] = {};
      for (const el of r.elements) {
        init[r.name][el] = { condition: "good", notes: "" };
      }
    }
    return init;
  });

  function updateCondition(
    room: string,
    element: string,
    condition: ItemCondition,
  ) {
    setState((s) => ({
      ...s,
      [room]: { ...s[room], [element]: { ...s[room][element], condition } },
    }));
  }

  function updateNotes(room: string, element: string, notes: string) {
    setState((s) => ({
      ...s,
      [room]: { ...s[room], [element]: { ...s[room][element], notes } },
    }));
  }

  async function submit() {
    setSubmitting(true);

    const items = Object.entries(state).flatMap(([room, elements]) =>
      Object.entries(elements).map(([element, v], idx) => ({
        room,
        element,
        condition: v.condition,
        notes: v.notes || null,
        sort_order: idx,
      })),
    );

    const res = await fetch(`/api/leases/${leaseId}/inspections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        inspection_date: date,
        water_meter_index: waterIndex ? Number(waterIndex) : null,
        electricity_meter_index: elecIndex ? Number(elecIndex) : null,
        general_notes: generalNotes || null,
        tenant_present: tenantPresent,
        items,
      }),
    });

    setSubmitting(false);
    if (!res.ok) return;

    const { id } = await res.json();
    router.push(`/inspections/${id}`);
    router.refresh();
  }

  return (
    <div className="space-y-4 pb-24">
      {/* En-tête */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Type *</label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as InspectionType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSPECTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Date *</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Index compteur eau
            </label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Ex : 1245"
              value={waterIndex}
              onChange={(e) => setWaterIndex(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Index compteur électricité
            </label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Ex : 8752"
              value={elecIndex}
              onChange={(e) => setElecIndex(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Une carte par pièce */}
      {rooms.map((room) => (
        <Card key={room.name}>
          <CardHeader>
            <CardTitle className="text-base">{room.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {room.elements.map((el) => {
              const v = state[room.name][el];
              return (
                <div key={el} className="rounded border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex-1 text-sm font-medium">{el}</span>
                    <Select
                      value={v.condition}
                      onValueChange={(c) =>
                        updateCondition(room.name, el, c as ItemCondition)
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_CONDITIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {v.condition !== "good" && (
                    <Input
                      placeholder="Précisions (optionnel)"
                      value={v.notes}
                      onChange={(e) =>
                        updateNotes(room.name, el, e.target.value)
                      }
                    />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Notes générales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Observations générales</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={3}
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            placeholder="Ex : remise des 2 jeux de clés + 1 télécommande portail..."
          />
        </CardContent>
      </Card>

      {/* Barre d'action */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background p-3 sm:static sm:border-0 sm:p-0">
        <div className="mx-auto flex max-w-3xl gap-3">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={() => router.back()}
          >
            Annuler
          </Button>
          <Button
            className="flex-1 sm:flex-none"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Enregistrer l'état des lieux
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

## 📁 7. `app/api/leases/[id]/inspections/route.ts`

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const itemSchema = z.object({
  room: z.string().min(1).max(60),
  element: z.string().min(1).max(80),
  condition: z.enum([
    "new",
    "good",
    "fair",
    "worn",
    "damaged",
    "missing",
    "replaced",
  ]),
  notes: z.string().max(500).optional().nullable(),
  sort_order: z.number().int().default(0),
});

const bodySchema = z.object({
  type: z.enum(["move_in", "move_out", "periodic", "pre_rental"]),
  inspection_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  water_meter_index: z.coerce.number().min(0).optional().nullable(),
  electricity_meter_index: z.coerce.number().min(0).optional().nullable(),
  general_notes: z.string().max(2000).optional().nullable(),
  tenant_present: z.boolean().default(false),
  items: z.array(itemSchema).min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: leaseId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation échouée", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { data: lease } = await supabase
    .from("leases")
    .select("organization_id")
    .eq("id", leaseId)
    .single();

  if (!lease)
    return NextResponse.json({ error: "Bail introuvable" }, { status: 404 });

  const v = parsed.data;

  // Créer le rapport
  const { data: report, error: reportError } = await supabase
    .from("inspection_reports")
    .insert({
      organization_id: lease.organization_id,
      lease_id: leaseId,
      type: v.type,
      status: "draft",
      inspection_date: v.inspection_date,
      conducted_by: user.id,
      tenant_present: v.tenant_present,
      water_meter_index: v.water_meter_index ?? null,
      electricity_meter_index: v.electricity_meter_index ?? null,
      general_notes: v.general_notes?.trim() || null,
    })
    .select("id")
    .single();

  if (reportError || !report) {
    console.error("[inspections.POST]", reportError);
    return NextResponse.json(
      { error: "Erreur création rapport" },
      { status: 500 },
    );
  }

  // Créer les items en bulk
  const rows = v.items.map((it) => ({
    report_id: report.id,
    organization_id: lease.organization_id,
    room: it.room,
    element: it.element,
    condition: it.condition,
    notes: it.notes?.trim() || null,
    sort_order: it.sort_order,
  }));

  const { error: itemsError } = await supabase
    .from("inspection_items")
    .insert(rows);

  if (itemsError) {
    console.error("[inspections.items.POST]", itemsError);
    // On laisse le rapport exister, l'utilisateur pourra le compléter
    return NextResponse.json(
      { id: report.id, warning: "Items partiellement enregistrés" },
      { status: 201 },
    );
  }

  return NextResponse.json({ id: report.id }, { status: 201 });
}
```

---

## 📁 8. Intégration dans la page du bail

`app/(dashboard)/leases/[id]/page.tsx` — ajoutez deux onglets :

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LeaseInventory } from "@/components/leases/lease-inventory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClipboardCheck } from "lucide-react";

export default async function LeaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: lease } = await supabase
    .from("leases")
    .select(
      `
      id, start_date, end_date, rent_amount, charges_amount,
      unit:units ( id, label, type ),
      tenant:tenants ( id, full_name, phone )
    `,
    )
    .eq("id", id)
    .single();

  if (!lease) return null;

  const { data: inventoryItems } = await supabase
    .from("inventory_items")
    .select("id, name, category, quantity, condition, notes, photo_url")
    .eq("lease_id", id)
    .order("category")
    .order("name");

  const { data: catalog } = await supabase
    .from("inventory_catalog")
    .select("id, category, name")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <header>
        <h1 className="text-xl font-semibold">
          Bail — {(lease as any).unit?.label}
        </h1>
        <p className="text-sm text-muted-foreground">
          {(lease as any).tenant?.full_name} ·{" "}
          {lease.rent_amount.toLocaleString("fr-FR")} FCFA/mois
        </p>
      </header>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Inventaire</TabsTrigger>
          <TabsTrigger value="inspections">États des lieux</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-4">
          <LeaseInventory
            leaseId={lease.id}
            catalog={(catalog ?? []) as any}
            items={(inventoryItems ?? []) as any}
          />
        </TabsContent>

        <TabsContent value="inspections" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/leases/${id}/inspections/new?type=move_in`}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Nouvel état des lieux d'entrée
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/leases/${id}/inspections/new?type=move_out`}>
                État des lieux de sortie
              </Link>
            </Button>
          </div>
          {/* Liste des rapports existants — à compléter */}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

Et la page `app/(dashboard)/leases/[id]/inspections/new/page.tsx` :

```tsx
import { InspectionForm } from "@/components/leases/inspection-form";
import type { InspectionType } from "@/lib/inventory-types";

export default async function NewInspectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-xl font-semibold">Nouvel état des lieux</h1>
      <InspectionForm
        leaseId={id}
        defaultType={(type as InspectionType) ?? "move_in"}
      />
    </div>
  );
}
```

---

## 🎯 Ce que cette implémentation garantit

1. **Deux systèmes complémentaires** : inventaire du mobilier (objets mobiles) et état des lieux (bâti pièce par pièce).
2. **Catalogue partagé + personnalisable** : une agence qui gère un type de bien spécifique peut ajouter ses propres items (le catalogue système reste intact).
3. **Snapshot du nom** : si le catalogue évolue, l'inventaire historique garde le nom original. Preuve en cas de litige.
4. **Photos attachées** : bucket privé Supabase Storage, isolation par organisation via le préfixe de chemin (`<org_id>/...`).
5. **Comparaison possible** : entre l'état des lieux d'entrée et de sortie, un diff automatique peut être calculé (à venir : page de comparaison).
6. **Relevés de compteurs** : eau et électricité tracés dans le rapport — indispensable en Côte d'Ivoire pour la régularisation.
7. **Grille standard pré-remplie** : 8 pièces × 5 à 9 éléments = environ 50 points de contrôle. Le gestionnaire n'a plus qu'à valider ou ajuster.

---

## 🧪 Tests à faire

1. **Ajouter 3 objets** au catalogue depuis le formulaire → vérifier qu'ils apparaissent dans la liste.
2. **Sélectionner un objet depuis le catalogue** → nom et catégorie se pré-remplissent.
3. **Créer un état des lieux d'entrée complet** → vérifier que les 50+ items sont créés en une transaction.
4. **Vérifier l'isolation RLS** : impossible de lire un inventaire ou un rapport d'une autre organisation.
5. **Modifier la condition d'un élément** (`good` → `damaged`) → la note devient obligatoire.
6. **Uploader une photo** → la policy Storage vérifie le préfixe `org_id`.

---

Souhaitez-vous que j'enchaîne sur la **page de comparaison entrée/sortie** (le fameux diff qui liste automatiquement les dégradations et calcule le montant à retenir sur le dépôt de garantie) ? C'est la fonctionnalité la plus vendeuse auprès des agences, car c'est là qu'elles perdent de l'argent aujourd'hui.
