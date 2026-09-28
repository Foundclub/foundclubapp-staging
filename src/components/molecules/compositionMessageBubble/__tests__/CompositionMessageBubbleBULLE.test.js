import { QueryClientProvider } from '@tanstack/react-query';
// 🧱 LE MEME MODULE QUE GIFTEDCHAT : `lodash.isequal`, celui qu'il importe en
// tete de `Message/index.js` (voir `reactionsEnDirect.test.js`).
import isEqual from 'lodash.isequal';
import { memo } from 'react';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { invalidateAfterAction } from '@/domains/refresh/afterAction';

import { creerQueryClientDeTest } from '../../../../testSupport/queryClientDeTest';
import CompositionMessageBubble from '../CompositionMessageBubble';

// ==========================================================================
// BULLE (decision d'Adel du 29/09, « bulle A ») — REPONDRE PRESENT / ABSENT
// DEPUIS LA CARTE « COMPOSITION PUBLIEE » DU CANAL.
//
// 🔍 Constat de recette (tournee 3, 28/09, defaut 2) : en publiant, l'entraineur
// coche « Demander une reponse — Present / absent dans le canal »… et la carte
// publiee n'a AUCUN bouton. Il faut « Ouvrir » puis « Tu es convoque ».
//
// 🎯 Ce que ces temoins exigent :
//   1. un CONVOQUE voit Present et Absent dans la carte, sa reponse marquee ;
//   2. seulement si la convocation EN COURS demande une reponse ;
//   3. TOUJOURS A JOUR — une seule source, celle de « Tu es convoque »
//      (`GET /events/:id/convocation`), meme derriere la memoisation de
//      GiftedChat (le piege qui a deja fige les reactions, WHATSAPP3) ;
//   4. la MEME route que partout (`POST /events/:id/rsvp`), les memes refus ;
//   5. une carte DEPASSEE (version anterieure) : aucun bouton.
//
// 🧪 VRAI react-query, comme le temoin CONVOC de « Tu es convoque » : c'est le
// cache qui est en jeu, une doublure de `useQuery` rendrait tout vert sans rien
// prouver. Les SERVICES sont doubles une couche plus bas, et tiennent un
// « serveur » qui garde la reponse.
// ==========================================================================

const MOI = 'joueur-1';
const REMPLACANT = 'joueur-2';
const A_VENIR = '2099-06-14T16:00:00.000Z';
const PASSE = '2020-06-14T16:00:00.000Z';

const mockNavigate = jest.fn();
/** @type {any} */
let mockSnapshot;

/**
 * Le « serveur » de la convocation : il garde la reponse comme le vrai
 * (`event.participations` / `event.missings`), et compte ses lectures.
 */
const mockServeur = {
  lectures: 0,
  /** @type {Error | null} */
  refus: null,
  reponse: 'pending',
  requireResponse: true,
  version: 2,
};

/**
 * La mise au point de l'ecran, pilotable comme la vraie : quitter le canal,
 * y revenir. Un petit magasin externe, pour que `useIsFocused` redessine.
 */
const mockFocus = {
  /** @type {Set<() => void>} */
  abonnes: new Set(),
  valeur: true,
  /**
   * S'abonne aux changements de mise au point.
   * @param {() => void} rappel
   * @returns {() => void}
   */
  abonner(rappel) {
    mockFocus.abonnes.add(rappel);
    return () => { mockFocus.abonnes.delete(rappel); };
  },
  /**
   * Quitte le canal (`false`) ou y revient (`true`).
   * @param {boolean} valeur
   */
  poser(valeur) {
    mockFocus.valeur = valeur;
    mockFocus.abonnes.forEach((rappel) => rappel());
  },
};

jest.mock('@react-navigation/native', () => {
  const { useSyncExternalStore } = jest.requireActual('react');
  return {
    useIsFocused: () => useSyncExternalStore(mockFocus.abonner, () => mockFocus.valeur),
    useNavigation: () => ({ navigate: mockNavigate }),
  };
});

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('@/store/authRuntime', () => ({
  getAuthRuntimeSnapshot: () => mockSnapshot,
}));

