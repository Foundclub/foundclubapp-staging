/* eslint-disable no-console */
// 🔤 I18N-0 — les clefs de traduction : relevé des replis en ligne, et écriture
// dans les dictionnaires SANS les réorganiser.
//
// Usage :
//   node scripts/i18n/clefs.js replis
//       Relève les appels `t('clef', 'repli')` de la production dont la clef est
//       ABSENTE de fr.js, et les classe (ajoutables / minées / illisibles / nues).
//   node scripts/i18n/clefs.js replis --ecrire [--sortie a-traduire.json]
//       Ajoute les clefs ajoutables à fr.js (valeur = le repli, mot pour mot) et
//       écrit la liste { clef: texte français } qui reste à traduire.
//   node scripts/i18n/clefs.js replis --ignores
//       Liste aussi les replis IGNORÉS (clef déjà dans fr.js, texte différent).
//   node scripts/i18n/clefs.js replis --controle --traductions I18N-1.en.json
//       N'écrit RIEN. Vérifie que chaque clef ajoutable a sa traduction anglaise
//       dans le fichier, avec les mêmes {{jetons}}. Code 1 sinon. C'est la porte
//       d'un lot I18N-1..4, qui ne touche jamais fr.js ni en.js.
//   node scripts/i18n/clefs.js en --traductions traductions.json
//       Ajoute à en.js toutes les clefs de fr.js qui lui manquent, en lisant leur
//       texte anglais dans le fichier donné. Refuse s'il en manque une seule.
//
// 🧨 POURQUOI UNE CLEF « MINÉE » N'EST JAMAIS AJOUTÉE : dès qu'une clef existe
// dans fr.js, i18next IGNORE le repli. Une clef appelée avec deux replis
// différents (`t('common.confirm', 'Accepter')` et `t('common.confirm',
// 'Refuser')`) transformerait l'un des deux boutons en l'autre. Même raison pour
// une clef dont UN des appels a un repli illisible (gabarit, concaténation).
// Voir src/theme/strings/translations/frClefsAtteignables.test.js.
//
// 🔢 Pluriels : `t('clef', { count, defaultValue_one: '…', defaultValue_other: '…' })`
// ajoute `clef_one` et `clef_other` (i18next lit ces replis depuis la v21).
//
// ✍️ L'insertion suit l'ordre de `perfectionist/sort-objects` (alphabétique,
// casse ignorée, locale en-US) : une clef neuve se pose à sa place, rien d'autre
// ne bouge. Dans fr.js, une ligne de plus de 100 caractères reçoit sa dérogation
// `max-len` (un texte ne se coupe pas).
const fs = require('fs');
const path = require('path');

const { parse } = require('@babel/parser');

const RACINE = path.resolve(__dirname, '..', '..');
const SRC = path.join(RACINE, 'src');
const FR = path.join(SRC, 'theme', 'strings', 'translations', 'fr.js');
const EN = path.join(SRC, 'theme', 'strings', 'translations', 'en.js');
const SUFFIXES_DE_PLURIEL = ['', '_zero', '_one', '_two', '_few', '_many', '_other'];
const CLEF_POINTEE = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/;
const LARGEUR_MAX = 100;
const EN_VIDE = [
  '// 🔤 I18N-0 — l\'app en anglais. MÊMES clefs que fr.js : le témoin',
  '// src/theme/strings/__tests__/enClefsIdentiques.test.js rougit dès qu\'une clef',
  '// manque ici. `node scripts/i18n/clefs.js en --traductions <json>` la pose à sa place.',
  '// Un texte ne se coupe pas : la largeur de ligne ne s\'applique pas à ce fichier.',
  '/* eslint-disable max-len */',
  'export default {',
  '};',
  '',
].join('\n');

const lireArgument = (nom) => {
  const index = process.argv.indexOf(nom);
  return index === -1 ? undefined : process.argv[index + 1];
};

const comparer = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase(), 'en-US');

// ---------------------------------------------------------------------------
// Le dictionnaire : un `export default { ... }` d'objets et de textes.
// ---------------------------------------------------------------------------

const racineDuDictionnaire = (source) => {
  const ast = parse(source, { sourceType: 'module' });
  const exportation = ast.program.body.find((n) => n.type === 'ExportDefaultDeclaration');
  if (!exportation || exportation.declaration.type !== 'ObjectExpression') {
    throw new Error('Le dictionnaire doit être un `export default { ... }`.');
  }
  return exportation.declaration;
};

