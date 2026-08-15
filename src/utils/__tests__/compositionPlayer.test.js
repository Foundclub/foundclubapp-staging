import {
  getCompositionPlayerId,
  getCompositionPlayerInitials,
  getCompositionPlayerLabel,
  sanitizeCompositionText,
} from '../compositionPlayer';

// C-F — FILET DE DEMENAGEMENT (E6).
//
// Ces 4 fonctions vivaient dans `views/tactical_v2/multiTeamCompositionUtils.js`
// et n'avaient AUCUN test : les 20 tests de ce fichier portent sur les packs de
// composition, jamais sur elles (mesure du 2026-08-16, grep sur leurs 4 noms
// dans `multiTeamCompositionUtils.test.js` : 0 occurrence).
//
// 💣 C'est le trou le plus cher du lot. `getCompositionPlayerInitials` est ce
// qui remplit l'avatar quand une personne n'a pas de photo, et `ProfileAvatar`
// est utilise par 64 fichiers : profils, listes, equipes, messagerie. Le
// deplacer sans filet, c'etait parier sur toute l'app.
//
// ⚠️ CE FICHIER NE JUGE RIEN, il DECRIT — y compris la reparation de mojibake,
// qui est la partie qu'on casse sans s'en apercevoir parce qu'elle ne se voit
// que sur des prenoms accentues mal encodes par le serveur.

describe("getCompositionPlayerId — l'identifiant qui sert de cle partout", () => {
  it('prefere `documentId` a `id` quand les deux existent', () => {
    expect(getCompositionPlayerId({ documentId: 'doc1', id: 42 })).toBe('doc1');
  });

  it('retombe sur `id` quand il n y a pas de documentId', () => {
    expect(getCompositionPlayerId({ id: 42 })).toBe('42');
  });

  it('rend une chaine VIDE quand il n y a rien — jamais « undefined »', () => {
    expect(getCompositionPlayerId({})).toBe('');
    expect(getCompositionPlayerId(null)).toBe('');
    expect(getCompositionPlayerId(undefined)).toBe('');
  });

  it('coupe les espaces de bord : « doc1 » et «  doc1  » sont le MEME joueur', () => {
    expect(getCompositionPlayerId({ documentId: '  doc1  ' })).toBe('doc1');
  });
});

describe('getCompositionPlayerLabel — le nom affiche', () => {
  it('assemble prenom et nom', () => {
    expect(getCompositionPlayerLabel({ firstname: 'Jean', lastname: 'Dupont' })).toBe('Jean Dupont');
  });

  it('prenom seul : pas d espace en trop derriere', () => {
    expect(getCompositionPlayerLabel({ firstname: 'Jean' })).toBe('Jean');
  });

  it('nom de famille seul : rendu tel quel', () => {
    expect(getCompositionPlayerLabel({ lastname: 'Dupont' })).toBe('Dupont');
  });

  it('retombe sur `name` — c est la forme des joueurs ajoutes a la main', () => {
    expect(getCompositionPlayerLabel({ name: 'Invite 1' })).toBe('Invite 1');
  });

  it('personne : le repli est « Joueur », jamais du vide', () => {
    expect(getCompositionPlayerLabel({})).toBe('Joueur');
    expect(getCompositionPlayerLabel(null)).toBe('Joueur');
  });
});

describe("getCompositionPlayerInitials — ce qui remplit l'avatar sans photo", () => {
  it('prenom + nom : les DEUX premieres lettres, en majuscules', () => {
    expect(getCompositionPlayerInitials({ firstname: 'jean', lastname: 'dupont' })).toBe('JD');
  });

  it('un seul mot : une seule initiale', () => {
    expect(getCompositionPlayerInitials({ firstname: 'Jean' })).toBe('J');
  });

  it('trois mots : on s arrete a DEUX initiales', () => {
    expect(getCompositionPlayerInitials({ firstname: 'Jean Pierre', lastname: 'Dupont' })).toBe('JP');
  });

  it('personne : le repli est « ? » — c est le repli de `Joueur`, donc « J »', () => {
    // Temoin explicite : le repli de `getCompositionPlayerLabel` traverse, donc
    // un joueur vide rend « J » et non « ? ». Le « ? » n'apparait que si le
    // libelle est vide, ce que le repli « Joueur » empeche.
    expect(getCompositionPlayerInitials({})).toBe('J');
  });

  it('espaces multiples entre prenom et nom : aucune initiale fantome', () => {
    expect(getCompositionPlayerInitials({ firstname: 'Jean', lastname: '  Dupont' })).toBe('JD');
  });
});

describe('sanitizeCompositionText — la reparation de mojibake, invisible et indispensable', () => {
  it('repare un « e accent aigu » casse par un double encodage', () => {
    expect(sanitizeCompositionText('JÃ©rÃ´me')).toBe('Jerome');
  });

  it('repare l apostrophe typographique cassee', () => {
    expect(sanitizeCompositionText('Lâ€™equipe')).toBe("L'equipe");
  });

  it('coupe les espaces de bord', () => {
    expect(sanitizeCompositionText('  Jean  ')).toBe('Jean');
  });

  it('un texte deja propre traverse sans etre abime', () => {
    expect(sanitizeCompositionText('Jerome')).toBe('Jerome');
  });

  it('valeur absente : chaine vide, pas de plantage', () => {
    expect(sanitizeCompositionText(null)).toBe('');
    expect(sanitizeCompositionText(undefined)).toBe('');
  });
});

describe("le mojibake traverse aussi les 3 fonctions qui s'en servent", () => {
  it('un identifiant mal encode est repare avant de servir de cle', () => {
    expect(getCompositionPlayerId({ documentId: 'docÃ©1' })).toBe('doce1');
  });

  it('un prenom mal encode donne quand meme la bonne initiale', () => {
    expect(getCompositionPlayerInitials({ firstname: 'Ã‰lodie', lastname: 'Martin' })).toBe('EM');
  });
});
