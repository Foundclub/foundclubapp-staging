import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';

import EventParticipants from '../components/EventParticipants';

// AD06 (E6) — LE FILET DE `EventParticipants.js` (784 lignes).
//
// 🪢 POURQUOI CE FICHIER EXISTE : la liste des participants est le plus gros
// composant de la fiche evenement, et jusqu ici un SEUL de ses comportements
// etait tenu par un temoin (AC07, le bouton « Relancer » grise). Les 3 lots qui
// suivent (les compteurs, l heure d arrivee, les etats vides) touchent la
// pastille, l entete et les groupes. Sans filet, on modifie a l aveugle.
//
// 🔬 LE HARNAIS EST CELUI D AC07, REUTILISE : meme stub `react-i18next`, meme
// theme monte avec les VRAIS modules (un Proxy rend les echecs jest illisibles,
// piege paye au lot paywall). UNE seule difference, volontaire : ici `t` lit le
// VRAI `fr.js` au lieu de rendre la clef brute — c est ce qui permet au temoin
// 7 de prouver que les libelles accentues existent bien dans le dictionnaire.
//
// 📏 CE QUE CHAQUE TEMOIN TIENT :
//   1. les 8 sorties de la pastille (l audit en annoncait 7)
//   2. les 5 groupes du chemin AVEC equipes, dans l ordre
//   3. le SECOND chemin, sans equipes (3 groupes + demandes en haut)
//   4. les 2 boutons des demandes font bien 44 px
//   5. les 3 tuiles de compteurs, meme a zero          (L3-A)
//   6. « Sans reponse » calcule par soustraction        (L3-A)
//   7. l heure d arrivee, les accents, les etats vides  (L3-B + L6-F)

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  /**
   * Lit une clef pointee dans le VRAI dictionnaire francais.
   * @param {string} chemin - La clef, par exemple `eventDetails.fields.participations`.
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

// Le theme est monte avec les VRAIS modules (cf. AC07). Seul `Images` est stube.
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

const COULEURS = jest.requireActual('@/theme/colors').default();

// 🕐 L heure d arrivee est fabriquee en heure LOCALE puis relue en heure locale :
// le temoin ne depend donc d aucun fuseau. 14:32 reste 14:32 partout.
const ARRIVEE_LOCALE = new Date(2026, 7, 20, 14, 32, 0);
const NOW_MS = Date.parse('2026-08-20T18:00:00.000Z');

// 🏷️ LA TABLE DES LIBELLES DE PASTILLE.
// Elle decrit l ETAT COURANT du code. Le lot L3-B la met a jour en meme temps
// qu il accentue les libelles : c est la seule chose que ce fichier apprend du
// futur, et le diff tient en 5 lignes.
const PASTILLE = {
  absent: 'Absent',
  arrive: 'Arrive',
  attente: 'En attente',
  nonPointe: 'Non pointe',
  retardAnnonce: 'Retard annonce',
  sansReponse: 'Sans réponse',
};
const COULEUR_ABSENT = COULEURS.error500;

/**
 * Fabrique un joueur minimal.
 * @param {string} id - Son `documentId`.
 * @param {string} prenom - Son prenom, pour lire l arbre a l oeil.
 * @returns {object} - Le joueur.
 */
const joueur = (id, prenom) => ({
  documentId: id, firstname: prenom, id, lastname: 'Test',
});

const P_NON_POINTE = joueur('p-nonpointe', 'Noa');
const P_ARRIVE_RETARD = joueur('p-arrive-retard', 'Ana');
const P_ARRIVE = joueur('p-arrive', 'Alex');
const P_RETARD_ANNONCE = joueur('p-retard', 'Remi');
const P_ATTENTE_VIVANTE = joueur('p-attente-vive', 'Lena');
const P_ABSENT = joueur('p-absent', 'Bilal');
const P_SANS_REPONSE = joueur('p-sansreponse', 'Sami');
const P_ATTENTE = joueur('p-attente', 'Theo');

