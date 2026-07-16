// Tests jest de la composition PURE des textes de partage.
import { buildCardShareMessage, buildCardShareTitle } from '../cardMessages';

describe('cardMessages', () => {
  test('buildCardShareTitle', () => {
    expect(buildCardShareTitle({ firstname: 'Sofia', lastname: 'MARTIN' })).toBe('Sofia MARTIN');
    expect(buildCardShareTitle({}, { fallbackName: 'Ma carte' })).toBe('Ma carte');
  });

  test('buildCardShareMessage intro + suffixe dispo + lien', () => {
    const out = buildCardShareMessage({
      labels: {
        availableSuffix: 'Je cherche un club !',
        intro: 'Voici ma carte FoundClub',
        linkLabel: 'Trouve-moi sur FoundClub',
      },
      model: {
        firstname: 'Sofia', isAvailable: true, lastname: 'MARTIN', qrUrl: 'https://foundclub.app/x',
      },
    });
    expect(out.title).toBe('Sofia MARTIN');
    expect(out.message).toContain('Voici ma carte FoundClub');
    expect(out.message).toContain('Je cherche un club !');
    expect(out.message).toContain('Trouve-moi sur FoundClub :\nhttps://foundclub.app/x');
  });

  test('buildCardShareMessage sans lien', () => {
    const out = buildCardShareMessage({ labels: { intro: 'Hey' }, model: { firstname: 'A', qrUrl: '' } });
    expect(out.url).toBe('');
    expect(out.message).toBe('Hey');
  });
});
