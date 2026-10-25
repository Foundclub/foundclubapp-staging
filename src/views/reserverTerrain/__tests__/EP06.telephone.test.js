import { Linking } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FeuilleTelephone from '@/views/reserverTerrain/components/FeuilleTelephone';

import { lisibles, pressable } from '@/testSupport/temoinComplexe';

// RESA-L6A (14/10/2026) — E-P06 « La feuille Téléphone seulement » (planches EP06, RA2 état 3, P00
// bloc 8 ; plan E-P06, A-G16, A-G24) : le nom du terrain, le créneau touché rappelé (A-G24), le
// texte et le numéro DU COMPLEXE (RG-TEL), « Appeler le … » (lien tel:), « Fermer », la mention
// « n'apparaît pas dans tes réservations ». Sur ordinateur : le numéro en grand et « Copier le
// numéro ». Rien n'est enregistré dans l'app ; l'âge ne s'applique pas (le complexe décide).

let mockOrdinateur = false;
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockOrdinateur }));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const TELEPHONE = {
  number: '+33639981234',
  text: 'Ce terrain ne peut être réservé que par appel au',
};
const fermer = jest.fn();

/**
 * Monte la feuille.
 * @param {Record<string, any>} [props] - Ce qui change.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async (props = {}) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <FeuilleTelephone
        creneau={props.creneau}
        onFermer={fermer}
        telephone={props.telephone || TELEPHONE}
        terrain={{ capacity: 4, name: 'Padel A' }}
        visible={props.visible !== false}
      />,
    );
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockOrdinateur = false;
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

describe('E-P06 — la feuille « Téléphone seulement »', () => {
  it('le terrain, le texte et le numéro du complexe, la mention', async () => {
    const vus = lisibles(await monter());
    expect(vus).toEqual(expect.arrayContaining([
      'Padel A',
      'Ce terrain ne peut être réservé que par appel au 06 39 98 12 34.',
      'Une réservation par téléphone n’apparaît pas dans tes réservations.',
      'Appeler le 06 39 98 12 34',
      'Fermer',
    ]));
  });

  it('« Appeler » ouvre l’appel du téléphone, vers le numéro du complexe', async () => {
    const arbre = await monter();
    await act(async () => {
      pressable(arbre, 'Appeler le 06 39 98 12 34').props.onPress();
    });
    expect(Linking.openURL).toHaveBeenCalledWith('tel:+33639981234');
  });

  it('« Fermer » ferme la feuille', async () => {
    const arbre = await monter();
    await act(async () => {
      pressable(arbre, 'Fermer').props.onPress();
    });
    expect(fermer).toHaveBeenCalled();
  });

  it('un créneau touché est rappelé (A-G24), avec son prix', async () => {
    const vus = lisibles(await monter({
      creneau: {
        date: '2026-10-13',
        from: '18:00',
        price: { amount: 6, perPlayer: 6, unit: 'joueur' },
        to: '19:30',
      },
    }));
    expect(vus).toEqual(expect.arrayContaining([
      'Padel A · Mardi 13 octobre',
      '18 h – 19 h 30',
      '6 € par joueur, à régler sur place',
      'Demande ce créneau au complexe. '
        + 'Une réservation par téléphone n’apparaît pas dans tes réservations.',
    ]));
  });

  it('le texte du complexe, s’il en a écrit un, remplace le texte par défaut', async () => {
    const vus = lisibles(await monter({
      telephone: { number: '+33639981234', text: 'Réservations au comptoir ou au' },
    }));
    expect(vus).toContain('Réservations au comptoir ou au 06 39 98 12 34.');
  });

  it('sur ordinateur : le numéro en grand et « Copier le numéro »', async () => {
    mockOrdinateur = true;
    const ecrire = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: ecrire },
    });
    const arbre = await monter();
    const vus = lisibles(arbre);
    expect(vus).toContain('06 39 98 12 34');
    expect(vus).not.toContain('Appeler le 06 39 98 12 34');
    await act(async () => {
      pressable(arbre, 'Copier le numéro').props.onPress();
    });
    expect(ecrire).toHaveBeenCalledWith('+33639981234');
    expect(lisibles(arbre)).toContain('Numéro copié.');
  });

  it('fermée : rien ne s’affiche', async () => {
    const arbre = await monter({ visible: false });
    expect(arbre.toJSON()).toBeNull();
  });
});

describe('BH16 P13-19 — pas de presse-papiers', () => {
  it('« Numéro copié. » ne s’affiche pas quand rien n’a été copié', async () => {
    mockOrdinateur = true;
    Object.defineProperty(global.navigator, 'clipboard', { configurable: true, value: undefined });
    const arbre = await monter();
    await act(async () => {
      pressable(arbre, 'Copier le numéro').props.onPress();
    });
    expect(lisibles(arbre)).not.toContain('Numéro copié.');
  });
});
