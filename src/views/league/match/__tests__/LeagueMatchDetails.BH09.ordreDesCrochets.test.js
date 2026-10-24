const fs = require('fs');
const path = require('path');

// BH09 P10-01 : un tableau de dépendances est évalué pendant le rendu. Il ne doit citer
// aucune `const` du composant déclarée plus bas (zone morte => ReferenceError à l'ouverture).
const source = fs.readFileSync(path.join(__dirname, '..', 'LeagueMatchDetails.js'), 'utf8');
const lines = source.split('\n');

const declarationLine = (name) => lines.findIndex((l) => l.startsWith(`  const ${name} `));

const depsOf = (name) => {
  const start = declarationLine(name);
  let i = start + 1;
  while (!/^  \}, \[/.test(lines[i])) i += 1;
  let deps = lines[i].replace(/^  \}, \[/, '');
  while (!/\]\);/.test(deps)) { i += 1; deps += lines[i]; }
  return deps.replace(/\]\);.*/, '').split(',').map((d) => d.trim()).filter(Boolean);
};

test.each(['renderNegotiationActions', 'renderPostSlotResolutionActions'])(
  '%s ne cite que des valeurs déjà déclarées',
  (name) => {
    const own = declarationLine(name);
    expect(own).toBeGreaterThan(0);
    const late = depsOf(name).filter((dep) => {
      const at = declarationLine(dep.split('.')[0]);
      return at > own;
    });
    expect(late).toEqual([]);
  },
);
