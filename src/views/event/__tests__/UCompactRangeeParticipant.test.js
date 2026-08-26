import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import EventParticipants from '../components/EventParticipants';

// COMPACT (vague U, 26/08) — LA RANGEE D UN PARTICIPANT NE FAIT PLUS QU UNE LIGNE.
//
// 📸 CE QU ADEL A VU (capture du 26/08 19h32, onglet Participants d un match) :
// une SEULE rangee de joueur occupait cinq etages — la pastille sur 3 lignes
// (« Arrivé » / « 270 min en avance » / « 19:29 »), le bouton « Modifier » sur
// son propre etage, puis « Correction manuelle staff » et « Corrigé par
// Philippe Courtoi ». Deux joueurs remplissaient l ecran.
//
// 🎯 CE QUE CE FILET TIENT, ET QUE LES PORTES NE VOIENT PAS :
//   1. le bloc « staff » n existe plus — aucun de ses trois textes ne revient
//   2. la pastille se compose HORIZONTALEMENT : un seul etage, jamais trois
//   3. la rangee mesure la hauteur de l avatar plus ses marges, et cette
//      hauteur est LA MEME quel que soit l etat du joueur (D5)
//   4. le bouton « Modifier » vit DANS la ligne, et reste attrapable au doigt
//
// 🧷 CE FILET NE TOUCHE NI AUX LIBELLES NI AUX COULEURS : ils appartiennent au
// lot S3, valide par Adel le 25/08, et `AD06ParticipantsFilet.test.js` les fige
// deja en `toEqual` STRICT. Si ce fichier-ci devenait rouge en meme temps
// qu AD06, c est qu un libelle aurait bouge — ce n est pas le sujet de COMPACT.

// 🧨 CONDITIONS DE DEMARRAGE, PAS DES CONFORTS (motif recopie d AD06).
// `EventParticipants` importe `licenseQueries` et `eventService`, qui
// descendent jusqu a `client.native.js` — lequel jette AU CHARGEMENT quand
// `.env` est absent, et `.env` est gitignore donc absent de toute copie de
// travail. Sans ces bouchons : « failed to run », 0 test execute.
jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseAssignments: () => ({ data: undefined, isLoading: false }),
}));

jest.mock('@/services/event/eventService', () => ({
  markCoachArrival: jest.fn(),
  markCoachArrivalBulk: jest.fn(),
  resetCoachAttendance: jest.fn(),
  updateCoachLateMinutes: jest.fn(),
}));

// Le bouton « Faire l appel » monte `useNavigation()` : sans conteneur de
// navigation dans le harnais, le vrai module jette et toute la suite tombe.
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  /**
   * Lit une clef pointee dans le VRAI dictionnaire francais.
   * @param {string} chemin - La clef, par exemple `eventDetails.attendanceBadge.arrived`.
   * @returns {any} - La valeur trouvee, ou `undefined`.
   */
  const lire = (chemin) => String(chemin)
    .split('.')
    .reduce(
      (noeud, clef) => (noeud === null || noeud === undefined ? undefined : noeud[clef]),
      traductions,
    );
  return {
    initReactI18next: { init: jest.fn(), type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ clef, /** @type {any} */ valeurParDefaut) => {
        const valeur = lire(clef);
        if (typeof valeur === 'string') return valeur;
        return typeof valeurParDefaut === 'string' ? valeurParDefaut : clef;
      },
    }),
  };
});

// Le theme est monte avec les VRAIS modules : un Proxy rendrait les echecs jest
// illisibles (piege paye au lot paywall).
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

const NOW_MS = Date.parse('2026-08-20T18:00:00.000Z');
const DEBUT_MS = NOW_MS - (12 * 60000);
const MINUTE_MS = 60000;

/**
 * Fabrique un joueur minimal.
 * @param {string} id - Son `documentId`.
 * @param {string} prenom - Son prenom.
 * @returns {object} - Le joueur.
 */
