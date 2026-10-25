import renderer, { act } from 'react-test-renderer';

import TeamSlotCreationForm from '../TeamSlotCreationForm';

// C04 Q3-06 (BUGHUNT phase 2, 25/10) — disponibilités d'équipe : un créneau de 18:00 à 10:00
// était accepté. Mettre le début à 23 h poussait la fin à minuit… du LENDEMAIN ; la fin restait
// ensuite un jour plus loin, et « 10:00 du lendemain » passait pour plus tard que 18:00.
// Le fichier n'avait aucun témoin : le premier bloc décrit le comportement actuel (E6).

const mockRoues = [];
jest.mock('@/components/molecules/dateTimeSelector/DateTimeSelector', () => ({
  WheelPicker: (/** @type {any} */ props) => { mockRoues.push(props); return null; },
}));
jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => () => null);
jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ r) => (typeof r === 'string' ? r : cle),
  }),
}));
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({ Colors: {}, Fonts: new Proxy({}, { get: () => ({}) }) }),
}));

// Les 4 roues, dans l'ordre de l'écran : heure et minute du début, heure et minute de la fin.
const roue = (/** @type {number} */ rang) => mockRoues.slice(-4)[rang];
const debutHeure = (/** @type {number} */ h) => act(() => { roue(0).onValueChange(h); });
const finHeure = (/** @type {number} */ h) => act(() => { roue(2).onValueChange(h); });

const monter = () => {
  const brouillons = [];
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <TeamSlotCreationForm
        initialValues={{ day: 'monday', endTime: '22:00', startTime: '20:00' }}
        onAdd={jest.fn()}
        onCancel={jest.fn()}
        onDraftChange={(/** @type {any} */ b) => brouillons.push(b)}
      />,
    );
  });
  return { arbre, dernier: () => brouillons[brouillons.length - 1] };
};

beforeEach(() => { mockRoues.length = 0; });

describe('TeamSlotCreationForm — comportement actuel (caractérisation)', () => {
  test('début 18 h, fin 22 h : créneau valide « 18:00 → 22:00 »', () => {
    const { arbre, dernier } = monter();
    debutHeure(18);

    expect(dernier().isValid).toBe(true);
    expect(dernier().slot).toEqual(expect.objectContaining({
      day: 'monday', endTime: '22:00', startTime: '18:00',
    }));
    act(() => arbre.unmount());
  });

  test('début 22 h avec fin 22 h : la fin passe à 23 h', () => {
    const { arbre, dernier } = monter();
    debutHeure(22);

    expect(dernier().slot)
      .toEqual(expect.objectContaining({ endTime: '23:00', startTime: '22:00' }));
    act(() => arbre.unmount());
  });
});

describe('🔴 C04 Q3-06 — une fin avant le début est refusée', () => {
  test('début 23 h, puis 18 h, puis fin 10 h : créneau refusé', () => {
    const { arbre, dernier } = monter();
    debutHeure(23);
    debutHeure(18);
    finHeure(10);

    expect(dernier().isValid).toBe(false);
    expect(dernier().slots).toEqual([]);
    act(() => arbre.unmount());
  });

  test('début 23 h : la fin reste le même jour (23:55), pas « 00:00 » du lendemain', () => {
    const { arbre, dernier } = monter();
    debutHeure(23);

    expect(dernier().slot)
      .toEqual(expect.objectContaining({ endTime: '23:55', startTime: '23:00' }));
    act(() => arbre.unmount());
  });
});
