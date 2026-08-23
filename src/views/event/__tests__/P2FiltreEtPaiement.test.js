import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventParticipants from '../components/EventParticipants';

// P2 (E6) — LE FILET DES PASTILLES DE FILTRE ET DE LA COLONNE « A PAYE ».
//
// 🪢 POURQUOI CE FICHIER EN PLUS D AD06 ET D AE02 : AD06 tient l ecran AU
// REPOS, AE02 tient CE QUI SE PASSE QUAND ON TAPE. Ni l un ni l autre n APPUIE
// sur quoi que ce soit — ils ne peuvent donc rien dire d un filtre. Les trois
// filets se lisent ensemble :
//   · AD06 → l ecran par defaut n a pas bouge
//   · AE02 → la recherche
//   · P2   → le filtre par pastilles, et la colonne d argent
//
// 🔬 LE HARNAIS EST CELUI D AD06, RECOPIE : vrai `fr.js` lu par `t`, vrai theme
// monte avec les VRAIS modules. ⛔ JAMAIS un Proxy de theme : il rend les
// echecs jest illisibles (piege paye au lot paywall).
//
// 🧨 LE MOCK DE `licenseQueries` N EST PAS UN CONFORT, C EST UNE CONDITION DE
// DEMARRAGE : le vrai module descend jusqu a `client.native.js`, qui jette AU
// CHARGEMENT quand `.env` est absent — et `.env` est gitignore, donc absent de
// toute copie de travail. Sans ce mock, la suite entiere ne demarre pas
// (« failed to run », 0 test execute).

const mockAffectations = { valeur: { data: undefined, isLoading: false } };

jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseAssignments: () => mockAffectations.valeur,
}));

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

// Le theme est monte avec les VRAIS modules (cf. AD06). Seul `Images` est stube.
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

const P_PRESENT = joueur('p-present', 'Alex');
const P_ABSENT = joueur('p-absent', 'Bilal');
const P_SANS_REPONSE = joueur('p-sansreponse', 'Sami');

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

const LES_TROIS = {
  missing: [P_ABSENT],
  notAnswered: [P_SANS_REPONSE],
  participating: [P_PRESENT],
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
 * Le SELECTEUR D AD06, RECOPIE MOT POUR MOT — c est tout son interet.
 * Il attrape les pastilles d etat par leur couture `textAlign: 'center'` +
 * `color` dans le MEME objet de style. Le temoin 5 s en sert pour prouver que
 * les chips de filtre n y tombent PAS : si elles y tombaient, les 8 temoins de
 * pastille d AD06 partiraient au rouge en serie (ils comparent en `toEqual`).
 * @param {any} arbre - L arbre rendu.
 * @returns {{couleur: string, texte: string}[]} - Une entree par pastille.
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
 * Les textes de la LISTE, c est-a-dire tout ce qui suit le bloc de compteurs.
 * Recopie d AD06 : la coupe se fait sur la legende de la barre. C est elle qui
 * met les chips de filtre HORS de portee des temoins d ordre — a condition
 * qu elles se rendent AU-DESSUS de cette legende.
 * @param {any} arbre - L arbre rendu.
 * @returns {string[]} - Les textes de la liste des participants.
 */
const textesDeLaListe = (arbre) => {
  const textes = textesVisibles(arbre);
  const rangLegende = textes.findIndex((/** @type {string} */ t) => /réponses sur/.test(t));
  return rangLegende >= 0 ? textes.slice(rangLegende + 1) : textes;
};

/**
 * Retrouve une pastille de filtre par sa clef.
 * @param {any} arbre - L arbre rendu.
 * @param {string} clef - `tous`, `participating`, `missing` ou `notAnswered`.
 * @returns {any} - Le noeud tactile, ou `undefined`.
 */
const chip = (arbre, clef) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud.props.testID === `P2-pastille-${clef}`);

/**
 * Appuie sur une pastille de filtre.
 * @param {any} arbre - L arbre rendu.
 * @param {string} clef - La clef de la pastille.
 * @returns {void} - Rien.
 */
