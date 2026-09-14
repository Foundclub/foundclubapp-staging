/* eslint-env jest */
// 🔤 I18N-0 — le témoin de scripts/i18n/clefs.js : l'outil qui écrit dans fr.js
// et en.js doit le faire sans rien déplacer, et ne jamais poser une clef minée.
const {
  ajouterClefs,
  aPlat,
  bilanDesTraductions,
  classerLesReplis,
  releverDansLaSource,
} = require('../clefs');

const DICTIONNAIRE = [
  'export default {',
  '  alpha: {',
  "    b: 'B',",
  "    d: 'D',",
  '  },',
  '  // un commentaire qui reste collé à sa clef',
  '  zeta: {',
  "    x: 'X',",
  '  },',
  '};',
  '',
].join('\n');

/**
 * Relève les appels d'une source de production fictive.
 * @param {string} source - Le code.
 * @returns {Map<string, object[]>} Les appels, par clef.
 */
const relever = (source) => releverDansLaSource(new Map(), 'src/Ecran.js', source);

describe('I18N-0 — ajouterClefs', () => {
  it('pose chaque clef à sa place triée, sans toucher une ligne existante', () => {
    const { refusees, source } = ajouterClefs(DICTIONNAIRE, {
      'alpha.c': 'C',
      'beta.a': "L'équipe",
      'zeta.y': 'Y',
    });

    expect(refusees).toEqual([]);
    expect(source).toBe([
      'export default {',
      '  alpha: {',
      "    b: 'B',",
      "    c: 'C',",
      "    d: 'D',",
      '  },',
      '  beta: {',
      '    a: "L\'équipe",',
      '  },',
      '  // un commentaire qui reste collé à sa clef',
      '  zeta: {',
      "    x: 'X',",
      "    y: 'Y',",
      '  },',
      '};',
      '',
    ].join('\n'));
    expect(aPlat(source)).toEqual({
      'alpha.b': 'B',
      'alpha.c': 'C',
      'alpha.d': 'D',
      'beta.a': "L'équipe",
      'zeta.x': 'X',
      'zeta.y': 'Y',
    });
  });

  it('refuse une clef présente, ou dont le chemin traverse un texte', () => {
    const { refusees, source } = ajouterClefs(DICTIONNAIRE, {
      'alpha.b': 'autre',
      'alpha.b.c': 'C',
    });

    expect(refusees.sort()).toEqual(['alpha.b', 'alpha.b.c']);
    expect(source).toBe(DICTIONNAIRE);
  });

  it('laisse les clefs numériques sans guillemets, et déroge à max-len au-delà de 100', () => {
    const long = 'x'.repeat(120);
    const { source } = ajouterClefs(DICTIONNAIRE, { 'alpha.1': 'Un', 'alpha.long': long });

    expect(source).toContain("    1: 'Un',");
    expect(source).toContain(`    // eslint-disable-next-line max-len\n    long: '${long}',`);
  });
});

describe('I18N-0 — classerLesReplis', () => {
  it('ajoute un repli simple, et les formes d’un repli pluriel', () => {
    const appels = relever([
      "t('ecran.titre', 'Mon titre');",
      "t('ecran.seances', { count, defaultValue_one: '{{count}} séance',",
      "  defaultValue_other: '{{count}} séances' });",
      "t('ecran.connue', 'Déjà là');",
    ].join('\n'));

    const bilan = classerLesReplis({ 'ecran.connue': 'Déjà là' }, appels);

    expect(bilan.ajoutables).toEqual({
      'ecran.seances_one': '{{count}} séance',
      'ecran.seances_other': '{{count}} séances',
      'ecran.titre': 'Mon titre',
    });
  });

  it('n’ajoute JAMAIS une clef appelée avec deux replis différents', () => {
    const appels = relever("t('common.confirm', 'Accepter');\nt('common.confirm', 'Refuser');");

    const bilan = classerLesReplis({}, appels);

    expect(bilan.ajoutables).toEqual({});
    expect(bilan.minees).toEqual(['common.confirm']);
  });

  it('n’ajoute pas une clef dont un appel a un repli illisible', () => {
    // Le second appel porte un gabarit `Texte ${nom}` : illisible.
    const gabarit = ['`Texte $', '{nom}`'].join('');
    const appels = relever(`t('a.b', 'Texte');\nt('a.b', ${gabarit});`);

    expect(classerLesReplis({}, appels).illisibles).toEqual(['a.b']);
  });
});

describe('I18N-0 — bilanDesTraductions (la porte d’un lot)', () => {
  it('signale une traduction manquante, des jetons différents, une clef en trop', () => {
    const ajoutables = { 'a.b': 'Bonjour {{prenom}}', 'a.c': 'Salut' };

    expect(bilanDesTraductions(ajoutables, {
      'a.b': 'Hello {{name}}',
      'z.z': 'Orphan',
    })).toEqual({ enTrop: ['z.z'], jetonsFaux: ['a.b'], manquantes: ['a.c'] });
  });
});
