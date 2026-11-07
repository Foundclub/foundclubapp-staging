import { clubHubTarget, homeTarget } from '@/domains/tour/guideCommon';
import { PRESIDENT_GUIDE_SETTINGS } from '@/domains/tour/presidentGuideSettings';
import t from '@/domains/tour/presidentText';

import { RouteNames } from '@/navigation/routeNames';

/**
 * Guide Dirigeant·e, M1 « Gérer ton club » (pack `05_GUIDE_D_DIRIGEANT.md`).
 * Cinq parties, ① à ⑤, qui repartent de la fiche du club.
 *
 * Écarts au pack, tranchés le 05/11 : ②③④ se jouent pour tous, car la première installation
 * et le premier partenaire sont offerts (Adel « 77- C ») ; ② se passe (décision 4) ; la bulle
 * d'adresse se dit AVANT d'ouvrir la feuille et se retire dedans, donc `m1-ffsearch` et
 * `m1-ffsel` n'existent pas (§3 bis, 1).
 */

const MISSION_ID = 'president_m1';
/**
 * La place offerte est déjà prise, dit par l'écran : on le dit AVANT de faire remplir (leçon G93).
 * @param {string} key - Signal de l'écran.
 * @returns {(ctx: any) => boolean} Condition de l'étape.
 */
const isTaken = (key) => (ctx) => Boolean(ctx?.created?.[key]);

/**
 * Recette L11 (l11-m1-reprise) : vue de l'Accueil, la bulle d'une étape de la fiche garde sa
 * consigne et montre la carte « Gérer mon club ».
 * @param {() => string} text - Texte de la bulle sur l'Accueil.
 * @returns {{ targets: string[]; text: string }} Repli de l'étape.
 */
const fromHome = (text) => ({
  targets: ['home.card.manage-club'],
  get text() { return text(); },
});

export const M1_MISSION = {
  gaugeStep: 25,
  id: MISSION_ID,
  locked: true,
  get title() { return t('missionTitles.m1', 'Gérer ton club'); },
};

/**
 * Une bulle sur un champ de « Modifier le club » : on vérifie, on corrige, « Suivant ».
 * @param {string} id - Id de l'étape.
 * @param {string} target - Ancre du champ.
 * @param {() => string} text - Texte de la bulle.
 * @returns {any} Étape.
 */
const editStep = (id, target, text) => ({
  id,
  missionId: MISSION_ID,
  get nextLabel() { return t('next', 'Suivant'); },
  resumeFrom: 'm1-info',
  targets: [target],
  get text() { return text(); },
});

/**
 * Une bulle du formulaire d'installation dont « Suivant » attend un champ rempli.
 * @param {string} id - Id de l'étape.
 * @param {string} target - Ancre du champ.
 * @param {string} field - Champ dit par l'écran (`reportTourField`).
 * @param {() => string} text - Texte de la bulle.
 * @param {() => string} message - Ce que la bulle dit si le champ est vide.
 * @returns {any} Étape.
 */
const facilityFieldStep = (id, target, field, text, message) => ({
  id,
  missionId: MISSION_ID,
  get nextLabel() { return t('next', 'Suivant'); },
  nextRequires: { field, message },
  resumeFrom: 'm1-fac',
  subMission: 'facilities',
  targets: [target],
  get text() { return text(); },
});