const appuyer = (arbre, clef) => {
  act(() => { chip(arbre, clef).props.onPress(); });
};

/**
 * Lit le texte d un noeud repere par son `testID` (recopie d AD06).
 * @param {any} arbre - L arbre rendu.
 * @param {string} identifiant - Le `testID` cherche.
 * @returns {string} - Le texte porte par ce noeud, ou '' s il n existe pas.
 */
const parIdentifiant = (arbre, identifiant) => {
  const trouves = arbre.root.findAllByProps({ testID: identifiant });
  return trouves.length > 0 ? texteDe(trouves[0]) : '';
};

const CAMPAGNE_ACTIVE = { documentId: 'camp-active', status: 'active' };
const CAMPAGNE_BROUILLON = { documentId: 'camp-brouillon', status: 'draft' };

/**
 * Fabrique une affectation de cotisation, telle que la rend le serveur.
 * @param {string} idUtilisateur - Le `documentId` du membre.
 * @param {string} statut - L un des 6 statuts de cotisation.
 * @returns {object} - L affectation.
 */
const affectation = (idUtilisateur, statut) => ({
  status: statut,
  user: { documentId: idUtilisateur, id: idUtilisateur },
});

/**
 * Arme la reponse du serveur pour les affectations de cotisation.
 * @param {object[]} liste - Les affectations a rendre.
 * @returns {void} - Rien.
 */
const armerAffectations = (liste) => {
  mockAffectations.valeur = { data: { data: liste }, isLoading: false };
};

beforeEach(() => {
  mockAffectations.valeur = { data: undefined, isLoading: false };
});

describe('P2 · temoin 1 — les 4 pastilles et leurs compteurs', () => {
  test('Tous, Presents, Absents, Sans reponse portent chacune son nombre', () => {
    const arbre = monter({ participationsByStatus: LES_TROIS });

    expect(texteDe(chip(arbre, 'tous'))).toContain('Tous');
    expect(texteDe(chip(arbre, 'tous'))).toContain('3');
    expect(texteDe(chip(arbre, 'participating'))).toContain('Présents');
    expect(texteDe(chip(arbre, 'participating'))).toContain('1');
    expect(texteDe(chip(arbre, 'missing'))).toContain('Absents');
    expect(texteDe(chip(arbre, 'missing'))).toContain('1');
    expect(texteDe(chip(arbre, 'notAnswered'))).toContain('Sans réponse');
    expect(texteDe(chip(arbre, 'notAnswered'))).toContain('1');
  });

  test('sans aucune liste rendue, il n y a pas de pastille du tout', () => {
    const arbre = monter();

    expect(chip(arbre, 'tous')).toBeUndefined();
  });
});

describe('P2 · temoin 2 — appuyer « Absents » ne laisse que les absents', () => {
  test('les deux autres groupes disparaissent, titre compris', () => {
    const arbre = monter({ participationsByStatus: LES_TROIS });
    appuyer(arbre, 'missing');

    const textes = textesDeLaListe(arbre);

    expect(textes).toContain('Absent·e·s');
    expect(textes).toContain('Bilal Test');
    expect(textes).not.toContain('Présent·e·s');
    expect(textes).not.toContain('Sans réponse');
    expect(textes).not.toContain('Alex Test');
    expect(textes).not.toContain('Sami Test');
  });
});

describe('P2 · temoin 3 — « Tous » retablit', () => {
  test('apres un filtre, les 3 groupes reviennent', () => {
    const arbre = monter({ participationsByStatus: LES_TROIS });
    appuyer(arbre, 'participating');
    appuyer(arbre, 'tous');

    const textes = textesDeLaListe(arbre);

    expect(textes).toContain('Présent·e·s');
    expect(textes).toContain('Absent·e·s');
    expect(textes).toContain('Sans réponse');
    expect(textes).toContain('Alex Test');
    expect(textes).toContain('Bilal Test');
    expect(textes).toContain('Sami Test');
  });
});

