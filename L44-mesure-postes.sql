-- ============================================================================
-- L44 — combien de postes deja en base tombent HORS de la liste unique ?
-- Genere depuis app/src/constants/positions.js : 38 postes sur 5 sports,
-- soit 32 valeurs distinctes (6 postes servent a deux sports).
--
-- LECTURE SEULE. Aucune ecriture, aucune migration. A lancer sur STAGING d abord.
-- ============================================================================
--
-- Rappel de forme : `UserPosition` enregistre PLUSIEURS postes separes par une
-- virgule (« Attaquant, Ailier droit »). La requete decoupe donc sur la virgule
-- avant de comparer, sinon tout profil multi-postes ressortirait faussement
-- « hors liste ».

-- ---------------------------------------------------------------------------
-- 0) CONTROLE PREALABLE — le nom reel des colonnes.
--    Strapi 5 ecrit les colonnes en snake_case (`preferred_sport`), mais ce
--    n est pas garanti. Lancer CECI en premier et adapter si besoin.
-- ---------------------------------------------------------------------------
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'up_users'
  AND (column_name ILIKE '%position%' OR column_name ILIKE '%sport%')
ORDER BY column_name;

-- ---------------------------------------------------------------------------
-- 1) LE DETAIL — chaque poste present en base, dedans ou dehors.
-- ---------------------------------------------------------------------------
WITH liste_unique(poste) AS (VALUES
    ('Meneur'),
    ('Arrière'),
    ('Ailier'),
    ('Ailier fort'),
    ('Pivot'),
    ('Gardien'),
    ('Défenseur central'),
    ('Latéral droit'),
    ('Latéral gauche'),
    ('Milieu défensif'),
    ('Milieu central'),
    ('Milieu offensif'),
    ('Ailier droit'),
    ('Ailier gauche'),
    ('Attaquant'),
    ('Avant-centre'),
    ('Arrière gauche'),
    ('Arrière droit'),
    ('Demi-centre'),
    ('Pilier'),
    ('Talonneur'),
    ('Deuxième ligne'),
    ('Troisième ligne aile'),
    ('Troisième ligne centre'),
    ('Demi de mêlée'),
    ('Demi d''ouverture'),
    ('Centre'),
    ('Pointu'),
    ('Réceptionneur-attaquant'),
    ('Central'),
    ('Passeur'),
    ('Libéro')
),
postes_joueurs AS (
  SELECT
    u.id,
    u.preferred_sport                     AS sport,
    btrim(morceau)                        AS poste
  FROM up_users u
  CROSS JOIN LATERAL unnest(string_to_array(u.position, ',')) AS morceau
  WHERE u.position IS NOT NULL
    AND btrim(u.position) <> ''
)
SELECT
  p.poste,
  p.sport,
  count(*)                                AS nb_comptes,
  (l.poste IS NOT NULL)                   AS dans_la_liste
FROM postes_joueurs p
LEFT JOIN liste_unique l ON l.poste = p.poste
GROUP BY p.poste, p.sport, (l.poste IS NOT NULL)
ORDER BY dans_la_liste ASC, nb_comptes DESC, p.poste;

-- ---------------------------------------------------------------------------
-- 2) LE RESUME EN 4 NOMBRES — c est celui-ci qui decide s il faut un rattrapage.
--    Si `comptes_a_rattraper` = 0, il n y a rien a faire : aucun lot de plus.
-- ---------------------------------------------------------------------------
WITH liste_unique(poste) AS (VALUES
    ('Meneur'),
    ('Arrière'),
    ('Ailier'),
    ('Ailier fort'),
    ('Pivot'),
    ('Gardien'),
    ('Défenseur central'),
    ('Latéral droit'),
    ('Latéral gauche'),
    ('Milieu défensif'),
    ('Milieu central'),
    ('Milieu offensif'),
    ('Ailier droit'),
    ('Ailier gauche'),
    ('Attaquant'),
    ('Avant-centre'),
    ('Arrière gauche'),
    ('Arrière droit'),
    ('Demi-centre'),
    ('Pilier'),
    ('Talonneur'),
    ('Deuxième ligne'),
    ('Troisième ligne aile'),
    ('Troisième ligne centre'),
    ('Demi de mêlée'),
    ('Demi d''ouverture'),
    ('Centre'),
    ('Pointu'),
    ('Réceptionneur-attaquant'),
    ('Central'),
    ('Passeur'),
    ('Libéro')
),
postes_joueurs AS (
  SELECT
    u.id,
    btrim(morceau) AS poste
  FROM up_users u
  CROSS JOIN LATERAL unnest(string_to_array(u.position, ',')) AS morceau
  WHERE u.position IS NOT NULL
    AND btrim(u.position) <> ''
)
SELECT
  count(DISTINCT p.poste)                                        AS valeurs_distinctes,
  count(DISTINCT p.poste) FILTER (WHERE l.poste IS NULL)         AS valeurs_hors_liste,
  count(DISTINCT p.id)                                           AS comptes_avec_un_poste,
  count(DISTINCT p.id) FILTER (WHERE l.poste IS NULL)            AS comptes_a_rattraper
FROM postes_joueurs p
LEFT JOIN liste_unique l ON l.poste = p.poste;

-- ---------------------------------------------------------------------------
-- 3) CONTROLE ANNEXE — les noms de sport tels que Strapi les nomme.
--    `getPositionsForSport` ne fait qu un `.toLowerCase()` : ni `trim()`, ni
--    retrait d accents. Un sport nomme « Rugby a XV », « Foot » ou « Football »
--    avec une espace finale rendrait une liste VIDE cote app.
--    Toute ligne a `reconnu_par_l_app = false` AVEC des comptes est un trou.
-- ---------------------------------------------------------------------------
SELECT
  u.preferred_sport                       AS sport_en_base,
  count(*)                                AS nb_comptes,
  (lower(btrim(u.preferred_sport)) IN
    ('football','basketball','handball','volleyball','rugby'))   AS reconnu_par_l_app
FROM up_users u
WHERE u.preferred_sport IS NOT NULL
  AND btrim(u.preferred_sport) <> ''
GROUP BY u.preferred_sport
ORDER BY reconnu_par_l_app ASC, nb_comptes DESC;
