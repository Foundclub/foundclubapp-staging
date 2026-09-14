/* eslint-env jest */
// 🔤 I18N-0 — le témoin du cliquet du français en dur et du contrôle
// d'extraction fidèle : ce qu'ils comptent, ce qu'ils ignorent.
const { textesDisparus } = require('../extraction-fidele');
const { estFrancais, textesFrancais } = require('../francais-en-dur');

describe('I18N-0 — estFrancais', () => {
  it.each([
    ['Réessayer', true],
    ['Il reste des places', true],
    ["Choisis l'équipe", true],
    ['Match amical', false],
    ['fr-FR', false],
    ['testID-du-bouton', false],
    ['Loading…', false],
  ])('%s → %s', (texte, attendu) => {
    expect(estFrancais(texte)).toBe(attendu);
  });
});

describe('I18N-0 — textesFrancais', () => {
  it('compte littéraux, gabarits et texte JSX, jamais ce qui est déjà dans t()', () => {
    const source = [
      "const a = 'Chargement du profil';",
      // eslint-disable-next-line no-template-curly-in-string -- du code source, pas un gabarit
      'const b = `Il reste ${n} séances`;',
      "const c = t('ecran.titre', 'Déjà traduisible');",
      "console.log('Journal en français');",
      'const d = <Text>Temps de jeu</Text>;',
    ].join('\n');

    expect(textesFrancais('src/Ecran.js', source)).toEqual([
      { ligne: 1, texte: 'Chargement du profil' },
      { ligne: 2, texte: 'Il reste {{}} séances' },
      { ligne: 5, texte: 'Temps de jeu' },
    ]);
  });
});

describe('I18N-0 — textesDisparus (extraction fidèle)', () => {
  const AVANT = [
    "const a = 'Chargement du profil';",
    // eslint-disable-next-line no-template-curly-in-string -- du code source, pas un gabarit
    'const b = `Bonjour ${prenom}, prêt ?`;',
    'const c = <Text>Temps de jeu</Text>;',
  ].join('\n');

  it('ne signale rien quand chaque texte est passé dans un repli identique', () => {
    const apres = [
      "const a = t('ecran.chargement', 'Chargement du profil');",
      "const b = t('ecran.bonjour', 'Bonjour {{prenom}}, prêt ?', { prenom });",
      "const c = <Text>{t('ecran.tempsDeJeu', 'Temps de jeu')}</Text>;",
    ].join('\n');

    expect(textesDisparus('src/Ecran.js', AVANT, apres)).toEqual([]);
  });

  it('signale un texte réécrit en passant', () => {
    const apres = [
      "const a = t('ecran.chargement', 'Chargement…');",
      "const b = t('ecran.bonjour', 'Bonjour {{prenom}}, prêt ?', { prenom });",
      "const c = <Text>{t('ecran.tempsDeJeu', 'Temps de jeu')}</Text>;",
    ].join('\n');

    expect(textesDisparus('src/Ecran.js', AVANT, apres)).toEqual([
      { ligne: 1, texte: 'Chargement du profil' },
    ]);
  });
});
