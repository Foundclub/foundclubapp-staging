import renderer, { act } from 'react-test-renderer';

import FriseDuJour from '@/views/complexe/components/FriseDuJour';

import { parRepere, pressable, textes } from '@/testSupport/temoinComplexe';

// RESA-L5A1 (13/10/2026) — E-G02 bloc 3, planche P00 bloc 2 : la frise « Aujourd'hui », une
// ligne par terrain, chaque créneau à sa place, le trait de l'heure, la légende repliable.

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const LIGNES = [
  {
    cle: 't-1',
    couleur: null,
    creneaux: [
      { etat: 'libre', from: '18:00', to: '19:00' },
      { etat: 'libre', from: '19:00', to: '20:00' },
    ],
    nom: 'Terrain 1',
  },
  {
    cle: 't-2',
    couleur: null,
    creneaux: [{ etat: 'libre', from: '18:30', to: '20:00' }],
    nom: 'Padel A',
  },
];

/**
 * Monte la frise.
 * @param {Record<string, any>} props - Les propriétés.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async (props) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <FriseDuJour
        lignes={props.lignes}
        maintenant={props.maintenant}
        onToucher={props.onToucher}
      />,
    );
  });
  return arbre;
};

describe('RESA-L5A1 E-G02 — la frise du jour', () => {
  it('une ligne par terrain, les heures de la journée, chaque créneau dit son état', async () => {
    const arbre = await monter({ lignes: LIGNES, maintenant: 18 * 60 + 40 });
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining(['Terrain 1', 'Padel A', '18 h', '19 h', '20 h']));
    expect(lus.filter((texte) => texte === 'Libre')).toHaveLength(3);
    expect(parRepere(arbre, 'frise-creneau-t-1-18:00')?.props.accessibilityLabel)
      .toBe('Terrain 1, 18 h – 19 h, libre');
  });

  it('le trait de l’heure, seulement pendant la journée de la frise', async () => {
    const pendant = await monter({ lignes: LIGNES, maintenant: 18 * 60 + 40 });
    expect(parRepere(pendant, 'frise-maintenant')).not.toBeNull();
    expect(parRepere(await monter({ lignes: LIGNES, maintenant: 9 * 60 }), 'frise-maintenant'))
      .toBeNull();
  });

  it('la légende se déplie : les six états d’un créneau (P00 bloc 2)', async () => {
    const arbre = await monter({ lignes: LIGNES, maintenant: 0 });
    expect(textes(arbre)).not.toContain('Réservé à l’extérieur');
    await act(async () => {
      pressable(arbre, 'Légende').props.onPress();
    });
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Libre',
      'Réservé dans l’app',
      'Réservé à l’extérieur',
      'En attente',
      'Bloqué',
      'Fermé',
    ]));
  });

  it('RESA-L5A2 — une case se touche quand l’accueil le demande (réservée ⇒ fiche)', async () => {
    const onToucher = jest.fn();
    const lignes = [{
      ...LIGNES[0],
      creneaux: [{
        etat: 'app', from: '18:00', libelle: 'Julien M.', reservationId: 'r-1', to: '19:00',
      }],
    }];
    const arbre = await monter({ lignes, maintenant: 0, onToucher });
    await act(async () => {
      parRepere(arbre, 'frise-creneau-t-1-18:00').props.onPress();
    });
    expect(onToucher).toHaveBeenCalledWith(lignes[0], lignes[0].creneaux[0]);
    expect(textes(arbre)).toContain('Julien M.');
    // Sans `onToucher`, la case reste une simple vue (aucun appui).
    const muette = await monter({ lignes: LIGNES, maintenant: 0 });
    expect(parRepere(muette, 'frise-creneau-t-1-18:00').props.onPress).toBeUndefined();
  });

  it('aucun créneau : pas de frise', async () => {
    expect((await monter({ lignes: [], maintenant: 0 })).toJSON()).toBeNull();
  });
});
