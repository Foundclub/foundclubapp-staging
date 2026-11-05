import { Platform, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { act, create } from 'react-test-renderer';

import LeagueLegalAcceptanceModal from '../LeagueLegalAcceptanceModal';

// LEAGUE-CADRE-SITE (05/11/2026) — la ligne a cocher du cadre League garde `flex: 0` sur le
// telephone ; le site a son propre style, parce que `flex: 0` y vaut `flex-basis: 0%` (0 px).
// Le site se prouve dans le vrai navigateur (web : tests/components/league-cadre-site.spec.ts) ;
// ici, ce que le correctif ne doit PAS changer sur le telephone, et ce que fait chaque portee.

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

jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  (/** @type {any} */ { children, isVisible }) => (isVisible ? children : null)
));

jest.mock('react-native-bouncy-checkbox', () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual('react');
  return forwardRef((/** @type {any} */ { isChecked, onPress }, /** @type {any} */ ref) => {
    useImperativeHandle(ref, () => ({ onCheckboxPress: () => onPress(!isChecked) }));
    return null;
  });
});

const PORTEES = [
  ['league_team_create', 4],
  ['league_team_invitation_accept', 4],
  ['league_team_join_request', 4],
  ['league_match_captain_proposal', 4],
  ['league_match_captain_acceptance', 4],
  ['league_match_venue_booking', 4],
  ['league_match_player_participation', 3],
];

const OS_D_ORIGINE = Platform.OS;
afterEach(() => {
  Platform.OS = OS_D_ORIGINE;
});

const monter = (/** @type {string} */ scope) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = create(<LeagueLegalAcceptanceModal isVisible scope={scope} />); });
  return () => arbre.root.findAllByType(TouchableWithoutFeedback);
};

describe('LEAGUE-CADRE-SITE — la ligne a cocher du cadre League', () => {
  it.each(['ios', 'android'])('%s : le style de la ligne ne change pas (flex: 0)', (os) => {
    // @ts-expect-error Platform.OS est en lecture seule dans les types
    Platform.OS = os;
    const lignes = monter('league_team_create')();
    expect(lignes).toHaveLength(4);
    lignes.forEach((/** @type {any} */ ligne) => {
      const style = StyleSheet.flatten(ligne.props.children.props.style);
      expect(style.flex).toBe(0);
      expect(style.width).toBe('100%');
      expect(style.flexBasis).toBeUndefined();
      expect(style.flexGrow).toBeUndefined();
      expect(style.flexShrink).toBeUndefined();
    });
  });

  it.each(PORTEES)('%s : %i cases, et chaque appui coche la sienne', (
    /** @type {any} */ scope,
    /** @type {any} */ cases,
  ) => {
    const lignes = monter(scope);
    expect(lignes()).toHaveLength(cases);

    for (let rang = 0; rang < cases; rang += 1) {
      act(() => { lignes()[rang].props.onPress(); });
      expect(lignes().map((/** @type {any} */ ligne) => ligne.props.accessibilityState.checked))
        .toEqual(Array.from({ length: cases }, (_, autre) => autre <= rang));
    }
  });
});
