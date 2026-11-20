/* eslint-disable max-len, react/jsx-props-no-spreading -- les témoins se lisent en entier ; le harnais passe les propriétés du cas. */
import renderer, { act } from 'react-test-renderer';

import TournamentTeamProgress from '../TournamentTeamProgress';

// RETOUCHES-R50 (20/11/2026, tournée de photos de la recette 50, écran 8e, reco « avant » suivie
// par Adel) — quelqu'un HORS de l'équipe lisait « 5 payés sur 5 : ton équipe joue le tournoi » sur la
// page d'une équipe validée : la phrase des membres passait avant la règle du visiteur
// (`viewerIsMember`). « Présent » reste visible (D277 Q5) : seul ce texte change.
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

const membre = (/** @type {string} */ id, /** @type {any} */ user, /** @type {any} */ extra = {}) => ({
  documentId: id, responseStatus: 'present', role: 'member', user, ...extra,
});
// 4 joueurs, 3 payés (planche 4a) : Karim (capitaine), Nassim, Lucas payés ; Sami doit sa place.
const QUATRE = [
  membre('k', { documentId: 'u-k', firstname: 'Karim', lastname: 'Benali' }, { role: 'captain' }),
  membre('n', { documentId: 'u-n', firstname: 'Nassim', lastname: 'Amrani' }),
  membre('l', { documentId: 'u-l', firstname: 'Lucas', lastname: 'Martin' }),
  membre('s', { documentId: 'u-s', firstname: 'Sami', lastname: 'Haddad' }),
];

/** @type {any[]} */
const montes = [];
const monter = (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre = null;
  act(() => { arbre = renderer.create(<TournamentTeamProgress detailed teamStatus="pending" tournamentConfig={{}} {...props} />); });
  montes.push(arbre);
  return arbre;
};
const texte = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.type === 'Text')
  .map((/** @type {any} */ n) => [].concat(n.props.children).join('')).join(' | ');
afterEach(() => { act(() => { montes.splice(0).forEach((arbre) => arbre.unmount()); }); });

const VALIDEE = { members: [], paidCount: 5, paidMembersToValidate: 5 };

describe('RETOUCHES-R50 8e : équipe validée lue par quelqu’un qui n’en est pas', () => {
  test('🔴 non-membre : « l’équipe joue le tournoi », jamais « ton équipe »', () => {
    const contenu = texte(monter({
      members: QUATRE, payment: VALIDEE, teamStatus: 'accepted', viewerIsMember: false,
    }));
    expect(contenu).toContain('Équipe validée');
    expect(contenu).toContain('5 payés sur 5 : l’équipe joue le tournoi.');
    expect(contenu).not.toContain('ton équipe');
    expect(contenu).not.toContain('Tu peux encore ajouter des joueurs');
  });

  test('caractérisant : un membre garde « ton équipe joue le tournoi »', () => {
    const contenu = texte(monter({ members: QUATRE, payment: VALIDEE, teamStatus: 'accepted' }));
    expect(contenu).toContain('5 payés sur 5 : ton équipe joue le tournoi. Tu peux encore ajouter des joueurs.');
  });
});
