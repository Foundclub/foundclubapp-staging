import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventParticipants from '../components/EventParticipants';

// P7 (E6) — LE FILET DU REGROUPEMENT PAR POSTE, cote COMPOSANT.
//
// 🪢 POURQUOI CE FICHIER EN PLUS DE `EventDetailsP7Detection.test.js` : celui-la
// prouve que l'ECRAN CALCULE les bons groupes ; celui-ci prouve que le
// COMPOSANT les REND, avec les deux titres que la regle 5 du pack exige. Un
// calcul juste qui n'arrive pas a l'ecran ne sert a rien, et l'inverse non plus.
//
// 🔬 LE HARNAIS EST CELUI D'AD06 ET DE P2, RECOPIE : vrai `fr.js` lu par `t`
// (les libelles attendus ci-dessous sont donc les VRAIES clefs, pas des replis),
// vrai theme monte avec les VRAIS modules. ⛔ JAMAIS un Proxy de theme : il rend
// les echecs jest illisibles (piege paye au lot paywall).
//
// 🧨 LE MOCK DE `licenseQueries` EST UNE CONDITION DE DEMARRAGE : le vrai module
// descend jusqu'a `client.native.js`, qui jette AU CHARGEMENT quand `.env` est
// absent — et `.env` est gitignore, donc absent de toute copie de travail.

const mockAffectations = { valeur: { data: undefined, isLoading: false } };

jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseAssignments: () => mockAffectations.valeur,
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  /**
   * Lit une clef pointee dans le VRAI dictionnaire francais.
   * @param {string} chemin - La clef, par exemple `eventDetails.detection.groupPending`.
   * @returns {any} - La valeur trouvee, ou `undefined`.
   */
  const lire = (chemin) => String(chemin)
    .split('.')
    .reduce(
      (noeud, clef) => (noeud === null || noeud === undefined ? undefined : noeud[clef]),
      traductions,
    );
  /**
   * Remplace les {{jetons}} d'un modele.
   * @param {string} modele - Le modele a remplir.
   * @param {any} options - Les valeurs.
   * @returns {string} - Le texte final.
   */
  const rendre = (modele, options) => String(modele).replace(
    /\{\{(\w+)\}\}/g,
    (_tout, nom) => (options && nom in options ? String(options[nom]) : `{{${nom}}}`),
  );
  return {
    initReactI18next: { init: jest.fn(), type: '3rdParty' },
    useTranslation: () => ({
      t: (
        /** @type {string} */ clef,
        /** @type {any} */ valeurParDefaut,
        /** @type {any} */ options,
      ) => {
        const valeur = lire(clef);
        const modele = typeof valeur === 'string' ? valeur : valeurParDefaut;
        const reglages = typeof valeurParDefaut === 'string' ? options : valeurParDefaut;
        if (typeof modele !== 'string') return clef;
        return rendre(modele, reglages);
      },
    }),
  };
});

// Le theme est monte avec les VRAIS modules (cf. AD06 et P2).
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

/**
 * Fabrique un joueur minimal.
 * @param {string} id - Son `documentId`.
 * @param {string} prenom - Son prenom, pour lire l arbre a l oeil.
 * @returns {object} - Le joueur.
 */
const joueur = (id, prenom) => ({
  documentId: id, firstname: prenom, id, lastname: 'Test',
});

const RETENU = joueur('u-retenu', 'Alix');
const CANDIDAT = joueur('u-candidat', 'Bahia');
const LIBRE = joueur('u-libre', 'Chris');

/**
 * Fabrique une demande de participation.
 * @param {string} id - Son `documentId`.
 * @param {object} user - La personne qui demande.
 * @returns {object} - La demande.
 */
const demande = (id, user) => ({ documentId: id, participationStatus: 'pending', user });

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

const POSTE_GARDIEN = {
  acceptedCount: 1,
  isComplete: false,
  key: 'ad-gardien',
  participating: [RETENU],
  pending: [demande('part-gardien', CANDIDAT)],
  position: 'Gardien',
  quantity: 2,
};

