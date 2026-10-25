import renderer, { act } from 'react-test-renderer';

import BadgeComplexe from '@/views/complexe/components/BadgeComplexe';
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';
import CarteTerrain from '@/views/complexe/components/CarteTerrain';
import LogoComplexe from '@/views/complexe/components/LogoComplexe';
import PastilleMode from '@/views/complexe/components/PastilleMode';

import {
  enUnMot,
  parRepere,
  PLAN_OUVERT,
  pressable,
  terrainDeTemoin,
  textes,
} from '@/testSupport/temoinComplexe';

// RESA-L5A1 (13/10/2026) — P00 « langage visuel de la réservation » : les composants partagés
// des écrans du gérant (pastille du complexe, logo carré, mode d'un terrain, carte d'un terrain,
// bandeau d'état).

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const NBSP = ' ';

/**
 * Monte un élément.
 * @param {import('react').ReactElement} element - L'élément.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async (element) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(element);
  });
  return arbre;
};

describe('RESA-L5A1 P00 — on voit que c’est un complexe (A-G05)', () => {
  it('la pastille « Complexe de réservation », et sa version courte', async () => {
    expect(textes(await monter(<BadgeComplexe />))).toEqual(['Complexe de réservation']);
    expect(textes(await monter(<BadgeComplexe court />))).toEqual(['Complexe']);
  });

  it('le logo carré : les initiales sans image, l’image sinon', async () => {
    const sansImage = await monter(<LogoComplexe nom="Le Five de Montrivage" taille={60} />);
    expect(textes(sansImage)).toEqual(['LF']);
    const avecImage = await monter(<LogoComplexe logo="https://exemple.test/logo.png" nom="Le Five" />);
    expect(textes(avecImage)).toEqual([]);
    expect(parRepere(avecImage, 'complexe-logo-image')?.props.source).toEqual({
      uri: 'https://exemple.test/logo.png',
    });
  });
});

describe('RESA-L5A1 P00 — le mode d’un terrain (D2)', () => {
  // RESA-FIN-APP (20/10/2026) — tournée 2 (Android 16) : la pastille du Terrain 2 s'affichait
  // « Validation » (le dernier mot passait sur une ligne invisible). Une pastille épouse son texte :
  // ses espaces deviennent insécables (`texteInsecable`), le texte se comporte comme un mot seul.
  it('trois pastilles, une par mode, dessinées en un seul mot', async () => {
    expect(textes(await monter(<PastilleMode mode="automatique" />))).toEqual(['Automatique']);
    expect(textes(await monter(<PastilleMode mode="manuel" />)))
      .toEqual([enUnMot('Validation manuelle')]);
    expect(textes(await monter(<PastilleMode mode="telephone" />)))
      .toEqual([enUnMot('Téléphone seulement')]);
  });

  it('un mode inconnu ne dessine rien', async () => {
    expect((await monter(<PastilleMode mode="autre" />)).toJSON()).toBeNull();
  });
});

describe('RESA-L5A1 P00 — la carte d’un terrain (E-G07, P00 bloc 5)', () => {
  it('nom, ligne, mode, prix indicatif, horaires d’ouverture', async () => {
    const ouvrir = jest.fn();
    const arbre = await monter(
      <CarteTerrain
        onOuvrir={ouvrir}
        terrain={terrainDeTemoin({ slotPlan: PLAN_OUVERT })}
      />,
    );
    expect(textes(arbre)).toEqual([
      'Terrain 1',
      'Foot à 5 · Extérieur · 10 joueurs',
      'Automatique',
      `60${NBSP}€ le créneau`,
      'Ouvert : lun-ven 17 h – 23 h, sam-dim 9 h – 22 h',
    ]);
    await act(async () => {
      pressable(arbre, 'Terrain 1').props.onPress();
    });
    expect(ouvrir).toHaveBeenCalledTimes(1);
  });

  it('sans créneau, coupé, sans prix : « Aucun créneau ouvert », « Pas réservable »', async () => {
    const arbre = await monter(
      <CarteTerrain
        onOuvrir={jest.fn()}
        terrain={terrainDeTemoin({
          basePrice: null, bookingMode: 'telephone', isBookable: false, name: 'Padel A',
        })}
      />,
    );
    expect(textes(arbre)).toEqual([
      'Padel A',
      'Foot à 5 · Extérieur · 10 joueurs',
      enUnMot('Téléphone seulement'),
      'Aucun créneau ouvert',
      'Pas réservable',
    ]);
  });

  it('le bouton « … » n’existe que si on lui donne un geste', async () => {
    const sans = await monter(<CarteTerrain onOuvrir={jest.fn()} terrain={terrainDeTemoin()} />);
    expect(parRepere(sans, 'carte-terrain-plus-t-1')).toBeNull();
    const plus = jest.fn();
    const avec = await monter(
      <CarteTerrain onOuvrir={jest.fn()} onPlus={plus} terrain={terrainDeTemoin()} />,
    );
    await act(async () => {
      pressable(avec, 'Plus d’actions').props.onPress();
    });
    expect(plus).toHaveBeenCalledTimes(1);
  });
});

describe('RESA-L5A1 P00 — le bandeau d’état', () => {
  it('un texte, et une action quand on lui en donne une', async () => {
    const agir = jest.fn();
    const arbre = await monter(
      <BandeauComplexe
        action="Ajouter un terrain"
        onAction={agir}
        texte="Ajoute ton premier terrain pour recevoir des réservations."
        ton="info"
      />,
    );
    expect(textes(arbre)).toContain('Ajoute ton premier terrain pour recevoir des réservations.');
    await act(async () => {
      pressable(arbre, 'Ajouter un terrain').props.onPress();
    });
    expect(agir).toHaveBeenCalledTimes(1);
  });
});
