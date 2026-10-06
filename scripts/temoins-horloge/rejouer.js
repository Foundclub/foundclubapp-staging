/**
 * `npm run temoins:horloge` — LE GARDE-FOU DES BOMBES À RETARDEMENT (TEMOINS-DATES, 06/10/2026).
 *
 * Rejoue toute la suite Jest à l'heure réelle (la référence), puis avec le calendrier avancé de
 * 30 et de 365 jours (`avancer-date.js`). Un témoin vert à l'heure réelle et rouge plus tard
 * dépend de la date du jour : il rougira tout seul ce jour-là, sans qu'une ligne ait changé.
 *
 * Chaque rouge nouveau est CONFIRMÉ : son fichier est rejoué seul, à l'heure réelle puis avancée.
 * Seul un rouge qui se reproduit seul compte ; les autres sont dits « instables » (charge du PC).
 * Si une passe voit tomber plus de 25 fichiers d'un coup, elle est déclarée EFFONDRÉE et n'est
 * pas confirmée : constaté le 06/10, une tâche de fond coupée par sa minuterie laisse ses enfants
 * incapables de lancer un processus (Windows 0xC0000142) ; tout ce qui démarre ensuite tombe.
 *
 * Sortie 0 = vert · 1 = au moins une bombe confirmée · 2 = passe effondrée, à relancer.
 * Un témoin déjà rouge à l'heure réelle n'est PAS compté : `npx jest` mesure le reste.
 *
 * ⚠️ Suite LOURDE (passes complètes, `--maxWorkers=2`) : prendre le jeton des portes
 * (`JETON_PORTES.md`). Volontairement HORS de la CI et des portes : l'y brancher est un geste R4.
 *
 * Options : `--jours 7,30,90,365` (décalages, en jours) · `--sortie <fichier.json>` (le détail)
 *           · `--fichiers <motif>` (seulement les témoins dont le chemin correspond, comme Jest).
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const racine = path.join(__dirname, '..', '..');
const avancerDate = path.join(__dirname, 'avancer-date.js').replace(/\\/g, '/');
const configuration = path.join(__dirname, 'jest.config.horloge.js');
const jest = require.resolve('jest/bin/jest', { paths: [racine] });
const SEUIL_EFFONDREMENT = 25;

const ecrire = (ligne) => process.stdout.write(`${ligne}\n`);
const lireOption = (nom, defaut) => {
  const i = process.argv.indexOf(nom);
  return i === -1 ? defaut : process.argv[i + 1];
};
const decalages = String(lireOption('--jours', '30,365'))
  .split(',')
  .map(Number)
  .filter((n) => n > 0);
const sortie = lireOption('--sortie', null);
const motif = lireOption('--fichiers', null);

const optionsNodeDeDepart = process.env.NODE_OPTIONS || '';
const fichierDe = (cle) => cle.split(' › ')[0];
const premiereLigne = (texte) => String(texte || '').split('\n').find((l) => l.trim()) || '';

const lireLesRouges = (json) => {
  const rouges = new Map();
  json.testResults.forEach((fichier) => {
    const nom = path.relative(racine, fichier.name).replace(/\\/g, '/');
    const echecs = fichier.assertionResults.filter((a) => a.status === 'failed');
    echecs.forEach((a) => {
      const raison = premiereLigne(a.failureMessages.join('\n')).slice(0, 300);
      rouges.set(`${nom} › ${a.fullName}`, raison);
    });
    if (fichier.status === 'failed' && !echecs.length) {
      const raison = premiereLigne(fichier.message).slice(0, 300);
      rouges.set(`${nom} › (le fichier ne se charge pas)`, raison);
    }
  });
  return rouges;
};

const passe = (jours, fichiers) => {
  const rapport = path.join(os.tmpdir(), `temoins-horloge-app-${process.pid}-${jours}.json`);
  const debut = Date.now();
  const options = [jest, '--config', configuration, '--maxWorkers=2', '--silent', '--json'];
  const cible = fichiers ? ['--runTestsByPath', ...fichiers] : [motif].filter(Boolean);
  const resultat = spawnSync(process.execPath, options.concat([`--outputFile=${rapport}`], cible), {
    cwd: racine,
    encoding: 'utf8',
    env: {
      ...process.env,
      HORLOGE_DECALAGE_JOURS: String(jours),
      NODE_OPTIONS: jours
        ? `${optionsNodeDeDepart} --require="${avancerDate}"`.trim()
        : optionsNodeDeDepart,
    },
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const secondes = Math.round((Date.now() - debut) / 1000);
  if (!fs.existsSync(rapport)) {
    const fin = String(resultat.stderr).slice(-4000);
    throw new Error(`Aucun rapport Jest à +${jours} j (code ${resultat.status}) : ${fin}`);
  }
  const json = JSON.parse(fs.readFileSync(rapport, 'utf8'));
  fs.unlinkSync(rapport);
  const bilan = `suites ${json.numPassedTestSuites}/${json.numTotalTestSuites}, `
    + `témoins ${json.numPassedTests}/${json.numTotalTests}`;
  return {
    bilan, jours, rouges: lireLesRouges(json), secondes,
  };
};

const confirmer = (jours, nouveaux) => {
  const suspects = [...new Set(nouveaux.map(fichierDe))];
  const seulsReel = passe(0, suspects);
  const seulsAvances = passe(jours, suspects);
  const confirmes = nouveaux.filter(
    (cle) => seulsAvances.rouges.has(cle) && !seulsReel.rouges.has(cle),
  );
  return { confirmes, instables: nouveaux.filter((cle) => !confirmes.includes(cle)) };
};

const decalerUnePasse = (jours, reference) => {
  const r = passe(jours);
  const nouveaux = [...r.rouges.keys()].filter((cle) => !reference.rouges.has(cle)).sort();
  const fichiersTombes = new Set(nouveaux.map(fichierDe)).size;
  const effondree = fichiersTombes > SEUIL_EFFONDREMENT;
  const verdict = effondree || !nouveaux.length
    ? { confirmes: [], instables: [] }
    : confirmer(jours, nouveaux);
  ecrire(`  +${jours} j : ${nouveaux.length} rouge(s) nouveau(x) dans ${fichiersTombes} fichier(s) `
    + `(${r.bilan}), ${r.secondes} s — `
    + `${effondree ? 'PASSE EFFONDRÉE' : `${verdict.confirmes.length} confirmé(s) seul(s)`}`);
  const raisons = Object.fromEntries(nouveaux.map((cle) => [cle, r.rouges.get(cle)]));
  return {
    effondree, jours, raisons, secondes: r.secondes, ...verdict,
  };
};

const conclure = (resultats, totalSecondes) => {
  resultats.filter((r) => r.instables.length).forEach((r) => {
    ecrire(`\nInstables à +${r.jours} j (rouges en suite complète, verts seuls) :`);
    r.instables.forEach((cle) => ecrire(`    ~ ${cle}`));
  });
  const bombes = resultats.filter((r) => r.confirmes.length);
  bombes.forEach((r) => {
    ecrire(`\nBOMBES à +${r.jours} jours (vertes aujourd’hui, rouges ce jour-là, confirmées) :`);
    r.confirmes.forEach((cle) => ecrire(`    - ${cle}\n        ${r.raisons[cle]}`));
  });
  if (bombes.length) {
    ecrire(`\nROUGE (${totalSecondes} s). Désamorcer : une horloge figée dans le témoin `
      + '(jest.useFakeTimers({ now }) / jest.setSystemTime).');
    process.exitCode = 1;
  } else if (resultats.some((r) => r.effondree)) {
    ecrire(`\nINVALIDE (${totalSecondes} s) : une passe s’est effondrée `
      + `(plus de ${SEUIL_EFFONDREMENT} fichiers d’un coup). Relancer sur un PC au calme.`);
    process.exitCode = 2;
  } else {
    ecrire(`\nVERT : aucun témoin ne dépend de la date du jour (${totalSecondes} s).`);
  }
};

try {
  const debut = Date.now();
  const liste = decalages.map((j) => `+${j}`).join(', ');
  ecrire(`Horloge avancée sur la suite Jest, décalages : 0 (référence), ${liste} jours`);
  const reference = passe(0);
  ecrire(`  référence : ${reference.rouges.size} rouge(s) (${reference.bilan}), `
    + `${reference.secondes} s`);
  const resultats = decalages.map((jours) => decalerUnePasse(jours, reference));
  const totalSecondes = Math.round((Date.now() - debut) / 1000);
  if (sortie) {
    const referenceJson = { ...reference, rouges: Object.fromEntries(reference.rouges) };
    const detail = { reference: referenceJson, resultats, totalSecondes };
    fs.writeFileSync(sortie, JSON.stringify(detail, null, 2));
  }
  if (reference.rouges.size) {
    ecrire(`\n${reference.rouges.size} rouge(s) DÉJÀ à l'heure réelle (non comptés ici) :`);
    reference.rouges.forEach((raison, cle) => ecrire(`    · ${cle}`));
  }
  conclure(resultats, totalSecondes);
} catch (erreur) {
  process.stderr.write(`${erreur.stack || erreur}\n`);
  process.exitCode = 1;
}