const POSTE_SANS_NOM = {
  acceptedCount: 1,
  isComplete: false,
  key: 'p7-sans-poste',
  participating: [LIBRE],
  pending: [],
  position: '',
  quantity: 0,
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
        {/* eslint-disable-next-line react/jsx-props-no-spreading -- l ecran a 21 props */}
        <EventParticipants {...PROPS_BASE} {...surcharges} />
      </QueryClientProvider>,
    );
  });
  return arbre;
};

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
 * Rend tout le texte visible de l arbre, en une seule chaine.
 * 🪤 L arbre rendu par `toJSON()` porte ses enfants dans `children`, PAS dans
 * `props.children` — `texteDe` ci-dessus lit des noeuds d instance de test, ce
 * qui n est pas la meme forme. Lire la mauvaise forme rend une chaine VIDE, et
 * un `not.toContain` serait alors vert sur n importe quoi.
 * @param {any} arbre - L arbre rendu.
 * @returns {string} - Le texte.
 */
const texteVisible = (arbre) => {
  /** @type {string[]} */
  const morceaux = [];
  /**
   * Descend un noeud JSON et empile ce qu il porte.
   * @param {any} noeud - Le noeud courant.
   * @returns {void} - Rien.
   */
  const descendre = (noeud) => {
    if (noeud === null || noeud === undefined || noeud === false) return;
    if (typeof noeud === 'string' || typeof noeud === 'number') {
      morceaux.push(String(noeud));
      return;
    }
    if (Array.isArray(noeud)) {
      noeud.forEach(descendre);
      return;
    }
    descendre(noeud.children);
  };
  descendre(arbre.toJSON());
  return morceaux.join(' ').replace(/\s+/g, ' ').trim();
};

/**
 * Compte les occurrences d un extrait dans le texte rendu.
 * @param {any} arbre - L arbre rendu.
 * @param {string} extrait - Ce qu on cherche.
 * @returns {number} - Le nombre d occurrences.
 */
const compter = (arbre, extrait) => texteVisible(arbre).split(extrait).length - 1;

