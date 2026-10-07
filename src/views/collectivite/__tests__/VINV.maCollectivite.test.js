/* eslint-disable max-len -- les phrases de l'écran sont citées en entier */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MaCollectivite from '../components/MaCollectivite';

// 🏛️ VILLE-INVITER-CLUB, VOIE 3 (07/10/2026) — « collectivité A » d'Adel : dans « Gérer mon
// club », la case « Ma collectivité » du DIRIGEANT.
//
// Ce que ce témoin fige (ROUGE avant : le composant n'existait pas) :
//   K1 — rattaché : « Ton club est rattaché à la Ville de X », et plus rien à chercher ;
//   K2 — sinon : « Rechercher ma collectivité », celle de la commune d'abord ; « Demander le
//        rattachement » (la Ville accepte) ; une Ville qui propose déjà : « Accepter sa demande » ;
//   K3 — une demande en cours : son état, et pas de seconde recherche ;
//   K4 — introuvable : « Prévenir ma mairie » (une piste pour l'équipe FoundClub) ; déjà fait :
//        la date ; sans commune connue, le dirigeant la donne.

// Un ecran entier monte sous charge (suite complete, PC occupe) : le premier cas qui monte le
// champ de saisie paie le chargement des modules et depassait les 5 s par defaut (COLL-CONSOLE).
jest.setTimeout(30000);

/** @type {any} */
let mockMa;
/** @type {any} */
let mockDemandes;
/** @type {any} */
let mockRecherche;
const mockRechercheAppels = jest.fn();
const mockDemander = {
  error: null, isPending: false, mutate: jest.fn(), variables: null,
};
const mockPrevenir = {
  error: null, isPending: false, mutate: jest.fn(), variables: null,
};
const mockRepondre = {
  error: null, isPending: false, mutate: jest.fn(), variables: null,
};

jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        let texte = cle;
        if (typeof valeur === 'string') texte = valeur;
        else if (typeof repli === 'string') texte = repli;
        return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''));
      },
    }),
  };
});

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

jest.mock('@/services/collectivite/collectiviteRattachementQueries', () => ({
  useAnswerCollectiviteProposal: () => mockRepondre,
  useClubCollectiviteRequests: () => mockDemandes,
  useCollectivitesForClubSearch: (/** @type {any} */ clubId, /** @type {any} */ q) => {
    mockRechercheAppels(clubId, q);
    return mockRecherche;
  },
  useMaCollectivite: () => mockMa,
  useNotifyMairie: () => mockPrevenir,
  useRequestClubAttach: () => mockDemander,
}));

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MaCollectivite clubId="club-e" />);
  });
  return arbre;
};

const racine = (/** @type {any} */ x) => x.root || x;
const textes = (/** @type {any} */ arbre) => racine(arbre).findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const boutons = (/** @type {any} */ arbre, /** @type {string} */ titre) => racine(arbre).findAll(
  (/** @type {any} */ n) => n.props?.title === titre && typeof n.props?.onPress === 'function',
);
const dans = (/** @type {any} */ arbre, /** @type {string} */ testID) => racine(arbre).findAll(
  (/** @type {any} */ n) => n.props?.testID === testID,
)[0];
const saisir = (/** @type {any} */ arbre, /** @type {string} */ testID, /** @type {string} */ texte) => {
  const champ = racine(arbre).findAll(
    (/** @type {any} */ n) => n.props?.testID === testID && typeof n.props?.onChangeText === 'function',
  )[0];
  champ.props.onChangeText(texte);
};

const ville = (/** @type {Record<string, unknown>} */ champs) => ({
  attached: false, attachedElsewhere: false, inCommune: false, proposal: null, request: null, type: 'commune', ...champs,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockMa = {
    data: { attached: null, commune: { code: '13055', name: 'Montrivage' }, lead: null },
    error: null,
    isLoading: false,
  };
  mockDemandes = { data: [], error: null, isLoading: false };
  mockRecherche = {
    data: [
      ville({ documentId: 'ville-m', inCommune: true, name: 'Ville de Montrivage' }),
      ville({ documentId: 'ville-p', name: 'Ville de Portvieux', proposal: { documentId: 'p1', state: 'pending' } }),
      ville({ documentId: 'ville-r', name: 'Ville de Rochebrune', request: { documentId: 'r1', state: 'pending' } }),
      ville({ documentId: 'ville-x', name: 'Ville de Sauveterre', request: { documentId: 'r2', state: 'refused' } }),
    ],
    error: null,
    isLoading: false,
  };
});

