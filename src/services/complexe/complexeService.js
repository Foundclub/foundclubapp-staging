/**
 * LE COMPLEXE DE RÉSERVATION, CÔTÉ GÉRANT — RESA-L5A1 (13/10/2026), chantier Réservation.
 *
 * Les routes du serveur après RESA-L1A + RESA-L1B (contrat : dépôt méthode
 * `docs/RESERVATION_CONTRAT_API_L1.md` ; source qui fait foi : admin `origin/feat/RESAL1B-admin`,
 * `src/api/complexe/routes/*.ts`). Le serveur est le seul juge : la relation `gestionnaires`
 * garde chaque route du gérant, une LISTE BLANCHE choisit les champs écrits. L'app n'envoie que
 * ce que l'écran demande, et lit le code du refus dans `error.details.code`.
 *
 * ⚠️ NON LIVRÉ (ni recette ni production, 13/10) : tout ce qui appelle ce module est caché par
 * l'interrupteur `COMPLEXES_GERANT` (`src/config/fonctionsMasquees.js`).
 *
 * ⚠️ Le client HTTP est chargé À L'APPEL, comme collectiviteRattachementService : « Mon compte »
 * et l'accueil importent les composants du gérant sans doubler le client, qui exige l'adresse du
 * serveur dès son chargement (mémoire piege-env-absent-worktree-import-service). Par `require` et
 * non par `import()` : jest n'exécute pas un import dynamique (mémoire
 * piege-jest-import-dynamique), et ce service a son témoin.
 *
 * RESA-L6A (14/10) : ces DEUX `require` à l'appel (le client, et le service des fermetures qui
 * importe le client) RESTENT, mesurés : les importer en tête fait échouer au CHARGEMENT 10
 * suites de témoins dans toute copie de travail sans `.env` (9 de `views/profile` + le témoin des
 * fermetures : « API_URL is missing », runtimeUrls.native.js:50) ; un `import()` dynamique, jest
 * ne l'exécute pas (« dynamic import callback was invoked without --experimental-vm-modules »,
 * 15 témoins du service rouges). Prix : le site plantera le jour où il APPELLERA ce service (son
 * serveur de dev n'a pas `require`) ; les écrans du gérant n'y sont pas avant le lot web L7.
 * Toute autre dépendance est importée en tête (témoin
 * `views/reserverTerrain/__tests__/site.sansRequire.test.js`, qui tolère ces deux lignes
 * seulement).
 *
 * Témoin : `__tests__/complexeService.test.js`.
 */
import { uploadActualiteFile } from '../collectivite/collectiviteActualiteService';

/**
 * Le client HTTP de l'app, chargé à l'appel.
 * @returns {any} Le client axios.
 */
// eslint-disable-next-line global-require
const client = () => require('../client').default;

/**
 * Le corps d'une réponse.
 * @param {Promise<any>} reponse - La réponse axios.
 * @returns {Promise<any>} Son corps.
 */
const corps = async (reponse) => (await reponse).data;

const enc = (/** @type {unknown} */ valeur) => encodeURIComponent(String(valeur || ''));

/**
 * « Devenir gestionnaire » (E-G01) : crée SON complexe. 201 `{ data: complexe }` ; ou 200
 * `{ data: { duplicate: true, suggestions } }` (« C'est le tien ? », rien n'est créé) : renvoyer
 * avec `forceCreate: true` pour créer quand même.
 * @param {Record<string, any>} donnees - `{ acceptRules, name, address, phoneNumber, sports,
 *   minAge, cancellationDelayHours, siret?, forceCreate? }`.
 * @returns {Promise<any>} Le corps `{ data }`.
 */
export const creerMonComplexe = async (donnees) => corps(
  client().post('/complexes/self-onboard', { data: donnees }),
);

/**
 * MES complexes (AT-01) : non vide ⇒ la bascule « mode complexe / mode joueur ».
 * @returns {Promise<any>} `{ data: [{ documentId, name, slug, status, verified, city, logo }] }`.
 */
export const lireMesComplexes = async () => corps(client().get('/complexes/mine'));

/**
 * SON complexe, vu par son gestionnaire (E-G11, E-G16) : tout, règles comprises.
 * @param {string} complexeId - documentId du complexe.
 * @returns {Promise<any>} `{ data: complexe }`.
 */
export const lireComplexeGere = async (complexeId) => corps(
  client().get(`/complexes/${enc(complexeId)}/manage`),
);

/**
 * Modifier SON complexe (E-G16) : un champ absent reste inchangé.
 * @param {string} complexeId - documentId du complexe.
 * @param {Record<string, any>} donnees - Les champs modifiés.
 * @returns {Promise<any>} `{ data: complexe }`.
 */