const DEMANDE = {
  documentId: 'demande-1',
  sourceTeam: { documentId: 'eq-2', name: 'U17' },
  user: joueur('p-demande', 'Yanis'),
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
 * Aplatit un style RN, qu il soit un objet ou un tableau imbrique.
 * @param {any} style - Le style a plat ou en tableau.
 * @returns {any[]} - Les objets de style, sans les trous.
 */
const aplatir = (style) => (Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean);

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

/**
 * Lit les pastilles d etat : leur texte et leur couleur.
 * La couture est le style `textAlign: 'center'` + `color`, qui n appartient
 * qu a la pastille dans ce composant.
 * @param {any} arbre - L arbre rendu.
 * @returns {{couleur: string, texte: string}[]} - Une entree par ligne de pastille.
 */
const pastilles = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => ({
    centre: aplatir(noeud.props.style)
      .find((/** @type {any} */ s) => s && s.textAlign === 'center'),
    noeud,
  }))
  .filter((/** @type {any} */ entree) => Boolean(entree.centre && entree.centre.color))
  .map((/** @type {any} */ entree) => ({
    couleur: entree.centre.color,
    texte: texteDe(entree.noeud),
  }));

/**
 * Lit le texte d un noeud repere par son `testID`.
 * @param {any} arbre - L arbre rendu.
 * @param {string} identifiant - Le `testID` cherche.
 * @returns {string} - Le texte porte par ce noeud.
 */