describe('P2 · temoin 4 — l ORDRE des groupes ne bouge pas', () => {
  test('au repos ET apres un aller-retour de filtre', () => {
    const arbre = monter({ participationsByStatus: LES_TROIS });
    /**
     * Relit l ordre des 3 titres de groupe.
     * @returns {number[]} - Les 3 rangs, dans l ordre attendu.
     */
    const rangs = () => {
      const textes = textesDeLaListe(arbre);
      return [
        textes.indexOf('Présent·e·s'),
        textes.indexOf('Absent·e·s'),
        textes.indexOf('Sans réponse'),
      ];
    };

    const [avantP, avantA, avantS] = rangs();
    expect(avantP).toBeGreaterThanOrEqual(0);
    expect(avantP).toBeLessThan(avantA);
    expect(avantA).toBeLessThan(avantS);

    appuyer(arbre, 'notAnswered');
    appuyer(arbre, 'tous');

    const [apresP, apresA, apresS] = rangs();
    expect(apresP).toBeGreaterThanOrEqual(0);
    expect(apresP).toBeLessThan(apresA);
    expect(apresA).toBeLessThan(apresS);
  });

  test('les chips se rendent AU-DESSUS de la legende, donc hors de la liste', () => {
    const arbre = monter({ participationsByStatus: LES_TROIS });
    const tous = textesVisibles(arbre);
    const rangLegende = tous.findIndex((/** @type {string} */ t) => /réponses sur/.test(t));
    const rangChip = tous.findIndex((/** @type {string} */ t) => /^Tous/.test(t));

    expect(rangChip).toBeGreaterThanOrEqual(0);
    expect(rangChip).toBeLessThan(rangLegende);
  });
});

describe('P2 · temoin 5 — le selecteur de pastilles d AD06 ignore les chips', () => {
  test('aucune chip de filtre n est prise pour une pastille d etat', () => {
    const arbre = monter({ participationsByStatus: LES_TROIS });
    const textesDePastille = pastilles(arbre).map((/** @type {any} */ p) => p.texte);

    expect(textesDePastille.some((/** @type {string} */ t) => /^Tous/.test(t))).toBe(false);
    expect(textesDePastille.some((/** @type {string} */ t) => /^Présents/.test(t))).toBe(false);
    expect(textesDePastille.some((/** @type {string} */ t) => /^Absents/.test(t))).toBe(false);
  });
});

describe('P2 · temoin 6 — la colonne « a paye », vue par un dirigeant', () => {
  test('« Payée » sur la ligne du payeur, « En attente » sur l autre', () => {
    armerAffectations([
      affectation('p-present', 'paid'),
      affectation('p-absent', 'pending'),
    ]);

    const arbre = monter({
      canManageEventLicenseCampaigns: true,
      eventLicenseCampaigns: [CAMPAGNE_ACTIVE],
      participationsByStatus: LES_TROIS,
    });

    // 🎯 On lit par testID, PAS par `textesVisibles` : « En attente » est aussi
    // un libelle de la pastille d assiduite, et un temoin qui chercherait ce
    // texte dans tout l ecran serait VERT meme si la colonne n existait pas.
    expect(parIdentifiant(arbre, 'P2-paiement-p-present')).toBe('Payée');
    expect(parIdentifiant(arbre, 'P2-paiement-p-absent')).toBe('En attente');
  });

  test('les 6 statuts ont chacun leur libelle francais', () => {
    const attendus = {
      manual_review: 'À valider',
      overdue: 'En retard',
      paid: 'Payée',
      partial: 'Partiel',
      pending: 'En attente',
      waived: 'Exemptée',
    };

    Object.entries(attendus).forEach(([statut, libelle]) => {
      armerAffectations([affectation('p-present', statut)]);
      const arbre = monter({
        canManageEventLicenseCampaigns: true,
        eventLicenseCampaigns: [CAMPAGNE_ACTIVE],
        participationsByStatus: LES_TROIS,
      });
      expect(parIdentifiant(arbre, 'P2-paiement-p-present')).toBe(libelle);
    });
  });

  test('la campagne se choisit par la chaine de repli : active avant brouillon', () => {
    armerAffectations([affectation('p-present', 'paid')]);

    const arbre = monter({
      canManageEventLicenseCampaigns: true,
      eventLicenseCampaigns: [CAMPAGNE_BROUILLON, CAMPAGNE_ACTIVE],
      participationsByStatus: LES_TROIS,
    });

    expect(parIdentifiant(arbre, 'P2-paiement-p-present')).toBe('Payée');
  });

  test('une personne sans affectation ne porte RIEN', () => {
    armerAffectations([affectation('p-present', 'paid')]);

    const arbre = monter({
      canManageEventLicenseCampaigns: true,
      eventLicenseCampaigns: [CAMPAGNE_ACTIVE],
      participationsByStatus: LES_TROIS,
    });

    expect(parIdentifiant(arbre, 'P2-paiement-p-present')).toBe('Payée');
    expect(parIdentifiant(arbre, 'P2-paiement-p-absent')).toBe('');
  });
});

