import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteCanalMembres from '../CollectiviteCanalMembres';
import CanauxDeLaVille from '../components/CanauxDeLaVille';
import { FilDeLaVilleQuitte } from '../components/FilDeLaVille';

// 🏛️ COLL-C4A2 (02/10) — PLANCHE 1 : le canal des dirigeants, côté écrans (design HY521H1
// page 3, P3c-canal-tel écrans 2, 3, 6 et 7 ; P3v2-messages-tel écran 1).
//
// Ce que ce témoin fige (ROUGE avant le lot : aucun canal des dirigeants nulle part) :
//   - la mairie, dans son onglet « Messages » : sous les actualités, « Dirigeants des clubs »,
//     « Vous et les dirigeants des 3 clubs · échanges de créneaux », vers le canal (voix de la
//     Ville) ;
//   - le dirigeant : épinglé au-dessus des actualités de sa Ville, avec le dernier message signé
//     et ses non-lus ; un entraîneur (sans canal) ne le voit pas ;
//   - « Dans ce canal » : la Ville et ses gestionnaires, chaque club et ses dirigeants, la règle,
//     ni « Ajouter » ni « Retirer » ; un club détaché lit « Tu ne fais plus partie de ce canal ».

/** @type {any} */
let mockMine;
/** @type {any} */
let mockCanaux;
/** @type {any} */
let mockMembres;
/** @type {any} */
let mockParams;
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate, setOptions: mockSetOptions }),
  useRoute: () => ({ params: mockParams }),
}));

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

jest.mock('@/services/collectivite/collectiviteActualiteQueries', () => ({
  useMesActualitesDeLaVille: () => mockMine,
}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => ({
    data: [{ documentId: 'a' }, { documentId: 'b' }, { documentId: 'c' }],
  }),
  useMyCollectivites: () => ({ data: [VILLE] }),
}));
jest.mock('@/services/collectivite/collectiviteCanauxQueries', () => ({
  useMembresDuFil: () => mockMembres,
  useMesCanauxDeLaVille: () => mockCanaux,
}));
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });

const VILLE = { documentId: 'ville-de-recette', name: 'Ville de Montrivage' };
const LIGNE_DU_CANAL = {
  canal: { documentId: 'canal-1' },
  clubsCount: 3,
  collectivite: VILLE,
  fonctions: ['dirigeant'],
};
const SUBVENTIONS = {
  category: 'subventions',
  collectivite: VILLE,
  documentId: 'actu-subventions',
  publishedAt: '2026-09-21T08:00:00.000Z',
  title: 'Subventions 2027',
};

const aplatirTexte = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};
const monter = async (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(element);
  });
  return arbre;
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const trouver = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID && typeof n.type !== 'string',
);
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  await act(async () => {
    trouver(arbre, testID)[0].props.onPress();
  });
};
const navigation = { navigate: mockNavigate };

beforeEach(() => {
  mockMine = { data: { actualites: [SUBVENTIONS], collectivites: [VILLE] } };
  mockCanaux = { data: [{ ...LIGNE_DU_CANAL, fonctions: ['gestionnaire'] }] };
  mockMembres = { data: undefined, isLoading: true };
  mockParams = { chatId: 'canal-1', espace: 'ville' };
  mockNavigate.mockReset();
  mockSetOptions.mockReset();
  mockGoBack.mockReset();
});

describe('COLL-C4A2 — planche 1 : le canal des dirigeants dans la messagerie', () => {
  // 🏛️ R17-CANAUX (19/10, REC17-004) — RÉÉCRITS. Adel : « le canal des dirigeants doit être
  // comme les autres ». La carte « Dirigeants des clubs » de la mairie, sous ses actualités, a
  // quitté le haut de « Messages » : le canal est une LIGNE de la liste, qu'on épingle et
  // qu'on archive (MessagingIPH09.liste.test.js, « R17-CANAUX »).
  it('R17-CANAUX : la mairie, plus de carte « Dirigeants des clubs » au-dessus', async () => {
    const arbre = await monter(
      <CanauxDeLaVille collectiviteId="ville-de-recette" espaceVille navigation={navigation} />,
    );
    expect(trouver(arbre, 'canal-dirigeants-mairie')).toHaveLength(0);
    expect(arbre.toJSON()).toBeNull();
  });

  it('R17-CANAUX : la mairie, avant que le serveur rende son canal : rien non plus', async () => {
    mockCanaux = { data: undefined, isLoading: true };
    const arbre = await monter(
      <CanauxDeLaVille collectiviteId="ville-de-recette" espaceVille navigation={navigation} />,
    );
    expect(arbre.toJSON()).toBeNull();
  });

  // 🏛️ R17-CANAUX (19/10, REC17-004, correction 2 du chef, §1 ter) — RÉÉCRIT. Côté membre, le
  // bloc épinglé (« Dirigeants des clubs », « Actualités de la Ville », « Ton club ») doublait la
  // ligne « Toute la ville » : il est parti. Les canaux sont des LIGNES de la liste
  // (MessagingIPH09.liste.test.js) ; la demande « mes canaux » part toujours (création au serveur).
  it('R17-CANAUX : le dirigeant, plus de carte « Dirigeants des clubs » épinglée', async () => {
    mockCanaux = { data: [LIGNE_DU_CANAL] };
    const chats = [{
      documentId: 'canal-1',
      messages: [{
        message: 'Merci. Faites chacun votre demande.',
        sender: { firstname: 'Sophie', lastname: 'Leroy' },
        senderSignature: { nom: 'Ville de Montrivage', voix: 'ville' },
      }],
      type: 'collectivite_dirigeants',
      unreadCount: 1,
    }];
    const arbre = await monter(<CanauxDeLaVille chats={chats} navigation={navigation} />);
    expect(arbre.toJSON()).toBeNull();
    expect(trouver(arbre, 'canal-dirigeants-ville-de-recette')).toHaveLength(0);
  });

  it('R17-CANAUX : un entraîneur, ni carte d’actualités ni canal épinglé', async () => {
    mockCanaux = { data: [] };
    const arbre = await monter(<CanauxDeLaVille chats={[]} navigation={navigation} />);
    expect(arbre.toJSON()).toBeNull();
  });
});

