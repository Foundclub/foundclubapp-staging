import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import FriendlyMatchWizardRecap from '../FriendlyMatchWizardRecap';

// Filet D24 (E6) — l'etape 7/7 n'avait AUCUN test, et c'est la seule qui
// PUBLIE. Ce fichier decrit ce qu'elle fait au moment ou l'annonce part : ce
// qui est envoye, ce qui est efface, et OU l'on atterrit.
//
// ⚠️ Ce fichier ne prouve PAS le resultat sur la pile de navigation — c'est
// `friendlyMatchWizardAtterrissage.test.js` qui le fait, avec les vrais
// routeurs. Ici on epingle les ORDRES donnes, et surtout leur ordre.

/** @type {any[]} */
const mockPropsDuGabarit = [];
/** @type {any[]} */
const mockActions = [];
/** @type {any[]} */
const mockBannieres = [];
const mockCreer = jest.fn();

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

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockPropsDuGabarit.push(props);
  return props.children;
});

jest.mock('@/context/AppFeedbackContext', () => ({
  __esModule: true,
  useAppFeedback: () => ({ showBanner: (/** @type {any} */ b) => mockBannieres.push(b) }),
}));

// ⛔ Jamais `requireActual` sur ce service : son client HTTP exige `API_URL` au
// chargement, et la suite meurt sans message lisible.
jest.mock('@/services/friendlyMatch/friendlyMatchService', () => ({
  __esModule: true,
  createFriendlyMatchAd: (/** @type {any} */ payload) => mockCreer(payload),
}));

/** Le brouillon, lu a chaque rendu : le test remplace son contenu. */
const mockBrouillon = /** @type {any} */ ({});
jest.mock('../FriendlyMatchWizardContext', () => ({
  __esModule: true,
  useFriendlyMatchWizard: () => ({
    dispatch: (/** @type {any} */ action) => mockActions.push(action),
    state: mockBrouillon,
  }),
}));

/** Un brouillon COMPLET : rien ne bloque, la publication peut partir. */
const brouillonPublicable = () => ({
  activity: null,
  candidateDates: [{ date: '2099-05-12', start: '18:00' }],
  category: null,
  description: 'On cherche un adversaire.',
  entryOrigin: '',
  format: '',
  formatOther: '',
  hostingPreference: 'BOTH',
  installation: null,
  level: null,
  location: { city: 'Marseille' },
  refereeing: '',
  section: null,
  team: { documentId: 'team-1', name: 'U15' },
  travelRadiusKm: 25,
});

/**
 * Monte le recapitulatif sur un brouillon donne.
 * @param {any} [modifications] Ce qui change par rapport au brouillon publiable.
 * @returns {any} L'arbre, la navigation espionnee et l'ordre des gestes.
 */
const rendre = (modifications = {}) => {
  Object.keys(mockBrouillon).forEach((cle) => { delete mockBrouillon[cle]; });
  Object.assign(mockBrouillon, brouillonPublicable(), modifications);

  /** @type {any[]} */
  const gestes = [];
  const navigation = {
    goBack: jest.fn(),
    navigate: (/** @type {any} */ nom) => gestes.push({ geste: 'navigate', nom }),
    popTo: (/** @type {any} */ nom) => gestes.push({ geste: 'popTo', nom }),
    replace: (/** @type {any} */ nom, /** @type {any} */ params) => gestes.push({
      geste: 'replace', nom, params,
    }),
  };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(FriendlyMatchWizardRecap, { navigation }));
  });
  return { arbre, gestes, navigation };
};

/** Le dernier jeu de props recu par le gabarit de tunnel. */
const dernierGabarit = () => mockPropsDuGabarit[mockPropsDuGabarit.length - 1];

/**
 * Appuie sur « Publier l'annonce » et laisse la promesse se resoudre.
 * @returns {Promise<void>} Quand la publication est terminee.
 */
const publier = async () => {
  await act(async () => {
    await dernierGabarit().onNext();
  });
};

beforeEach(() => {
  mockPropsDuGabarit.length = 0;
  mockActions.length = 0;
  mockBannieres.length = 0;
  mockCreer.mockReset();
  mockCreer.mockResolvedValue({ documentId: 'ad-42' });
});

