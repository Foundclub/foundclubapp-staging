import fs from 'fs';
import path from 'path';

import { parse } from '@babel/parser';

import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

// SANS-EMOJI — décision d'Adel du 01/10/2026 : « on évite les emoji, tout ; si
// besoin on fait un design nous » (système de design FoundClub, consigne 10).
//
// Ce témoin rougit dès qu'un emoji, un pictogramme, une flèche ou une coche
// typographique réapparaît dans un TEXTE de l'app :
// - les valeurs de fr.js et en.js ;
// - les textes du code de production sous src/ : littéraux '…' "…", gabarits
//   `…`, texte JSX (les commentaires ne s'affichent pas, ils ne comptent pas).
//
// Un symbole qui porte un sens se remplace par une icône déjà dessinée
// (`GlyphIcon`, `theme/images.js`) posée À CÔTÉ du texte ; un symbole de décor
// se retire. S'il n'existe aucune icône : texte seul, et une ligne dans la
// liste « icônes à dessiner » du compte rendu du lot.

const RACINE = path.resolve(__dirname, '..', '..', '..', '..');
const SRC = path.join(RACINE, 'src');
const DICTIONNAIRES = path.join(SRC, 'theme', 'strings', 'translations');
// Mêmes exclusions que la porte du français en dur (scripts/i18n/francais-en-dur.js).
const DOSSIERS_EXCLUS = ['__mocks__', '__tests__', 'node_modules', 'testSupport'];

// Les seuls fichiers où un emoji est le CONTENU et non un décor de l'app.
// Décision d'Adel du 01/10/2026 vers 17h25 (« on garde A », relayée par le chef
// d'orchestre) : les emoji de la messagerie RESTENT. C'est l'expression des
// membres, pas un texte de l'interface ; la règle « aucun emoji » vise les
// boutons, titres, messages du système et notifications.
const FICHIERS_EXCEPTES = {
  // Le clavier d'emoji de la messagerie : ce sont les emoji que l'UTILISATEUR
  // envoie dans ses messages.
  'src/domains/messaging/emojiCatalog.js': 'clavier d emoji de la messagerie',
  // Les 6 réactions rapides d'un message. La même liste est validée par le
  // serveur (admin `chat-message-reactions.js`) et stockée telle quelle :
  // la changer ici rendrait illisibles les réactions déjà enregistrées.
  'src/domains/messaging/reactionUseCases.js': 'réactions rapides des messages',
};

const SYMBOLE = new RegExp([
  '\\p{Extended_Pictographic}',
  '\\p{Emoji_Presentation}',
  '[\\u{1F1E6}-\\u{1F1FF}]', // lettres des drapeaux
  '[\\u2190-\\u21FF]', // flèches
  '[\\u2300-\\u23FF]', // signes techniques (⌫ ⏱ ⌛)
  '[\\u2460-\\u24FF]', // chiffres et lettres cerclés
  '[\\u2500-\\u25FF]', // traits, blocs, formes (▼ ● ■)
  '[\\u2600-\\u27BF]', // symboles divers et dingbats (★ ✓ ✕)
  '[\\u27F0-\\u27FF]',
  '[\\u2900-\\u297F]',
  '[\\u2B00-\\u2BFF]', // flèches et formes (⭐)
  '[\\u{1F000}-\\u{1FAFF}]',
  '\\uFE0F', // sélecteur « présentation emoji »
  '\\u20E3', // touche cerclée (1️⃣)
].join('|'), 'u');

// © et ® sont des marques légales, pas des pictogrammes : l'attribution des
// fonds de carte (« © OpenStreetMap contributors ») est exigée par leur licence.
const MARQUES_LEGALES = /[©®]/gu;

const contientSymbole = (texte) => SYMBOLE.test(String(texte).replace(MARQUES_LEGALES, ''));

const feuilles = (noeud, prefixe = []) => Object.entries(noeud).flatMap(([clef, valeur]) => {
  const chemin = prefixe.concat(clef);
  if (valeur !== null && typeof valeur === 'object') return feuilles(valeur, chemin);
  return [[chemin.join('.'), valeur]];
});