const nomDeLaPropriete = (propriete) => propriete.key.name ?? propriete.key.value;

// Le texte d'un littéral : 'a', "a", `a`, et 'a' + 'b' (fr.js coupe ses longues
// phrases ainsi).
const texteDuNoeud = (noeud) => {
  if (!noeud) return undefined;
  if (noeud.type === 'StringLiteral') return noeud.value;
  if (noeud.type === 'TemplateLiteral' && noeud.expressions.length === 0) {
    return noeud.quasis[0].value.cooked;
  }
  if (noeud.type === 'BinaryExpression' && noeud.operator === '+') {
    const gauche = texteDuNoeud(noeud.left);
    const droite = texteDuNoeud(noeud.right);
    return gauche === undefined || droite === undefined ? undefined : gauche + droite;
  }
  return undefined;
};

// Le dictionnaire mis à plat : { 'a.b.c': 'texte' }.
const aPlat = (source) => {
  const plat = {};
  const parcourir = (objet, prefixe) => {
    objet.properties.forEach((propriete) => {
      const nom = nomDeLaPropriete(propriete);
      const clef = prefixe ? `${prefixe}.${nom}` : nom;
      if (propriete.value.type === 'ObjectExpression') {
        parcourir(propriete.value, clef);
        return;
      }
      const texte = texteDuNoeud(propriete.value);
      if (texte === undefined) {
        throw new Error(`Valeur non textuelle pour ${clef}`);
      }
      plat[clef] = texte;
    });
  };
  parcourir(racineDuDictionnaire(source), '');
  return plat;
};

const litteral = (texte) => {
  const echapper = (guillemet) => texte
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .split(guillemet)
    .join(`\\${guillemet}`);
  if (texte.includes("'") && !texte.includes('"')) return `"${echapper('"')}"`;
  return `'${echapper("'")}'`;
};

const nomDeClef = (nom) => (/^([A-Za-z_$][A-Za-z0-9_$]*|0|[1-9][0-9]*)$/.test(nom)
  ? nom
  : litteral(nom));

// Rend une propriété (texte ou objet) à la profondeur donnée, enfants triés.
const rendre = (nom, valeur, profondeur, avecDerogation) => {
  const retrait = '  '.repeat(profondeur);
  if (typeof valeur === 'string') {
    const ligne = `${retrait}${nomDeClef(nom)}: ${litteral(valeur)},`;
    const derogation = avecDerogation && ligne.length > LARGEUR_MAX
      ? `${retrait}// eslint-disable-next-line max-len\n`
      : '';
    return `${derogation}${ligne}\n`;
  }
  const enfants = Object.keys(valeur)
    .sort(comparer)
    .map((enfant) => rendre(enfant, valeur[enfant], profondeur + 1, avecDerogation))
    .join('');
  return `${retrait}${nomDeClef(nom)}: {\n${enfants}${retrait}},\n`;
};

const debutDeLigne = (source, index) => source.lastIndexOf('\n', index - 1) + 1;

const cheminsDes = (valeur, chemin) => (typeof valeur === 'string'
  ? [chemin]
  : Object.entries(valeur).flatMap(([nom, enfant]) => cheminsDes(enfant, `${chemin}.${nom}`)));