const joueur = (id, prenom) => ({
  documentId: id, firstname: prenom, id, lastname: 'Test',
});

const P_ARRIVE = joueur('p-arrive', 'Alex');
const P_RETARD = joueur('p-retard', 'Ana');
const P_ABSENT = joueur('p-absent', 'Bilal');
const P_SANS_REPONSE = joueur('p-sansreponse', 'Sami');

// 🧑‍💼 LE POINTAGE QU ADEL AVAIT SOUS LES YEUX : corrige a la main par un
// membre du staff, avec une note. C est LUI qui faisait pousser les deux
// derniers etages de la rangee.
const POINTAGE_CORRIGE_PAR_LE_STAFF = {
  arrivedAt: new Date(DEBUT_MS).toISOString(),
  manualOverride: true,
  note: 'Il avait prevenu qu il arriverait plus tot.',
  updatedBy: { firstname: 'Philippe', lastname: 'Courtoi' },
};

const PROPS_BASE = {
  attendanceByUserId: {},
  canApprovePendingRequests: true,
  canEdit: true,
  event: { documentId: 'evt-1' },
  eventStartAt: null,
  externalParticipationSection: null,
  handleExportParticipants: jest.fn(),
  handleRemindPlayers: jest.fn(),
  handleShare: jest.fn(),
  handleUpdateParticipation: jest.fn(),
  handleUserPress: jest.fn(),
  nowMs: NOW_MS,
  onCoachEditLate: jest.fn(),
  onCoachMarkArrival: jest.fn(),
  participantsSummary: undefined,
  participationsByStatus: undefined,
  pendingParticipations: [],
  teamParticipationSections: [],
};

/**
 * Monte le VRAI composant, avec le fournisseur qu exige `useIsMutating`.
 * @param {object} [surcharges] - Les props a remplacer.
 * @returns {any} - L arbre rendu.
 */
const monter = (surcharges = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        {/* eslint-disable-next-line react/jsx-props-no-spreading -- l ecran a 19 props */}
        <EventParticipants {...PROPS_BASE} {...surcharges} />
      </QueryClientProvider>,
    );
  });
  return arbre;
};

/**
 * Rend une section d equipe complete, prete a etre surchargee.
 * @param {object} [surcharges] - Les champs a remplacer.
 * @returns {object} - La section.
 */
const section = (surcharges = {}) => ({
  key: 'eq-1',
  missing: [],
  notAnswered: [],
  participating: [],
  teamName: 'U15 Feminines',
  ...surcharges,
});

/**
 * Ramasse le texte porte par un noeud et ses enfants.
 * @param {any} noeud - Le noeud de depart.
 * @returns {string} - Le texte, espaces normalises.
 */
const texteDe = (noeud) => {
  /** @type {string[]} */
  const morceaux = [];
  /**
   * Descend un noeud et empile ce qu il porte.
   * @param {any} enfant - Le noeud courant.
   * @returns {void} - Rien.
   */
  const descendre = (enfant) => {
    if (enfant === null || enfant === undefined || enfant === false) return;
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      morceaux.push(String(enfant));
      return;
    }
    const enfants = enfant?.props?.children;
    if (Array.isArray(enfants)) enfants.forEach(descendre);
    else descendre(enfants);
  };
  descendre(noeud);
  return morceaux.join(' ').replace(/\s+/g, ' ').trim();
};

/**
 * Tous les textes rendus, dans l ordre de l arbre.
 * @param {any} arbre - L arbre rendu.
 * @returns {string[]} - Les textes non vides.
 */
const textesVisibles = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => texteDe(noeud))
  .filter(Boolean);

