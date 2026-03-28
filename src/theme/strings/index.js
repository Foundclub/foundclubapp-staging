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
