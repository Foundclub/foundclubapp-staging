/* eslint-env jest */
// 🔤 I18N-0 — le témoin du cliquet du français en dur et du contrôle
// d'extraction fidèle : ce qu'ils comptent, ce qu'ils ignorent.
const { textesDisparus } = require('../extraction-fidele');
const {
  estFrancais, EXCEPTIONS_D78, fichiersEnHausse, textesFrancais,
} = require('../francais-en-dur');

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

// D78 « 253 A » (Adel, 12/11/2026) : les 4 fichiers attribués à la récolte du train 9 (texte légal
// et faux positifs, banc RECOLTE-TRAIN9-1111/I18N-ATTRIBUTION.md) ont une tolérance CHIFFRÉE ; une
// ligne de plus dans l'un d'eux fait toujours rougir la porte.
describe('D78 — les exceptions des 4 fichiers du train 9', () => {
  it('tolère exactement les lignes attribuées, pas une de plus', () => {
    const plafonds = { 'src/domains/subscription/subscriptionBilling.js': 5 };
    const juste = {
      'src/domains/complexe/reglesDesComplexes.js': 41,
      'src/domains/search/friendlyMatchFormats.js': 1,
      'src/domains/subscription/subscriptionBilling.js': 9,
      'src/views/event/components/EventChatInfos.js': 2,
    };
    expect(fichiersEnHausse(juste, plafonds)).toEqual([]);
    Object.keys(juste).forEach((fichier) => {
      expect(fichiersEnHausse({ ...juste, [fichier]: juste[fichier] + 1 }, plafonds))
        .toEqual([fichier]);
    });
    expect(Object.values(EXCEPTIONS_D78).reduce((a, b) => a + b, 0)).toBe(48);
  });
  it('un autre fichier n’a aucune tolérance', () => {
    expect(fichiersEnHausse({ 'src/x.js': 1 }, {})).toEqual(['src/x.js']);
  });
});