describe('VINV voie 3 · « Ma collectivité », le dirigeant', () => {
  it('K1 rattaché : la Ville, et plus rien à chercher', async () => {
    mockMa.data = { attached: { name: 'Ville de Montrivage', type: 'commune' }, commune: null, lead: null };
    const arbre = await monter();
    expect(textes(arbre)).toEqual(expect.arrayContaining(['Ma collectivité', 'Ton club est rattaché à la Ville de Montrivage.']));
    expect(dans(arbre, 'ma-collectivite-recherche')).toBeUndefined();
    expect(boutons(arbre, 'Prévenir ma mairie')).toHaveLength(0);
  });

  it('K2 rechercher : la commune d’abord, « Demander le rattachement », et la Ville qui propose déjà', async () => {
    const arbre = await monter();
    expect(mockRechercheAppels).toHaveBeenCalledWith('club-e', '');
    expect(textes(arbre)).toContain('Rechercher ma collectivité');
    const montrivage = dans(arbre, 'ma-collectivite-ville-m');
    expect(textes(montrivage)).toEqual(expect.arrayContaining(['Ville de Montrivage', 'Dans ta commune']));
    await act(async () => { boutons(montrivage, 'Demander le rattachement')[0].props.onPress(); });
    expect(mockDemander.mutate).toHaveBeenCalledWith({ clubId: 'club-e', collectiviteId: 'ville-m' }, expect.any(Object));
    await act(async () => { boutons(dans(arbre, 'ma-collectivite-ville-p'), 'Accepter sa demande')[0].props.onPress(); });
    expect(mockRepondre.mutate).toHaveBeenCalledWith({ accept: true, clubId: 'club-e', invitationId: 'p1' }, expect.any(Object));
    expect(textes(dans(arbre, 'ma-collectivite-ville-r'))).toContain('Demande envoyée');
    // « refus B » (Adel, 07/10 ~18h05) : après un refus de la Ville, le club peut redemander.
    const refus = dans(arbre, 'ma-collectivite-ville-x');
    expect(textes(refus)).toContain('Elle a refusé ta demande');
    await act(async () => { boutons(refus, 'Demander de nouveau')[0].props.onPress(); });
    expect(mockDemander.mutate).toHaveBeenLastCalledWith({ clubId: 'club-e', collectiviteId: 'ville-x' }, expect.any(Object));
  });

  it('K3 une demande en cours : son état, sans seconde recherche', async () => {
    mockDemandes = {
      data: [{
        canAnswer: false, collectivite: { name: 'Ville de Montrivage', type: 'commune' }, documentId: 'r1', kind: 'attach_request', state: 'pending',
      }],
      error: null,
      isLoading: false,
    };
    const arbre = await monter();
    expect(textes(arbre)).toContain('Ta demande de rattachement à la Ville de Montrivage attend sa réponse.');
    expect(dans(arbre, 'ma-collectivite-recherche')).toBeUndefined();
  });

  it('K4 introuvable : « Prévenir ma mairie », une piste pour l’équipe FoundClub ; déjà fait, la date', async () => {
    const arbre = await monter();
    expect(textes(arbre)).toContain('Ta collectivité n’est pas sur FoundClub ?');
    await act(async () => { boutons(arbre, 'Prévenir ma mairie')[0].props.onPress(); });
    expect(mockPrevenir.mutate).toHaveBeenCalledWith({ clubId: 'club-e', communeName: null }, expect.any(Object));

    mockMa.data = { ...mockMa.data, lead: { communeName: 'Montrivage', createdAt: '2026-10-07T12:00:00.000Z' } };
    const deja = await monter();
    expect(textes(deja).some((texte) => texte.startsWith('Ta mairie de Montrivage est signalée à l’équipe FoundClub'))).toBe(true);
    expect(boutons(deja, 'Prévenir ma mairie')).toHaveLength(0);
  });

  it('K4 sans commune connue : le dirigeant la donne avant de prévenir', async () => {
    mockMa.data = { attached: null, commune: null, lead: null };
    const arbre = await monter();
    expect(boutons(arbre, 'Prévenir ma mairie')[0].props.disabled).toBe(true);
    await act(async () => { saisir(arbre, 'ma-collectivite-commune', ' Montrivage '); });
    await act(async () => { boutons(arbre, 'Prévenir ma mairie')[0].props.onPress(); });
    expect(mockPrevenir.mutate).toHaveBeenCalledWith({ clubId: 'club-e', communeName: 'Montrivage' }, expect.any(Object));
  });
});