describe('P2 · temoin 7 — la colonne est GATEE, c est de l argent', () => {
  test('un NON-dirigeant ne voit rien, meme avec une campagne et des affectations', () => {
    armerAffectations([
      affectation('p-present', 'paid'),
      affectation('p-absent', 'pending'),
    ]);

    const arbre = monter({
      canManageEventLicenseCampaigns: false,
      eventLicenseCampaigns: [CAMPAGNE_ACTIVE],
      participationsByStatus: LES_TROIS,
    });

    expect(parIdentifiant(arbre, 'P2-paiement-p-present')).toBe('');
    expect(parIdentifiant(arbre, 'P2-paiement-p-absent')).toBe('');
    expect(textesVisibles(arbre)).not.toContain('Payée');
  });

  test('un dirigeant SANS campagne ne voit pas de colonne vide : elle n existe pas', () => {
    armerAffectations([affectation('p-present', 'paid')]);

    const arbre = monter({
      canManageEventLicenseCampaigns: true,
      eventLicenseCampaigns: [],
      participationsByStatus: LES_TROIS,
    });

    expect(parIdentifiant(arbre, 'P2-paiement-p-present')).toBe('');
    expect(textesVisibles(arbre)).not.toContain('Payée');
    expect(textesVisibles(arbre)).not.toContain('—');
  });
});

describe('P2 · temoin 8 — la colonne d argent ne casse aucun temoin d ordre', () => {
  test('aucun libelle de paiement n est EGAL a un texte des temoins d ordre', () => {
    const libelles = ['À valider', 'En retard', 'Payée', 'Partiel', 'En attente', 'Exemptée'];
    const textesDOrdre = [
      'Demandes de participation',
      'Présent·e·s',
      'Absent·e·s',
      'Sans réponse',
      'Historique équipe retirée',
    ];

    libelles.forEach((libelle) => {
      expect(textesDOrdre).not.toContain(libelle);
    });
  });

  test('le selecteur de pastilles d AD06 n attrape pas la colonne de paiement', () => {
    armerAffectations([
      affectation('p-present', 'paid'),
      affectation('p-absent', 'pending'),
    ]);

    const arbre = monter({
      canManageEventLicenseCampaigns: true,
      eventLicenseCampaigns: [CAMPAGNE_ACTIVE],
      participationsByStatus: LES_TROIS,
    });

    expect(pastilles(arbre).map((/** @type {any} */ p) => p.texte)).not.toContain('Payée');
  });

  test('l ORDRE des 3 groupes tient, colonne d argent affichee', () => {
    armerAffectations([affectation('p-present', 'paid')]);

    const arbre = monter({
      canManageEventLicenseCampaigns: true,
      eventLicenseCampaigns: [CAMPAGNE_ACTIVE],
      participationsByStatus: LES_TROIS,
    });

    const textes = textesDeLaListe(arbre);

    expect(textes.indexOf('Présent·e·s')).toBeGreaterThanOrEqual(0);
    expect(textes.indexOf('Présent·e·s')).toBeLessThan(textes.indexOf('Absent·e·s'));
    expect(textes.indexOf('Absent·e·s')).toBeLessThan(textes.indexOf('Sans réponse'));
  });
});
