import { Image } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

import { getNotificationIcon } from '@/utils/notifications/notificationPresentation';

/**
 * 🏛️ COLL-C4A3 (03/10/2026) — PLANCHE 19 : la notification d'une actualité de la Ville a SON
 * icône (la T9 la voyait sous la cloche générique, comme n'importe quelle notification).
 *
 * L'icône : le bâtiment à colonnes, repris tel quel de l'ancien système d'Adel (« Bank », la
 * bibliothèque même de la cloche et des silhouettes de l'app), au gabarit du jeu validé le 01/10
 * (« Icone ok ») : PNG 96 × 96, encre blanche, teintée par le code. Aucun emoji.
 *
 * Le type vient du serveur : `collectiviteNewsPublished`
 * (admin/src/api/user-fcm-token/types/index.ts, COLLECTIVITE_NEWS_PUBLISHED).
 */

const dessine = (/** @type {string} */ nom) => {
  /** @type {any} */
  let arbre;
  const avertir = jest.spyOn(console, 'warn').mockImplementation(() => {});
  act(() => {
    arbre = renderer.create(<SvgIcon name={nom} />);
  });
  avertir.mockRestore();
  const images = arbre.root.findAllByType(Image);
  act(() => { arbre.unmount(); });
  return images.length === 1;
};

describe('COLL-C4A3 — l icône d une actualité de la Ville', () => {
  it('une actualité de la Ville montre le bâtiment à colonnes, pas la cloche', () => {
    expect(getNotificationIcon('collectiviteNewsPublished')).toBe('building-columns');
  });

  it('l icône existe dans le jeu de l app, et se dessine', () => {
    expect(dessine('building-columns')).toBe(true);
  });

  it('un type inconnu garde la cloche', () => {
    expect(getNotificationIcon('typeInconnu')).toBe('bell');
  });
});