export const modifierComplexeGere = async (complexeId, donnees) => corps(
  client().put(`/complexes/${enc(complexeId)}/manage`, { data: donnees }),
);

/**
 * « Mes installations » (E-G07) : les terrains de SON complexe, avec le résumé de leurs créneaux.
 * @param {string} complexeId - documentId du complexe.
 * @returns {Promise<any>} `{ data: [terrain] }`.
 */
export const lireTerrains = async (complexeId) => corps(
  client().get(`/complexes/${enc(complexeId)}/terrains`),
);

/**
 * « Nouveau terrain » (E-G08).
 * @param {string} complexeId - documentId du complexe.
 * @param {Record<string, any>} donnees - `{ name, sport, setting, capacity, bookingMode, … }`.
 * @returns {Promise<any>} `{ data: terrain }`.
 */
export const creerTerrain = async (complexeId, donnees) => corps(
  client().post(`/complexes/${enc(complexeId)}/terrains`, { data: donnees }),
);

/**
 * Modifier SON terrain (E-G08) : un champ absent reste inchangé.
 * @param {string} complexeId - documentId du complexe.
 * @param {string} terrainId - documentId du terrain.
 * @param {Record<string, any>} donnees - Les champs modifiés.
 * @returns {Promise<any>} `{ data: terrain }`.
 */
export const modifierTerrain = async (complexeId, terrainId, donnees) => corps(
  client().put(`/complexes/${enc(complexeId)}/terrains/${enc(terrainId)}`, { data: donnees }),
);

/**
 * Le modèle de créneaux et de tarifs d'un terrain (E-G09, RA4), jugé EN ENTIER par le serveur.
 * `apercu` : jugé et résumé SANS être écrit (`dryRun`). ⚠️ Le serveur lit `dryRun` dans le CORPS
 * (`terrain.ts`, `setCreneaux` : `payload.dryRun === true`), pas dans l'adresse comme l'écrit le
 * contrat.
 * @param {string} complexeId - documentId du complexe.
 * @param {string} terrainId - documentId du terrain.
 * @param {{ extraSlots: any[], period: any, ranges: any[], rates: any[] }} plan - Le modèle.
 * @param {{ apercu?: boolean }} [options] - Aperçu seulement.
 * @returns {Promise<any>} `{ data: terrain }`, ou `{ data: { creneaux, dryRun, slotPlan } }`.
 */
export const enregistrerCreneaux = async (
  complexeId,
  terrainId,
  plan,
  { apercu = false } = {},
) => corps(
  client().put(
    `/complexes/${enc(complexeId)}/terrains/${enc(terrainId)}/creneaux`,
    apercu ? { data: plan, dryRun: true } : { data: plan },
  ),
);

// ---------------------------------------------------------------------------------------------
// RESA-L5A2 (14/10/2026) — les routes ajoutées par RESA-L2A (contrat, partie « Ajouté après
// RESA-L2A » ; admin `origin/feat/RESAL2A-admin`, `routes/reservation-custom.ts`). NON LIVRÉES :
// cachées, comme le reste, par `COMPLEXES_GERANT`.
// ---------------------------------------------------------------------------------------------

/**
 * Les paramètres non vides, seulement : une adresse sans `terrain=` ni `statut=` vides.
 * @param {Record<string, unknown>} params - Les paramètres.
 * @returns {Record<string, unknown>} Les paramètres remplis.
 */
const remplis = (params) => Object.fromEntries(
  Object.entries(params)
    .filter(([, valeur]) => valeur !== undefined && valeur !== null && valeur !== ''),
);

/**
 * Les réservations de SON complexe (E-G04, E-G06), par pages de 20.
 * @param {string} complexeId - documentId du complexe.
 * @param {{ page?: number, source?: string, statut?: string, terrain?: string,
 *   vue: 'a-venir' | 'aujourdhui' | 'demandes' | 'passees' | 'traitees' }} filtres - La vue.
 * @returns {Promise<any>} `{ data: { items, pagination: { page, pageSize, total } } }`.
 */
export const lireReservationsDuComplexe = async (complexeId, filtres) => corps(
  client().get(`/complexes/${enc(complexeId)}/reservations`, { params: remplis(filtres) }),
);

/**
 * La fiche d'une réservation (E-G05) : le nom, le téléphone SEULEMENT s'il est accordé.
 * @param {string} complexeId - documentId du complexe.
 * @param {string} reservationId - documentId de la réservation.
 * @returns {Promise<any>} `{ data: reservation }`.
 */