const PART_INFOS = [
  {
    advanceOn: { key: RouteNames.Club, type: 'route' },
    id: 'm1-card',
    missionId: MISSION_ID,
    navTarget: homeTarget,
    targets: ['home.card.manage-club'],
    get text() { return t('m1-card', 'Tout part d’ici : ouvre « Gérer mon club ».'); },
  },
  {
    id: 'm1-info',
    lookOnly: true,
    missionId: MISSION_ID,
    navTarget: clubHubTarget,
    get nextLabel() { return t('next', 'Suivant'); },
    resumeFrom: 'm1-info',
    targets: ['club.card'],
    get text() {
      return t(
        'm1-info',
        '1/5 · La carte de ton club : logo, nom, adresse, téléphone, email. C’est ce que '
          + 'voient les joueur·se·s.',
      );
    },
  },
  {
    advanceOn: { key: RouteNames.ClubEdit, type: 'route' },
    id: 'm1-edit',
    missionId: MISSION_ID,
    resumeFrom: 'm1-info',
    targets: ['club.edit'],
    get text() { return t('m1-edit', 'Pour les personnaliser, touche « Modifier ».'); },
  },
  editStep('m1-logo', 'clubEdit.logo', () => t(
    'm1-logo',
    'Ton logo : touche-le pour choisir une image de ton téléphone.',
  )),
  editStep('m1-name', 'clubEdit.name', () => t(
    'm1-name',
    'Le nom du club, tel qu’il apparaît partout. Corrige-le si besoin.',
  )),
  editStep('m1-email', 'clubEdit.email', () => t('m1-email', 'L’email de contact du club.')),
  editStep('m1-phone', 'clubEdit.phone', () => t('m1-phone', 'Le téléphone du club.')),
  // GUIDE-D-CORR TG-09 (tournée du 07/11, g15) : « Placer sur la carte » n'est pas à l'écran ; la
  // bulle ne nomme que ce qu'on voit.
  editStep('m1-addr', 'clubEdit.address', () => t(
    'm1-addr',
    'L’adresse du club : touche le champ, tape-la et choisis-la dans la liste. Elle place ton '
      + 'club sur la carte, pour que les joueur·se·s te trouvent autour d’eux.',
  )),
  editStep('m1-deleg', 'clubEdit.delegation', () => t(
    'm1-deleg',
    'Qui accepte les joueur·se·s dans les équipes : toi seul·e, ou chaque coach pour son équipe.',
  )),
  editStep('m1-create', 'clubEdit.teamCreation', () => t(
    'm1-create',
    'Tes coachs créent-ils leurs équipes eux-mêmes ? Et dois-tu les valider ?',
  )),
  {
    advanceOn: { key: 'club.updated', type: 'action' },
    id: 'm1-save',
    missionId: MISSION_ID,
    resumeFrom: 'm1-info',
    targets: ['clubEdit.save'],
    get text() { return t('m1-save', 'Enregistre.'); },
  },
];

const PARTNER_TAKEN = { goto: 'm1-partners-taken', key: 'sponsor.free.taken', type: 'action' };
// GUIDE-D-CORR TG-06 (tournée du 07/11, r12-r14) : un partenaire déjà là, comme l'installation
// (`facility.existing`) ; on ne demande pas « ton premier partenaire ».
const PARTNER_EXISTING = { goto: 'm1-partners-have', key: 'sponsor.existing', type: 'action' };
/**
 * TG-06 : la partie 2/5 est faite (partenaire créé pendant le guide, ou déjà là) ; rejouée après un
 * retour en arrière, elle ne se redemande pas.
 * @param {any} ctx - Contexte du guide.
 * @returns {boolean} La partie reste à faire.
 */
const isPartnerToDo = (ctx) => !ctx?.created?.['sponsor.created']
  && !ctx?.created?.['sponsor.existing'];

