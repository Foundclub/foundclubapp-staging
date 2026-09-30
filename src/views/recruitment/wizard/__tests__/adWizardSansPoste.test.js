// Le VRAI i18next en francais : ce filet lit les textes de `fr.js`, c'est lui
// qui porte la coquille « n'à » et les libelles des roles d'entraineur.
import '@/theme/strings';

import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import AdWizardRecap from '../AdWizardRecap';

// RECRUTER-TUNNEL (audit V1, point H2) — UN CLUB D'ARTS MARTIAUX NE POUVAIT PAS
// PUBLIER UNE OFFRE DE JOUEURS.
//
// Ce que l'audit a vu a l'ecran (captures `H2_arts-martiaux-sans-poste_1` et `_2`) :
//   · etape 3/7 : « Arts martiaux ne nécessite pas de préciser des postes. Tu
//     peux passer directement à la suite » — l'etape Postes laisse passer
//     (`isAdWizardNeedsComplete` connait les sports sans postes depuis C28) ;
//   · etape 7/7 : « Récapitulatif incomplet — Il manque encore au moins un poste »
//     et « Publier l'annonce » grise. Le recapitulatif avait RECOPIE la regle au
//     lieu d'appeler celle de l'etape, et la copie ignorait C28.
// Et meme debloque, le bouton n'aurait rien publie : une annonce PAR poste, zero
// poste ⇒ zero annonce, et retour a l'accueil sans rien montrer.
//
// Le filet est pilote par ce que l'etape EXPOSE (ses props : `isNextDisabled`,
// `onNext`) et par le TEXTE rendu — jamais par la forme de l'arbre.

/** @type {any[]} */
const mockProprietesEtape = [];
/** @type {any[]} */
const mockAnnoncesEnvoyees = [];
const mockCreerAnnonce = jest.fn(async (/** @type {any} */ donnees) => {
  mockAnnoncesEnvoyees.push(donnees);
  return { documentId: `annonce-${mockAnnoncesEnvoyees.length}` };
});
const mockClientRequete = { invalidateQueries: jest.fn() };
const mockBanniere = jest.fn();

// Objets FIGES : un contexte neuf a chaque rendu relance les effets qui en
// dependent et fait tourner Jest en boucle infinie, sans message (piege D81).
const BRIEF_COMMUN = Object.freeze({
  address: Object.freeze({ label: 'Salle annexe' }),
  category: Object.freeze({ documentId: 'cat-1', name: 'U15 (15 ans)' }),
  description: '',
  minLevel: Object.freeze({ documentId: 'niv-1', name: 'Départemental' }),
  section: Object.freeze({ documentId: 'sec-1', name: 'Mixte' }),
  validationMode: 'auto',
});

/**
 * Une equipe dont le sport est le premier de ses activites, comme le serveur la rend.
 * @param {string} sport Le nom du sport.
 * @returns {any} L'equipe figee.
 */
const equipeDe = (sport) => Object.freeze({
  activities: Object.freeze([Object.freeze({ name: sport })]),
  club: Object.freeze({ documentId: 'club-1' }),
  documentId: `equipe-${sport}`,
  name: 'U13',
});

const ETAT_ARTS_MARTIAUX = Object.freeze({
  ...BRIEF_COMMUN,
  audienceType: 'player',
  positions: Object.freeze([]),
  sport: Object.freeze({ name: 'Arts martiaux' }),
  team: equipeDe('Arts martiaux'),
});

const ETAT_FOOTBALL_SANS_POSTE = Object.freeze({
  ...BRIEF_COMMUN,
  audienceType: 'player',
  positions: Object.freeze([]),
  sport: Object.freeze({ name: 'Football' }),
  team: equipeDe('Football'),
});

const ETAT_ENTRAINEUR_ADJOINT = Object.freeze({
  ...BRIEF_COMMUN,
  audienceType: 'coach',
  coachExperienceLevel: 'confirme',
  coachQuantity: 1,
  coachRole: 'entraineur_adjoint',
  engagementType: 'benevole',
  positions: Object.freeze([]),
  sport: Object.freeze({ name: 'Football' }),
  team: equipeDe('Football'),
});

