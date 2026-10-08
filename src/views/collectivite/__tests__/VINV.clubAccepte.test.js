/* eslint-disable max-len -- les phrases de l'écran sont citées en entier */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import RattachementDuClub from '../components/RattachementDuClub';

// 🏛️ VILLE-INVITER-CLUB (07/10/2026), côté CLUB — « club A » d'Adel : quand les dirigeants
// ACCEPTENT la demande de la Ville, le club est rattaché tout de suite. Et (constat du chef en
// prod, 07/10) : le dirigeant doit VOIR l'état de SA demande de rattachement, dans les deux sens —
// Adel avait cru son club rattaché alors que la demande attendait.
//
// Ce que ce témoin fige (ROUGE avant le lot : rien, côté club, ne parlait de la Ville) :
//   C1 — la demande de la Ville : « La Ville de X propose de rattacher ton club », ce que ça
//        change (une phrase), l'offre quand la Ville la donne, Accepter / Refuser (confirmé) ;
//   C2 — ses autres demandes se lisent, au « tu » : en attente, rattaché, refusée ;
//   C3 — rien pour un compte qui ne dirige pas le club, ni quand il n'y a aucune demande.

/** @type {any} */
let mockDemandes;
const mockLecture = jest.fn();
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
  useClubCollectiviteRequests: (/** @type {any} */ clubId, /** @type {any} */ options) => {
    mockLecture(clubId, options);
    return mockDemandes;
  },
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

const monter = async (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    // eslint-disable-next-line react/jsx-props-no-spreading
    arbre = renderer.create(<RattachementDuClub {...props} />);
  });
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

const boutons = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.title === titre && typeof n.props?.onPress === 'function',
);

const VILLE = { name: 'Ville de Montrivage', type: 'commune' };

beforeEach(() => {
  jest.clearAllMocks();
  mockDemandes = {
    data: [
      {
        canAnswer: true, collectivite: VILLE, createdAt: '2026-10-07T12:00:00.000Z', documentId: 'p1', kind: 'proposal', offerIncluded: true, state: 'pending',
      },
      {
        canAnswer: false, collectivite: { name: 'Ville de Démouville', type: 'commune' }, createdAt: '2026-10-07T11:51:00.000Z', documentId: 'r1', kind: 'attach_request', offerIncluded: false, state: 'pending',
      },
    ],
    error: null,
    isLoading: false,
  };
});

describe('VINV · côté club — la demande de la Ville, et l’état de ses demandes', () => {
  it('C1 la demande de la Ville : ce qu’elle change, l’offre, Accepter', async () => {
    const arbre = await monter({ clubId: 'club-e', enabled: true });
    expect(mockLecture).toHaveBeenCalledWith('club-e', { enabled: true });
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'La Ville de Montrivage propose de rattacher ton club',
      'Rattaché, ton club voit les installations et les créneaux de la Ville, peut y demander des créneaux et reçoit ses actualités.',
      'Avec la Ville de Montrivage, ton club reçoit l’offre Club de FoundClub, offerte par la Ville.',
    ]));
    await act(async () => { boutons(arbre, 'Accepter')[0].props.onPress(); });
    expect(mockRepondre.mutate).toHaveBeenCalledWith(
      { accept: true, clubId: 'club-e', invitationId: 'p1' },
      expect.any(Object),
    );
  });

  it('C1 Refuser demande confirmation (FINITIONS-VILLE : la Ville pourra la renvoyer, « refus B »)', async () => {
    const arbre = await monter({ clubId: 'club-e', enabled: true });
    await act(async () => { boutons(arbre, 'Refuser')[0].props.onPress(); });
    expect(mockRepondre.mutate).not.toHaveBeenCalled();
    expect(textes(arbre)).toContain('Refuser la demande de la Ville de Montrivage ? Ton club ne sera pas rattaché ; elle pourra te la renvoyer plus tard.');
    await act(async () => { boutons(arbre, 'Oui, refuser')[0].props.onPress(); });
    expect(mockRepondre.mutate).toHaveBeenCalledWith(
      { accept: false, clubId: 'club-e', invitationId: 'p1' },
      expect.any(Object),
    );
  });

  it('C1 sans l’offre : la phrase de l’offre ne s’écrit pas', async () => {
    mockDemandes.data[0].offerIncluded = false;
    const arbre = await monter({ clubId: 'club-e', enabled: true });
    expect(textes(arbre).some((texte) => texte.includes('offre Club'))).toBe(false);
  });

  it('C2 la demande faite par le lien se lit : en attente, puis rattaché, ou refusée', async () => {
    const arbre = await monter({ clubId: 'club-e', enabled: true });
    expect(textes(arbre)).toContain('Ta demande de rattachement à la Ville de Démouville attend sa réponse.');
    mockDemandes = {
      data: [
        {
          canAnswer: false, collectivite: VILLE, documentId: 'r1', kind: 'attach_request', offerIncluded: true, state: 'refused',
        },
      ],
      error: null,
      isLoading: false,
    };
    const refus = await monter({ clubId: 'club-e', enabled: true });
    expect(textes(refus)).toContain('La Ville de Montrivage n’a pas accepté ta demande de rattachement.');
    expect(boutons(refus, 'Accepter')).toHaveLength(0);
  });

  it('C3 rien quand il n’y a aucune demande, ni pour qui ne dirige pas le club', async () => {
    mockDemandes = { data: [], error: null, isLoading: false };
    expect((await monter({ clubId: 'club-e', enabled: true })).toJSON()).toBeNull();
    mockDemandes = { data: undefined, error: new Error('403'), isLoading: false };
    expect((await monter({ clubId: 'club-e', enabled: false })).toJSON()).toBeNull();
    expect(mockLecture).toHaveBeenLastCalledWith('club-e', { enabled: false });
  });
});
