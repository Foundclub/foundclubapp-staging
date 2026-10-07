import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import i18n from '@/theme/strings';

import ConvocationUpdateNotice from '../ConvocationUpdateNotice';

// MESSAGERIE-1C (récolte 3a) — LA NOTICE « X REMPLACE Y » AFFICHE DES NOMS DE JOUEURS.
//
// Le VRAI i18next de l'app échappe les valeurs interpolées (`sansEchappement.js`) : sans
// l'option, « Rayan N'Diaye » sortait « Rayan N&#39;Diaye ». Le témoin FINITIONS3 ne voit pas
// cet appel (ses variables s'appellent `entering` / `leaving`, pas `name`) : celui-ci le tient,
// avec le vrai moteur de traduction et la vraie notice.

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({ Colors: couleurs, Fonts: genererPolices(couleurs) }),
  };
});

const carte = (/** @type {number} */ publishedVersion, /** @type {any[]} */ joueurs) => ({
  eventId: 'match',
  manualPlayers: [],
  publishedVersion,
  reservePlayers: [],
  snapshotPlayers: joueurs,
  teamId: 'equipe',
  teams: [{ placements: joueurs.map((j) => ({ playerId: j.documentId })) }],
  type: 'lineup_share',
});

test('« Rayan N\'Diaye remplace Sami D\'Arc », sans entite HTML, en fr et en en', async () => {
  const v1 = carte(1, [{ documentId: 'sami', firstname: 'Sami', lastname: 'D\'Arc' }]);
  const v2 = carte(2, [{ documentId: 'rayan', firstname: 'Rayan', lastname: 'N\'Diaye' }]);
  /** @type {string[]} */
  const rendus = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const langue of ['fr', 'en']) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await i18n.changeLanguage(langue); });
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(
        <ConvocationUpdateNotice
          composition={v2}
          messages={[{ composition: v1 }, { composition: v2 }]}
        />,
      );
    });
    rendus.push(arbre.root.findAllByType(Text)
      .map((/** @type {any} */ n) => [].concat(n.props.children).join('')).join(''));
    act(() => { arbre.unmount(); });
  }
  await act(async () => { await i18n.changeLanguage('fr'); });

  expect(rendus).toEqual([
    'Composition modifiée (v2) : Rayan N\'Diaye remplace Sami D\'Arc',
    'Lineup changed (v2): Rayan N\'Diaye replaces Sami D\'Arc',
  ]);
});