describe('COMPACT · temoin 1 — le bloc « staff » ne pousse plus la rangee', () => {
  test('« Correction manuelle staff », « Corrigé par X » et la note ont disparu', () => {
    const arbre = monter({
      attendanceByUserId: { 'p-arrive': POINTAGE_CORRIGE_PAR_LE_STAFF },
      eventStartAt: new Date(DEBUT_MS),
      teamParticipationSections: [section({ participating: [P_ARRIVE] })],
    });

    const tout = textesVisibles(arbre).join(' | ');

    // Les trois textes que la capture d Adel montrait sous la pastille.
    expect(tout).not.toContain('Correction manuelle staff');
    expect(tout).not.toContain('Corrige par');
    expect(tout).not.toContain('Corrigé par');
    expect(tout).not.toContain('Philippe');
    expect(tout).not.toContain('Courtoi');
    expect(tout).not.toContain('Il avait prevenu');

    // 🧷 ET LE RESTE DE LA RANGEE N A PAS BOUGE : le joueur, sa pastille et son
    // heure d arrivee sont toujours la. Sans ce controle, un composant qui ne
    // rendrait plus RIEN passerait les six attentes ci-dessus.
    expect(tout).toContain('Alex');
    expect(tout).toContain('Arrivé');
  });

  test('un pointage corrige rend EXACTEMENT les memes textes qu un pointage ordinaire', () => {
    // 📏 LA MESURE QUI TIENT LA PROMESSE : ce n est pas « les mots ont disparu »
    // qui compte, c est que la rangee ne GRANDIT plus quand le staff est passe
    // par la. Deux montages identiques a l attendance pres.
    const ordinaire = monter({
      attendanceByUserId: { 'p-arrive': { arrivedAt: new Date(DEBUT_MS).toISOString() } },
      eventStartAt: new Date(DEBUT_MS),
      teamParticipationSections: [section({ participating: [P_ARRIVE] })],
    });
    const corrige = monter({
      attendanceByUserId: { 'p-arrive': POINTAGE_CORRIGE_PAR_LE_STAFF },
      eventStartAt: new Date(DEBUT_MS),
      teamParticipationSections: [section({ participating: [P_ARRIVE] })],
    });

    expect(textesVisibles(corrige)).toEqual(textesVisibles(ordinaire));
  });
});

// 📏 LE MODELE DE HAUTEUR — POURQUOI IL EST CALCULE, ET PAS MESURE.
// `react-test-renderer` ne fait AUCUNE mise en page : il n y a pas un pixel a
// lire dans l arbre. Ce filet calcule donc la hauteur comme Yoga la calculerait,
// a partir des SEULES choses que l arbre expose vraiment : les etages empiles
// dans la rangee, et la hauteur intrinseque de chacun des elements de la ligne.
// C est ce qui rend D5 verifiable : « une rangee = la hauteur de l avatar plus
// ses marges, quel que soit l etat du joueur ».
// ⚠️ Ce que ce modele NE prouve PAS : le rendu au pixel sur un vrai telephone.
// La LARGEUR, elle, depend de l ecran — c est le temoin 2 qui la tient, en
// figeant l ORDRE dans lequel les informations cedent la place.
const PADDING_RANGEE = 16;
const TAILLE_AVATAR = 40;

/**
 * L heure locale courte, exactement comme `formatArrivalTime` la rend.
 * Le temoin ne depend ainsi d aucun fuseau.
 * @param {number} ms - L instant.
 * @returns {string} - L heure au format HH:MM.
 */
const heureLocale = (ms) => {
  const date = new Date(ms);
  const heures = String(date.getHours()).padStart(2, '0');
  return `${heures}:${String(date.getMinutes()).padStart(2, '0')}`;
};

/**
 * Aplatit un style RN, qu il soit un objet ou un tableau imbrique.
 * @param {any} style - Le style a plat ou en tableau.
 * @returns {any[]} - Les objets de style, sans les trous.
 */
const aplatir = (style) => (Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean);

/**
 * La valeur RETENUE pour une propriete de style : la derniere gagne, comme RN.
 * @param {any[]} styles - Les objets de style aplatis.
 * @param {string} propriete - Le nom de la propriete.
 * @returns {number} - La valeur, ou 0 si personne ne la porte.
 */