const PART_PARTNERS = [
  {
    advanceOn: [
      { key: 'club.section.partners', type: 'interaction' },
      PARTNER_TAKEN,
      PARTNER_EXISTING,
    ],
    fallback: fromHome(() => t(
      'm1-partners-home',
      '2/5 · Tes partenaires. Ouvre « Gérer mon club », puis « Nos partenaires ».',
    )),
    id: 'm1-partners',
    missionId: MISSION_ID,
    navTarget: clubHubTarget,
    passable: PRESIDENT_GUIDE_SETTINGS.partnerPassable,
    resumeFrom: 'm1-partners',
    subMission: 'partners',
    targets: ['club.m.partners'],
    get text() { return t('m1-partners', '2/5 · Tes partenaires. Ouvre « Nos partenaires ».'); },
    when: isPartnerToDo,
  },
  {
    advanceOn: [{ key: RouteNames.AddSponsor, type: 'route' }, PARTNER_TAKEN, PARTNER_EXISTING],
    id: 'm1-padd',
    missionId: MISSION_ID,
    passable: PRESIDENT_GUIDE_SETTINGS.partnerPassable,
    resumeFrom: 'm1-partners',
    subMission: 'partners',
    targets: ['club.partners.add'],
    get text() { return t('m1-padd', 'Ajoute ton premier partenaire avec « + ».'); },
    when: isPartnerToDo,
  },
  {
    id: 'm1-partners-taken',
    lookOnly: true,
    missionId: MISSION_ID,
    passable: true,
    resumeFrom: 'm1-partners',
    subMission: 'partners',
    targets: ['club.partners.add'],
    get text() {
      return t(
        'm1-partners-taken',
        'Ton partenaire offert est déjà là : le suivant demande l’offre Club. Passe cette partie.',
      );
    },
    when: (/** @type {any} */ ctx) => isTaken('sponsor.free.taken')(ctx)
      && !ctx?.created?.['sponsor.created'],
  },
  {
    id: 'm1-partners-have',
    lookOnly: true,
    missionId: MISSION_ID,
    get nextLabel() { return t('next', 'Suivant'); },
    resumeFrom: 'm1-partners',
    subMission: 'partners',
    targets: ['club.partners.add'],
    get text() {
      return t(
        'm1-partners-have',
        '2/5 · Tu as déjà ton partenaire : il est dans cette liste. « + » en ajoute un autre plus '
          + 'tard. On passe à tes installations.',
      );
    },
    // Seulement par l'aiguillage `sponsor.existing`.
    when: (/** @type {any} */ ctx) => Boolean(ctx?.created?.['sponsor.existing'])
      && !ctx?.created?.['sponsor.created'],
  },
  {
    // TG-06 : « Reviens sur la fiche » ne suit que la création ; rejouée, la partie est sautée.
    advanceOn: {
      commits: true, goto: 'm1-pback', key: 'sponsor.created', type: 'action',
    },
    id: 'm1-pform',
    missionId: MISSION_ID,
    passable: PRESIDENT_GUIDE_SETTINGS.partnerPassable,
    refused: {
      key: 'paywall.sponsor-manage-required',
      text: () => t(
        'm1-pform-refused',
        'Ton offre gratuite compte déjà son partenaire : le suivant demande l’offre Club. Ferme '
          + 'l’offre et passe cette partie.',
      ),
    },
    resumeFrom: 'm1-partners',
    subMission: 'partners',
    targets: ['sponsor.fields', 'sponsor.save'],
    get text() {
      return t(
        'm1-pform',
        'Son logo, son nom et le lien de son site, puis « Ajouter le partenaire ».',
      );
    },
    veil: false,
    when: isPartnerToDo,
  },
  {
    advanceOn: { key: 'club.section.closed', type: 'interaction' },
    id: 'm1-pback',
    missionId: MISSION_ID,
    resumeFrom: 'm1-fac',
    subMission: 'partners',
    targets: ['header.back'],
    get text() { return t('m1-pback', 'Reviens sur la fiche du club.'); },
    // Laisse le geste du bord, seul retour d'un iPhone sans flèche à portée.
    veil: false,
    // Seulement par l'aiguillage de `m1-pform` (TG-06) : jamais au fil d'une partie rejouée.
    when: () => false,
  },
];

const FACILITY_TAKEN = { goto: 'm1-fac-taken', key: 'facility.free.taken', type: 'action' };
// Recette L11 (décision du chef, 06/11) : une installation déjà là suffit, on passe à son planning.
// Train 5 : elle passe avant « place offerte prise » (QUOTA-CLUB), que FacilityList émet après elle.
const FACILITY_EXISTING = { goto: 'm1-fac-have', key: 'facility.existing', type: 'action' };

