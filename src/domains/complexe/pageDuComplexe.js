import localeDesFormats from '@/theme/strings/localeDesFormats';

/**
 * « MON COMPLEXE » (LA PAGE) — RESA-L5B-2 (20/10/2026), chantier Réservation.
 *
 * Les règles PURES de E-G11 (planches EG11 et RA5 ; plan :802-845 ; A-G04, A-G05, A-G25, RG-TEL)
 * sur le serveur RESA-L1A (`GET|PUT /complexes/:id/manage`, une liste blanche ; un champ absent
 * reste inchangé) et RESA-L4 (`GET|PUT /complexes/:id/partenaires`, la liste ENTIÈRE, 12 au plus).
 * Le nom, l'adresse (avec sa position) et le téléphone DU complexe (public, jamais celui d'un
 * joueur) sont obligatoires ; l'e-mail, le site (http(s)), le SIRET (14 chiffres) facultatifs ; la
 * description 500 caractères ; 8 photos de couverture au plus ; les horaires d'accueil (pour
 * l'affichage, distincts des créneaux) une plage par jour ici.
 *
 * Témoin : `pageDuComplexe.test.js`.
 */

export const DESCRIPTION_MAX = 500;
export const PHOTOS_MAX = 8;
export const PARTENAIRES_MAX = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^https?:\/\/[^\s<>"']+$/i;
const HEURE_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Le nom d'un jour (1 = lundi … 7 = dimanche), dans la langue de l'app, avec sa majuscule.
 * @param {number} jour - 1 à 7.
 * @returns {string} « Lundi ».
 */
export const nomDuJour = (jour) => {
  // Le 1er janvier 2024 est un lundi.
  const texte = new Date(2024, 0, jour, 12)
    .toLocaleDateString(localeDesFormats(), { weekday: 'long' });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
};

/**
 * Les horaires d'accueil du serveur (`[{ day, ranges[{ from, to }] }]`) en 7 lignes, une par jour :
 * ouvert ou fermé, la première plage (les suivantes sont gardées telles quelles).
 * @param {unknown} horaires - `openingHours` du serveur.
 * @returns {Array<{ autres: any[], day: number, from: string, ouvert: boolean, to: string }>} Les
 *   lignes.
 */
export const horairesEnLignes = (horaires) => {
  const liste = Array.isArray(horaires) ? horaires : [];
  return [1, 2, 3, 4, 5, 6, 7].map((day) => {
    const ranges = liste.find((ligne) => Number(ligne?.day) === day)?.ranges;
    const plages = Array.isArray(ranges) ? ranges : [];
    return {
      autres: plages.slice(1),
      day,
      from: String(plages[0]?.from || '09:00'),
      ouvert: plages.length > 0,
      to: String(plages[0]?.to || '22:00'),
    };
  });
};

/**
 * Les 7 lignes en horaires du serveur : les jours ouverts seulement.
 * @param {Array<{ autres?: any[], day: number, from: string, ouvert: boolean, to: string }>} lignes
 *   - Les lignes de l'écran.
 * @returns {Array<{ day: number, ranges: Array<{ from: string, to: string }> }>} Les horaires.
 */
export const lignesEnHoraires = (lignes) => (Array.isArray(lignes) ? lignes : [])
  .filter((ligne) => ligne.ouvert)
  .map((ligne) => ({
    day: ligne.day,
    ranges: [{ from: ligne.from, to: ligne.to }, ...(ligne.autres || [])],
  }));

/**
 * Ce qui manque ou ne va pas (planche EG11 état 2) : des CLÉS de message, l'écran les traduit.
 * @param {{ adresse?: any, email?: string, horaires?: any[], nom?: string, siret?: string,
 *   site?: string, telephone?: string }} saisie - L'écran.
 * @returns {Record<string, string>} Le champ et sa clé de message ; vide : tout va.
 */
export const erreursDeLaPage = (saisie) => {
  /** @type {Record<string, string>} */
  const erreurs = {};
  if (!String(saisie?.nom || '').trim()) erreurs.nom = 'nomObligatoire';
  const adresse = saisie?.adresse;
  if (!adresse || !Number.isFinite(adresse.lat) || !Number.isFinite(adresse.lng)) {
    erreurs.adresse = 'adresseObligatoire';
  }
  if (!String(saisie?.telephone || '').trim()) erreurs.telephone = 'telephoneObligatoire';
  const email = String(saisie?.email || '').trim();
  if (email && !EMAIL_PATTERN.test(email)) erreurs.email = 'emailInvalide';
  const site = String(saisie?.site || '').trim();
  if (site && !URL_PATTERN.test(site)) erreurs.site = 'siteInvalide';
  const siret = String(saisie?.siret || '').replace(/\s/g, '');
  if (siret && !/^\d{14}$/.test(siret)) erreurs.siret = 'siretInvalide';
  const horaireFaux = (saisie?.horaires || []).some((ligne) => ligne.ouvert && (
    !HEURE_PATTERN.test(ligne.from) || !HEURE_PATTERN.test(ligne.to) || ligne.from >= ligne.to));
  if (horaireFaux) erreurs.horaires = 'horairesInvalides';
  return erreurs;
};

/**
 * Le texte d'un champ, nettoyé ; vide : null.
 * @param {unknown} valeur - La saisie.
 * @returns {string | null} Le texte.
 */
const texte = (valeur) => String(valeur ?? '').replace(/\s+/g, ' ').trim() || null;

/**
 * Le corps de « Enregistrer » : SEULS les champs changés (un champ absent reste inchangé côté
 * serveur), dans la liste blanche. L'adresse part avec sa position (`address`, `addressLabel`,
 * `coordinates`, et la ville si l'option la donne).
 * @param {Record<string, any>} saisie - L'écran.
 * @param {Record<string, any>} enregistre - Le complexe lu (`toManagedView`).
 * @returns {Record<string, any>} Les champs à écrire ; vide : rien n'a changé.
 */
export const corpsDeLaPage = (saisie, enregistre) => {
  /** @type {Record<string, any>} */
  const corps = {};
  const change = (/** @type {unknown} */ a, /** @type {unknown} */ b) => (
    JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)
  );
  if (change(texte(saisie.nom), enregistre?.name)) corps.name = texte(saisie.nom);
  const description = String(saisie.description ?? '').trim().slice(0, DESCRIPTION_MAX) || null;
  if (change(description, enregistre?.description)) corps.description = description;
  if (change(texte(saisie.email), enregistre?.email)) corps.email = texte(saisie.email);
  if (change(texte(saisie.site), enregistre?.websiteUrl)) corps.websiteUrl = texte(saisie.site);
  const siret = String(saisie.siret ?? '').replace(/\s/g, '') || null;
  if (change(siret, enregistre?.siret)) corps.siret = siret;
  const telephone = String(saisie.telephone ?? '').trim();
  if (telephone && telephone !== String(enregistre?.phoneNumber || '')) {
    corps.phoneNumber = telephone;
  }
  const horaires = lignesEnHoraires(saisie.horaires);
  if (change(horaires, enregistre?.openingHours || [])) corps.openingHours = horaires;
  const logo = saisie.logo?.id ?? null;
  if (change(logo, enregistre?.logo?.id ?? null)) corps.logo = logo;
  const photos = (saisie.photos || []).map((/** @type {any} */ photo) => photo.id)
    .slice(0, PHOTOS_MAX);
  const avant = (enregistre?.photos || []).map((/** @type {any} */ photo) => photo.id);
  if (change(photos, avant)) corps.photos = photos;
  const { adresse } = saisie;
  const adresseAvant = enregistre?.address;
  if (adresse && (adresse.label !== adresseAvant?.label || adresse.lat !== adresseAvant?.lat
    || adresse.lng !== adresseAvant?.lng)) {
    corps.address = { label: adresse.label, lat: adresse.lat, lng: adresse.lng };
    corps.addressLabel = adresse.label;
    corps.coordinates = { lat: adresse.lat, lng: adresse.lng };
    if (adresse.city) corps.city = adresse.city;
  }
  return corps;
};

/**
 * Le corps des partenaires : la liste entière, dans l'ordre de la page (A-G25 ; 12 au plus).
 * @param {Array<{ documentId?: string | null, link?: string | null, logo?: { id?: number } | null,
 *   title: string }>} partenaires - La liste de l'écran.
 * @returns {Array<Record<string, any>>} Le corps du PUT.
 */
export const corpsDesPartenaires = (partenaires) => (Array.isArray(partenaires) ? partenaires : [])
  .slice(0, PARTENAIRES_MAX)
  .map((partenaire) => ({
    ...(partenaire.documentId ? { documentId: partenaire.documentId } : {}),
    ...(texte(partenaire.link) ? { link: texte(partenaire.link) } : {}),
    ...(partenaire.logo?.id ? { logo: partenaire.logo.id } : {}),
    title: String(partenaire.title || '').replace(/\s+/g, ' ').trim(),
  }));