/** @type {any} */
let mockEtatCourant = ETAT_ARTS_MARTIAUX;

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    mutateAsync: (/** @type {any} */ variables) => options.mutationFn(variables),
    reset: jest.fn(),
  }),
  useQueryClient: () => mockClientRequete,
}));

// Le VRAI theme, sans le contexte React qui le porte. Un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall, 2026-08-02).
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: espaces,
    }),
  };
});

// ⛔ Jamais `requireActual` sur un service : le client HTTP refuse de se charger
// sans `API_URL` et fait tomber la suite AVANT le premier rendu.
jest.mock('@/services/recruitment/recruitmentService', () => ({
  createRecruitmentAd: (/** @type {any} */ ...arguments_) => mockCreerAnnonce(...arguments_),
}));

jest.mock('@/domains/subscription/subscriptionDecision', () => ({
  extractSubscriptionDecisionFromError: () => null,
}));

jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: mockBanniere }),
}));

jest.mock('../AdWizardContext', () => ({
  useAdWizard: () => ({ dispatch: jest.fn(), state: mockEtatCourant }),
}));

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function PaywallMock() {
    return null;
  },
);

jest.mock(
  '@/views/event/wizard/components/EventWizardTeamCard',
  () => function CarteEquipeMock() {
    return null;
  },
);

// La doublure capture les props ET rend le contenu de l'etape : on lit ce que
// le recapitulatif affiche, et on publie par son bouton (`onNext`).
jest.mock(
  '@/components/molecules/wizardStepLayout/WizardStepLayout',
  () => function EtapeMock(/** @type {any} */ props) {
    // eslint-disable-next-line global-require
    const { createElement: creer } = require('react');
    // eslint-disable-next-line global-require
    const { View } = require('react-native');
    mockProprietesEtape.push(props);
    return creer(View, null, props.children);
  },
);

/** @type {any} */
let arbre = null;
/** @type {any} */
let resetRacine;

/**
 * Tout le texte d'un noeud, colle comme a l'ecran (piege D49 : jamais `join(' ')`).
 * @param {any} noeud Un noeud de `toJSON()`.
 * @returns {string} Le texte.
 */
const texteDe = (noeud) => {
  if (noeud === null || noeud === undefined) return '';
  if (typeof noeud === 'string') return noeud;
  if (Array.isArray(noeud)) return noeud.map(texteDe).join('');
  return texteDe(noeud.children);
};

/**
 * Chaque bloc de texte rendu, separement : un libelle se cherche entier.
 * @param {any} noeud Un noeud de `toJSON()`.
 * @returns {string[]} Les textes.
 */
const textesDe = (noeud) => {
  if (noeud === null || noeud === undefined) return [];
  if (typeof noeud === 'string') return [noeud];
  if (Array.isArray(noeud)) return noeud.flatMap(textesDe);
  if (noeud.type === 'Text') return [texteDe(noeud)];
  return textesDe(noeud.children);
};

const texteVisible = () => textesDe(arbre.toJSON()).join(' | ');

const etape = () => mockProprietesEtape[mockProprietesEtape.length - 1];

/**
 * Monte l'etape de recapitulatif sur un brief donne.
 * @param {any} etat L'etat du tunnel.
 * @returns {void}
 */
const monterLeRecap = (etat) => {
  mockEtatCourant = etat;
  mockProprietesEtape.length = 0;
  mockAnnoncesEnvoyees.length = 0;
  resetRacine = jest.fn();

  const navigation = {
    dispatch: jest.fn(),
    getParent: () => ({ reset: resetRacine }),
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  act(() => {
    arbre = renderer.create(createElement(AdWizardRecap, { navigation }));
  });
};

/**
 * Publie l'annonce en appuyant sur le bouton de l'etape, comme l'audit.
 * @returns {Promise<void>} Rien.
 */
const publier = async () => {
  await act(async () => {
    await etape().onNext();
  });
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  jest.clearAllMocks();
});

