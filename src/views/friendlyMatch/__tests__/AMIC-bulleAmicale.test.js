import { StyleSheet, Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// eslint-disable-next-line max-len
import ProposalMessageBubble from '@/components/molecules/proposalMessageBubble/ProposalMessageBubble';

// AMICAUX-CORRECTIFS (13/10) — la bulle « Proposition » d un match AMICAL.
//   82 : le petit mot du proposeur (`staffMessage`, pose par le serveur depuis ce lot) n etait
//        que dans le texte de secours, que la bulle ne dessine pas.
//   71 : l or est celui de la League (decision de design du 01/10). Adel, 12/10 ~23h21,
//        « ok reco » : la bulle d un amical prend une couleur FoundClub (cyan ; orange
//        d avertissement pour « En attente »). La bulle LEAGUE, elle, ne bouge pas.

// Le VRAI theme, monte sans son fournisseur (meme montage que friendlyProposalInChat.test.js).
jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Spaces,
    }),
  };
});

const Colors = jest.requireActual('@/theme/colors').default();
const OR_DE_LA_LEAGUE = 'rgba(212, 175, 55, 0.9)';

/** La charge que le serveur pose dans le fil (friendly-match-workflow, depuis AMIC-82). */
const AMICAL = {
  adId: 'ad-1',
  applicationId: 'app-1',
  canAcceptUserIds: ['user-auteur'],
  categoryLabel: 'U13',
  dateLabel: 'samedi 24 octobre',
  hostTeamName: 'Montrivage Olympique',
  kind: 'friendly_match',
  levelLabel: 'Départemental',
  sectionLabel: 'Mixte',
  staffMessage: 'On amène les maillots blancs.',
  status: 'pending',
  teamName: 'Valbrune U13',
  timeLabel: 'de 14:00 à 16:00',
  type: 'proposal',
  venue: 'Stade du Moulin',
};
/** Une proposition LEAGUE : ni `kind`, ni ligne d amical. */
const LEAGUE = {
  date: '2099-10-24T12:00:00.000Z',
  endDate: '2099-10-24T14:00:00.000Z',
  matchId: 'match-1',
  status: 'pending',
  type: 'proposal',
  venue: 'Five de Valbrune',
};

const rendre = (/** @type {any} */ proposal) => {
  let rendu;
  act(() => {
    rendu = renderer.create(<ProposalMessageBubble allowResponseActions proposal={proposal} />);
  });
  return /** @type {any} */ (rendu);
};
const textes = (/** @type {any} */ rendu) => rendu.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => noeud.props.children)
  .filter((/** @type {any} */ valeur) => typeof valeur === 'string');
const cadre = (/** @type {any} */ rendu) => StyleSheet.flatten(
  rendu.root.findAllByType(View)[0].props.style,
);
const couleurDuBadge = (/** @type {any} */ rendu, /** @type {string} */ libelle) => {
  const badge = rendu.root.findAllByType(Text)
    .find((/** @type {any} */ noeud) => noeud.props.children === libelle);
  return StyleSheet.flatten(badge.props.style).color;
};

describe('AMIC — la bulle d un match amical', () => {
  test('82 — le petit mot du proposeur est DANS la bulle, sous son libelle', () => {
    const lignes = textes(rendre(AMICAL));
    expect(lignes).toContain('On amène les maillots blancs.');
    expect(lignes[lignes.indexOf('On amène les maillots blancs.') - 1]).toBe('Message');
  });

  test('82 PROTEGE — sans petit mot, aucune ligne « Message » vide', () => {
    expect(textes(rendre({ ...AMICAL, staffMessage: undefined }))).not.toContain('Message');
  });

  test('71 — le cadre d un amical n est plus l or de la League', () => {
    expect(cadre(rendre(AMICAL)).borderColor).not.toBe(OR_DE_LA_LEAGUE);
  });

  test('71 — « En attente de ta reponse » d un amical est orange d avertissement', () => {
    expect(couleurDuBadge(rendre(AMICAL), 'En attente de ta réponse')).toBe(Colors.warning500);
  });

  test('71 PROTEGE — la bulle LEAGUE garde son or, cadre et badge', () => {
    const rendu = rendre(LEAGUE);
    expect(cadre(rendu).borderColor).toBe(OR_DE_LA_LEAGUE);
    expect(couleurDuBadge(rendu, 'En attente de ta réponse')).toBe(Colors.gold500);
  });
});
