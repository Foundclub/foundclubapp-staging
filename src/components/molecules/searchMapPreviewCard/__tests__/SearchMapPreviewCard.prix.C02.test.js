import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SearchMapPreviewCard from '@/components/molecules/searchMapPreviewCard/SearchMapPreviewCard';

// BUGHUNT C02 (25/10/2026) — Q1-14 : l'aperçu d'une réservation sur la carte ne gardait que deux
// pastilles (date, heure) : le prix, propre aux réservations, n'apparaissait jamais. Les autres
// cartes (événements, clubs) gardent leurs deux pastilles.

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));
jest.mock('@/components/atoms/marqueeText/MarqueeText', () => () => null);

const REPERE = {
  dateLabel: 'Sam. 25/10',
  distanceLabel: '1,2 km',
  id: 'r1',
  imageUrl: '',
  priceLabel: '8 EUR',
  subtitle: 'Paris',
  timeLabel: '18:00 - 19:00',
  title: 'Five Paris',
};

/**
 * Les textes affichés par l'aperçu.
 * @param {'events' | 'reservations'} scope - La carte.
 * @returns {string[]} Les textes.
 */
const textes = (scope) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <SearchMapPreviewCard item={REPERE} onOpen={() => {}} scope={scope} />,
    );
  });
  return arbre.root.findAllByType(Text)
    .map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
};

describe('Q1-14 — aperçu de carte : le prix d’une réservation', () => {
  it('une réservation montre sa date, son heure et son prix', () => {
    expect(textes('reservations'))
      .toEqual(expect.arrayContaining(['Sam. 25/10', '18:00 - 19:00', '8 EUR']));
  });

  it('un événement garde deux pastilles (date, heure), sans prix ni distance', () => {
    const vus = textes('events');
    expect(vus).toEqual(expect.arrayContaining(['Sam. 25/10', '18:00 - 19:00']));
    expect(vus).not.toContain('8 EUR');
    expect(vus).not.toContain('1,2 km');
  });
});
