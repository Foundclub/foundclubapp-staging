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