const valeurDeStyle = (styles, propriete) => styles
  .filter((/** @type {any} */ s) => typeof s[propriete] === 'number')
  .map((/** @type {any} */ s) => s[propriete])
  .pop() || 0;

/**
 * La derniere valeur TEXTE retenue pour une propriete de style.
 * @param {any[]} styles - Les objets de style aplatis.
 * @param {string} propriete - Le nom de la propriete.
 * @returns {string} - La valeur, ou '' si personne ne la porte.
 */
const texteDeStyle = (styles, propriete) => styles
  .map((/** @type {any} */ s) => s[propriete])
  .filter(Boolean)
  .pop() || '';

/**
 * Le premier noeud portant ce `testID`.
 * @param {any} racine - L arbre ou le noeud de depart.
 * @param {string} identifiant - Le `testID` cherche.
 * @returns {any} - Le noeud.
 */
const parIdentifiant = (racine, identifiant) => {
  // L arbre rendu expose `.root` ; un noeud deja trouve cherche depuis lui-meme.
  const depart = racine.root || racine;
  const trouves = depart.findAllByProps({ testID: identifiant });
  if (trouves.length === 0) throw new Error(`aucun noeud « ${identifiant} »`);
  return trouves[0];
};

/**
 * Les etages VRAIMENT empiles dans un bloc.
 *
 * 🪤 On lit `props.children`, PAS `noeud.children` : un meme `testID` est porte
 * a la fois par le composant et par le noeud hote qu il rend, et le premier n a
 * alors qu UN enfant — le second. Compter la, c est se garantir un « 1 etage »
 * toujours vert, y compris sur le code d avant le lot.
 * @param {any} noeud - Le bloc.
 * @returns {any[]} - Ses etages, sans les branches eteintes.
 */
const etagesDe = (noeud) => [noeud.props.children]
  .flat(Infinity)
  .filter((/** @type {any} */ enfant) => enfant !== null
    && enfant !== undefined
    && enfant !== false
    && enfant !== '');

/**
 * Mesure une rangee de participant : combien d etages elle empile, et la
 * hauteur qu elle occupe.
 * @param {any} arbre - L arbre rendu.
 * @param {string} documentId - Le `documentId` du joueur.
 * @returns {{etages: number, hauteur: number}} - La mesure.
 */
const mesurerLaRangee = (arbre, documentId) => {
  const rangee = parIdentifiant(arbre, `COMPACT-rangee-${documentId}`);
  const padding = valeurDeStyle(aplatir(rangee.props.style), 'padding');

  // La hauteur de la ligne : le plus grand de ses elements.
  /** @type {number[]} */
  const hauteurs = rangee.findAllByType(ProfileAvatar)
    .map((/** @type {any} */ noeud) => Number(noeud.props.size) || 0);

  rangee.findAllByType(Button).forEach((/** @type {any} */ noeud) => {
    const styles = aplatir(noeud.findAllByType(TouchableOpacity)[0].props.style);
    hauteurs.push(valeurDeStyle(styles, 'height'));
  });

  const pastille = parIdentifiant(rangee, `COMPACT-pastille-${documentId}`);
  const stylePastille = aplatir(pastille.props.style);
  const lignesDeTexte = pastille.findAllByType(Text)
    .map((/** @type {any} */ noeud) => valeurDeStyle(aplatir(noeud.props.style), 'lineHeight'));
  hauteurs.push(
    (valeurDeStyle(stylePastille, 'paddingVertical') * 2)
    + (valeurDeStyle(stylePastille, 'borderWidth') * 2)
    + Math.max(...lignesDeTexte),
  );

  return { etages: etagesDe(rangee).length, hauteur: (padding * 2) + Math.max(...hauteurs) };
};

