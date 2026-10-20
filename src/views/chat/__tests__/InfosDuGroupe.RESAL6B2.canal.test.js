import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import InfosDuGroupe from '../InfosDuGroupe';

// RESA-L6B-2 (20/10/2026) — E-P12, LES INFOS DU CANAL D'UN COMPLEXE, CÔTÉ JOUEUR (planche EP12
// états 2 et 3 ; plan E-P12 ; serveur RESA-L4) : un membre voit le NOMBRE de membres (« Canal du
// complexe · 214 membres »), JAMAIS la liste (les membres ne se voient pas entre eux ; le serveur
// ne joint qu'eux-mêmes et les gérants, l'app masque ce qu'il reste) ; « Quitter le canal », et sa
// confirmation : « … Tu ne recevras plus ses nouvelles. Tu y reviendras en le remettant en favori.
// » (Q5). Le gérant, administrateur du canal, garde la liste (sa page E-G12 la montre). Montage du
// témoin InfosDuGroupe.test.js (MSG1A §3.16).

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      const gabarit = typeof repli === 'string' ? repli : repli?.defaultValue;
      if (typeof gabarit !== 'string') return cle;
      return gabarit.replace(/\{\{(\w+)\}\}/g, (_m, nom) => (
        repli?.[nom] !== undefined ? String(repli[nom]) : _m
      ));
    },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
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
  const Colors = generateColors();
  return { __esModule: true, default: () => ({ Colors }) };
});
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);

const CANAL = {
  groupName: 'Le Five de Montrivage',
  participants: [
    { documentId: 'moi', firstname: 'Adel', lastname: 'F' },
    { documentId: 'gerant', firstname: 'Marc', lastname: 'Duval' },
  ],
  participantsCount: 214,
  type: 'group',
};

/**
 * Monte les infos du canal.
 * @param {{ estAdmin?: boolean, meId?: string }} [options] - Qui regarde.
 * @returns {{ arbre: any, onQuitter: jest.Mock }} L'arbre, et « Quitter ».
 */
const rendre = ({ estAdmin = false, meId = 'moi' } = {}) => {
  const onQuitter = jest.fn();
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <InfosDuGroupe
        adminIds={['gerant']}
        chat={CANAL}
        estAdmin={estAdmin}
        meId={meId}
        onAjouter={jest.fn()}
        onBasculerAdmin={jest.fn()}
        onClose={jest.fn()}
        onEnvoyerUnMessage={jest.fn()}
        onQuitter={onQuitter}
        onRenommer={jest.fn()}
        onRetirer={jest.fn()}
        onSignaler={jest.fn()}
        visible
      />,
    );
  });
  return { arbre, onQuitter };
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''));
const parId = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === id && typeof n.props?.onPress === 'function',
)[0];

it('un membre : le nombre de membres, jamais la liste ; ni « Ajouter des membres »', () => {
  const { arbre } = rendre();
  expect(textes(arbre)).toContain('Canal du complexe · 214 membres');
  expect(arbre.root.findAll((/** @type {any} */ n) => (
    String(n.props?.testID || '').startsWith('infos-du-groupe-membre-')
  ))).toHaveLength(0);
  expect(textes(arbre)).not.toContain('Marc Duval');
  expect(parId(arbre, 'infos-du-groupe-ajouter')).toBeUndefined();
});

it('« Quitter le canal », puis sa confirmation (Q5), puis le départ', () => {
  const { arbre, onQuitter } = rendre();
  act(() => { parId(arbre, 'infos-du-groupe-quitter').props.onPress(); });
  expect(textes(arbre)).toEqual(expect.arrayContaining([
    'Quitter le canal',
    'Quitter le canal « Le Five de Montrivage » ? Tu ne recevras plus ses nouvelles. Tu y '
      + 'reviendras en le remettant en favori.',
    'Rester',
  ]));
  expect(textes(arbre)).not.toContain('Annuler');
  act(() => { parId(arbre, 'infos-du-groupe-confirmer-depart').props.onPress(); });
  expect(onQuitter).toHaveBeenCalled();
});

it('le gérant (administrateur) garde la liste des membres', () => {
  const { arbre } = rendre({ estAdmin: true, meId: 'gerant' });
  expect(arbre.root.findAll((/** @type {any} */ n) => (
    String(n.props?.testID || '').startsWith('infos-du-groupe-membre-')
  )).length).toBeGreaterThan(0);
});
