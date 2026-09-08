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
// 🚨🚨 AVIS AU RÉCOLTEUR — À LIRE AVANT DE FUSIONNER CETTE BRANCHE 🚨🚨
//
// **CE PAQUET N'EST PAS INSTALLÉ DANS `D:/App/fc/app`.** Mesuré le 2026-09-08 :
// `require.resolve('intl-pluralrules')` y rend MODULE_NOT_FOUND. Fusionner sans rien
// faire casse TOUT ce qui charge ce fichier — 35 fichiers l'importent directement, et
// l'app entière en dépend.
//
// 🪤 POURQUOI, ET C'EST UNE ERREUR DE MA PART QUE JE CORRIGE ICI : le message du commit
// `053d7cb6` affirme « node_modules est une JONCTION vers D:/App/fc/app — installer ici
// écrit dans la copie principale ». **C'ÉTAIT VRAI AVANT L'INSTALLATION, ET FAUX APRÈS.**
// `npm install` a REMPLACÉ la jonction par un arbre privé de 741 paquets (dossier créé
// le 08/09 à 15:41:37, la seconde même de l'installation). Le paquet a donc atterri dans
// le worktree SEUL. La copie principale est restée à 740 paquets, intacte — et les
// 203 autres worktrees qui partagent sa jonction n'ont rien vu passer.
//
// ✅ LE GESTE QUI MANQUE, et il est sur la liste noire (R4 n° 6, GO d'Adel obligatoire) :
//
//     cd D:/App/fc/app && npx npm@10 install intl-pluralrules@2.0.1
//
// ⛔ SURTOUT PAS `npm ci` NI `npm install` SANS ARGUMENT dans `D:/App/fc/app` : son
// `node_modules` est la cible de **203 jonctions** de worktrees. Un `npm ci` efface et
// reconstruit l'arbre pour les 203 en même temps. L'ajout d'un seul paquet, lui, est
// purement additif.
// ⛔ Et `npm@10`, jamais le npm 11 local : la CI refuse un lock écrit par npm 11.
//
// 🧪 LA PREUVE D'ARRÊT, à coller :
//     cd D:/App/fc/app && node -e "console.log(require.resolve('intl-pluralrules'))"
//     → doit imprimer un chemin (aujourd'hui : MODULE_NOT_FOUND)
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
