import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PollMessageBubble from '../PollMessageBubble';

// MSG1A (§3.4) — E6 : LE TEMOIN CARACTERISANT DE LA BULLE DE SONDAGE, ECRIT AVANT LE RESTYLE.
//
// La bulle n'avait AUCUN temoin direct (doublee dans les 11 suites de l'ecran). Ce qui doit
// survivre au nouveau dessin du pack : un appui sur une option vote pour ELLE ; « ouvrir le
// detail » reste atteignable ; un sondage anonyme ne nomme personne ; mon vote se voit ;
// rien ne s'affiche pour autre chose qu'un sondage.
// Les blocs P1-P5 sont verts AVANT et APRES ; P6-P8 decrivent le pack (rouges avant).

// SONDAGE-NOMS — le crochet qui lit les noms au serveur est double : ce temoin ne parle qu'a
// la bulle ; les profils rendus par le serveur se reglent par `mockProfils`.
let mockProfils = new Map();
jest.mock('@/domains/messaging/usePollVoterProfiles', () => ({
  __esModule: true,
  default: () => mockProfils,
  nameOfPollVoter: (/** @type {any} */ profil) => (
    `${String(profil?.firstname || '').trim()} ${String(profil?.lastname || '').trim()}`.trim()
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : repli?.defaultValue || cle
    ),
  }),
}));

jest.mock('react-native-svg', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    Circle: VueRN,
    default: VueRN,
    Line: VueRN,
    Path: VueRN,
    Polyline: VueRN,
    Rect: VueRN,
    Svg: VueRN,
  };
});

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return { __esModule: true, default: () => ({ Colors, Fonts: generateFonts(Colors) }) };
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => <VueRN testID={`avatar-${props.name}`} />,
  };
});

const SONDAGE = {
  allowMultipleVotes: false,
  isAnonymous: false,
  options: [
    { id: 'o1', label: 'Mardi 19h', voters: ['a', 'b'] },
    { id: 'o2', label: 'Jeudi 20h', voters: ['moi'] },
    { id: 'o3', label: 'Samedi 10h', voters: [] },
  ],
  question: 'Quel creneau ?',
  type: 'poll',
};

const NOMS = { a: 'Karim Benali', b: 'Lea Morel', moi: 'Adel F' };

/**
 * Aide du temoin : `rendre`.
 * @param {any} props
 * @returns {any} L'arbre rendu.
 */
const rendre = (props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <PollMessageBubble
        currentUserId="moi"
        nomMasqueDuVotant={props.nomMasqueDuVotant}
        onOpenDetails={props.onOpenDetails}
        onVote={props.onVote}
        poll={props.poll ?? SONDAGE}
        resolveVoterName={(id) => NOMS[id] || 'Membre'}
      />,
    );
  });
  return arbre;
};

const textes = (arbre) => arbre.root.findAllByType(Text)
  .map((n) => [].concat(n.props.children).join(''));

