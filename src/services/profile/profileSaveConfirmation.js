/**
 * AA11 — CE QUE DIT L'APP QUAND ELLE VIENT D'ENREGISTRER UN CHAMP DU PROFIL.
 *
 * Demande d'Adel, le 2026-08-20 : « quand on modifie une information du profil,
 * on manque d'un pop-up pour dire "felicitations, votre (info) a ete
 * modifiee" ».
 *
 * 🎯 Le mot qui porte tout est « (info) ». Une phrase creuse — « Succes », un
 * « OK » — coute un geste sans rien apprendre : on savait deja qu'on avait
 * appuye. Ce qu'on ignore, c'est CE QUI est parti. La table ci-dessous n'existe
 * donc que pour NOMMER le champ, et elle reutilise les libelles que l'ecran
 * affiche deja au-dessus de chaque saisie — jamais un second vocabulaire.
 *
 * 🎁 MEME MOTIF QUE Y04 (`services/requests/requestAcceptanceCelebration.js`),
 * pas un second : une table de clefs de `fr.js`, un fabricant de phrase pur, et
 * l'appelant qui decide QUAND. Ce qui change, c'est la LIVRAISON — Y04 ouvre un
 * `Modal` local dans son ecran, ce lot-ci passe par la banniere globale qui
 * s'efface toute seule (`emitCelebrationBanner`). Motif : on modifie souvent
 * trois champs d'affilee, et trois fenetres a fermer a la main sont un mur.
 *
 * ⛔ AUCUN TEXTE EN DUR ICI : chaque phrase est une clef de `fr.js`, le repli
 * passe en second argument de `t` — le motif tenu par tout le dossier.
 *
 * ⚠️ CE MODULE NE SAIT PAS SI L'ENREGISTREMENT A REUSSI. Il ne fabrique qu'une
 * phrase. L'appelant ne l'invoque QUE dans son chemin de succes : une
 * felicitation sur un echec est le pire des deux mondes — on croit que c'est
 * fait, ca ne l'est pas.
 */

/**
 * Le libelle de chaque champ, repris de l'ecran qui le fait saisir.
 * ⚠️ Les clefs sont celles de `profile.fields.*.label`, deja utilisees par
 * `ProfileEdit.js`, `SelfProfilePlayerCoach.js` et `SelfProfileUnified.js` :
 * la confirmation dit donc EXACTEMENT le mot que la personne vient de lire.
 */
const PROFILE_FIELD_LABELS = /** @type {Record<string, { fallback: string, key: string }>} */ ({
  address: { fallback: 'Ville', key: 'profile.fields.city.label' },
  avatar: { fallback: 'Photo de profil', key: 'profile.fields.avatar.label' },
  bestLevel: { fallback: 'Meilleur niveau', key: 'profile.fields.bestLevel.label' },
  birthdate: { fallback: 'Date de naissance', key: 'profile.fields.birthdate.label' },
  category: { fallback: 'Catégorie', key: 'profile.fields.category.label' },
  email: { fallback: 'Email', key: 'profile.fields.email.label' },
  firstname: { fallback: 'Prénom', key: 'profile.fields.firstname.label' },
  height: { fallback: 'Taille (m)', key: 'profile.fields.height.label' },
  isLookingForClub: { fallback: 'Profil visible', key: 'profile.fields.isLookingForClub.label' },
  jerseyNumber: { fallback: 'Numéro de maillot', key: 'profile.fields.jerseyNumber.label' },
  lastname: { fallback: 'Nom', key: 'profile.fields.lastname.label' },
  nationality: { fallback: 'Nationalité', key: 'profile.fields.nationality.label' },
  phoneNumber: { fallback: 'Numéro de téléphone', key: 'profile.fields.phoneNumber.label' },
  position: { fallback: 'Poste', key: 'profile.fields.position.label' },
  preferredSport: { fallback: 'Sport de préférence', key: 'profile.fields.preferredSport.label' },
  section: { fallback: 'Section', key: 'profile.fields.section.label' },
  sportsHistory: { fallback: 'Historique sportif', key: 'profile.fields.sportsHistory.label' },
  weight: { fallback: 'Poids (kg)', key: 'profile.fields.weight.label' },
});

/**
 * `geohash` voyage avec l'adresse et n'est un champ que personne ne saisit :
 * l'annoncer nommerait une information que personne ne reconnaitrait.
 */
