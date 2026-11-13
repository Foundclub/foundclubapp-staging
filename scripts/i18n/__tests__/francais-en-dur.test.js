/* eslint-env jest */
// 🔤 I18N-0 — le témoin du cliquet du français en dur et du contrôle
// d'extraction fidèle : ce qu'ils comptent, ce qu'ils ignorent.
const fs = require('fs');
const path = require('path');

const baseline = require('../../../.ci/i18n-francais-en-dur-baseline.json');
const { textesDisparus } = require('../extraction-fidele');
const {
  estFrancais, EXCEPTIONS_D78, fichiersEnHausse, mesurer, textesFrancais,
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

// D78 « 253 A » (Adel, 12/11/2026) avait posé une tolérance chiffrée sur 4 fichiers du train 9 ;
// le recalage « 306 A » (13/11) l'absorbe dans la baseline. Plus aucun fichier n'a de tolérance.
describe('D78 — les exceptions du train 9, absorbées par « 306 A »', () => {
  it('aucun fichier n’a plus de tolérance : une ligne au-dessus de sa baseline fait rougir', () => {
    const regles = 'src/domains/complexe/reglesDesComplexes.js';
    expect(fichiersEnHausse({ [regles]: 41 }, { [regles]: 41 })).toEqual([]);
    expect(fichiersEnHausse({ [regles]: 42 }, { [regles]: 41 })).toEqual([regles]);
    expect(fichiersEnHausse({ 'src/x.js': 1 }, {})).toEqual(['src/x.js']);
  });
});

// GO Adel « 306 A » (13/11/2026, relayé par le chef) : la baseline est recalée sur la mesure de la
// tête du train 10 (589 lignes : 587 du train 9 + le repli RESA-JOUEUR et le journal PHOTO-SITE).
// Les tolérances D78 y sont absorbées, donc VIDÉES : gardées, elles tolèreraient deux fois les
// mêmes 48 lignes. Le contrôle doit attraper TOUTE ligne neuve, même dans ces fichiers-là.
describe('306 A — la baseline recalée attrape toute ligne neuve', () => {
  const RACINE = path.resolve(__dirname, '..', '..', '..');
  const compter = (parFichier) => Object.fromEntries(
    Object.entries(parFichier).map(([fichier, lignes]) => [fichier, lignes.length]),
  );
  const tete = compter(mesurer());

  it('la tête est à sa baseline : 589 lignes, aucune hausse, aucune tolérance en plus', () => {
    expect(baseline.totalLignes).toBe(589);
    expect(fichiersEnHausse(tete, baseline.fichiers)).toEqual([]);
    expect(EXCEPTIONS_D78).toEqual({});
  });

  it.each([
    'src/domains/complexe/reglesDesComplexes.js',
    'src/domains/subscription/subscriptionBilling.js',
    'src/views/event/components/EventChatInfos.js',
    'src/domains/search/friendlyMatchFormats.js',
    'src/domains/complexe/reserverTerrain.js',
    'src/domains/messaging/photoDuGroupe.js',
  ])('une ligne de français en dur ajoutée exprès dans %s fait rougir la porte', (fichier) => {
    const source = `${fs.readFileSync(path.join(RACINE, fichier), 'utf8')}\n`
      + "export const ajoutExpres = 'Ton créneau est réservé';\n";
    const lignes = new Set(textesFrancais(fichier, source).map((texte) => texte.ligne));
    expect(lignes.size).toBe((tete[fichier] || 0) + 1);
    expect(fichiersEnHausse({ ...tete, [fichier]: lignes.size }, baseline.fichiers))
      .toEqual([fichier]);
  });
});
