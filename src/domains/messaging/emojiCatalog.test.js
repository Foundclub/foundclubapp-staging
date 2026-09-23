import { EMOJI_CATALOG, EMOJI_CATALOG_SIZE } from './emojiCatalog';
import { REACTION_EMOJIS } from './reactionUseCases';

// WHATSAPP — CE QUE CE TEMOIN GARDE, et pourquoi chaque point est la.
//
// Le catalogue est une DONNEE ENGENDREE : personne ne le relit ligne a ligne, et
// 837 emojis sur 70 lignes sont exactement le genre de fichier qu un outil
// d edition abime en silence. Un emoji casse ne fait pas rougir un ecran — il
// part chez tous les membres du fil sous forme de carre vide.
//
// 🪤 Le piege vise nommement : un outil qui echappe l unicode transforme « 😀 »
// en « \u00F0\u009F\u0098\u0080 » ou en « ? ». Les deux laissent des caracteres
// ASCII dans les entrees — c est ce que le test ci-dessous refuse.

describe('WHATSAPP — le catalogue derriere le « + »', () => {
  it('compte neuf familles, toutes garnies', () => {
    expect(EMOJI_CATALOG).toHaveLength(9);
    EMOJI_CATALOG.forEach((categorie) => {
      expect(typeof categorie.key).toBe('string');
      expect(categorie.key.length).toBeGreaterThan(0);
      expect(categorie.emojis.length).toBeGreaterThan(10);
    });
  });

  it('annonce le bon total', () => {
    const compte = EMOJI_CATALOG.reduce((total, categorie) => total + categorie.emojis.length, 0);
    expect(EMOJI_CATALOG_SIZE).toBe(compte);
    expect(EMOJI_CATALOG_SIZE).toBeGreaterThan(500);
  });

  it('ne contient AUCUN caractere ASCII — c est le filet anti-corruption', () => {
    const abimes = [];

    EMOJI_CATALOG.forEach((categorie) => {
      categorie.emojis.forEach((emoji) => {
        // eslint-disable-next-line no-control-regex
        if (/[\u0000-\u007F]/.test(emoji)) abimes.push(`${categorie.key}: ${JSON.stringify(emoji)}`);
      });
    });

    expect(abimes).toEqual([]);
  });

  it('ne contient ni entree vide ni grappe demesuree', () => {
    EMOJI_CATALOG.forEach((categorie) => {
      categorie.emojis.forEach((emoji) => {
        expect(emoji.length).toBeGreaterThan(0);
        // La borne du serveur est 64 unites UTF-16 ; le catalogue reste loin dessous.
        expect(emoji.length).toBeLessThanOrEqual(8);
      });
    });
  });

  it('ne propose jamais deux fois le meme emoji', () => {
    const vus = new Set();
    const doublons = [];

    EMOJI_CATALOG.forEach((categorie) => {
      categorie.emojis.forEach((emoji) => {
        if (vus.has(emoji)) doublons.push(emoji);
        vus.add(emoji);
      });
    });

    expect(doublons).toEqual([]);
  });

  // 🏳️ LES DRAPEAUX sont d une autre nature que les 811 autres : ce ne sont pas
  // des pictogrammes mais des PAIRES d indicateurs regionaux (U+1F1E6..U+1F1FF),
  // deux par drapeau. Un seul indicateur, ou un nombre impair, ne s affiche pas
  // comme un drapeau — et le serveur le refuserait.
  it('la famille des drapeaux ne contient que des PAIRES d indicateurs regionaux', () => {
    const drapeaux = EMOJI_CATALOG.find((categorie) => categorie.key === 'drapeaux');

    expect(drapeaux).toBeDefined();
    expect(drapeaux.emojis).toHaveLength(258);

    drapeaux.emojis.forEach((drapeau) => {
      const points = Array.from(drapeau).map((c) => c.codePointAt(0));
      expect(points).toHaveLength(2);
      points.forEach((point) => {
        expect(point).toBeGreaterThanOrEqual(0x1F1E6);
        expect(point).toBeLessThanOrEqual(0x1F1FF);
      });
    });
  });

  it('contient bien les six raccourcis — la barre et le clavier ne se contredisent pas', () => {
    const tous = new Set(EMOJI_CATALOG.flatMap((categorie) => categorie.emojis));
    REACTION_EMOJIS.forEach((emoji) => {
      expect(tous.has(emoji)).toBe(true);
    });
  });
});