const SILENT_FIELDS = new Set(['documentId', 'geohash', 'id', 'legalAcceptance']);

/**
 * Ramene n'importe quelle valeur de champ a une chaine comparable.
 * ⚠️ Sans ca, `75` et `'75'` passeraient pour deux valeurs differentes et
 * l'ecran annoncerait un changement que personne n'a fait — l'adresse et la
 * photo sont des objets recrees a chaque rendu, jamais egaux par reference.
 * @param {string} field
 * @param {any} value
 * @returns {string}
 */
const normalizeFieldValue = (field, value) => {
  if (value === null || value === undefined) return '';
  if (field === 'avatar') {
    return String(value?.url || value?.uri || value || '').trim();
  }
  if (field === 'address') {
    if (typeof value === 'string') return value.trim();
    const label = String(value?.label || '').trim();
    const point = String(value?.value || '').trim();
    return label || point ? `${label}|${point}` : '';
  }
  if (field === 'section') {
    return String(value?.documentId || value || '').trim();
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value).trim();
};

/**
 * Les champs dont la valeur a REELLEMENT change entre deux etats du profil.
 * Un champ absent de `after` n'est pas compare : les ecrans n'envoient pas tous
 * la meme liste (la sheet d'un dirigeant n'envoie qu'un seul champ).
 * @param {Record<string, any> | null | undefined} before L'etat charge.
 * @param {Record<string, any> | null | undefined} after Ce qui part au serveur.
 * @returns {string[]} Les noms de champs, dans l'ordre de la table.
 */
export const listChangedProfileFields = (before, after) => {
  const previous = before && typeof before === 'object' ? before : {};
  const next = after && typeof after === 'object' ? after : {};

  return Object.keys(PROFILE_FIELD_LABELS).filter((field) => {
    if (SILENT_FIELDS.has(field)) return false;
    if (!Object.prototype.hasOwnProperty.call(next, field)) return false;
    return normalizeFieldValue(field, previous[field]) !== normalizeFieldValue(field, next[field]);
  });
};

/**
 * Le titre et le texte a annoncer apres un enregistrement REUSSI.
 * Rend `null` quand il n'y a rien a dire — aucun champ n'a bouge. Une
 * confirmation qui apparait alors qu'on n'a rien fait n'informe de rien.
 * @param {string[]} changedFields Les champs rendus par `listChangedProfileFields`.
 * @param {(key: string, fallback?: any) => string} t La traduction.
 * @returns {{ body: string, eyebrow: string, title: string } | null}
 */
export const buildProfileSaveConfirmation = (changedFields, t) => {
  const fields = (Array.isArray(changedFields) ? changedFields : [])
    .filter((field) => Boolean(PROFILE_FIELD_LABELS[field]));
  if (fields.length === 0) return null;

  const labelOf = (/** @type {string} */ field) => {
    const entry = PROFILE_FIELD_LABELS[field];
    return t(entry.key, entry.fallback);
  };

  // ⚠️ Le remplacement se fait A LA MAIN, comme dans Y04 : le repli passe en
  // second argument de `t` n'est PAS interpole par i18next. Une autre
  // convention afficherait « {{field}} » a l'ecran des que la clef manquerait.
  const fill = (/** @type {string} */ template, /** @type {Record<string, string>} */ values) => (
    Object.entries(values).reduce(
      (text, [name, value]) => text.replace(`{{${name}}}`, value),
      String(template || ''),
    )
  );

  const title = t('profile.saveConfirmation.title', 'C’est enregistré');
  const eyebrow = t('profile.saveConfirmation.eyebrow', 'PROFIL');

  if (fields.length === 1) {
    return {
      body: fill(
        t('profile.saveConfirmation.one', '{{field}} : la modification est bien enregistrée.'),
        { field: labelOf(fields[0]) },
      ),
      eyebrow,
      title,
    };
  }

  if (fields.length === 2) {
    return {
      body: fill(
        t(
          'profile.saveConfirmation.two',
          '{{first}} et {{second}} : les modifications sont bien enregistrées.',
        ),
        { first: labelOf(fields[0]), second: labelOf(fields[1]) },
      ),
      eyebrow,
      title,
    };
  }

  return {
    body: fill(
      t(
        'profile.saveConfirmation.many',
        '{{count}} informations de ton profil sont bien enregistrées.',
      ),
      { count: String(fields.length) },
    ),
    eyebrow,
    title,
  };
};

export default buildProfileSaveConfirmation;
