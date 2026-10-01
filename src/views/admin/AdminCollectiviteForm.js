import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  COLLECTIVITE_TYPES,
  collectiviteTypeLabel,
  readCollectiviteCreateForm,
} from '@/domains/collectivite/collectiviteDisplay';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useCreateAdminCollectivite } from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * Le debut officiel du nom, pose dans le champ quand on choisit le type (D59). Ce sont des
 * noms FRANCAIS (« Ville de … ») quelle que soit la langue de l ecran : le dictionnaire
 * anglais porte la meme valeur.
 * @param {(cle: string, repli: string) => string} t - La traduction.
 * @param {string} type - Le type choisi.
 * @returns {string} Le prefixe, espace final compris.
 */
const prefixeOfficiel = (t, type) => {
  switch (type) {
    case 'departement': return t('adminCollectivites.form.prefixes.departement', 'Département de ');
    case 'intercommunalite':
      return t('adminCollectivites.form.prefixes.intercommunalite', 'Communauté de communes ');
    case 'region': return t('adminCollectivites.form.prefixes.region', 'Région ');
    default: return t('adminCollectivites.form.prefixes.commune', 'Ville de ');
  }
};

/**
 * Un exemple de forme officielle, par type.
 * @param {(cle: string, repli: string) => string} t - La traduction.
 * @param {string} type - Le type choisi.
 * @returns {string} L exemple.
 */
const exempleOfficiel = (t, type) => {
  switch (type) {
    case 'departement':
      return t('adminCollectivites.form.examples.departement', '« Département du Var »');
    case 'intercommunalite':
      return t(
        'adminCollectivites.form.examples.intercommunalite',
        '« Communauté de communes du Val » ou « Métropole Aix-Marseille-Provence »',
      );
    case 'region': return t('adminCollectivites.form.examples.region', '« Région Sud »');
    default:
      return t(
        'adminCollectivites.form.examples.commune',
        '« Ville de Montrivage » ou « Ville d’Aix »',
      );
  }
};

/**
 * 🏛️ CONSOLE › COLLECTIVITES › CREER (D61, 2026-09-29).
 *
 * Le nom se saisit sous sa FORME OFFICIELLE (D59) : le bandeau « Offert par la Ville de X »
 * le lit tel quel. Aide : choisir le type pose son debut officiel dans le champ (s il est
 * vide ou ne porte qu un autre debut) et montre un exemple. Controle : le formulaire ne part
 * pas tant que le nom ne commence pas par un debut officiel de son type (le serveur, lui,
 * ne le controle pas) ; code INSEE ou SIREN obligatoire, formats du serveur.
 * La collectivite nait INACTIVE : l activer reste un geste a part (liste ou detail).
 * Creee : on ouvre son detail, a la place du formulaire.
 * @returns {import('react').ReactElement} L ecran.
 */
