import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

import { EcussonVille } from '../components/BlocDeLaVille';
import CanauxDeLaVille from '../components/CanauxDeLaVille';
import { EcussonDuFil, IconeDuCanal } from '../components/FilDeLaVille';

// 🏛️ COLL-C4A3 (03/10/2026) — PLANCHE 47 : le canal des dirigeants, ses manques vus à la T9
// (design validé HY521H1 page 3, P3c-canal-tel écrans 1, 3, 7 et 8).
//
// Ce que ce témoin fige (ROUGE avant le lot) :
//   - la ligne épinglée « Dirigeants des clubs » du dirigeant porte l'HEURE du dernier message,
//     et la suit quand un message arrive (la liste se met à jour sans recharger : le serveur
//     réveille désormais la liste, admin COLL-C4A3-liste-temps-reel) ;
//   - sous les canaux de la Ville, les conversations du club ont leur titre : « Ton club »
//     (dirigeant, entraîneur, joueur, parent) ; la mairie, elle, a « Conversations » ;
//   - l'en-tête d'un fil de la Ville porte son icône ou son écusson : la tuile du canal ; pour la
//     conversation privée, l'écusson d'EN FACE (le club côté Ville, la Ville côté club).

/** @type {any} */
let mockMine;
/** @type {any} */
let mockCanaux;

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
  useMembresDuFil: () => ({ data: undefined }),
  useMesCanauxDeLaVille: () => mockCanaux,
}));

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

/**
 * Aujourd'hui, à cette heure (heure locale) : la liste montre l'heure, pas la date.
 * @param {number} heures - L'heure.
 * @param {number} minutes - Les minutes.
 * @returns {string} La date ISO.
 */
const aujourdhuiA = (heures, minutes) => {
  const date = new Date();
  date.setHours(heures, minutes, 0, 0);
  return date.toISOString();
};

/**
 * Le canal tel que la liste de la messagerie le porte, avec son dernier message.
 * @param {any} dernier - Le dernier message.
 * @param {number} [nonLus] - Les non-lus.
 * @returns {any[]} La liste.
 */
const listeAvec = (dernier, nonLus = 1) => [{
  documentId: 'canal-1',
  messages: [dernier],
  type: 'collectivite_dirigeants',
  unreadCount: nonLus,
}];

const aplatirTexte = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const navigation = { navigate: jest.fn() };

/** @type {any[]} */
const montes = [];
const monter = async (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(element);
  });
  montes.push(arbre);
  return arbre;
};

beforeEach(() => {
  mockMine = { data: { actualites: [SUBVENTIONS], collectivites: [VILLE] } };
  mockCanaux = { data: [LIGNE_DU_CANAL] };
});

afterEach(() => {
  while (montes.length) {
    const arbre = montes.pop();
    act(() => { arbre.unmount(); });
  }
});

describe('COLL-C4A3 — planche 47 : la ligne épinglée du dirigeant', () => {
  // 🏛️ R17-CANAUX (19/10, REC17-004, correction 2 du chef, §1 ter) — RÉÉCRIT. Côté membre, le
  // bloc épinglé (« Dirigeants des clubs », « Actualités de la Ville », « Ton club ») doublait la
  // ligne « Toute la ville » : il est parti. Les canaux sont des LIGNES de la liste
  // (MessagingIPH09.liste.test.js) ; la demande « mes canaux » part toujours (création au serveur).
  // L heure du dernier message est celle de la LIGNE de la liste (Messaging.js,
  // formatChatTimestamp).
  it('R17-CANAUX : plus de ligne épinglée, même quand un message arrive', async () => {
    const premier = {
      createdAt: aujourdhuiA(9, 30),
      message: 'Merci. Faites chacun votre demande.',
      sender: { firstname: 'Sophie', lastname: 'Leroy' },
      senderSignature: { nom: 'Ville de Montrivage', voix: 'ville' },
    };
    const arbre = await monter(
      <CanauxDeLaVille chats={listeAvec(premier)} navigation={navigation} />,
    );
    // ⏳ GARDE (19/10, décision « C » du chef) : la carte d'actualités peut rester (pas de
    // « Toute la ville » dans cette liste) ; le canal des dirigeants n'est plus épinglé, ni son
    // heure.
    const sansCanalEpingle = () => {
      expect(textes(arbre)).not.toContain('Dirigeants des clubs');
      expect(textes(arbre).filter((texte) => /^\d{2}:\d{2}$/.test(texte))).toEqual([]);
    };
    sansCanalEpingle();

    // Un message arrive (la socket a réécrit la liste) : la ligne suit, sans recharger.
    const suivant = {
      createdAt: aujourdhuiA(21, 5),
      message: 'Pour le 8, nos U15 peuvent passer à 19:00.',
      sender: { firstname: 'Karim', lastname: 'Benali' },
      senderSignature: { nom: 'AS Montrivage', voix: 'club' },
    };
    await act(async () => {
      arbre.update(<CanauxDeLaVille chats={listeAvec(suivant, 2)} navigation={navigation} />);
    });
    sansCanalEpingle();
  });

  it('canal encore vide : pas d’heure inventée', async () => {
    const arbre = await monter(<CanauxDeLaVille chats={[]} navigation={navigation} />);
    expect(textes(arbre).filter((texte) => /^\d{2}:\d{2}$/.test(texte))).toEqual([]);
  });
});