jest.mock('@/services/event/eventService', () => ({
  getEventConvocation: jest.fn(() => {
    mockServeur.lectures += 1;
    return Promise.resolve({
      branches: [{
        published: {
          requireResponse: mockServeur.requireResponse,
          reservePlayerIds: ['joueur-2'],
          reserveSnapshotPlayers: [
            { documentId: 'joueur-2', firstname: 'Paul', lastname: 'Veuillet' },
          ],
          snapshotPlayers: [
            { documentId: 'joueur-1', firstname: 'Adel', lastname: 'Ferchichi' },
            { documentId: 'joueur-2', firstname: 'Paul', lastname: 'Veuillet' },
          ],
          sportContext: 'football',
          teams: [{
            id: 't1',
            placements: [{ playerId: 'joueur-1', positionX: 50, positionY: 20 }],
          }],
          version: mockServeur.version,
        },
        responses: {
          byPlayerId: { 'joueur-1': mockServeur.reponse, 'joueur-2': 'pending' },
        },
        team: { documentId: 'team-1', name: 'Aix-Perd en Buvette' },
      }],
      event: { date: '2099-06-14T16:00:00.000Z', documentId: 'evt-1', name: '' },
    });
  }),
  missingEvent: jest.fn(() => Promise.resolve({})),
  respondToEventRsvp: jest.fn((/** @type {string} */ _id, /** @type {string} */ reponse) => {
    if (mockServeur.refus) return Promise.reject(mockServeur.refus);
    mockServeur.reponse = reponse;
    return Promise.resolve({ changed: true });
  }),
}));

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, style }) => (
      <View style={style} testID="mini-terrain">{children}</View>
    ),
  };
});

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = genererCouleurs();
  const theme = {
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => theme };
});

// Le bouton du design system, reduit a ce qui se verifie : son titre, sa
// variante (c'est elle qui dit « ta reponse ») et son appui.
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity accessibilityLabel={title} onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

// La carte telle que le serveur la poste (`publishLineupShareToTeamChat`).
const COMPO = {
  eventAddress: 'Pélissanne (13330)',
  eventDate: A_VENIR,
  eventDisplayName: 'Match vs US Pelican',
  eventId: 'evt-1',
  eventName: 'Match vs US Pelican',
  manualPlayers: [],
  placements: [],
  publishedVersion: 2,
  reservePlayers: [{ documentId: REMPLACANT, firstname: 'Paul', lastname: 'Veuillet' }],
  schemaVersion: 3,
  snapshotPlayers: [
    { documentId: MOI, firstname: 'Adel', lastname: 'Ferchichi' },
    { documentId: REMPLACANT, firstname: 'Paul', lastname: 'Veuillet' },
  ],
  sport: 'football',
  sportContext: 'football',
  teamId: 'team-1',
  teamName: 'Aix-Perd en Buvette',
  teams: [{
    id: 't1',
    name: 'Aix-Perd en Buvette',
    placements: [{ playerId: MOI, positionX: 50, positionY: 20 }],
  }],
  type: 'lineup_share',
};

/**
 * Le comparateur de GiftedChat, recopie a l'identique de `Message/index.js`
 * (le meme que `reactionsEnDirect.test.js`, qui verifie qu'il n'a pas change).
 * @param {any} props Les props actuelles.
 * @param {any} nextProps Les suivantes.
 * @returns {boolean} Vrai pour NE PAS redessiner (convention de `memo`).
 */
const commeGiftedChat = (props, nextProps) => {
  const shouldUpdate = props.shouldUpdateMessage?.(props, nextProps)
    || !isEqual(props.currentMessage, nextProps.currentMessage)
    || !isEqual(props.previousMessage, nextProps.previousMessage)
    || !isEqual(props.nextMessage, nextProps.nextMessage);
  return !shouldUpdate;
};

/** Chaque rendu de la « bulle GiftedChat » (le mur de memoisation). */
/** @type {number[]} */
const rendusDuMur = [];

/**
 * La bulle telle que GiftedChat la monte : derriere son `memo`.
 * @param {any} props
 * @returns {any}
 */
function BulleBrute({ currentMessage }) {
  rendusDuMur.push(1);
  return <CompositionMessageBubble composition={currentMessage.composition} />;
}
const BulleGiftedChat = memo(BulleBrute, commeGiftedChat);

/** @type {any} */
let queryClient;
/** @type {any[]} */
const montes = [];