describe('COLL-C4A2 — planche 1 : « Dans ce canal »', () => {
  it('la Ville et ses gestionnaires, chaque club et ses dirigeants ; rien à ajouter', async () => {
    mockMembres = {
      data: {
        chat: { documentId: 'canal-1', type: 'collectivite_dirigeants' },
        club: null,
        clubsCount: 2,
        collectivite: VILLE,
        groupes: [
          {
            cle: 'ville',
            membres: [{
              estMoi: true, firstname: 'Sophie', fonction: 'gestionnaire', lastname: 'Leroy',
            }],
            nom: 'Ville de Montrivage',
          },
          {
            cle: 'club',
            club: { documentId: 'club-as', logo: null, name: 'AS Montrivage' },
            membres: [{
              estMoi: false, firstname: 'Karim', fonction: 'dirigeant', lastname: 'Benali',
            }],
            nom: 'AS Montrivage',
          },
          {
            cle: 'club',
            club: { documentId: 'club-fc', logo: null, name: 'Montrivage FC' },
            membres: [],
            nom: 'Montrivage FC',
          },
        ],
      },
      isLoading: false,
    };
    const arbre = await monter(<CollectiviteCanalMembres />);
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Dirigeants des clubs · Ville de Montrivage',
      'Ville de Montrivage',
      'Sophie Leroy (vous)',
      'gestionnaire',
      'AS Montrivage',
      'Karim Benali',
      'dirigeant',
      'Montrivage FC',
      'Aucun dirigeant sur l’app pour l’instant.',
      // eslint-disable-next-line max-len
      'Un club rattaché y entre avec ses dirigeants ; un club détaché en sort. Les entraîneurs, les joueurs et les parents n’y sont pas.',
    ]));
    expect(lus.join(' ')).not.toMatch(/Ajouter|Retirer/);
    expect(mockSetOptions).toHaveBeenCalledWith({ headerTitle: 'Dans ce canal' });
  });

  it('côté dirigeant, « (toi) » ; un club détaché lit qu’il n’en fait plus partie', async () => {
    mockParams = { chatId: 'canal-1' };
    mockMembres = {
      data: {
        chat: { documentId: 'canal-1', type: 'collectivite_dirigeants' },
        collectivite: VILLE,
        groupes: [{
          cle: 'club',
          club: { documentId: 'club-as', name: 'AS Montrivage' },
          membres: [{
            estMoi: true, firstname: 'Karim', fonction: 'dirigeant', lastname: 'Benali',
          }],
          nom: 'AS Montrivage',
        }],
      },
      isLoading: false,
    };
    const arbre = await monter(<CollectiviteCanalMembres />);
    expect(textes(arbre)).toContain('Karim Benali (toi)');
    mockMembres = {
      data: undefined,
      error: {
        response: { data: { error: { details: { code: 'COLLECTIVITE_CANAL_NOT_MEMBER' } } } },
      },
      isLoading: false,
    };
    const refuse = await monter(<CollectiviteCanalMembres />);
    expect(textes(refuse)).toContain('Tu ne fais plus partie de ce canal');
  });

  it('la conversation privée a son propre « Tu ne fais plus partie »', async () => {
    const onRetour = jest.fn();
    const arbre = await monter(<FilDeLaVilleQuitte estCanal={false} onRetour={onRetour} />);
    expect(textes(arbre)).toContain('Tu ne fais plus partie de cette conversation');
    await appuyer(arbre, 'fil-de-la-ville-retour');
    expect(onRetour).toHaveBeenCalled();
  });
});