export const lireReservationGeree = async (complexeId, reservationId) => corps(
  client().get(`/complexes/${enc(complexeId)}/reservations/${enc(reservationId)}`),
);

/**
 * Le planning de SES terrains (E-G03, la frise de E-G02) : 31 jours au plus.
 * @param {string} complexeId - documentId du complexe.
 * @param {{ from: string, terrain?: string, to: string }} periode - Les jours, un terrain.
 * @returns {Promise<any>} `{ data: { from, to, terrains: [{ days: [{ date, slots }] }] } }`.
 */
export const lirePlanning = async (complexeId, periode) => corps(
  client().get(`/complexes/${enc(complexeId)}/planning`, { params: remplis(periode) }),
);

/**
 * Accepter, ou refuser avec un motif (obligatoire), une demande (E-G06, E-G05).
 * @param {string} complexeId - documentId du complexe.
 * @param {string} reservationId - documentId de la demande.
 * @param {{ decision: 'accepter' | 'refuser', reason?: string }} decision - La décision.
 * @returns {Promise<any>} `{ data: reservation }`.
 */
export const deciderDemande = async (complexeId, reservationId, decision) => corps(
  client().post(
    `/complexes/${enc(complexeId)}/reservations/${enc(reservationId)}/decision`,
    { data: decision },
  ),
);

/**
 * Annuler une réservation (motif obligatoire pour une réservation de l'app, N-18), ou supprimer
 * une note « extérieur » (sans motif).
 * @param {string} complexeId - documentId du complexe.
 * @param {string} reservationId - documentId de la réservation.
 * @param {string | null} motif - Le motif, ou null.
 * @returns {Promise<any>} `{ data: reservation }`.
 */
export const annulerReservationGeree = async (complexeId, reservationId, motif) => corps(
  client().post(
    `/complexes/${enc(complexeId)}/reservations/${enc(reservationId)}/annuler`,
    { data: motif ? { reason: motif } : {} },
  ),
);

/**
 * « Réservé à l'extérieur » (E-G03, A-G17) : un créneau du modèle, un nom libre.
 * @param {string} complexeId - documentId du complexe.
 * @param {{ date: string, externalName: string, from: string, terrain: string }} note - Le créneau.
 * @returns {Promise<any>} `{ data: reservation }` (201).
 */
export const noterExterieur = async (complexeId, note) => corps(
  client().post(`/complexes/${enc(complexeId)}/reservations`, { data: note }),
);

/**
 * « Modifier le nom » d'une note « extérieur » (E-G05).
 * @param {string} complexeId - documentId du complexe.
 * @param {string} reservationId - documentId de la note.
 * @param {string} nom - Le nom libre.
 * @returns {Promise<any>} `{ data: reservation }`.
 */
export const modifierExterieur = async (complexeId, reservationId, nom) => corps(
  client().put(
    `/complexes/${enc(complexeId)}/reservations/${enc(reservationId)}`,
    { data: { externalName: nom } },
  ),
);

/**
 * « Retirer » SON terrain (E-G07, E-G08) : `apercu` compte ses réservations à venir sans rien
 * écrire (`dryRun` DANS LE CORPS, `terrain.ts` `retirerTerrain`) ; sinon le terrain sort et ses
 * réservations à venir sont annulées et prévenues (N-18).
 * @param {string} complexeId - documentId du complexe.
 * @param {string} terrainId - documentId du terrain.
 * @param {{ apercu?: boolean }} [options] - L'aperçu seulement.
 * @returns {Promise<any>} `{ data: { dryRun, reservationsTouchees } }` ou
 *   `{ data: { reservationsAnnulees, retired } }`.
 */
export const retirerTerrain = async (complexeId, terrainId, { apercu = false } = {}) => corps(
  client().post(
    `/complexes/${enc(complexeId)}/terrains/${enc(terrainId)}/retirer`,
    apercu ? { dryRun: true } : {},
  ),
);

// ---------------------------------------------------------------------------------------------
// RESA-L5B-1 (20/10/2026) — les routes ajoutées par RESA-L2B (admin `origin/feat/RESA-admin`,
// `routes/protection-custom.ts`). NON LIVRÉES : cachées, comme le reste, par `COMPLEXES_GERANT`.
// ---------------------------------------------------------------------------------------------