describe('Etape 7/7 — publier', () => {
  it('est la 7e etape sur 7 et son bouton dit ce qu il fait', () => {
    rendre();
    expect(dernierGabarit().stepIndex).toBe(7);
    expect(dernierGabarit().stepCount).toBe(7);
    expect(dernierGabarit().nextLabel).toBe('Publier l’annonce');
    expect(dernierGabarit().isNextDisabled).toBe(false);
  });

  it('un brouillon incomplet ne publie pas et nomme ce qui manque', async () => {
    rendre({ candidateDates: [] });
    expect(dernierGabarit().isNextDisabled).toBe(true);

    await publier();

    expect(mockCreer).not.toHaveBeenCalled();
    expect(mockBannieres[0]).toMatchObject({ body: 'Propose au moins une date.', tone: 'error' });
  });

  // ⑤ — l'origine est une donnee de NAVIGATION. Elle ne doit pas se retrouver
  // dans le corps de la requete : le serveur rejetterait un champ inconnu.
  it('l origine du tunnel ne part JAMAIS au serveur', async () => {
    rendre({ entryOrigin: 'EventStack' });

    await publier();

    expect(mockCreer).toHaveBeenCalledTimes(1);
    expect(mockCreer.mock.calls[0][0]).not.toHaveProperty('entryOrigin');
    expect(mockCreer.mock.calls[0][0]).toMatchObject({
      hostingPreference: 'BOTH',
      team: 'team-1',
    });
  });
});

describe('Etape 7/7 — ⑤ ou l on atterrit apres avoir publie', () => {
  // Entree directe depuis League : un seul tunnel a effacer, `replace` suffit.
  it('sans origine, elle remplace le tunnel amical par le detail de l annonce', async () => {
    const { gestes } = rendre();

    await publier();

    expect(gestes).toEqual([
      { geste: 'replace', nom: 'FriendlyMatchAdDetails', params: { adId: 'ad-42' } },
    ]);
  });

  // Entree par la porte du tunnel Evenement : DEUX tunnels a effacer, donc deux
  // ordres, et `popTo` DOIT venir en premier — dans l'autre sens il effacerait
  // le detail qu'on vient de poser.
  it('avec l origine, elle revient d abord sur le tunnel qui l a ouverte', async () => {
    const { gestes } = rendre({ entryOrigin: 'EventStack' });

    await publier();

    expect(gestes).toEqual([
      { geste: 'popTo', nom: 'EventStack' },
      { geste: 'replace', nom: 'FriendlyMatchAdDetails', params: { adId: 'ad-42' } },
    ]);
  });

  // ⚠️ `popTo` sur un nom ABSENT de la pile REMPLACE l'ecran courant par lui :
  // une origine inconnue fabriquerait donc un ecran. La liste fermee l'ignore.
  it('une origine inconnue est ignoree, elle n invente pas d ecran', async () => {
    const { gestes } = rendre({ entryOrigin: 'TeamStack' });

    await publier();

    expect(gestes.map((/** @type {any} */ g) => g.geste)).toEqual(['replace']);
  });

  it('vide le brouillon avant de partir, pour ne pas reproposer l annonce publiee', async () => {
    await act(async () => {});
    const { gestes } = rendre({ entryOrigin: 'EventStack' });

    await publier();

    expect(mockActions).toContainEqual({ type: 'RESET' });
    expect(gestes).toHaveLength(2);
    expect(mockBannieres[0]).toMatchObject({ title: 'Annonce publiée', tone: 'success' });
  });

  it('une publication refusee ne bouge pas d un ecran et garde le message du serveur', async () => {
    mockCreer.mockRejectedValue(new Error('Cette équipe a déjà une annonce ouverte.'));
    const { gestes } = rendre({ entryOrigin: 'EventStack' });

    await publier();

    expect(gestes).toEqual([]);
    expect(mockActions).not.toContainEqual({ type: 'RESET' });
    expect(mockBannieres[0]).toMatchObject({
      body: 'Cette équipe a déjà une annonce ouverte.',
      tone: 'error',
    });
  });
});