describe('H2 — un club d arts martiaux publie une offre de joueurs SANS poste', () => {
  it('LE TEMOIN : le recapitulatif ne reclame plus de poste, le bouton est actif', () => {
    monterLeRecap(ETAT_ARTS_MARTIAUX);

    expect(texteVisible()).not.toContain('Récapitulatif incomplet');
    expect(texteVisible()).not.toContain('au moins un poste');
    expect(etape().isNextDisabled).toBe(false);
  });

  it('publier envoie UNE annonce, sans poste, et atterrit dessus', async () => {
    monterLeRecap(ETAT_ARTS_MARTIAUX);
    await publier();

    expect(mockBanniere).not.toHaveBeenCalled();
    expect(mockCreerAnnonce).toHaveBeenCalledTimes(1);
    const [envoyee] = mockAnnoncesEnvoyees;
    expect(envoyee.audienceType).toBe('player');
    expect(envoyee.team).toBe('equipe-Arts martiaux');
    // Pas un poste invente : la cle reste vide, le serveur n'enregistre aucun poste.
    expect(envoyee.position).toBeUndefined();

    const { routes } = resetRacine.mock.calls[0][0];
    expect(routes[routes.length - 1]).toEqual({
      name: 'RecruitmentAdDetails',
      params: { adId: 'annonce-1' },
    });
  });

  it('la vue d ensemble compte 4 informations sur 4, sans « À compléter »', () => {
    monterLeRecap(ETAT_ARTS_MARTIAUX);

    expect(texteVisible()).toContain('4 / 4 informations clés prêtes à publier');
    expect(texteVisible()).toContain('Prêt à publier');
    expect(texteVisible()).not.toContain('À compléter');
  });

  it('la rubrique Besoins dit pourquoi il n y a pas de poste, sans en reclamer', () => {
    monterLeRecap(ETAT_ARTS_MARTIAUX);

    expect(texteVisible()).toContain('Arts martiaux ne nécessite pas de préciser des postes.');
    expect(texteVisible()).not.toContain('Ajoute au moins un poste');
    expect(texteVisible()).not.toContain('Aucun poste');
  });
});

describe('H2 — garde-fou : un sport A postes exige toujours son poste', () => {
  it('football sans poste : bouton grise et poste reclame', () => {
    monterLeRecap(ETAT_FOOTBALL_SANS_POSTE);

    expect(etape().isNextDisabled).toBe(true);
    expect(texteVisible()).toContain('Il manque encore au moins un poste avant de publier cette annonce.');
  });

  it('football sans poste : appuyer quand meme ne publie RIEN', async () => {
    monterLeRecap(ETAT_FOOTBALL_SANS_POSTE);
    await publier();

    expect(mockCreerAnnonce).not.toHaveBeenCalled();
    expect(mockBanniere).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error' }));
  });

  it('la coquille voisine : « n a » et non « n à »', () => {
    monterLeRecap(ETAT_FOOTBALL_SANS_POSTE);

    expect(texteVisible()).toContain("Aucun poste n'a encore été ajouté.");
    expect(texteVisible()).not.toContain('n\'à');
  });
});

describe('H3 dans le recapitulatif — le role entraineur n est jamais un nom technique', () => {
  it('« entraineur_adjoint » se lit « Entraîneur adjoint »', () => {
    monterLeRecap(ETAT_ENTRAINEUR_ADJOINT);

    expect(texteVisible()).toContain('Entraîneur adjoint');
    expect(texteVisible()).not.toContain('entraineur_adjoint');
  });

  it('et la coquille jumelle des missions : « n a encore » et non « n à encore »', () => {
    monterLeRecap(ETAT_ENTRAINEUR_ADJOINT);

    expect(texteVisible()).toContain("Aucune mission détaillée n'a encore été ajoutée.");
    expect(texteVisible()).not.toContain('n à encore');
  });
});
