import { clubHubTarget, homeTarget } from '@/domains/tour/guideCommon';
import { PRESIDENT_GUIDE_SETTINGS } from '@/domains/tour/presidentGuideSettings';
import t from '@/domains/tour/presidentText';

import { RouteNames } from '@/navigation/routeNames';

/**
 * Guide Dirigeant·e, M1 « Gérer ton club » (pack `05_GUIDE_D_DIRIGEANT.md`).
 * Cinq parties, ① à ⑤, qui repartent de la fiche du club.
 *
 * Écarts au pack, tranchés le 05/11 : ②③④ sont montrés sans être joués si l'offre Club n'est pas
 * ouverte (décision 1) ; ② se passe (décision 4) ; la bulle d'adresse se dit AVANT d'ouvrir la
 * feuille et se retire dedans, donc `m1-ffsearch` et `m1-ffsel` n'existent pas (§3 bis, 1).
 */

const MISSION_ID = 'president_m1';
const hasClubPlan = (/** @type {any} */ ctx) => Boolean(ctx?.flags?.hasClubPlan);
const noClubPlan = (/** @type {any} */ ctx) => !hasClubPlan(ctx);

export const M1_MISSION = {
  gaugeStep: 25,
  id: MISSION_ID,
  locked: true,
  get title() { return t('missions.m1', 'Gérer ton club'); },
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
  when: hasClubPlan,
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
    missionId: MISSION_ID,
    navTarget: clubHubTarget,
    get nextLabel() { return t('next', 'Suivant'); },
    resumeFrom: 'm1-info',
    targets: ['club.card'],
    get text() {
      return t(
        'm1-info',
        '① La carte de ton club : logo, nom, adresse, téléphone, email. C’est ce que voient les '
          + 'joueur·se·s.',
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
  editStep('m1-addr', 'clubEdit.address', () => t(
    'm1-addr',
    'L’adresse du club. « Placer sur la carte » permet aux joueur·se·s de te trouver autour d’eux.',
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

const PART_PARTNERS = [
  {
    id: 'm1-partners-visit',
    missionId: MISSION_ID,
    navTarget: clubHubTarget,
    get nextLabel() { return t('next', 'Suivant'); },
    resumeFrom: 'm1-partners-visit',
    targets: ['club.m.partners'],
    get text() {
      return t(
        'm1-partners-visit',
        '② Tes partenaires s’ajoutent ici, avec l’offre Club : leur logo sur tes cartes équipe et '
          + 'la page du club.',
      );
    },
    when: noClubPlan,
  },
  {
    advanceOn: { key: 'club.section.partners', type: 'interaction' },
    id: 'm1-partners',
    missionId: MISSION_ID,
    navTarget: clubHubTarget,
    passable: PRESIDENT_GUIDE_SETTINGS.partnerPassable,
    resumeFrom: 'm1-partners',
    subMission: 'partners',
    targets: ['club.m.partners'],
    get text() { return t('m1-partners', '② Tes partenaires. Ouvre « Nos partenaires ».'); },
    when: hasClubPlan,
  },
  {
    advanceOn: { key: RouteNames.AddSponsor, type: 'route' },
    id: 'm1-padd',
    missionId: MISSION_ID,
    passable: PRESIDENT_GUIDE_SETTINGS.partnerPassable,
    resumeFrom: 'm1-partners',
    subMission: 'partners',
    targets: ['club.partners.add'],
    get text() { return t('m1-padd', 'Ajoute ton premier partenaire avec « + ».'); },
    when: hasClubPlan,
  },
  {
    advanceOn: { key: 'sponsor.created', type: 'action' },
    id: 'm1-pform',
    missionId: MISSION_ID,
    passable: PRESIDENT_GUIDE_SETTINGS.partnerPassable,
    refused: {
      key: 'paywall.sponsor-manage-required',
      text: () => t(
        'm1-pform-refused',
        'Sans offre Club, pas de partenaire : ferme l’offre et passe cette partie.',
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
    when: hasClubPlan,
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
    when: hasClubPlan,
  },
];

const PART_FACILITIES = [
  {
    id: 'm1-fac-visit',
    missionId: MISSION_ID,
    navTarget: clubHubTarget,
    get nextLabel() { return t('next', 'Suivant'); },
    resumeFrom: 'm1-fac-visit',
    targets: ['club.m.facilities'],
    get text() {
      return t(
        'm1-fac-visit',
        '③ Tes installations et leur planning se créent ici, avec l’offre Club.',
      );
    },
    when: noClubPlan,
  },
  {
    advanceOn: { key: RouteNames.FacilityList, type: 'route' },
    id: 'm1-fac',
    missionId: MISSION_ID,
    // Depuis « Passer cette partie » sur l'ajout d'un partenaire : la fiche n'est pas à l'écran.
    navigateOnEnter: true,
    navTarget: clubHubTarget,
    resumeFrom: 'm1-fac',
    subMission: 'facilities',
    targets: ['club.m.facilities'],
    get text() { return t('m1-fac', '③ Tes installations : stade, gymnase, salle…'); },
    when: hasClubPlan,
  },
  {
    advanceOn: { key: RouteNames.FacilityForm, type: 'route' },
    id: 'm1-facadd',
    missionId: MISSION_ID,
    resumeFrom: 'm1-fac',
    subMission: 'facilities',
    targets: ['facility.add'],
    get text() { return t('m1-facadd', 'Ajoute une installation.'); },
    when: hasClubPlan,
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
    when: hasClubPlan,
  },
  {
    advanceOn: { key: 'facility.created', type: 'action' },
    id: 'm1-ff3',
    missionId: MISSION_ID,
    refused: {
      key: 'paywall.facility-manage-required',
      text: () => t(
        'm1-ff3-refused',
        'Sans offre Club, pas d’installation : ferme l’offre et passe cette partie.',
      ),
    },
    resumeFrom: 'm1-fac',
    subMission: 'facilities',
    targets: ['facility.create'],
    get text() { return t('m1-ff3', 'Tout est bon ? Crée l’installation.'); },
    when: hasClubPlan,
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
    when: hasClubPlan,
  },
  Object.getOwnPropertyDescriptors(step),
);

const PART_PLANNING = [
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
    get text() { return t('m1-fplan', '④ Ton installation est créée. Ouvre son planning.'); },
    when: hasClubPlan,
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
      return t('m1-parrows', 'Les flèches changent de période. Essaie → pour voir la suite.');
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
    when: hasClubPlan,
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
    when: hasClubPlan,
  },
];

const PART_POSTER = [
  {
    advanceOn: { key: RouteNames.VisualShowcase, type: 'route' },
    id: 'm1-poster',
    missionId: MISSION_ID,
    navTarget: clubHubTarget,
    resumeFrom: 'm1-poster',
    targets: ['club.poster'],
    get text() { return t('m1-poster', '⑤ Dernière étape : l’affiche « Rejoindre le club ».'); },
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
    get nextLabel() { return t('m1-psent-next', 'C’est envoyé'); },
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
        'Envoyée ! Tu restes sur ton affiche pour la partager ailleurs. Quand tu as fini, '
          + 'ferme-la avec la croix.',
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
