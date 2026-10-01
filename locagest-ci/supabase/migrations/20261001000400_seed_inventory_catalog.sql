-- Migration 5 : catalogue systeme des objets d inventaire.
-- Depend de 20261001000300_add_inventory_and_inspection.sql
-- (table public.inventory_catalog et son index unique partiel).
--
-- organization_id est null : ces objets sont partages par toutes les agences.
-- Une agence peut ensuite ajouter ses propres objets sans toucher a ceux-ci.
--
-- Le catalogue est adresse par le nom de la piece et celui de l objet. Deux
-- insertions concurrentes(ne migration et un formulaire) ne peuvent donc pas
-- creer de doublon : on conflict do nothing laisse la ligne existante.

insert into public.inventory_catalog (organization_id, category, name, default_quantity, sort_order) values
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
  (null, 'Cuisine', 'Congelateur', 1, 51),
  (null, 'Cuisine', 'Cuisinière gaz', 1, 52),
  (null, 'Cuisine', 'Cuisinière electrique', 1, 53),
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
  (null, 'Cuisine', 'Batterie de Cuisine', 1, 64),
  (null, 'Cuisine', 'Service de vaisselle', 1, 65),
  (null, 'Cuisine', 'Couverts (set)', 1, 66),
  (null, 'Cuisine', 'Verres', 6, 67),
  (null, 'Cuisine', 'Tasses', 6, 68),
  (null, 'Cuisine', 'Poubelle', 1, 69),
  (null, 'Cuisine', 'Balai', 1, 70),
  (null, 'Cuisine', 'Serpillère + seau', 1, 71),
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
  (null, 'Divers', 'Détecteur de fumee', 1, 101),
  (null, 'Divers', 'Groupe électrogène', 1, 102),
  (null, 'Divers', 'Clés (jeu)', 2, 103),
  (null, 'Divers', 'Badges / Télécommandes portail', 1, 104),
-- Extérieur (villa)
  (null, 'Extérieur', 'Mobilier de jardin', 1, 110),
  (null, 'Extérieur', 'Barbecue', 1, 111),
  (null, 'Extérieur', 'Parasol', 1, 112),
  (null, 'Extérieur', 'Transat', 1, 113)
on conflict do nothing;