describe('COLL-C4A3 — planche 47 : « Ton club »', () => {
  // 🏛️ R17-CANAUX (19/10, REC17-004, correction 2 du chef, §1 ter) — RÉÉCRIT. Côté membre, le
  // bloc épinglé (« Dirigeants des clubs », « Actualités de la Ville », « Ton club ») doublait la
  // ligne « Toute la ville » : il est parti. Les canaux sont des LIGNES de la liste
  // (MessagingIPH09.liste.test.js) ; la demande « mes canaux » part toujours (création au serveur).
  it('R17-CANAUX : le dirigeant, plus de titre « Ton club » (rien à séparer)', async () => {
    const lus = textes(await monter(<CanauxDeLaVille chats={[]} navigation={navigation} />));
    expect(lus).not.toContain('Ton club');
  });

  it('R17-CANAUX : un entraîneur non plus', async () => {
    mockCanaux = { data: [] };
    expect(textes(await monter(<CanauxDeLaVille chats={[]} navigation={navigation} />)))
      .not.toContain('Ton club');
  });

  it('un membre d’un club rattaché à aucune Ville : rien, pas même « Ton club »', async () => {
    mockCanaux = { data: [] };
    mockMine = { data: { actualites: [], collectivites: [] } };
    const arbre = await monter(<CanauxDeLaVille chats={[]} navigation={navigation} />);
    expect(arbre.toJSON()).toBeNull();
  });

  // 🏛️ R17-CANAUX (19/10, REC17-004) — RÉÉCRIT : le titre « Conversations » séparait les cartes
  // de la mairie de ses conversations. Les cartes parties (« que des conversations », Adel), le
  // titre n'a plus rien à séparer : la liste commence sous la recherche.
  it('R17-CANAUX : la mairie, ni « Conversations » ni « Ton club »', async () => {
    mockCanaux = { data: [{ ...LIGNE_DU_CANAL, fonctions: ['gestionnaire'] }] };
    const arbre = await monter(
      <CanauxDeLaVille collectiviteId="ville-de-recette" espaceVille navigation={navigation} />,
    );
    expect(arbre.toJSON()).toBeNull();
  });
});

describe('COLL-C4A3 — planche 47 : l’écusson de l’en-tête d’un fil de la Ville', () => {
  const CANAL = { collectivite: VILLE, documentId: 'canal-1', type: 'collectivite_dirigeants' };
  const PRIVEE = {
    collectivite: VILLE,
    collectiviteClub: { documentId: 'club-fc', name: 'Montrivage FC' },
    documentId: 'privee-1',
    type: 'collectivite_club',
  };

  it('le canal des dirigeants : sa tuile, dès la route (avant que le fil soit lu)', async () => {
    expect((await monter(<EcussonDuFil chat={CANAL} />)).root.findAllByType(IconeDuCanal))
      .toHaveLength(1);
    expect((await monter(<EcussonDuFil chat={null} routeChatType="collectivite_dirigeants" />))
      .root.findAllByType(IconeDuCanal)).toHaveLength(1);
  });

  it('conversation privée : l’écusson du club côté Ville, de la Ville côté club', async () => {
    const cote = await monter(<EcussonDuFil chat={PRIVEE} espaceVille />);
    const logo = cote.root.findByType(ClubLogoMark);
    expect(logo.props.club).toEqual(PRIVEE.collectiviteClub);
    const club = await monter(<EcussonDuFil chat={PRIVEE} />);
    expect(club.root.findByType(EcussonVille).props.nom).toBe('Ville de Montrivage');
  });

  it('un fil ordinaire, ou un fil privé pas encore lu : rien', async () => {
    expect((await monter(<EcussonDuFil chat={{ type: 'team' }} />)).toJSON()).toBeNull();
    expect((await monter(<EcussonDuFil chat={null} routeChatType="collectivite_club" />)).toJSON())
      .toBeNull();
  });
});