/**
 * « Non honorée » (E-G04, E-G05, RG-NONHONOREE) : une réservation de l'app, confirmée, dont le
 * créneau a commencé il y a 7 jours au plus ; le réserveur est prévenu (N-17) et, au x-ième, banni
 * automatiquement ici (N-12 au gérant). Le serveur ne lit pas le corps.
 * @param {string} complexeId - documentId du complexe.
 * @param {string} reservationId - documentId de la réservation.
 * @returns {Promise<any>} `{ data: reservation }` (la fiche du gérant).
 */
export const marquerNonHonoree = async (complexeId, reservationId) => corps(
  client().post(
    `/complexes/${enc(complexeId)}/reservations/${enc(reservationId)}/non-honoree`,
    {},
  ),
);

/**
 * « Annuler le marquage », dans les 7 jours (le même délai que le marquage) ; personne n'est
 * prévenu, et le bannissement automatique que CE marquage avait déclenché part avec lui.
 * @param {string} complexeId - documentId du complexe.
 * @param {string} reservationId - documentId de la réservation.
 * @returns {Promise<any>} `{ data: reservation }`.
 */
export const annulerNonHonoree = async (complexeId, reservationId) => corps(
  client().post(
    `/complexes/${enc(complexeId)}/reservations/${enc(reservationId)}/non-honoree/annuler`,
    {},
  ),
);

/**
 * La fiche d'un CLIENT (E-G15) : un joueur qui a réservé ici (sinon 404
 * COMPLEXE_CLIENT_NOT_FOUND) — ses non honorées, ses annulations hors délai, ses réservations à
 * venir, son bannissement (raison PRIVÉE, lue par le gérant seul). Jamais un numéro.
 * @param {string} complexeId - documentId du complexe.
 * @param {string} joueurId - documentId du joueur.
 * @returns {Promise<any>} `{ data: { documentId, firstname, lastname, noShows, lateCancellations,
 *   upcoming, ban } }`.
 */
export const lireClient = async (complexeId, joueurId) => corps(
  client().get(`/complexes/${enc(complexeId)}/clients/${enc(joueurId)}`),
);

/**
 * « Bannir » (E-G15, RG-BAN) : chez CE complexe seulement ; le joueur n'est PAS prévenu.
 * @param {string} complexeId - documentId du complexe.
 * @param {{ cancelUpcoming?: boolean, joueur: string, reason: string, until?: string }} ban - La
 *   liste blanche du serveur (`until` : le dernier jour banni, AAAA-MM-JJ).
 * @returns {Promise<any>} `{ data: client }` (201).
 */
export const bannir = async (complexeId, ban) => corps(
  client().post(`/complexes/${enc(complexeId)}/bannis`, { data: ban }),
);

/**
 * « Débannir » : le bannissement est levé (sa ligne reste) ; le compteur des non honorées repart.
 * @param {string} complexeId - documentId du complexe.
 * @param {string} joueurId - documentId du joueur.
 * @returns {Promise<any>} `{ data: client }`.
 */
export const debannir = async (complexeId, joueurId) => corps(
  client().post(`/complexes/${enc(complexeId)}/bannis/${enc(joueurId)}/lever`, {}),
);

// ---------------------------------------------------------------------------------------------
// RESA-L5A2 — les FERMETURES d'un terrain de complexe passent par les routes des fermetures des
// Villes, élargies par RESA-L2A (`facility-closure.ts` : `canManage`, `reservationsOf`). Le service
// des fermetures est chargé À L'APPEL (même raison que le client, en tête de ce fichier).
// ---------------------------------------------------------------------------------------------

/**
 * Le service des fermetures, chargé à l'appel.
 * @returns {any} Le module.
 */
// eslint-disable-next-line global-require
const fermetures = () => require('../facilityClosure/facilityClosureService');

/**
 * Lance un geste par terrain, l'un après l'autre : ce qui est fait reste fait. Tout échoue ⇒ le
 * premier refus est levé (l'écran le dit) ; une partie échoue ⇒ les échecs sont rendus.
 * @param {string[]} ids - Les identifiants.
 * @param {(id: string) => Promise<any>} geste - Le geste.
 * @returns {Promise<{ echecs: Array<{ erreur: any, id: string }>, reponses: any[] }>} Le bilan.
 */
const unParUn = async (ids, geste) => {
  /** @type {any[]} */
  const reponses = [];
  /** @type {Array<{ erreur: any, id: string }>} */
  const echecs = [];
  // Un par un, exprès : une fermeture annule des réservations, l'ordre est celui de l'écran.
  // eslint-disable-next-line no-restricted-syntax
  for (const id of ids) {
    try {
      // eslint-disable-next-line no-await-in-loop
      reponses.push(await geste(id));
    } catch (erreur) {
      echecs.push({ erreur, id });
    }
  }
  if (!reponses.length && echecs.length) throw echecs[0].erreur;
  return { echecs, reponses };
};