/**
 * Les textes d une pastille, avec ce qui commande leur retrecissement.
 * @param {any} arbre - L arbre rendu.
 * @param {string} documentId - Le `documentId` du joueur.
 * @returns {any[]} - Une entree par texte.
 */
const morceauxDePastille = (arbre, documentId) => parIdentifiant(
  arbre,
  `COMPACT-pastille-${documentId}`,
)
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => ({
    lignes: noeud.props.numberOfLines,
    reduitLaPolice: Boolean(noeud.props.adjustsFontSizeToFit),
    retrecit: valeurDeStyle(aplatir(noeud.props.style), 'flexShrink'),
    texte: texteDe(noeud),
  }));

describe('COMPACT · temoin 2 — la pastille tient sur UNE ligne', () => {
  test('les 3 informations se composent horizontalement, une seule ligne chacune', () => {
    const arbre = monter({
      attendanceByUserId: {
        'p-arrive': {
          arrivedAt: new Date(DEBUT_MS + (7 * MINUTE_MS)).toISOString(),
          lateMinutes: 7,
        },
      },
      eventStartAt: new Date(DEBUT_MS),
      teamParticipationSections: [section({ participating: [P_ARRIVE] })],
    });

    const style = aplatir(parIdentifiant(arbre, 'COMPACT-pastille-p-arrive').props.style);

    // C est une LIGNE, plus une colonne : c est tout le lot.
    expect(texteDeStyle(style, 'flexDirection')).toBe('row');
    expect(texteDeStyle(style, 'alignItems')).toBe('center');

    const morceaux = morceauxDePastille(arbre, 'p-arrive');
    expect(morceaux.map((/** @type {any} */ m) => m.texte)).toEqual([
      'Arrivé', '7 min de retard', heureLocale(DEBUT_MS + (7 * MINUTE_MS)),
    ]);
    // Aucune des trois ne s autorise un retour a la ligne.
    expect(morceaux.map((/** @type {any} */ m) => m.lignes)).toEqual([1, 1, 1]);
  });

  test('quand la place manque, l heure cede AVANT l ecart, et l etat ne cede jamais', () => {
    const arbre = monter({
      attendanceByUserId: {
        'p-arrive': {
          arrivedAt: new Date(DEBUT_MS + (7 * MINUTE_MS)).toISOString(),
          lateMinutes: 7,
        },
      },
      eventStartAt: new Date(DEBUT_MS),
      teamParticipationSections: [section({ participating: [P_ARRIVE] })],
    });

    const [etat, ecart, heure] = morceauxDePastille(arbre, 'p-arrive');

    // 🛡️ L ETAT NE SE COMPRIME PAS. `flexShrink: 0` est la seule chose qui le
    // garantisse : sans elle, « Arrivé » finirait en « Arr… » sur un petit
    // ecran, et la pastille ne dirait plus rien du tout.
    expect(etat.retrecit).toBe(0);

    // Et l ordre dans lequel les deux autres cedent : l heure d abord.
    expect(heure.retrecit).toBeGreaterThan(ecart.retrecit);
    expect(ecart.retrecit).toBeGreaterThan(etat.retrecit);

    // Le motif de retrecissement du depot, sur les deux qui ont le droit de
    // maigrir — jamais sur l etat.
    expect(ecart.reduitLaPolice).toBe(true);
    expect(heure.reduitLaPolice).toBe(true);
    expect(etat.reduitLaPolice).toBe(false);
  });
});

