/* eslint-disable no-underscore-dangle */

/**
 * D95 — le compteur de joueurs qui attendent un club.
 *
 * Ce fichier est volontairement SEPARE de `adminService.js` : ce dernier
 * instancie le client HTTP au chargement, qui tire lui-meme des modules natifs
 * (`react-native-device-info`). Une fonction pure enfermee la-dedans ne peut
 * pas etre testee sans empiler les mocks. Ici, zero import : le test la charge
 * telle quelle.
 */

/** Valeur de l'enumeration `requestKind` du schema Strapi `club-request`. */
export const TEAM_NOT_FOUND_KIND = 'team_not_found';

/**
 * S02 — le type de ligne de la SECONDE porte. Ce n'est pas une demande a
 * traiter : c'est un CHIFFRE que le super admin lit. Elle n'a donc ni
 * « Traiter » ni « Refuser » — un bouton qui ne fait rien vaut moins que pas de
 * bouton du tout.
 */
export const CLUB_ARRIVAL_INTEREST_KIND = 'club_arrival_interest';

/**
 * La clef qui identifie « le meme club » entre deux demandes.
 * L'identifiant prime ; le nom normalise n'est le repli que s'il n'y en a pas
 * (les demandes venues de l'onboarding sont une recherche en texte libre).
 * @param {any} item
 * @returns {string}
 */
const buildWaitedClubKey = (item = {}) => {
  const clubId = String(item?.searchContext?.clubId || '').trim();
  if (clubId) return `id:${clubId}`;
  const clubName = String(item?.clubName || '').trim().toLowerCase();
  return clubName ? `name:${clubName}` : '';
};

/**
 * Le chiffre qui rend l'onglet super-admin vendable.
 * « 12 joueurs de votre club vous attendent sur FoundClub » est un appel qui se
 * decroche ; « un joueur a demande » ne l'est pas. On compte des JOUEURS
 * DISTINCTS, pas des demandes : les doublons deja en base gonfleraient le
 * chiffre a vide.
 * @param {any[]} items demandes deja annotees de `__requestType`
 * @returns {any[]} les memes items, annotes de `__waitingPlayersCount`
 */
export const annotateWaitingPlayersPerClub = (items = []) => {
  const requestersByClub = new Map();

  items.forEach((item) => {
    if (item?.__requestType !== TEAM_NOT_FOUND_KIND) return;
    const clubKey = buildWaitedClubKey(item);
    if (!clubKey) return;
    if (!requestersByClub.has(clubKey)) requestersByClub.set(clubKey, new Set());
    // Un compte sans identifiant lisible compte quand meme pour 1 : on retombe
    // sur l'identifiant de la demande, jamais sur 0.
    requestersByClub.get(clubKey).add(
      String(item?.user?.documentId || item?.user?.id || `request:${item?.documentId || ''}`),
    );
  });

  return items.map((item) => {
    if (item?.__requestType !== TEAM_NOT_FOUND_KIND) return item;
    const clubKey = buildWaitedClubKey(item);
    return {
      ...item,
      __waitingPlayersCount: clubKey ? (requestersByClub.get(clubKey)?.size || 1) : 1,
    };
  });
};

/**
 * La clef qui identifie « la meme personne » entre deux interets. Un compte sans
 * identifiant lisible compte quand meme pour 1 : on retombe sur l'identifiant de
 * l'interet, jamais sur 0.
 * @param {any} interest
 * @returns {string}
 */
const buildInterestedPersonKey = (interest = {}) => String(
  interest?.user?.documentId
  || interest?.user?.id
  || `interest:${interest?.documentId || ''}`,
);

/**
 * S02 — « N personnes sont interessees par votre club ».
 *
 * 💰 C'est l'appel qui se decroche : « une personne a demande » ne l'est pas.
 * ⚠️ On compte donc des PERSONNES DISTINCTES, pas des interets — appuyer cinq
 * fois ne fait pas cinq personnes. Meme regle, meme motif que
 * `annotateWaitingPlayersPerClub` ci-dessus, et une seule LIGNE PAR CLUB : le
 * super admin veut savoir quels clubs appeler, pas relire 12 fois le meme.
 * @param {any[]} interests interets bruts, tels que rendus par le serveur
 * @returns {any[]} une ligne par club, la plus fournie en premier
 */
export const buildClubArrivalInterestRows = (interests = []) => {
  /** @type {Map<string, any>} */
  const rowsByClub = new Map();

  interests.forEach((interest) => {
    const club = interest?.club || {};
    const clubKey = String(club?.documentId || club?.id || '').trim();
    if (!clubKey) return;

    if (!rowsByClub.has(clubKey)) {
      rowsByClub.set(clubKey, {
        __interestedPeople: new Set(),
        club,
        clubName: club?.name || '',
        createdAt: interest?.createdAt || null,
        // Une ligne de club, jamais une ligne de demande : son identifiant doit
        // etre stable et ne peut pas etre celui d'un interet en particulier.
        documentId: `club-arrival-interest:${clubKey}`,
      });
    }

    const row = rowsByClub.get(clubKey);
    row.__interestedPeople.add(buildInterestedPersonKey(interest));
    if (!row.createdAt || String(interest?.createdAt || '') > String(row.createdAt)) {
      row.createdAt = interest?.createdAt || row.createdAt;
    }
  });

  return [...rowsByClub.values()]
    .map(({ __interestedPeople, ...row }) => ({
      ...row,
      __interestedPeopleCount: __interestedPeople.size,
      __isAffiliationHelp: false,
      __requestType: CLUB_ARRIVAL_INTEREST_KIND,
      __typeLabel: 'INTÉRÊTS',
    }))
    .sort((a, b) => b.__interestedPeopleCount - a.__interestedPeopleCount);
};