// Ajoute des clefs { 'a.b': 'texte' } au dictionnaire, chacune à sa place triée.
// Rend le nouveau texte et les clefs refusées (chemin qui traverse un texte,
// clef déjà présente, ou clef à la fois texte et objet dans les ajouts).
const ajouterClefs = (source, ajouts, { avecDerogation = true } = {}) => {
  const arbre = {};
  const refusees = [];
  Object.keys(ajouts).sort().forEach((clef) => {
    const parties = clef.split('.');
    let noeud = arbre;
    const bloque = parties.slice(0, -1).some((partie) => {
      if (typeof noeud[partie] === 'string') return true;
      noeud[partie] = noeud[partie] || {};
      noeud = noeud[partie];
      return false;
    });
    const feuille = parties[parties.length - 1];
    if (bloque || noeud[feuille] !== undefined) {
      refusees.push(clef);
      return;
    }
    noeud[feuille] = ajouts[clef];
  });

  const insertions = [];
  const visiter = (objet, sousArbre, profondeur, prefixe) => {
    const proprietes = objet.properties;
    const parNom = new Map(proprietes.map((p) => [nomDeLaPropriete(p), p]));
    Object.keys(sousArbre).sort(comparer).forEach((nom) => {
      const valeur = sousArbre[nom];
      const chemin = prefixe ? `${prefixe}.${nom}` : nom;
      const existante = parNom.get(nom);
      if (existante) {
        if (typeof valeur !== 'string' && existante.value.type === 'ObjectExpression') {
          visiter(existante.value, valeur, profondeur + 1, chemin);
          return;
        }
        refusees.push(...cheminsDes(valeur, chemin));
        return;
      }
      const suivante = proprietes.find((p) => comparer(nomDeLaPropriete(p), nom) > 0);
      let position;
      if (suivante) {
        const commentaire = suivante.leadingComments && suivante.leadingComments[0];
        position = debutDeLigne(source, commentaire ? commentaire.start : suivante.start);
      } else {
        const fermante = objet.end - 1;
        position = debutDeLigne(source, fermante);
        if (source.slice(position, fermante).trim() !== '') {
          throw new Error(`Accolade fermante non isolée sur sa ligne (${chemin}).`);
        }
        const derniere = proprietes[proprietes.length - 1];
        if (derniere && !source.slice(derniere.end, fermante).includes(',')) {
          insertions.push({ ordre: -1, position: derniere.end, texte: ',' });
        }
      }
      insertions.push({
        ordre: insertions.length,
        position,
        texte: rendre(nom, valeur, profondeur, avecDerogation),
      });
    });
  };
  visiter(racineDuDictionnaire(source), arbre, 1, '');

  // De la fin vers le début ; à position égale, l'ordre trié est conservé.
  const resultat = insertions
    .sort((a, b) => (b.position - a.position) || (b.ordre - a.ordre))
    .reduce((texte, insertion) => (
      texte.slice(0, insertion.position) + insertion.texte + texte.slice(insertion.position)
    ), source);
  return { refusees, source: resultat };
};

// ---------------------------------------------------------------------------
// Les appels `t('clef', repli)` de la production.
// ---------------------------------------------------------------------------

const fichiersDeProduction = (dossier, acc = []) => {
  fs.readdirSync(dossier, { withFileTypes: true }).forEach((entree) => {
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) {
      if (!['__mocks__', '__tests__', 'node_modules'].includes(entree.name)) {
        fichiersDeProduction(complet, acc);
      }
      return;
    }
    if (/\.(js|jsx|ts|tsx)$/.test(entree.name) && !/\.(test|spec)\./.test(entree.name)) {
      acc.push(complet);
    }
  });
  return acc;
};

const analyser = (fichier, source) => parse(source, {
  errorRecovery: true,
  plugins: /\.tsx?$/.test(fichier) ? ['jsx', 'typescript'] : ['jsx'],
  sourceType: 'module',
});

// Parcours générique d'un arbre Babel.
const parcourirAst = (noeud, rappel) => {
  if (!noeud || typeof noeud.type !== 'string') return;
  rappel(noeud);
  Object.keys(noeud).forEach((champ) => {
    if (['innerComments', 'leadingComments', 'loc', 'trailingComments'].includes(champ)) return;
    const valeur = noeud[champ];
    if (Array.isArray(valeur)) {
      valeur.forEach((enfant) => parcourirAst(enfant, rappel));
    } else if (valeur && typeof valeur.type === 'string') {
      parcourirAst(valeur, rappel);
    }
  });
};

const estUnAppelDeT = (appel) => {
  const { callee } = appel;
  if (callee.type === 'Identifier') return callee.name === 't';
  return callee.type === 'MemberExpression'
    && !callee.computed
    && callee.property.name === 't'
    && callee.object.type === 'Identifier'
    && ['i18n', 'i18next'].includes(callee.object.name);
};

// Le repli d'un appel : { textes: { suffixe: texte } } s'il est lisible (suffixe
// '' pour un repli simple, '_one' / '_other'… pour un pluriel), { illisible: true }
// s'il y en a un qu'on ne sait pas lire, null s'il n'y en a pas.
const repliDeLAppel = (appel) => {
  const second = appel.arguments[1];
  if (!second) return null;
  const texte = texteDuNoeud(second);
  if (texte !== undefined) return { textes: { '': texte } };
  if (second.type !== 'ObjectExpression') return { illisible: true };
  const defauts = second.properties.filter((p) => p.type === 'ObjectProperty'
    && /^defaultValue(_[a-z]+)?$/.test(String(nomDeLaPropriete(p))));
  if (defauts.length === 0) return null;
  const textes = {};
  const lisibles = defauts.every((p) => {
    textes[String(nomDeLaPropriete(p)).replace('defaultValue', '')] = texteDuNoeud(p.value);
    return texteDuNoeud(p.value) !== undefined;
  });
  return lisibles ? { textes } : { illisible: true };
};