const PART_FACILITIES = [
  {
    // Le signal de l'écran peut précéder sa route : les deux étapes l'écoutent.
    advanceOn: [{ key: RouteNames.FacilityList, type: 'route' }, FACILITY_EXISTING, FACILITY_TAKEN],
    fallback: fromHome(() => t(
      'm1-fac-home',
      '3/5 · Tes installations : stade, gymnase, salle… Ouvre « Gérer mon club ».',
    )),
    id: 'm1-fac',
    missionId: MISSION_ID,
    // Depuis « Passer cette partie » sur l'ajout d'un partenaire : la fiche n'est pas à l'écran.
    navigateOnEnter: true,
    navTarget: clubHubTarget,
    resumeFrom: 'm1-fac',
    subMission: 'facilities',
    targets: ['club.m.facilities'],
    get text() { return t('m1-fac', '3/5 · Tes installations : stade, gymnase, salle…'); },
  },
  {
    advanceOn: [{ key: RouteNames.FacilityForm, type: 'route' }, FACILITY_EXISTING, FACILITY_TAKEN],
    id: 'm1-facadd',
    missionId: MISSION_ID,
    resumeFrom: 'm1-fac',
    subMission: 'facilities',
    targets: ['facility.add'],
    get text() { return t('m1-facadd', 'Ajoute une installation.'); },
  },
  {
    id: 'm1-fac-taken',
    lookOnly: true,
    missionId: MISSION_ID,
    passable: true,
    resumeFrom: 'm1-fac',
    subMission: 'facilities',
    targets: ['facility.add'],
    get text() {
      return t(
        'm1-fac-taken',
        'Ton installation offerte est déjà là : la suivante demande l’offre Club. Passe cette '
          + 'partie.',
      );
    },
    when: isTaken('facility.free.taken'),
  },
  facilityFieldStep(
    'm1-ffname',
    'facility.field.name',
    'facility.name',
    () => t('m1-ffname', 'Son nom (obligatoire) : par ex. Terrain Honneur ou Gymnase A.'),
    () => t('m1-ffname-guard', 'Donne d’abord un nom à l’installation.'),
  ),
  facilityFieldStep(
    'm1-fftype',
    'facility.field.type',
    'facility.type',
    () => t('m1-fftype', 'Son type (obligatoire) : stade, gymnase, salle…'),
    () => t('m1-fftype-guard', 'Choisis d’abord le type de l’installation.'),
  ),
  facilityFieldStep(
    'm1-ffaddr',
    'facility.address',
    'facility.address',
    () => t('m1-ffaddr', 'Son adresse (obligatoire) : touche le champ, tape-la, choisis-la dans la '
      + 'liste, puis « Sélectionner ».'),
    () => t('m1-ffaddr-guard', 'Choisis d’abord l’adresse de l’installation.'),
  ),
  {
    id: 'm1-ff2',
    missionId: MISSION_ID,
    get nextLabel() { return t('next', 'Suivant'); },
    resumeFrom: 'm1-fac',
    subMission: 'facilities',
    targets: ['facility.conflict', 'facility.capacity', 'facility.color'],
    get text() {
      return t(
        'm1-ff2',
        'Conflit de créneaux : à valider, ou réservé tout de suite. Capacité : équipes en même '
          + 'temps. Couleur : son repère.',
      );
    },
    veil: false,
  },
  {
    advanceOn: { key: 'facility.created', type: 'action' },
    id: 'm1-ff3',
    missionId: MISSION_ID,
    refused: {
      key: 'paywall.facility-manage-required',
      text: () => t(
        'm1-ff3-refused',
        'Ton offre gratuite compte déjà son installation : la suivante demande l’offre Club. Ferme '
          + 'l’offre et passe cette partie.',
      ),
    },
    resumeFrom: 'm1-fac',
    subMission: 'facilities',
    targets: ['facility.create'],
    get text() { return t('m1-ff3', 'Tout est bon ? Crée l’installation.'); },
  },
];

// Reprise de ④ : la liste des installations, où est la carte de celle créée en ③.
const facilityListTarget = {
  params: (/** @type {any} */ context) => ({ clubId: context?.userData?.club?.documentId }),
  routeName: RouteNames.FacilityList,
};

/**
 * Une bulle sur le planning de l'installation, avec ses événements d'exemple.
 * @param {any} step - Étape (ses `get` sont gardés).
 * @returns {any} Étape complétée.
 */
const planningStep = (step) => Object.defineProperties(
  {
    missionId: MISSION_ID,
    resumeFrom: 'm1-fplan',
    subMission: 'facilities',
    tourExample: 'planning',
  },
  Object.getOwnPropertyDescriptors(step),
);

