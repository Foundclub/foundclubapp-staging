import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

/**
 * L'AFFICHE D'UN COMPLEXE — RESA-L5B-2 (20/10/2026), chantier Réservation.
 *
 * Les règles PURES de E-G13 (planches EG13, RA7 ; plan :890-932 ; A-G10, A-G11, A-G12, A-G30,
 * A-G31, RC-G11) sur le serveur RESA-L4 : `POST /complexes/:id/affiche` ne lit QUE `{ texte
 * (neutre | promotion), promotion{ prix, texte }, style (ecusson | famille), format (a4 | post |
 * story), fidelite, apercu }` ; le nom, la ville, le logo, les sports et la fidélité viennent de la
 * base. Une promotion sans texte : le serveur écrit la phrase avec le prix. La promotion est un
 * TEXTE, appliquée sur place : l'app ne calcule ni n'encaisse rien (RC-G11).
 *
 * Témoin : `afficheDuComplexe.test.js`.
 */

/** @typedef {any} Traduire - La traduction (le TFunction d'i18next). */

/** Les formats : A4 (PDF à imprimer), post, story (images). */
const FORMATS = Object.freeze(['a4', 'post', 'story']);

/** Le texte « Neutre » (A-G11), mot pour mot comme le serveur l'imprime. */
export const TEXTE_NEUTRE = 'Scannez et ajoutez le complexe à vos favoris.';

/** La mention fixe sous la promotion (RC-G11). */
export const MENTION_PROMOTION = 'La promotion s\'applique sur place. L\'app ne l\'encaisse pas.';

/** Le texte de la promotion : 120 caractères au plus ; le prix : de 0 à 999 € (serveur). */
export const PROMO_TEXTE_MAX = 120;
export const PRIX_MAX = 999;

/**
 * « 5 », « 5,5 » ou « 5.50 » en nombre ; rien de lisible (ou hors de 0 à 999) : null.
 * @param {unknown} saisie - Le prix tapé.
 * @returns {number | null} Le prix.
 */
export const prixDe = (saisie) => {
  const texte = String(saisie ?? '').replace(/\s|€/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(texte)) return null;
  const prix = Number(texte);
  return prix >= 0 && prix <= PRIX_MAX ? prix : null;
};

/**
 * « 5 », « 5,50 » : le prix comme l'imprime le serveur (`prixLisible`).
 * @param {number} prix - Le prix.
 * @returns {string} Le prix lisible.
 */
const prixLisible = (prix) => (
  Number.isInteger(prix) ? String(prix) : prix.toFixed(2).replace('.', ',')
);

/**
 * La phrase de la promotion, celle que le serveur écrit à partir du prix (A-G11 ; planche RA7).
 * @param {number | null} prix - Le prix de la place.
 * @returns {string} La phrase, ou '' sans prix.
 */
export const textePromotion = (prix) => (prix === null || prix === undefined ? '' : (
  `Scannez, rejoignez le complexe dans vos favoris et bénéficiez d'une place de réservation à ${
    prixLisible(prix)} €`
));

/**
 * Le corps de « Créer une affiche » : la liste blanche du serveur, rien d'autre (RC-T01). En
 * promotion, le texte n'est envoyé que s'il a été changé à la main ; sinon le prix seul (le serveur
 * écrit la phrase).
 * @param {{ apercu?: boolean, fidelite?: boolean, format?: string, prix?: unknown,
 *   style?: string, texte?: string, textePromo?: string, texteModifie?: boolean }} choix - L'écran.
 * @returns {{ data: Record<string, any> }} Le corps.
 */
export const corpsDeLAffiche = (choix) => {
  const promotion = choix?.texte === 'promotion';
  const prix = prixDe(choix?.prix);
  const libre = String(choix?.textePromo || '').replace(/\s+/g, ' ').trim()
    .slice(0, PROMO_TEXTE_MAX);
  return {
    data: {
      apercu: choix?.apercu === true,
      fidelite: choix?.fidelite !== false,
      format: FORMATS.includes(String(choix?.format)) ? String(choix?.format) : 'post',
      style: choix?.style === 'famille' ? 'famille' : 'ecusson',
      texte: promotion ? 'promotion' : 'neutre',
      ...(promotion ? {
        promotion: {
          ...(prix === null ? {} : { prix }),
          ...(choix?.texteModifie && libre ? { texte: libre } : {}),
        },
      } : {}),
    },
  };
};

/**
 * L'encart « Fidélité » de l'affiche (A-G31), lu dans le programme (jamais ressaisi) : « Au bout
 * de 10 réservations, 1 partie offerte » ; rien sans programme actif.
 * @param {Traduire} t - Traduction.
 * @param {{ active?: boolean, reward?: string | null,
 *   threshold?: number } | null | undefined} programme - Le programme du complexe.
 * @returns {string} L'encart, ou ''.
 */
export const encartFidelite = (t, programme) => {
  const recompense = String(programme?.reward || '').trim();
  if (programme?.active !== true || !recompense) return '';
  return t(
    'complexeAffiches.fidelite.encart',
    'Au bout de {{seuil}} réservations, {{recompense}}',
    { recompense, seuil: Number(programme?.threshold) || 0, ...SANS_ECHAPPEMENT },
  );
};