describe('COMPACT · temoin 3 — la hauteur de l avatar, dans TOUS les etats', () => {
  test('un etage, et 40 + 2 x 16 = 72, quel que soit l etat du joueur', () => {
    const arbre = monter({
      attendanceByUserId: {
        'p-arrive': { arrivedAt: new Date(DEBUT_MS).toISOString() },
        'p-retard': {
          arrivedAt: new Date(DEBUT_MS + (7 * MINUTE_MS)).toISOString(),
          lateMinutes: 7,
        },
      },
      eventStartAt: new Date(DEBUT_MS),
      teamParticipationSections: [section({
        missing: [P_ABSENT],
        notAnswered: [P_SANS_REPONSE],
        participating: [P_ARRIVE, P_RETARD],
      })],
    });

    const attendu = { etages: 1, hauteur: TAILLE_AVATAR + (PADDING_RANGEE * 2) };

    // 🎯 D5 : quatre joueurs, quatre etats differents (arrive a l heure, arrive
    // en retard, absent, sans reponse) — UNE SEULE hauteur. Avant COMPACT, le
    // premier faisait presque trois fois la taille du dernier.
    expect(mesurerLaRangee(arbre, 'p-arrive')).toEqual(attendu);
    expect(mesurerLaRangee(arbre, 'p-retard')).toEqual(attendu);
    expect(mesurerLaRangee(arbre, 'p-absent')).toEqual(attendu);
    expect(mesurerLaRangee(arbre, 'p-sansreponse')).toEqual(attendu);
  });

  test('meme un pointage corrige par le staff ne fait pas grandir la rangee', () => {
    const arbre = monter({
      attendanceByUserId: { 'p-arrive': POINTAGE_CORRIGE_PAR_LE_STAFF },
      eventStartAt: new Date(DEBUT_MS),
      teamParticipationSections: [section({ participating: [P_ARRIVE] })],
    });

    expect(mesurerLaRangee(arbre, 'p-arrive')).toEqual({
      etages: 1,
      hauteur: TAILLE_AVATAR + (PADDING_RANGEE * 2),
    });
  });
});

describe('COMPACT · temoin 4 — « Modifier » vit DANS la ligne, et reste attrapable', () => {
  test('il ne s offre plus un etage a lui, et sa cible fait au moins 44 px', () => {
    const arbre = monter({
      attendanceByUserId: { 'p-arrive': { arrivedAt: new Date(DEBUT_MS).toISOString() } },
      eventStartAt: new Date(DEBUT_MS),
      teamParticipationSections: [section({ participating: [P_ARRIVE] })],
    });

    const rangee = parIdentifiant(arbre, 'COMPACT-rangee-p-arrive');
    const boutons = rangee.findAllByType(Button)
      .filter((/** @type {any} */ noeud) => noeud.props.title === 'Modifier');
    expect(boutons.length).toBe(1);

    // 1. Il est DANS la ligne : la rangee n a toujours qu un seul etage.
    expect(mesurerLaRangee(arbre, 'p-arrive').etages).toBe(1);

    // 2. ♿ ET IL RESTE ATTRAPABLE AU DOIGT. Le rendu VISUEL garde ses 39 px —
    //    c est ce que fige AD06 (temoin 4), et c est ce qui laisse la rangee a
    //    la hauteur de l avatar. C est la ZONE TACTILE qui atteint 44, par
    //    `hitSlop` : le motif du depot, deja porte par 5 composants.
    const { hitSlop } = boutons[0].props;
    const styles = aplatir(boutons[0].findAllByType(TouchableOpacity)[0].props.style);
    const hauteurRendue = valeurDeStyle(styles, 'height');

    expect(hauteurRendue).toBe(39);
    expect(hauteurRendue + hitSlop.top + hitSlop.bottom).toBeGreaterThanOrEqual(44);
    expect(hitSlop.left + hitSlop.right).toBeGreaterThan(0);
  });

  test('sans pointage, pas de bouton — et la rangee garde la meme hauteur', () => {
    const arbre = monter({
      teamParticipationSections: [section({ participating: [P_ARRIVE] })],
    });

    const rangee = parIdentifiant(arbre, 'COMPACT-rangee-p-arrive');
    expect(rangee.findAllByType(Button).length).toBe(0);
    expect(mesurerLaRangee(arbre, 'p-arrive')).toEqual({
      etages: 1,
      hauteur: TAILLE_AVATAR + (PADDING_RANGEE * 2),
    });
  });
});