// Ajoute à `appels` les `t('clef', …)` littéraux d'une source.
const releverDansLaSource = (appels, relatif, source) => {
  parcourirAst(analyser(relatif, source).program, (noeud) => {
    if (noeud.type !== 'CallExpression' || !estUnAppelDeT(noeud)) return;
    const clef = texteDuNoeud(noeud.arguments[0]);
    if (!clef || !CLEF_POINTEE.test(clef)) return;
    if (!appels.has(clef)) appels.set(clef, []);
    appels.get(clef).push({
      endroit: `${relatif}:${noeud.loc.start.line}`,
      repli: repliDeLAppel(noeud),
    });
  });
  return appels;
};

const releverLesAppels = () => {
  const appels = new Map();
  fichiersDeProduction(SRC).forEach((fichier) => {
    const relatif = path.relative(RACINE, fichier).split(path.sep).join('/');
    releverDansLaSource(appels, relatif, fs.readFileSync(fichier, 'utf8'));
  });
  return appels;
};

const presente = (plat, clef) => SUFFIXES_DE_PLURIEL.some((suffixe) => (
  typeof plat[`${clef}${suffixe}`] === 'string'
));

const classerLesReplis = (plat, appels = releverLesAppels()) => {
  const absentes = [...appels.entries()].filter(([clef]) => !presente(plat, clef));
  const ajoutables = {};
  const minees = [];
  const illisibles = [];
  const nues = [];
  absentes.forEach(([clef, usages]) => {
    if (usages.every((u) => !u.repli)) {
      nues.push(clef);
      return;
    }
    if (usages.some((u) => !u.repli || u.repli.illisible)) {
      illisibles.push(clef);
      return;
    }
    const signature = (usage) => JSON.stringify(Object.entries(usage.repli.textes).sort());
    const signatures = new Set(usages.map(signature));
    if (signatures.size > 1) {
      minees.push(clef);
      return;
    }
    Object.entries(usages[0].repli.textes).forEach(([suffixe, texte]) => {
      ajoutables[`${clef}${suffixe}`] = texte;
    });
  });
  const tous = [...appels.values()].flat();
  // 🪤 Un repli IGNORÉ : la clef existe déjà dans fr.js avec un autre texte, et
  // i18next affiche celui de fr.js. Un lot qui choisit une clef déjà prise voit
  // ce compteur monter — et son texte remplacé sans bruit.
  const ignores = [...appels.entries()]
    .filter(([clef]) => typeof plat[clef] === 'string')
    .flatMap(([clef, usages]) => usages
      .filter((u) => u.repli && u.repli.textes && typeof u.repli.textes[''] === 'string'
        && u.repli.textes[''] !== plat[clef])
      .map((u) => `${clef} (${u.endroit})`));
  return {
    absentes: absentes.length,
    ajoutables,
    appelsAvecRepli: tous.filter((u) => u.repli).length,
    appelsLitteraux: tous.length,
    clefsAppelees: appels.size,
    ignores: ignores.sort(),
    illisibles: illisibles.sort(),
    minees: minees.sort(),
    nues: nues.sort(),
  };
};

// ---------------------------------------------------------------------------

const jetons = (texte) => (String(texte).match(/\{\{[^}]+\}\}/g) || []).sort().join(' ');

// Chaque clef ajoutable a-t-elle sa traduction, avec les mêmes jetons ?
const bilanDesTraductions = (ajoutables, traductions) => {
  const clefs = Object.keys(ajoutables);
  return {
    enTrop: Object.keys(traductions).filter((clef) => ajoutables[clef] === undefined),
    jetonsFaux: clefs.filter((clef) => typeof traductions[clef] === 'string'
      && jetons(traductions[clef]) !== jetons(ajoutables[clef])),
    manquantes: clefs.filter((clef) => typeof traductions[clef] !== 'string'
      || traductions[clef].trim() === ''),
  };
};