/**
 * Les fermetures à venir (actives) de ces terrains, chacune avec son terrain.
 * @param {string[]} terrainIds - Les terrains.
 * @returns {Promise<any[]>} Les fermetures (`terrainId` ajouté).
 */
export const lireFermetures = async (terrainIds) => {
  const listes = await Promise.all(terrainIds.map(async (terrainId) => {
    const reponse = await fermetures().listFacilityClosures(terrainId, { status: 'active' });
    return (Array.isArray(reponse?.data) ? reponse.data : [])
      .map((/** @type {any} */ fermeture) => ({ ...fermeture, terrainId }));
  }));
  return listes.flat();
};

/**
 * L'aperçu d'une fermeture sur ces terrains (E-G10) : les réservations touchées, réunies.
 * @param {string[]} terrainIds - Les terrains.
 * @param {{ endDate: string, startDate: string }} dates - Les jours.
 * @returns {Promise<{ count: number, items: any[] }>} Les réservations touchées.
 */
export const lireApercuFermeture = async (terrainIds, { endDate, startDate }) => {
  const apercus = await Promise.all(terrainIds.map(async (terrainId) => {
    const reponse = await fermetures().previewFacilityClosure(terrainId, {
      endDate, kind: 'closure', startDate,
    });
    const touchees = reponse?.meta?.reservations;
    return {
      count: Number(touchees?.count) || 0,
      items: (Array.isArray(touchees?.items) ? touchees.items : [])
        .map((/** @type {any} */ item) => ({ ...item, terrainId })),
    };
  }));
  return {
    count: apercus.reduce((somme, apercu) => somme + apercu.count, 0),
    items: apercus.flatMap((apercu) => apercu.items),
  };
};

/**
 * Fermer des jours (E-G10) : UNE fermeture PAR terrain. Sans actualité (la case « Publier aussi une
 * actualité » est celle de la Ville).
 * @param {string[]} terrainIds - Les terrains.
 * @param {{ endDate: string, label?: string | null, message?: string | null, reason: string,
 *   startDate: string }} fermeture - Les jours, le motif, le mot aux joueurs.
 * @returns {Promise<{ annulees: number, echecs: Array<{ erreur: any, id: string }>,
 *   faits: number }>} Le bilan.
 */
export const fermerTerrains = async (terrainIds, fermeture) => {
  const { echecs, reponses } = await unParUn(terrainIds, (terrainId) => fermetures().closeFacility(
    terrainId,
    { ...fermeture, kind: 'closure', publishActualite: false },
  ));
  return {
    annulees: reponses.reduce(
      (somme, reponse) => somme + (Number(reponse?.data?.reservations?.annulees) || 0),
      0,
    ),
    echecs,
    faits: reponses.length,
  };
};

/**
 * « Rouvrir » des fermetures, ou « Débloquer » un créneau : un état, jamais une suppression.
 * @param {string[]} fermetureIds - Les fermetures.
 * @returns {Promise<{ echecs: Array<{ erreur: any, id: string }>, faits: number }>} Le bilan.
 */
export const rouvrirFermetures = async (fermetureIds) => {
  const { echecs, reponses } = await unParUn(
    fermetureIds,
    (fermetureId) => fermetures().reopenFacilityClosure(fermetureId),
  );
  return { echecs, faits: reponses.length };
};

/**
 * « Bloquer ce créneau » (E-G03) : une plage d'UN jour, motif facultatif pour un complexe.
 * @param {string} terrainId - Le terrain.
 * @param {{ date: string, from: string, motif?: string, to: string }} blocage - La plage.
 * @returns {Promise<any>} `{ data: fermeture }` (avec `reservations.gardees`).
 */
export const bloquerCreneau = async (terrainId, {
  date, from, motif, to,
}) => fermetures().closeFacility(terrainId, {
  endDate: date,
  endTime: to,
  kind: 'block',
  startDate: date,
  startTime: from,
  ...(motif ? { label: motif } : {}),
});

/**
 * Téléverse UNE photo (`POST /upload`, le chemin des actualités de la Ville) ; le serveur du
 * complexe vérifie ensuite qu'elle n'est liée à rien d'autre (COMPLEXE_FILE_NOT_ALLOWED).
 * @param {any} brut - Ce que rend le sélecteur d'image.
 * @returns {Promise<{ id: number, url?: string } | null>} Le fichier, ou null.
 */
export const televerserPhoto = async (brut) => uploadActualiteFile(brut);