/**
 * Tout le texte visible de l'arbre rendu, concatene.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  const aplatir = (/** @type {any} */ enfants) => {
    if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
    if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
    if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
    return String(enfants);
  };
  return arbre.root.findAllByType(TexteRN)
    .map((/** @type {any} */ noeud) => aplatir(noeud.props.children))
    .join(' | ');
};

/**
 * Les boutons de reponse de la carte (par leur titre).
 * @param {any} arbre
 * @param {string} titre
 * @returns {any[]}
 */
const boutons = (arbre, titre) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.title === titre
    && typeof noeud.props?.variant === 'string');

/**
 * La variante du bouton qui porte ce titre : c'est elle qui dit « ta reponse ».
 * @param {any} arbre
 * @param {string} titre
 * @returns {string | undefined}
 */
const varianteDu = (arbre, titre) => boutons(arbre, titre)[0]?.props?.variant;

/**
 * Attend, borne par une CONDITION (20 tours au plus), que la carte ait lu.
 * @param {() => boolean} condition
 * @returns {Promise<void>}
 */
const attendre = async (condition) => {
  for (let tour = 0; tour < 20 && !condition(); tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
};

/**
 * Laisse passer quelques tours sans rien attendre de precis (pour prouver
 * qu'une chose N'arrive PAS).
 * @returns {Promise<void>}
 */
const laisserPasser = async () => {
  await attendre(() => false);
};

/**
 * Monte la carte dans le fil, derriere la memoisation de GiftedChat.
 * @param {any} [compo]
 * @returns {Promise<any>}
 */
const monterDansLeFil = async (compo = COMPO) => {
  const message = { _id: 'm1', composition: compo, text: '' };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        <BulleGiftedChat currentMessage={message} />
      </QueryClientProvider>,
    );
  });
  montes.push(arbre);
  return { arbre, message };
};

/**
 * Monte la carte et attend que les boutons de reponse soient arrives.
 * @param {any} [compo]
 * @returns {Promise<any>}
 */
const monterEtLire = async (compo = COMPO) => {
  const monte = await monterDansLeFil(compo);
  await attendre(() => boutons(monte.arbre, 'Absent').length > 0);
  return monte;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockSnapshot = { auth: { user: { documentId: MOI } } };
  mockServeur.lectures = 0;
  mockServeur.refus = null;
  mockServeur.reponse = 'pending';
  mockServeur.requireResponse = true;
  mockServeur.version = 2;
  mockFocus.valeur = true;
  rendusDuMur.length = 0;
  queryClient = creerQueryClientDeTest();
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
  queryClient.clear();
  jest.restoreAllMocks();
});