const PART_PLANNING = [
  {
    advanceOn: { goto: 'm1-pdemo', key: 'facility.planning.opened', type: 'interaction' },
    id: 'm1-fac-have',
    missionId: MISSION_ID,
    navTarget: facilityListTarget,
    resumeFrom: 'm1-fac',
    subMission: 'facilities',
    targetsFor: (/** @type {any} */ context) => {
      const facilityId = context?.created?.['facility.existing']?.facilityId;
      return facilityId ? [`facility.plan.${facilityId}`] : [];
    },
    get text() {
      return t('m1-fac-have', '3/5 · Tu as déjà ton terrain. Ouvre son planning.');
    },
    // Seulement par l'aiguillage : après une création, la partie suit son cours.
    when: (/** @type {any} */ ctx) => Boolean(ctx?.created?.['facility.existing'])
      && !ctx?.created?.['facility.created'],
  },
  {
    advanceOn: { key: 'facility.planning.opened', type: 'interaction' },
    id: 'm1-fplan',
    missionId: MISSION_ID,
    navTarget: facilityListTarget,
    resumeFrom: 'm1-fplan',
    subMission: 'facilities',
    targetsFor: (/** @type {any} */ context) => {
      const facilityId = context?.created?.['facility.created']?.facilityId;
      return facilityId ? [`facility.plan.${facilityId}`] : [];
    },
    get text() { return t('m1-fplan', '4/5 · Ton installation est créée. Ouvre son planning.'); },
  },
  planningStep({
    bubblePlacement: 'top',
    id: 'm1-pdemo',
    get nextLabel() { return t('next', 'Suivant'); },
    targets: ['planning.grid'],
    get text() {
      return t(
        'm1-pdemo',
        'Ton planning est encore vide : on y a mis quelques événements d’exemple pour te '
          + 'montrer. Ils disparaissent à la fin du guide.',
      );
    },
    veil: false,
  }),
  planningStep({
    id: 'm1-pcap',
    get nextLabel() { return t('next', 'Suivant'); },
    targets: ['planning.capacity'],
    get text() {
      return t(
        'm1-pcap',
        'La capacité : combien d’équipes peuvent jouer en même temps, le moment le plus chargé '
          + 'et les places encore libres.',
      );
    },
  }),
  planningStep({
    advanceOn: { key: 'facility.planning.filter', type: 'interaction' },
    id: 'm1-pchips',
    targets: ['planning.chips'],
    get text() {
      return t(
        'm1-pchips',
        'Choisis l’installation affichée. « Toutes installations » regroupe tout ton club : '
          + 'touche-le.',
      );
    },
  }),
  planningStep({
    advanceOn: { key: 'planning.period.next', type: 'interaction' },
    id: 'm1-parrows',
    targets: ['planning.head'],
    get text() {
      return t('m1-parrows', 'Les flèches changent de période. Essaie celle de droite.');
    },
  }),
  planningStep({
    bubblePlacement: 'top',
    id: 'm1-pempty',
    get nextLabel() { return t('next', 'Suivant'); },
    targets: ['planning.grid'],
    get text() {
      return t(
        'm1-pempty',
        'Une période sans événement s’affiche comme ça. Les créneaux de tes coachs apparaîtront '
          + 'ici automatiquement.',
      );
    },
    veil: false,
  }),
  planningStep({
    advanceOn: { key: 'planning.view.month', type: 'interaction' },
    id: 'm1-pview',
    targets: ['planning.views'],
    get text() {
      return t('m1-pview', 'Change d’affichage : Semaine, 3 jours ou Mois. Touche « Mois ».');
    },
  }),
  planningStep({
    bubblePlacement: 'top',
    id: 'm1-pmonth',
    get nextLabel() { return t('understood', 'Compris'); },
    targets: ['planning.grid'],
    get text() {
      return t(
        'm1-pmonth',
        'En vue Mois, un point signale chaque jour où l’installation est occupée.',
      );
    },
    veil: false,
  }),
  {
    advanceOn: { key: RouteNames.FacilityList, type: 'route' },
    id: 'm1-pb1',
    missionId: MISSION_ID,
    resumeFrom: 'm1-fplan',
    subMission: 'facilities',
    targets: ['header.back'],
    get text() { return t('m1-pb1', 'Reviens à tes installations.'); },
    veil: false,
  },
  {
    advanceOn: { key: RouteNames.Club, type: 'route' },
    id: 'm1-fback',
    missionId: MISSION_ID,
    resumeFrom: 'm1-poster',
    subMission: 'facilities',
    targets: ['header.back'],
    get text() { return t('m1-fback', 'Puis retourne sur la fiche du club.'); },
    veil: false,
  },
];

