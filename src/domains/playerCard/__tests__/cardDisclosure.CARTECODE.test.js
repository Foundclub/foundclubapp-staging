// CARTECODE (26/10/2026) — registre des mineurs ligne 41 : avant tout partage, chacun voit ce
// qui part. La liste ne nomme que ce qui est vraiment sur la carte, et le code QR dit où il mène.
import { buildCardDisclosure } from '../cardMessages';

const cles = (resultat) => resultat.parts.map((p) => p.key);

describe('CARTECODE — l’écran « ce qui part »', () => {
  test('adulte complet, disponible : tout ce qui est sur sa carte, QR vers son profil', () => {
    const resultat = buildCardDisclosure({
      model: {
        age: 26,
        city: 'Aix-en-Provence 13090',
        hasPhoto: true,
        height: 178,
        isAvailable: true,
        weight: 74,
      },
      qr: { kind: 'install', personal: true },
    });
    expect(cles(resultat)).toEqual([
      'photoAndName',
      'age',
      'city',
      'body',
      'available',
      'qrProfile',
      'messageLooking',
    ]);
    expect(resultat.parts[1].value).toBe(26);
    expect(resultat.never).toEqual(['contact']);
  });

  test('ado : le QR mène à FoundClub, pas à son profil', () => {
    const resultat = buildCardDisclosure({
      model: { age: 16, hasPhoto: true, isAvailable: true },
      qr: { kind: 'install' },
    });
    expect(cles(resultat)).toContain('qrNeutral');
    expect(cles(resultat)).not.toContain('qrProfile');
  });

  test('ce qui manque n’est pas nommé ; sans QR, pas de ligne QR', () => {
    const resultat = buildCardDisclosure({
      model: { hasPhoto: false, isAvailable: false },
      qr: { kind: 'none' },
    });
    expect(cles(resultat)).toEqual(['name', 'unavailable', 'message']);
  });
});