describe('BULLE — le convoqué répond Présent / Absent sans quitter le canal', () => {
  it('témoin 1 — convoqué + « Demander une réponse » : 2 boutons, réponse marquée', async () => {
    mockServeur.reponse = 'present';
    const { arbre } = await monterEtLire();

    expect(boutons(arbre, 'Présent')).toHaveLength(1);
    expect(boutons(arbre, 'Absent')).toHaveLength(1);
    expect(texteVisible(arbre)).toContain('Tu as répondu Présent');
    expect(varianteDu(arbre, 'Présent')).toBe('Primary');
    expect(varianteDu(arbre, 'Absent')).toBe('Secondary');
  });

  it('témoin 2 — pas encore de réponse : 2 boutons, la carte n’affirme rien', async () => {
    const { arbre } = await monterEtLire();

    expect(texteVisible(arbre)).not.toContain('Tu as répondu');
    expect(varianteDu(arbre, 'Présent')).toBe('Secondary');
    expect(varianteDu(arbre, 'Absent')).toBe('Secondary');
  });

  // Appui sur Absent : la route de reponse, puis « Tu as repondu Absent », sans
  // quitter le fil.
  it('témoin 3 — appui sur Absent : la route, puis « Tu as répondu Absent »', async () => {
    const { respondToEventRsvp } = jest.requireMock('@/services/event/eventService');
    mockServeur.reponse = 'present';
    const { arbre } = await monterEtLire();

    await act(async () => {
      arbre.root.findByProps({ accessibilityLabel: 'Absent' }).props.onPress();
    });
    await attendre(() => texteVisible(arbre).includes('Tu as répondu Absent'));

    // La MEME porte que « Tu es convoque » et que les cartes de liste.
    expect(respondToEventRsvp).toHaveBeenCalledTimes(1);
    expect(respondToEventRsvp.mock.calls[0].slice(0, 2)).toEqual(['evt-1', 'absent']);
    expect(texteVisible(arbre)).toContain('Tu as répondu Absent');
    expect(texteVisible(arbre)).not.toContain('Tu as répondu Présent');
    expect(varianteDu(arbre, 'Absent')).toBe('Primary');
    // Repondre ne fait pas partir sur un autre ecran.
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // Un REFUS du serveur (match passe, compte non convoque…) est dit, la reponse
  // ne bouge pas.
  it('témoin 4 — un REFUS du serveur est dit, la réponse ne bouge pas', async () => {
    const refus = new Error('Error applying RSVP: Event date must be in the future');
    mockServeur.refus = refus;
    const { arbre } = await monterEtLire();

    await act(async () => {
      arbre.root.findByProps({ accessibilityLabel: 'Présent' }).props.onPress();
    });
    await attendre(() => Alert.alert.mock.calls.length > 0);

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(texteVisible(arbre)).not.toContain('Tu as répondu');
    expect(varianteDu(arbre, 'Présent')).toBe('Secondary');
  });

  it('témoin 5 — boutons HORS du bouton-carte : un lecteur d’écran les atteint', async () => {
    const { TouchableOpacity } = jest.requireActual('react-native');
    const { arbre } = await monterEtLire();

    // Le premier « bouton » de l'arbre est la carte (elle mene a « Tu es
    // convoque ») ; un bouton imbrique dans un element accessible est
    // invisible pour VoiceOver et TalkBack.
    const carte = arbre.root.findAllByType(TouchableOpacity)[0];
    expect(carte.props.accessibilityRole).toBe('button');
    expect(carte.findAll((/** @type {any} */ n) => n.props?.title === 'Absent')).toHaveLength(0);
    expect(boutons(arbre, 'Absent')).toHaveLength(1);
  });
});

describe('BULLE — toujours à jour, MALGRÉ la mémoïsation de GiftedChat', () => {
  // Reponse changee AILLEURS (fiche, « Tu es convoque ») : la carte la montre, et
  // ce n'est pas GiftedChat qui l'a redessinee.
  it('témoin 6 — réponse changée AILLEURS : la carte la montre, sans GiftedChat', async () => {
    mockServeur.reponse = 'present';
    const { arbre, message } = await monterEtLire();
    expect(texteVisible(arbre)).toContain('Tu as répondu Présent');
    const rendusAvant = rendusDuMur.length;

    // 🪤 LE PIEGE : le fil se redessine avec le MEME message — GiftedChat
    // refuse de redessiner la bulle. Tout etat passe par ses props est fige.
    await act(async () => {
      arbre.update(
        <QueryClientProvider client={queryClient}>
          <BulleGiftedChat currentMessage={message} />
        </QueryClientProvider>,
      );
    });
    expect(rendusDuMur.length).toBe(rendusAvant);

    // Ce que font la fiche, « Tu es convoque » et les listes apres une reponse
    // reussie : `invalidateAfterAction(queryClient, 'answerEvent')`.
    mockServeur.reponse = 'absent';
    await act(async () => {
      await invalidateAfterAction(queryClient, 'answerEvent');
    });
    await attendre(() => texteVisible(arbre).includes('Tu as répondu Absent'));

    // 🎯 LE COEUR DU LOT : la carte dit la nouvelle reponse...
    expect(texteVisible(arbre)).toContain('Tu as répondu Absent');
    expect(varianteDu(arbre, 'Absent')).toBe('Primary');
    // ... et ce n'est PAS GiftedChat qui l'a redessinee : la bulle lit elle-meme.
    expect(rendusDuMur.length).toBe(rendusAvant);
  });

  it('témoin 7 — réponse changée sur un AUTRE appareil : relue au RETOUR', async () => {
    mockServeur.reponse = 'present';
    const { arbre } = await monterEtLire();
    const lecturesAvant = mockServeur.lectures;

    // On quitte le canal ; la reponse change sur un autre telephone (aucune
    // invalidation locale ne peut le savoir).
    await act(async () => { mockFocus.poser(false); });
    mockServeur.reponse = 'absent';

    // Retour dans les 30 s : la copie est fraiche, pas de relecture (borne).
    await act(async () => { mockFocus.poser(true); });
    await laisserPasser();
    expect(mockServeur.lectures).toBe(lecturesAvant);

    // On repart, et on revient plus tard : la copie a vieilli, la carte relit.
    await act(async () => { mockFocus.poser(false); });
    const maintenant = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => maintenant + 31_000);
    await act(async () => { mockFocus.poser(true); });
    await attendre(() => texteVisible(arbre).includes('Tu as répondu Absent'));

    expect(mockServeur.lectures).toBe(lecturesAvant + 1);
    expect(texteVisible(arbre)).toContain('Tu as répondu Absent');
  });

  // L'entraineur REPUBLIE pendant que le joueur est dans le canal : la carte
  // neuve (v3) arrive alors que la copie dit encore v2. Une carte plus recente
  // que la copie PROUVE que la copie a vieilli : elle relit, et c'est ELLE qui
  // porte les boutons — l'ancienne les perd, par la meme copie.
  it('témoin 13 — carte NEUVE (republication) : relue, elle seule a les boutons', async () => {
    const ancienne = await monterEtLire();
    const lecturesAvant = mockServeur.lectures;

    mockServeur.version = 3;
    const neuve = await monterDansLeFil({ ...COMPO, publishedVersion: 3 });
    await attendre(() => boutons(neuve.arbre, 'Absent').length > 0);

    expect(mockServeur.lectures).toBe(lecturesAvant + 1);
    expect(boutons(neuve.arbre, 'Absent')).toHaveLength(1);
    expect(boutons(ancienne.arbre, 'Absent')).toHaveLength(0);
  });
});

describe('BULLE — rien ne change pour les autres lecteurs', () => {
  it('témoin 8 — non convoqué (écarté, parent) : aucun bouton, aucune lecture', async () => {
    mockSnapshot = { auth: { user: { documentId: 'spectateur-9' } } };
    const { arbre } = await monterDansLeFil();
    await laisserPasser();

    expect(boutons(arbre, 'Présent')).toHaveLength(0);
    expect(boutons(arbre, 'Absent')).toHaveLength(0);
    expect(mockServeur.lectures).toBe(0);
  });

  it('témoin 9 — entraîneur de l’équipe, pas dans la compo : aucun bouton', async () => {
    mockSnapshot = {
      auth: { user: { documentId: 'coach-1', trainedTeams: [{ documentId: 'team-1' }] } },
    };
    const { arbre } = await monterDansLeFil();
    await laisserPasser();

    expect(boutons(arbre, 'Présent')).toHaveLength(0);
    expect(boutons(arbre, 'Absent')).toHaveLength(0);
  });

  it('témoin 10 — publiée SANS « Demander une réponse » : aucun bouton', async () => {
    mockServeur.requireResponse = false;
    const { arbre } = await monterDansLeFil();
    await attendre(() => mockServeur.lectures > 0);
    await laisserPasser();

    expect(boutons(arbre, 'Présent')).toHaveLength(0);
    expect(boutons(arbre, 'Absent')).toHaveLength(0);
  });

  // VIEILLE carte (version depassee) : aucun bouton ; seule la carte en cours repond.
  it('témoin 11 — VIEILLE carte (version dépassée) : aucun bouton', async () => {
    mockServeur.version = 3;
    const { arbre } = await monterDansLeFil({ ...COMPO, publishedVersion: 2 });
    await attendre(() => mockServeur.lectures > 0);
    await laisserPasser();

    expect(boutons(arbre, 'Présent')).toHaveLength(0);
    expect(boutons(arbre, 'Absent')).toHaveLength(0);
  });

  it('témoin 12 — match PASSÉ : aucun bouton, aucune lecture (refus serveur)', async () => {
    const { arbre } = await monterDansLeFil({ ...COMPO, eventDate: PASSE });
    await laisserPasser();

    expect(boutons(arbre, 'Présent')).toHaveLength(0);
    expect(boutons(arbre, 'Absent')).toHaveLength(0);
    expect(mockServeur.lectures).toBe(0);
  });
});
