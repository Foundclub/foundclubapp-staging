import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AttendanceRow from '../AttendanceRow';

// PETITSBUGS-2 (presentation Coach, page 11) — sur l ecran Appel, le nom DEFILAIT
// (MarqueeText) : une capture le prenait coupe au debut (« obin masir »), ou coupe par
// « … » au milieu d un prenom (« Baptiste… »). Le nom passe maintenant sur DEUX lignes,
// immobile, une seule fois a l ecran.

jest.mock('@/theme/themeContext', () => {
  const leaf = {};
  return {
    __esModule: true,
    default: () => ({
      Colors: new Proxy({}, { get: () => 'black' }),
      Fonts: new Proxy({}, { get: () => leaf }),
      Images: new Proxy({}, { get: () => 1 }),
    }),
  };
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => function AvatarMock() {
  return null;
});

const NOM = 'Baptiste Vandenberghe-Lombard';

const monter = async () => {
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <AttendanceRow
        item={{
          rsvpStatus: 'not_answered',
          user: { documentId: 'u1', firstname: 'Baptiste', lastname: 'Vandenberghe-Lombard' },
        }}
        onLate={jest.fn()}
        onOnTime={jest.fn()}
        position={1}
        t={(_cle, repli) => repli}
      />,
    );
  });
  return arbre;
};

describe('PETITSBUGS-2 — le nom de l appel tient sur deux lignes', () => {
  test('ROUGE-AVANT — le nom est un texte de 2 lignes, rendu une seule fois', async () => {
    const arbre = await monter();
    const textesDuNom = arbre.root.findAllByType(Text)
      .filter((noeud) => [].concat(noeud.props.children).join('') === NOM);

    expect(textesDuNom).toHaveLength(1);
    expect(textesDuNom[0].props.numberOfLines).toBe(2);
  });
});