const controlerLesTraductions = (ajoutables) => {
  const chemin = lireArgument('--traductions');
  if (!chemin) throw new Error('--controle exige --traductions <fichier.json>.');
  const traductions = JSON.parse(fs.readFileSync(chemin, 'utf8'));
  const { enTrop, jetonsFaux, manquantes } = bilanDesTraductions(ajoutables, traductions);
  console.log(`controle: ajoutables=${Object.keys(ajoutables).length}`
    + ` manquantes=${manquantes.length} jetonsFaux=${jetonsFaux.length} enTrop=${enTrop.length}`);
  if (enTrop.length) console.log(`controle: en trop (sans appel) = ${enTrop.join(', ')}`);
  if (manquantes.length || jetonsFaux.length) {
    console.error(`controle: manquantes = ${manquantes.join(', ')}`);
    console.error(`controle: jetons differents = ${jetonsFaux.join(', ')}`);
    process.exit(1);
  }
};

const commandeReplis = () => {
  const sourceFr = fs.readFileSync(FR, 'utf8');
  const bilan = classerLesReplis(aPlat(sourceFr));
  const nbAjoutables = Object.keys(bilan.ajoutables).length;
  console.log(`replis: appelsLitteraux=${bilan.appelsLitteraux}`
    + ` clefsAppelees=${bilan.clefsAppelees}`
    + ` appelsAvecRepli=${bilan.appelsAvecRepli}`);
  console.log(`replis: clefsAbsentesDeFr=${bilan.absentes} ajoutables=${nbAjoutables}`
    + ` minees=${bilan.minees.length} illisibles=${bilan.illisibles.length}`
    + ` nues=${bilan.nues.length} replisIgnores=${bilan.ignores.length}`);
  const lister = (titre, clefs) => {
    if (clefs.length) console.log(`replis: ${titre} = ${clefs.join(', ')}`);
  };
  lister('minees (jamais ajoutees)', bilan.minees);
  lister('illisibles (jamais ajoutees)', bilan.illisibles);
  lister("NUES (l'ecran affiche la clef)", bilan.nues);
  if (process.argv.includes('--ignores')) lister('replis ignores', bilan.ignores);
  if (process.argv.includes('--controle')) {
    controlerLesTraductions(bilan.ajoutables);
    return;
  }
  if (!process.argv.includes('--ecrire')) return;

  const { refusees, source } = ajouterClefs(sourceFr, bilan.ajoutables);
  fs.writeFileSync(FR, source, 'utf8');
  const ecrites = Object.fromEntries(Object.entries(bilan.ajoutables)
    .filter(([clef]) => !refusees.includes(clef)));
  const sortie = lireArgument('--sortie');
  if (sortie) fs.writeFileSync(sortie, `${JSON.stringify(ecrites, null, 1)}\n`, 'utf8');
  const detail = refusees.length ? ` (${refusees.join(', ')})` : '';
  console.log(`replis: ecrites dans fr.js=${Object.keys(ecrites).length}`
    + ` refusees=${refusees.length}${detail}`);
};

const commandeEn = () => {
  const cheminTraductions = lireArgument('--traductions');
  if (!cheminTraductions) throw new Error('--traductions <fichier.json> est obligatoire.');
  const traductions = JSON.parse(fs.readFileSync(cheminTraductions, 'utf8'));
  const fr = aPlat(fs.readFileSync(FR, 'utf8'));
  const sourceEn = fs.existsSync(EN) ? fs.readFileSync(EN, 'utf8') : EN_VIDE;
  const en = aPlat(sourceEn);
  const manquantes = Object.keys(fr).filter((clef) => en[clef] === undefined);
  const sansTraduction = manquantes.filter((clef) => typeof traductions[clef] !== 'string');
  if (sansTraduction.length) {
    console.error(`en: ${sansTraduction.length} clef(s) sans traduction :`
      + ` ${sansTraduction.slice(0, 20).join(', ')}`);
    process.exit(1);
  }
  const ajouts = Object.fromEntries(manquantes.map((clef) => [clef, traductions[clef]]));
  const { refusees, source } = ajouterClefs(sourceEn, ajouts, { avecDerogation: false });
  fs.writeFileSync(EN, source, 'utf8');
  console.log(`en: ajoutees=${manquantes.length - refusees.length} refusees=${refusees.length}`);
};

if (require.main === module) {
  const commandes = { en: commandeEn, replis: commandeReplis };
  const commande = commandes[process.argv[2]];
  if (!commande) {
    console.error('Usage : node scripts/i18n/clefs.js replis'
      + ' [--ecrire | --controle --traductions <json>] | en --traductions <json>');
    process.exit(1);
  }
  commande();
}

module.exports = {
  ajouterClefs,
  aPlat,
  bilanDesTraductions,
  classerLesReplis,
  releverDansLaSource,
};