const parIdentifiant = (arbre, identifiant) => {
  const trouves = arbre.root.findAllByProps({ testID: identifiant });
  return trouves.length > 0 ? texteDe(trouves[0]) : '';
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

describe('AD06 · temoin 1 — les 8 sorties de la pastille', () => {
  test('les 7 sorties qui vivent avec un evenement commence', () => {
    const arbre = monter({
      attendanceByUserId: {
        'p-arrive': { arrivedAt: ARRIVEE_LOCALE.toISOString() },
        'p-arrive-retard': { arrivedAt: ARRIVEE_LOCALE.toISOString(), lateMinutes: 7 },
        'p-nonpointe': { attendanceStatus: 'no_show' },
        'p-retard': { attendanceStatus: 'declared_late', declaredLateMinutes: 5 },
      },
      eventStartAt: new Date(NOW_MS - (12 * 60000)),
      teamParticipationSections: [section({
        missing: [P_ABSENT],
        notAnswered: [P_SANS_REPONSE],
        participating: [
          P_NON_POINTE, P_ARRIVE_RETARD, P_ARRIVE, P_RETARD_ANNONCE, P_ATTENTE_VIVANTE,
        ],
      })],
    });

    expect(pastilles(arbre)).toEqual([
      // 1. `no_show` gagne sur tout le reste.
      { couleur: COULEURS.error500, texte: PASTILLE.nonPointe },
      // 4. arrive EN RETARD : le retard reel s affiche sous le titre.
      { couleur: COULEURS.warning500, texte: PASTILLE.arrive },
      { couleur: COULEURS.warning500, texte: '+7 min' },
      // 5. arrive a l heure.
      { couleur: COULEURS.success500, texte: PASTILLE.arrive },
      // 6. retard ANNONCE a l avance.
      { couleur: COULEURS.warning500, texte: PASTILLE.retardAnnonce },
      { couleur: COULEURS.warning500, texte: '+5 min' },
      // 7. retard VIVANT, calcule depuis le coup d envoi.
      { couleur: COULEURS.warning500, texte: PASTILLE.attente },
      { couleur: COULEURS.warning500, texte: '+12 min' },
      // 2. absent declare.
      { couleur: COULEUR_ABSENT, texte: PASTILLE.absent },
      // 3. sans reponse.
      { couleur: COULEURS.neutral200, texte: PASTILLE.sansReponse },
    ]);
  });

  test('la 8e sortie : rien du tout, avant le coup d envoi', () => {
    const arbre = monter({
      teamParticipationSections: [section({ participating: [P_ATTENTE] })],
    });

    expect(pastilles(arbre)).toEqual([
      { couleur: COULEURS.neutral200, texte: PASTILLE.attente },
    ]);
  });
});

describe('AD06 · temoin 2 — les 5 groupes et leur ordre', () => {
  test('demandes, presents, absents, sans reponse, historique', () => {
    const arbre = monter({
      teamParticipationSections: [section({
        historical: { missing: [joueur('h-2', 'Hugo')], participating: [joueur('h-1', 'Hana')] },
        missing: [P_ABSENT],
        notAnswered: [P_SANS_REPONSE],
        participating: [P_ARRIVE],
        pending: [DEMANDE],
      })],
    });

    const textes = textesVisibles(arbre);
    const rang = (/** @type {string} */ libelle) => textes.indexOf(libelle);

    expect(rang('Demandes de participation')).toBeGreaterThanOrEqual(0);
    expect(rang('Demandes de participation')).toBeLessThan(rang('Présent·e·s'));
    expect(rang('Présent·e·s')).toBeLessThan(rang('Absent·e·s'));
    expect(rang('Absent·e·s')).toBeLessThan(rang('Sans réponse'));
    expect(rang('Sans réponse')).toBeLessThan(rang('Historique équipe retirée'));
    expect(textes).toContain('U15 Feminines');
  });
});

describe('AD06 · temoin 3 — le second chemin, celui sans equipes', () => {
  test('3 groupes, et les demandes rendues au niveau du haut', () => {
    const arbre = monter({
      participationsByStatus: {
        missing: [P_ABSENT],
        notAnswered: [P_SANS_REPONSE],
        participating: [P_ARRIVE],
      },
      pendingParticipations: [DEMANDE],
      teamParticipationSections: [],
    });

    const textes = textesVisibles(arbre);
    const rang = (/** @type {string} */ libelle) => textes.indexOf(libelle);

    expect(rang('Demandes de participation')).toBeGreaterThanOrEqual(0);
    expect(rang('Demandes de participation')).toBeLessThan(rang('Présent·e·s'));
    expect(rang('Présent·e·s')).toBeLessThan(rang('Absent·e·s'));
    expect(rang('Absent·e·s')).toBeLessThan(rang('Sans réponse'));
    // Ce chemin ne connait PAS l historique, ni les noms d equipe.
    expect(textes).not.toContain('Historique équipe retirée');
    expect(textes).not.toContain('U15 Feminines');
  });
});

describe('AD06 · temoin 4 — les deux boutons des demandes font 44', () => {
  test('ils portent `isOption`, jamais `size=sm`, et mesurent 44 px', () => {
    const arbre = monter({ pendingParticipations: [DEMANDE] });

    const boutons = arbre.root
      .findAllByType(Button)
      .filter((/** @type {any} */ noeud) => ['check', 'close'].includes(noeud.props.icon));

    expect(boutons.map((/** @type {any} */ noeud) => noeud.props.icon)).toEqual(['check', 'close']);
    boutons.forEach((/** @type {any} */ noeud) => {
      expect(noeud.props.isOption).toBe(true);
      expect(noeud.props.size).toBeUndefined();
      // La mesure, pas la promesse : `buttonIconOption` vaut 44 (buttonStyle.js:43-47).
      const hauteurs = aplatir(noeud.findAllByType(TouchableOpacity)[0].props.style)
        .filter((/** @type {any} */ s) => typeof s.height === 'number')
        .map((/** @type {any} */ s) => s.height);
      expect(hauteurs[hauteurs.length - 1]).toBe(44);
    });
  });
});

describe('AD06 · temoin 5 — trois tuiles, meme a zero', () => {
  test('0 present, 0 absent, 3 sans reponse : les 3 tuiles et la barre sont la', () => {
    const arbre = monter({
      participantsSummary: { capacity: 0, participatingCount: 0 },
      teamParticipationSections: [section({
        notAnswered: [P_SANS_REPONSE, P_ATTENTE, P_ABSENT],
      })],
    });

    expect(parIdentifiant(arbre, 'AD06-tuile-participating')).toContain('0');
    expect(parIdentifiant(arbre, 'AD06-tuile-participating')).toContain('Présent·e·s');
    expect(parIdentifiant(arbre, 'AD06-tuile-missing')).toContain('0');
    expect(parIdentifiant(arbre, 'AD06-tuile-missing')).toContain('Absent·e·s');
    expect(parIdentifiant(arbre, 'AD06-tuile-notAnswered')).toContain('3');
    expect(parIdentifiant(arbre, 'AD06-tuile-notAnswered')).toContain('Sans réponse');

    // La barre EXISTE a zero reponse — c est precisement ce que `Stepper.js`
    // ne sait pas faire (il rend `null` des que `filled` vaut 0).
    expect(arbre.root.findAllByProps({ testID: 'AD06-barre-reponses' }).length)
      .toBeGreaterThan(0);

    // Et l ancien entete « Participants :  0 » a disparu.
    expect(textesVisibles(arbre).filter((/** @type {string} */ t) => /^Participants\s*:/.test(t)))
      .toEqual([]);
  });
});

describe('AD06 · temoin 6 — sans reponse par soustraction', () => {
  test('4 presents + 2 absents + 3 sans reponse : la tuile dit 3', () => {
    const arbre = monter({
      teamParticipationSections: [section({
        missing: [joueur('m-1', 'Mia'), joueur('m-2', 'Malo')],
        notAnswered: [joueur('n-1', 'Nina'), joueur('n-2', 'Noe'), joueur('n-3', 'Nour')],
        participating: [
          joueur('p-1', 'Paul'), joueur('p-2', 'Pia'), joueur('p-3', 'Pol'), joueur('p-4', 'Pam'),
        ],
      })],
    });

    expect(parIdentifiant(arbre, 'AD06-tuile-participating')).toContain('4');
    expect(parIdentifiant(arbre, 'AD06-tuile-missing')).toContain('2');
    expect(parIdentifiant(arbre, 'AD06-tuile-notAnswered')).toContain('3');
    // 4 presents + 2 absents = 6 reponses recues, sur 9 attendues.
    expect(parIdentifiant(arbre, 'AD06-barre-legende')).toContain('6');
    expect(parIdentifiant(arbre, 'AD06-barre-legende')).toContain('9');
  });

  test('jamais un nombre negatif quand le resume du serveur ment', () => {
    const arbre = monter({
      participantsSummary: { capacity: 0, participatingCount: 99 },
      teamParticipationSections: [section({ participating: [P_ARRIVE] })],
    });

    const texte = parIdentifiant(arbre, 'AD06-tuile-notAnswered');
    expect(texte).not.toMatch(/-\d/);
    expect(texte).toContain('0');
  });
});

describe('AD06 · temoin 7 — l heure d arrivee et les accents', () => {
  test('l heure s affiche, la pastille est accentuee, les groupes vides parlent', () => {
    const arbre = monter({
      attendanceByUserId: { 'p-arrive': { arrivedAt: ARRIVEE_LOCALE.toISOString() } },
      teamParticipationSections: [section({ participating: [P_ARRIVE] })],
    });

    const textes = textesVisibles(arbre);

    // 1. L heure d arrivee ne part plus a la poubelle.
    expect(textes).toContain('14:32');

    // 2. Le libelle est accentue, et il vient du dictionnaire.
    expect(pastilles(arbre).map((/** @type {any} */ p) => p.texte)).toContain('Arrivé');

    // 3. Un groupe vide garde son TITRE et dit POURQUOI il est vide.
    expect(textes).toContain('Absent·e·s');
    expect(textes).toContain('Aucune absence signalée.');
    expect(textes).toContain('Sans réponse');
    expect(textes).toContain('Tout le monde a répondu.');
  });

  test('un groupe present vide dit qu il attend des confirmations', () => {
    const arbre = monter({
      teamParticipationSections: [section({ notAnswered: [P_SANS_REPONSE] })],
    });

    const textes = textesVisibles(arbre);
    expect(textes).toContain('Présent·e·s');
    expect(textes).toContain('Personne n\'a encore confirmé sa présence.');
  });

  test('une heure d arrivee illisible ne rend RIEN, jamais du texte casse', () => {
    const arbre = monter({
      attendanceByUserId: { 'p-arrive': { arrivedAt: 'pas-une-date' } },
      teamParticipationSections: [section({ participating: [P_ARRIVE] })],
    });

    expect(textesVisibles(arbre).join(' | ')).not.toMatch(/Invalid Date|NaN/);
  });
});