describe('MSG1A — PollMessageBubble (caracterisation)', () => {
  test('P1 — appuyer sur une option vote pour ELLE', () => {
    const onVote = jest.fn();
    const arbre = rendre({ onVote });

    // Le bouton le plus INTERIEUR qui contient le libelle de l'option.
    const option = arbre.root
      .findAllByType(TouchableOpacity)
      .reverse()
      .find(
        (n) => n.findAll(
          (c) => c.type === Text && [].concat(c.props.children).join('') === 'Jeudi 20h',
        )
          .length > 0,
      );
    act(() => {
      option.props.onPress({ stopPropagation: () => {} });
    });

    expect(onVote).toHaveBeenCalledWith('o2');
  });

  test('P2 — le detail des votes reste atteignable', () => {
    const onOpenDetails = jest.fn();
    const arbre = rendre({ onOpenDetails, onVote: jest.fn() });

    const ouvrir = arbre.root
      .findAllByType(TouchableOpacity)
      .find((n) => n.props.onPress === onOpenDetails);
    act(() => {
      ouvrir.props.onPress();
    });

    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  test('P3 — la question et les trois options sont lues', () => {
    const arbre = rendre({ onVote: jest.fn() });

    expect(textes(arbre)).toEqual(
      expect.arrayContaining(['Quel creneau ?', 'Mardi 19h', 'Jeudi 20h', 'Samedi 10h']),
    );
  });

  test('P4 — un sondage ANONYME ne montre aucun votant', () => {
    const arbre = rendre({ onVote: jest.fn(), poll: { ...SONDAGE, isAnonymous: true } });

    expect(
      arbre.root.findAll((n) => String(n.props?.testID || '').startsWith('avatar-')),
    ).toHaveLength(0);
    expect(textes(arbre).join(' ')).not.toContain('Karim');
  });

  test('P5 — autre chose qu un sondage : rien', () => {
    const arbre = rendre({ poll: { type: 'proposal' } });

    expect(arbre.toJSON()).toBeNull();
  });

  test('P6 — le pack : la consigne dit « un choix » et le mode anonyme', () => {
    expect(textes(rendre({ onVote: jest.fn() }))).toContain('Sélectionne une option');
    expect(
      textes(
        rendre({
          onVote: jest.fn(),
          poll: { ...SONDAGE, allowMultipleVotes: true, isAnonymous: true },
        }),
      ),
    ).toContain('Sélectionne une ou plusieurs options · anonyme');
  });

  test('P7 — le pack : mon option porte le rond COCHE, les autres un rond vide', () => {
    const arbre = rendre({ onVote: jest.fn() });

    expect(
      arbre.root.findAll(
        (n) => n.props?.testID === 'sondage-rond-coche' && typeof n.type === 'string',
      ),
    ).toHaveLength(1);
    expect(
      arbre.root.findAll(
        (n) => n.props?.testID === 'sondage-rond-vide' && typeof n.type === 'string',
      ),
    ).toHaveLength(2);
  });

  test('P8 — le pack : 2 avatars de votants au plus par option, et le compte', () => {
    const arbre = rendre({ onVote: jest.fn() });

    expect(
      arbre.root.findAll(
        (n) => String(n.props?.testID || '').startsWith('avatar-') && typeof n.type === 'string',
      ),
    ).toHaveLength(3);
    expect(textes(arbre)).toEqual(expect.arrayContaining(['2', '1', '0']));
  });

  // MSG1A — demande de MESSAGERIE-1W (tranchee oui par le chef, 07/10) : avec `onOpenDetails`,
  // l'ancienne bulle faisait de TOUTE la carte un bouton qui CONTENAIT les boutons de vote
  // (HTML invalide sur le site, votes injoignables au lecteur d'ecran). Le pack met « Voir les
  // votes » en PIED : aucune option de vote n'est rangee dans le bouton du detail.
  test('P9 — « Voir les votes » est un bouton de PIED, qui ne contient aucune option', () => {
    const onOpenDetails = jest.fn();
    const arbre = rendre({ onOpenDetails, onVote: jest.fn() });
    const detail = arbre.root
      .findAllByType(TouchableOpacity)
      .filter((n) => n.props.onPress === onOpenDetails);

    expect(detail).toHaveLength(1);
    const dedans = detail[0].findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
    expect(dedans.join(' ')).not.toMatch(/Mardi 19h|Jeudi 20h|Samedi 10h/);
  });

  // MSG1A x SONDAGE-NOMS — le nom lu au SERVEUR l'emporte (un fil de club n'a pas de
  // participants) : il est sur la pastille du votant et dans l'etiquette de l'option.
  test('P10 — le nom du serveur nomme le votant : pastille et etiquette, jamais « Membre »', () => {
    mockProfils = new Map([['a', { documentId: 'a', firstname: 'Leo', lastname: 'Martin' }]]);
    const arbre = rendre({ onVote: jest.fn() });
    mockProfils = new Map();

    const avatars = arbre.root.findAll((n) => n.props?.testID === 'avatar-Leo Martin');
    expect(avatars.length).toBeGreaterThan(0);
    const option = arbre.root.findAll(
      (n) => n.props?.testID === 'sondage-option-o1'
        && typeof n.props?.accessibilityLabel === 'string',
    )[0];
    expect(option.props.accessibilityLabel).toContain('Leo Martin');
    expect(option.props.accessibilityLabel).not.toContain('Membre');
  });

  // ANONSITE — un fil de ligue avant le match : le serveur nomme l'adversaire qui a vote, mais
  // le masque de l'ecran passe devant (pastille et etiquette), et sa photo ne sort pas.
  test('P12 — le masque de l ecran passe devant le nom du serveur', () => {
    mockProfils = new Map([['a', { documentId: 'a', firstname: 'Leo', lastname: 'Martin' }]]);
    const arbre = rendre({
      nomMasqueDuVotant: (/** @type {string} */ id) => (id === 'a' ? 'Joueur Adverse' : ''),
      onVote: jest.fn(),
    });
    mockProfils = new Map();

    expect(arbre.root.findAll((n) => n.props?.testID === 'avatar-Leo Martin')).toHaveLength(0);
    const option = arbre.root.findAll(
      (n) => n.props?.testID === 'sondage-option-o1'
        && typeof n.props?.accessibilityLabel === 'string',
    )[0];
    expect(option.props.accessibilityLabel)
      .toBe('Mardi 19h, conversation.poll.bubble.votes, Joueur Adverse, Lea Morel');
  });

  // MSG1A x SECU-SONDAGE-ANONYME — un sondage anonyme du serveur neuf ne porte que des
  // COMPTEURS ; l'app y pose MON choix (`voters: [moi]` sur mes options). La bulle : mon option
  // cochee, les compteurs du serveur, et AUCUN votant (ni pastille, ni nom, meme pas moi).
  test('P11 — anonyme du serveur neuf : mon choix coche, ses compteurs, aucun votant', () => {
    const anonyme = {
      ...SONDAGE,
      isAnonymous: true,
      options: [
        {
          id: 'o1',
          label: 'Mardi 19h',
          voteCount: 4,
          voters: [],
        },
        {
          id: 'o2',
          label: 'Jeudi 20h',
          voteCount: 3,
          voters: ['moi'],
        },
        {
          id: 'o3',
          label: 'Samedi 10h',
          voteCount: 0,
          voters: [],
        },
      ],
    };
    const arbre = rendre({ onVote: jest.fn(), poll: anonyme });

    const coche = arbre.root.findAll(
      (n) => n.props?.testID === 'sondage-rond-coche' && typeof n.type === 'string',
    );
    expect(coche).toHaveLength(1);
    expect(textes(arbre)).toEqual(expect.arrayContaining(['4', '3', '0']));
    expect(
      arbre.root.findAll((n) => String(n.props?.testID || '').startsWith('avatar-')),
    ).toHaveLength(0);
    const etiquettes = arbre.root
      .findAll((n) => typeof n.props?.accessibilityLabel === 'string')
      .map((n) => n.props.accessibilityLabel)
      .join(' | ');
    expect(etiquettes).not.toMatch(/Adel|Karim|Lea|Membre/);
  });
});

// CORR-SOCLE (30/10, point 1 de la recette du site) — la carte fait 294 px (pack) : à 390 px sur
// le site, le fil n'en offre que 262 et la carte débordait à droite. Elle garde 294 px quand la
// place existe et ne dépasse plus son parent.
describe('CORR-SOCLE point 1 — la carte de sondage ne dépasse pas le fil', () => {
  test('carte seule : 294 px au plus, jamais plus que son parent', () => {
    const { StyleSheet, View } = jest.requireActual('react-native');
    const arbre = rendre({});
    const carte = arbre.root.findAllByType(View)
      .map((n) => StyleSheet.flatten(n.props.style) || {})
      .find((s) => s.width === 294);
    expect(carte.maxWidth).toBe('100%');
  });
});