function AdminCollectiviteForm() {
  const { t } = useTranslation();
  const navigation = /** @type {any} */ (useNavigation());
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const [form, setForm] = useState(() => ({
    codeInsee: '',
    email: '',
    name: prefixeOfficiel(t, 'commune'),
    phoneNumber: '',
    siren: '',
    type: 'commune',
  }));
  const [fautes, setFautes] = useState(/** @type {string[]} */ ([]));
  const creer = useCreateAdminCollectivite();

  // TEXTES-COLLECTIVITES (01/10) — « retour » effacait une saisie remplie sans rien demander,
  // et il n y avait pas de bouton « Annuler ». Une saisie VIDE (seul le debut officiel du nom,
  // pose par l ecran) part sans question ; sinon, on demande. Apres une creation reussie, le
  // detail remplace le formulaire sans question (`sortieLibre`).
  // ponytail: sur le site, le « retour » du NAVIGATEUR ne passe pas par `beforeRemove` (la
  // couche web de la navigation ne l emet pas) : seul « Annuler » y demande. Voie de sortie :
  // un `beforeunload` dans la couche web, s il le faut un jour.
  const sortieLibre = useRef(false);
  const debutsOfficiels = COLLECTIVITE_TYPES.map((type) => prefixeOfficiel(t, type).trim());
  const saisieVide = ['codeInsee', 'email', 'phoneNumber', 'siren']
    .every((cle) => !String(/** @type {any} */ (form)[cle] || '').trim())
    && ['', ...debutsOfficiels].includes(form.name.trim());
  const demanderAvantDeQuitter = (/** @type {() => void} */ quitter) => {
    Alert.alert(
      t('adminCollectivites.form.leave.title', 'Quitter sans créer la collectivité ?'),
      t('adminCollectivites.form.leave.message', 'Ce que tu as saisi sera perdu.'),
      [
        { style: 'cancel', text: t('adminCollectivites.form.leave.stay', 'Rester') },
        {
          onPress: () => {
            sortieLibre.current = true;
            quitter();
          },
          style: 'destructive',
          text: t('adminCollectivites.form.leave.confirm', 'Quitter'),
        },
      ],
    );
  };
  useEffect(() => navigation.addListener?.('beforeRemove', (/** @type {any} */ evenement) => {
    if (sortieLibre.current || saisieVide) return;
    evenement.preventDefault();
    demanderAvantDeQuitter(() => navigation.dispatch(evenement.data.action));
  }));
  const annuler = () => {
    if (saisieVide) {
      navigation.goBack?.();
      return;
    }
    demanderAvantDeQuitter(() => navigation.goBack?.());
  };

  const changer = (/** @type {keyof typeof form} */ champ) => (/** @type {string} */ valeur) => {
    setFautes([]);
    setForm((avant) => ({ ...avant, [champ]: valeur }));
  };
  const choisirType = (/** @type {string} */ type) => {
    setFautes([]);
    setForm((avant) => {
      const prefixes = COLLECTIVITE_TYPES.map((autre) => prefixeOfficiel(t, autre).trim());
      const nomVide = !avant.name.trim() || prefixes.includes(avant.name.trim());
      return { ...avant, name: nomVide ? prefixeOfficiel(t, type) : avant.name, type };
    });
  };

  const libelleFaute = (/** @type {string} */ faute) => {
    switch (faute) {
      case 'codeInsee':
        return t(
          'adminCollectivites.form.errors.codeInsee',
          'Code INSEE : 5 caractères (2A ou 2B en Corse).',
        );
      case 'identifier':
        return t(
          'adminCollectivites.form.errors.identifier',
          'Un code INSEE ou un SIREN est obligatoire.',
        );
      case 'officialName':
        return t('adminCollectivites.form.errors.officialName', {
          exemple: exempleOfficiel(t, form.type),
          ...SANS_ECHAPPEMENT,
        });
      case 'siren': return t('adminCollectivites.form.errors.siren', 'SIREN : 9 chiffres.');
      default: return t('adminCollectivites.form.errors.type', 'Choisis le type de collectivité.');
    }
  };

  const envoyer = () => {
    const { data, errors } = readCollectiviteCreateForm(form);
    setFautes(errors);
    if (errors.length > 0) return;
    creer.mutate(data, {
      onSuccess: (/** @type {any} */ reponse) => {
        const collectiviteId = reponse?.data?.documentId;
        sortieLibre.current = true;
        if (collectiviteId) {
          navigation.replace(RouteNames.AdminCollectiviteDetail, { collectiviteId });
        } else navigation.goBack?.();
      },
    });
  };

  const champStyle = { borderColor: `${Colors.primary500}80`, color: Colors.neutral00 };
  const champ = (/**
     @type {{ autoCapitalize?: 'characters' | 'none' | 'sentences',
    cle: keyof typeof form, keyboardType?: import('react-native').KeyboardTypeOptions,
    label: string, maxLength?: number }} */ {
      autoCapitalize = 'sentences', cle, keyboardType = 'default', label, maxLength = undefined,
    },
  ) => (
    <View style={{ gap: 6 }}>
      <Text style={[Fonts.p3Bold, Fonts.neutral200]}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        maxLength={maxLength}
        onChangeText={changer(cle)}
        placeholderTextColor={Colors.neutral400}
        style={[
          ApplicationStyle.borderRadius16,
          ApplicationStyle.borderWidth1,
          Fonts.p2,
          Spaces.padding[12],
          champStyle,
        ]}
        testID={`admin-collectivite-form-${cle}`}
        value={form[cle]}
      />
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={{ gap: 4 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t('adminCollectivites.list.title', 'Collectivités').toUpperCase()}
          </Text>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('adminCollectivites.form.title', 'Créer une collectivité')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t(
              'adminCollectivites.form.hint',
              'Elle naît inactive : tu l’actives ensuite, depuis la liste ou sa fiche.',
            )}
          </Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
            {t('adminCollectivites.form.type', 'Type')}
          </Text>
          <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
            {COLLECTIVITE_TYPES.map((type) => {
              const choisi = form.type === type;
              return (
                <TouchableOpacity
                  accessibilityRole="radio"
                  accessibilityState={{ selected: choisi }}
                  key={type}
                  onPress={() => choisirType(type)}
                  style={[
                    ApplicationStyle.borderRadius16,
                    ApplicationStyle.borderWidth1,
                    Spaces.paddingHorizontal[12],
                    Spaces.paddingVertical[8],
                    {
                      backgroundColor: choisi ? Colors.primary500 : 'transparent',
                      borderColor: Colors.primary500,
                    },
                  ]}
                  testID={`admin-collectivite-form-type-${type}`}
                >
                  <Text style={[Fonts.p3Bold, choisi ? Fonts.neutral900 : Fonts.neutral00]}>
                    {collectiviteTypeLabel(t, type)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {champ({ cle: 'name', label: t('adminCollectivites.form.name', 'Nom officiel') })}
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t('adminCollectivites.form.nameHint', {
            exemple: exempleOfficiel(t, form.type),
            ...SANS_ECHAPPEMENT,
          })}
        </Text>
        {champ({
          autoCapitalize: 'characters',
          cle: 'codeInsee',
          label: t('adminCollectivites.form.codeInsee', 'Code INSEE'),
          maxLength: 5,
        })}
        {champ({
          cle: 'siren',
          keyboardType: 'number-pad',
          label: t('adminCollectivites.form.siren', 'SIREN'),
          maxLength: 11,
        })}
        {champ({
          autoCapitalize: 'none',
          cle: 'email',
          keyboardType: 'email-address',
          label: t('adminCollectivites.form.email', 'E-mail (facultatif)'),
        })}
        {champ({
          cle: 'phoneNumber',
          keyboardType: 'phone-pad',
          label: t('adminCollectivites.form.phone', 'Téléphone (facultatif)'),
        })}

        {fautes.map((faute) => (
          <Text key={faute} style={[Fonts.p3Bold, Fonts.error500]}>{libelleFaute(faute)}</Text>
        ))}
        {creer.error ? (
          <Text style={[Fonts.p3Bold, Fonts.error500]}>
            {getErrorMessage(/** @type {any} */ (creer.error))}
          </Text>
        ) : null}
        <Button
          disabled={creer.isPending}
          isLoading={creer.isPending}
          onPress={envoyer}
          title={t('adminCollectivites.form.submit', 'Créer')}
          variant="Primary"
        />
        <Button
          disabled={creer.isPending}
          onPress={annuler}
          title={t('adminCollectivites.form.cancel', 'Annuler')}
          variant="Secondary"
        />
      </ScrollView>
    </ScreenContainer>
  );
}

export default AdminCollectiviteForm;