describe('P7 - le regroupement par poste, rendu par EventParticipants', () => {
  test('P7 · temoin 1 — un poste porte son nom et SES DEUX groupes nommes', () => {
    const arbre = monter({
      detectionPositionSections: [POSTE_GARDIEN],
      pendingParticipations: [demande('part-gardien', CANDIDAT)],
    });

    const texte = texteVisible(arbre);

    // Le titre du poste, puis les deux intitules EXACTS de la regle 5.
    expect(texte).toContain('Gardien');
    expect(texte).toContain('Demandes à traiter');
    expect(texte).toContain('Participants retenus');
    // Et les gens sont bien dans le bloc, pas seulement les titres.
    expect(texte).toContain('Alix');
    expect(texte).toContain('Bahia');
    // Le compteur de places du poste.
    expect(texte).toContain('1/2 retenu·e·s');
  });

  test('P7 · temoin 2 — le groupe de repli s annonce « Sans poste précisé »', () => {
    const arbre = monter({ detectionPositionSections: [POSTE_SANS_NOM] });

    const texte = texteVisible(arbre);

    expect(texte).toContain('Sans poste précisé');
    expect(texte).toContain('Chris');
    // Un groupe de repli n'a pas de nombre de places a annoncer.
    expect(texte).not.toContain('/0 retenu·e·s');
  });

  test('P7 · temoin 3 — les demandes ne sont PAS rendues DEUX fois', () => {
    // 🧨 Le defaut que ce temoin empeche : le bloc « Demandes de participation »
    // en tete de page rendait deja `pendingParticipations`. En mode par poste,
    // les memes demandes vivent DANS leur poste — les laisser aux deux endroits
    // ferait apparaitre chaque candidat en double.
    const arbre = monter({
      detectionPositionSections: [POSTE_GARDIEN],
      pendingParticipations: [demande('part-gardien', CANDIDAT)],
    });

    expect(compter(arbre, 'Bahia')).toBe(1);
  });

  test('P7 · temoin 4 — un poste qui n a encore retenu personne le DIT', () => {
    // Regle 5 : aucun bloc muet. Un poste vide garde son titre et explique.
    const arbre = monter({
      detectionPositionSections: [{ ...POSTE_GARDIEN, acceptedCount: 0, participating: [] }],
      pendingParticipations: [demande('part-gardien', CANDIDAT)],
    });

    const texte = texteVisible(arbre);

    expect(texte).toContain('Participants retenus');
    expect(texte).toContain('Personne n’est encore retenu·e sur ce poste.');
  });

  test('P7 · temoin 6 — appuyer sur une DEMANDE ouvre la fiche, pas le profil', () => {
    const ouvrirLaFiche = jest.fn();
    const ouvrirLeProfil = jest.fn();
    const arbre = monter({
      detectionPositionSections: [POSTE_GARDIEN],
      handleUserPress: ouvrirLeProfil,
      onCandidatePress: ouvrirLaFiche,
      pendingParticipations: [demande('part-gardien', CANDIDAT)],
    });

    // La carte de demande est le `TouchableOpacity` qui porte le nom.
    const carte = arbre.root.findAll(
      (/** @type {any} */ noeud) => noeud.type === TouchableOpacity
        && texteDe(noeud).includes('Bahia'),
    )[0];
    act(() => {
      carte.props.onPress();
    });

    expect(ouvrirLaFiche).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ documentId: CANDIDAT.documentId }),
      }),
    );
    expect(ouvrirLeProfil).not.toHaveBeenCalled();
  });

  test('P7 · temoin 7 — appuyer sur un RETENU ouvre sa fiche aussi', () => {
    // Les deux chemins passent par la MEME fonction : ils ne peuvent pas
    // diverger, l'un menant a la fiche et l'autre au profil.
    const ouvrirLaFiche = jest.fn();
    const ouvrirLeProfil = jest.fn();
    const arbre = monter({
      detectionPositionSections: [{ ...POSTE_GARDIEN, pending: [] }],
      handleUserPress: ouvrirLeProfil,
      onCandidatePress: ouvrirLaFiche,
    });

    const ligne = arbre.root.findAll(
      (/** @type {any} */ noeud) => noeud.type === TouchableOpacity
        && texteDe(noeud).includes('Alix'),
    )[0];
    act(() => {
      ligne.props.onPress();
    });

    expect(ouvrirLaFiche).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ documentId: RETENU.documentId }),
      }),
    );
    expect(ouvrirLeProfil).not.toHaveBeenCalled();
  });

  test('P7 · temoin 8 — HORS mode par poste, l appui ouvre toujours le profil', () => {
    // 🔒 Le detour n'existe QUE pour une detection rangee par poste. Partout
    // ailleurs, appuyer sur quelqu'un ouvre son profil, comme avant ce lot.
    const ouvrirLaFiche = jest.fn();
    const ouvrirLeProfil = jest.fn();
    const arbre = monter({
      handleUserPress: ouvrirLeProfil,
      onCandidatePress: ouvrirLaFiche,
      participationsByStatus: { missing: [], notAnswered: [], participating: [RETENU] },
    });

    const ligne = arbre.root.findAll(
      (/** @type {any} */ noeud) => noeud.type === TouchableOpacity
        && texteDe(noeud).includes('Alix'),
    )[0];
    act(() => {
      ligne.props.onPress();
    });

    expect(ouvrirLeProfil).toHaveBeenCalled();
    expect(ouvrirLaFiche).not.toHaveBeenCalled();
  });

  test('P7 · temoin 5 — SANS postes, l affichage d avant ce lot est intact', () => {
    // 🔒 Le temoin qui protege P2, AD06 et AE02 : la liste a plat garde son
    // titre de demandes en tete de page et ses groupes de statut.
    const arbre = monter({
      participationsByStatus: { missing: [], notAnswered: [], participating: [RETENU] },
      pendingParticipations: [demande('part-libre', CANDIDAT)],
    });

    const texte = texteVisible(arbre);

    expect(texte).toContain('Alix');
    expect(texte).toContain('Bahia');
    // Aucun intitule du mode « par poste » ne doit apparaitre.
    expect(texte).not.toContain('Demandes à traiter');
    expect(texte).not.toContain('Participants retenus');
    expect(texte).not.toContain('Sans poste précisé');
  });
});
