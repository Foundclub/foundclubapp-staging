// 🔤 LE PLURIEL FRANÇAIS, ET IL DOIT ÊTRE IMPORTÉ EN PREMIER.
//
// 🐞 LE DÉFAUT QU'IL RÉPARE, mesuré à l'écran le 2026-09-08 : l'app affichait
// « 0 séances faites sur 8 », « 0 tests faits », « 0 candidats », « 0 convoqués »,
// « Suspendu 0 matchs ». **En français, ZÉRO prend le SINGULIER.**
//
// 🔎 Ce n'étaient ni les clés ni les appels : les variantes `_one` / `_other` sont
// bonnes et `count` est bien passé. La même configuration donne la bonne réponse
// sous Node (`count=0` → « 0 séance faite »). C'est le moteur JavaScript embarqué
// qui appliquait la règle de l'ANGLAIS, faute de connaître les règles de pluriel du
// français. 43 phrases de l'app étaient concernées.
//
// ⚠️ POURQUOI CET IMPORT ET PAS UN CONTOURNEMENT. Le moteur POSSÈDE bien un
// `Intl.PluralRules` — il le résout simplement mal. Ce module ne s'installe donc pas
// « si Intl manque » : il REMPLACE l'implémentation dès qu'elle est incomplète
// (pas de `selectRange`, ou moins de quatre langues reconnues). C'est ce qui le rend
// efficace ici, là où un polyfill purement conditionnel n'aurait rien fait.
//
// ⛔ Il doit rester AVANT `i18next` : i18next lit `Intl.PluralRules` à l'init, et un
// import posé après ne serait jamais vu.
//
// ✅ AVIS AU RÉCOLTEUR — LE PAQUET EST INSTALLÉ DANS `D:/App/fc/app`
//
// Fait le 2026-09-08 sur GO nominatif d'Adel (« 1- installe »), geste de la liste
// noire R4 n° 6. Prouvé : `require.resolve('intl-pluralrules')` y rend désormais un
// chemin (il rendait MODULE_NOT_FOUND), et la suite complète y passe — 5 964 témoins
// verts, les 14 snapshots compris.
//
// 🧾 CE QUI A ÉTÉ FAIT, ET RIEN D'AUTRE :
//     cd D:/App/fc/app && npx npm@10 install intl-pluralrules@2.0.1 --no-save
//   740 → 741 paquets, **un seul ajout, rien de retiré** (comparaison des deux listes).
//   `package.json` et `package-lock.json` de la copie principale : md5 INCHANGÉS.
//   Les **203 jonctions** des autres worktrees : intactes.
//
// 🪤 POURQUOI `--no-save`, ET CE QUE ÇA LAISSE OUVERT. La copie principale est sur
// `staging` : y modifier `package.json` aurait sali une copie de travail partagée et
// gêné cette fusion — d'autant que la branche porte DÉJÀ la déclaration. Conséquence
// à connaître : tant que la fusion n'a pas eu lieu, le paquet est présent dans
// `node_modules` mais **pas déclaré**. Un `npm ci` dans `D:/App/fc/app` AVANT la
// fusion le supprimerait donc. Après la fusion, il est déclaré et tout install le garde.
//
// ⛔ ET DANS TOUS LES CAS, JAMAIS `npm ci` DANS `D:/App/fc/app` : son `node_modules`
// est la cible de **203 jonctions** de worktrees. Un `npm ci` efface et reconstruit
// l'arbre pour les 203 en même temps.
// ⛔ Et `npm@10`, jamais le npm 11 local : la CI refuse un lock écrit par npm 11.
//
// 🧠 CE QUI A FAILLI COÛTER CHER, et c'est R8 en une phrase : le message du commit
// `053d7cb6` affirmait « installer ici écrit dans la copie principale ». J'avais
// mesuré la jonction AVANT d'installer, puis écrit ce que j'avais mesuré — sans
// re-mesurer APRÈS. `npm install` avait remplacé la jonction du worktree par un arbre
// privé : le paquet était resté là, et nulle part ailleurs.
import 'intl-pluralrules';
import { setDefaultOptions } from 'date-fns';
import { fr } from 'date-fns/locale';
import i18n from 'i18next';
import * as JoiModule from 'joi';
import { initReactI18next } from 'react-i18next';

import * as translations from '@/theme/strings/translations';
import validations from '@/theme/strings/translations/validations';

const DefaultJoi = JoiModule?.default || JoiModule;

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: {
    ...Object.entries(translations).reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: {
          translation: value,
        },
      }),
      {},
    ),
  },
});

export default i18n;

export const Joi = DefaultJoi.defaults(
  (schema) => schema.options({
    abortEarly: false,
    errors: { language: i18n.language },
    messages: validations,
  }),
);

setDefaultOptions({ locale: fr });