const PART_POSTER = [
  {
    advanceOn: { key: RouteNames.VisualShowcase, type: 'route' },
    id: 'm1-poster',
    missionId: MISSION_ID,
    // Depuis « Passer cette partie » sur les installations : la fiche n'est pas à l'écran.
    navigateOnEnter: true,
    navTarget: clubHubTarget,
    resumeFrom: 'm1-poster',
    targets: ['club.poster'],
    get text() {
      return t('m1-poster', 'Dernière étape : l’affiche « Rejoindre le club ».');
    },
  },
  {
    advanceOn: { key: 'poster.model', type: 'interaction' },
    id: 'm1-pmodel',
    missionId: MISSION_ID,
    resumeFrom: 'm1-poster',
    targets: ['poster.model'],
    get text() { return t('m1-pmodel', 'Choisis un modèle : Écusson ou Famille.'); },
  },
  {
    bubblePlacement: 'top',
    id: 'm1-pposter',
    missionId: MISSION_ID,
    get nextLabel() { return t('next', 'Suivant'); },
    resumeFrom: 'm1-poster',
    targets: ['poster.preview'],
    get text() {
      return t(
        'm1-pposter',
        'Voici ton affiche : le nom du club, ton sport et le QR code qui mène à ton club. Tu '
          + 'pourras changer de modèle à tout moment.',
      );
    },
    veil: false,
  },
  {
    advanceOn: { key: 'poster.text.opened', type: 'interaction' },
    id: 'm1-ptext',
    missionId: MISSION_ID,
    resumeFrom: 'm1-poster',
    targets: ['poster.text'],
    get text() {
      return t(
        'm1-ptext',
        'Tu peux aussi adapter les textes de l’affiche. Touche « Personnaliser le texte ».',
      );
    },
  },
  {
    bubblePlacement: 'top',
    id: 'm1-pfields',
    missionId: MISSION_ID,
    get nextLabel() { return t('next', 'Suivant'); },
    resumeFrom: 'm1-poster',
    targets: ['poster.fields'],
    get text() {
      return t(
        'm1-pfields',
        'Change le titre, l’accroche, les sports ou le texte sous le QR code. Laisse vide pour '
          + 'garder le texte proposé.',
      );
    },
    // Les champs restent saisissables : le cadre n'intercepte aucune touche.
    veil: false,
  },
  {
    // ponytail: si l'affiche ne se fabrique pas, le bouton reste grisé et la bulle attend ;
    // sortie : « Réessayer » de l'écran, ou la pause du guide.
    // Partagée : le bilan le dira ; revenue sans partager : la bulle suivante, sans bilan.
    advanceOn: [
      { key: 'club.poster.shared', type: 'action' },
      { key: 'poster.share.returned', type: 'interaction' },
    ],
    bubblePlacement: 'top',
    id: 'm1-pshare',
    missionId: MISSION_ID,
    resumeFrom: 'm1-poster',
    targets: ['poster.share'],
    get text() {
      return t(
        'm1-pshare',
        'Le QR code mène directement à ton club. Partage l’affiche, ou imprime-la pour le '
          + 'club-house.',
      );
    },
  },
  {
    bubblePlacement: 'top',
    id: 'm1-psent',
    missionId: MISSION_ID,
    get nextLabel() { return t('m1-psent-next', 'C’est fait'); },
    resumeFrom: 'm1-poster',
    targets: ['poster.share'],
    get text() {
      return t('m1-psent', 'Tu peux la partager encore, ou continuer quand c’est fait.');
    },
    veil: false,
  },
  {
    advanceOn: { key: RouteNames.Club, type: 'route' },
    completesMission: true,
    id: 'm1-pclose',
    missionId: MISSION_ID,
    resumeFrom: 'm1-poster',
    targets: ['poster.close'],
    get text() {
      return t(
        'm1-pclose',
        'Tu restes sur ton affiche pour la partager ailleurs. Quand tu as fini, ferme-la avec '
          + 'la croix.',
      );
    },
  },
];

export const M1_STEPS = [
  ...PART_INFOS,
  ...PART_PARTNERS,
  ...PART_FACILITIES,
  ...PART_PLANNING,
  ...PART_POSTER,
];
