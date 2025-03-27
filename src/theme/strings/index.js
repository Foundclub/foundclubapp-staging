import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import DefaultJoi from 'joi';
import { setDefaultOptions } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as translations from './translations';
import validations from './translations/validations';

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
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
  lng: 'fr',
  fallbackLng: 'fr',
});

export default i18n;

export const Joi = DefaultJoi.defaults(
  (schema) => schema.options({
    abortEarly: false,
    messages: validations,
    errors: { language: i18n.language },
  }),
);

setDefaultOptions({ locale: fr });