const fichiersDeProduction = (dossier, acc = []) => {
  fs.readdirSync(dossier, { withFileTypes: true }).forEach((entree) => {
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) {
      if (!DOSSIERS_EXCLUS.includes(entree.name) && complet !== DICTIONNAIRES) {
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

const CHAMPS_IGNORES = ['innerComments', 'leadingComments', 'loc', 'trailingComments', 'extra'];

// Les textes porteurs d'un symbole dans une source : ['fichier:ligne  texte'].
const textesAvecSymbole = (fichier, relatif) => {
  const ast = parse(fs.readFileSync(fichier, 'utf8'), {
    errorRecovery: true,
    plugins: /\.tsx?$/.test(fichier) ? ['jsx', 'typescript'] : ['jsx'],
    sourceType: 'module',
  });
  const trouves = [];
  const visiter = (noeud) => {
    if (!noeud || typeof noeud.type !== 'string') return;
    let texte = null;
    if (noeud.type === 'StringLiteral' || noeud.type === 'JSXText') texte = noeud.value;
    if (noeud.type === 'TemplateElement') texte = noeud.value.cooked ?? noeud.value.raw;
    if (texte !== null && contientSymbole(texte)) {
      trouves.push(`${relatif}:${noeud.loc.start.line}  ${JSON.stringify(texte.trim())}`);
    }
    Object.entries(noeud).forEach(([champ, valeur]) => {
      if (CHAMPS_IGNORES.includes(champ)) return;
      if (Array.isArray(valeur)) valeur.forEach(visiter);
      else if (valeur && typeof valeur.type === 'string') visiter(valeur);
    });
  };
  visiter(ast.program);
  return trouves;
};

describe('SANS-EMOJI — aucun emoji dans les textes de l app', () => {
  it('reconnaît bien les symboles qu il doit refuser', () => {
    // Garde-fou du témoin : une expression qui ne reconnaîtrait rien serait toujours verte.
    ['🎉', '✓', '✕', '→', '★', '⚠️', '🇫🇷', '▼', '⌫', '✅', '⭐'].forEach((symbole) => {
      expect(contientSymbole(`Texte ${symbole}`)).toBe(true);
    });
    [
      'Équipe', '« Créer l alerte »', '+33', '2 × 45 min', '© OpenStreetMap', 'Club · Équipe', '…',
    ].forEach((texte) => expect(contientSymbole(texte)).toBe(false));
  });

  it.each([['fr', fr], ['en', en]])('aucune valeur de %s.js ne porte de symbole', (
    _langue,
    dictionnaire,
  ) => {
    const valeurs = feuilles(dictionnaire);
    expect(valeurs.length).toBeGreaterThan(1000);
    const fautives = valeurs
      .filter(([, valeur]) => typeof valeur === 'string' && contientSymbole(valeur))
      .map(([clef, valeur]) => [clef, JSON.stringify(valeur)].join('  '));
    expect(fautives).toEqual([]);
  });

  it('aucun texte du code de production ne porte de symbole', () => {
    const fichiers = fichiersDeProduction(SRC);
    expect(fichiers.length).toBeGreaterThan(500);
    const fautifs = fichiers.flatMap((fichier) => {
      const relatif = path.relative(RACINE, fichier).split(path.sep).join('/');
      if (FICHIERS_EXCEPTES[relatif]) return [];
      return textesAvecSymbole(fichier, relatif);
    });
    expect(fautifs).toEqual([]);
  });

  it('chaque exception nomme un fichier qui existe encore', () => {
    // Une exception dont le fichier a disparu doit sortir de la liste, sinon
    // elle couvrirait demain un fichier neuf du même nom.
    Object.keys(FICHIERS_EXCEPTES).forEach((relatif) => {
      expect(fs.existsSync(path.join(RACINE, relatif))).toBe(true);
    });
  });
});
