/* eslint-disable jsdoc/require-jsdoc */
import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { buildManualCallUpPlayer, hasSilentCallUp } from './matchCallUpUtils';

/**
 * D77 — ECRAN 3 : « Ajouter un joueur hors app ».
 *
 * Un ECRAN PLEIN, jamais une feuille : la saisie a 4 champs et un interrupteur,
 * une feuille la ferait passer sous le clavier.
 *
 * 🔒 La regle du pack qui commande cet ecran : le joueur hors app ne doit JAMAIS
 * recevoir une promesse fausse. Sans telephone (ou SMS refuse), le bandeau jaune
 * est obligatoire, et l'etiquette « Pas de SMS » le suit partout ensuite —
 * c'est `hasSilentCallUp` qui decide des deux, pour qu'ils ne puissent pas
 * se contredire.
 */

function MatchCallUpManualPlayer() {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  /** @type {{ returnParams?: object, teamName?: string }} */
  const params = route.params || {};
  const { returnParams = {}, teamName = '' } = params;

  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [notifyBySms, setNotifyBySms] = useState(false);

  // Le joueur tel qu'il sera cree : le bandeau d'avertissement et l'etiquette
  // qui le suivra lisent EXACTEMENT le meme objet, donc la meme verite.
  const previewPlayer = useMemo(
    () => buildManualCallUpPlayer({
      firstname, jerseyNumber, lastname, notifyBySms, phone,
    }),
    [firstname, jerseyNumber, lastname, notifyBySms, phone],
  );
  const willBeSilent = hasSilentCallUp(previewPlayer);

  const handleSubmit = useCallback(() => {
    if (!firstname.trim() || !lastname.trim()) {
      Alert.alert(
        t('matchCallUp.manualPlayer.title'),
        t('matchCallUp.manualPlayer.errors.nameRequired'),
      );
      return;
    }

    // On revient a l'ecran 1 en lui rendant TOUS ses parametres d'origine :
    // `navigate` vers un ecran deja empile y revient en depilant, et on ne
    // depend pas de la fusion implicite des parametres.
    // @ts-ignore
    navigation.navigate(RouteNames.MatchCallUpSelection, {
      ...returnParams,
      pendingManualPlayer: buildManualCallUpPlayer({
        firstname, jerseyNumber, lastname, notifyBySms, phone,
      }),
    });
  }, [
    firstname,
    jerseyNumber,
    lastname,
    navigation,
    notifyBySms,
    phone,
    returnParams,
    t,
  ]);

  const renderField = (/** @type {any} */ {
    keyboardType, label, maxLength, onChangeText, optional, placeholder, value,
  }) => (
    <View style={Spaces.marginBottom[12]}>
      <View style={styles.fieldLabelRow}>
        <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{label}</Text>
        {optional ? (
          <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
            {t('matchCallUp.manualPlayer.fields.optional').toUpperCase()}
          </Text>
        ) : null}
      </View>
      <TextInput
        accessibilityLabel={label}
        keyboardType={keyboardType}
        maxLength={maxLength}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.neutral400}
        style={[
          styles.fieldInput,
          Fonts.p1,
          {
            backgroundColor: withAlpha(Colors.neutral900, 0.3),
            borderColor: value ? Colors.primary500 : withAlpha(Colors.neutral00, 0.12),
            color: Colors.neutral00,
          },
        ]}
        value={value}
      />
    </View>
  );

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="edge-to-edge" style={[styles.screen]}>
      <View style={styles.header}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerTexts}>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {t('matchCallUp.manualPlayer.title')}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {t('matchCallUp.manualPlayer.subtitle', { teamName })}
          </Text>
        </View>
      </View>

      {/* D84 — meme correctif qu'a l'ecran 1, et pour la meme cause mesuree : un
          ScrollView sans `flex: 1` se mesure a la hauteur de ses enfants et
          pousse le pied de page dehors. Le formulaire pese 696 pt : il debordait
          deja sur un petit telephone, et sur tous des que le clavier retracte la
          fenetre — or c'est ici qu'on tape, le clavier y est presque toujours la. */}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.list}
      >
        <View
          style={[
            styles.introCard,
            {
              backgroundColor: withAlpha(Colors.primary500, 0.07),
              borderColor: withAlpha(Colors.primary500, 0.3),
            },
          ]}
        >
          <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>
            {t('matchCallUp.manualPlayer.intro')}
          </Text>
        </View>

        {renderField({
          label: t('matchCallUp.manualPlayer.fields.firstname.label'),
          onChangeText: setFirstname,
          placeholder: t('matchCallUp.manualPlayer.fields.firstname.placeholder'),
          value: firstname,
        })}
        {renderField({
          label: t('matchCallUp.manualPlayer.fields.lastname.label'),
          onChangeText: setLastname,
          placeholder: t('matchCallUp.manualPlayer.fields.lastname.placeholder'),
          value: lastname,
        })}
        {renderField({
          keyboardType: 'number-pad',
          label: t('matchCallUp.manualPlayer.fields.jerseyNumber.label'),
          maxLength: 2,
          onChangeText: setJerseyNumber,
          optional: true,
          placeholder: t('matchCallUp.manualPlayer.fields.jerseyNumber.placeholder'),
          value: jerseyNumber,
        })}

        <View style={[styles.separator, { backgroundColor: withAlpha(Colors.neutral00, 0.1) }]} />

        {renderField({
          keyboardType: 'phone-pad',
          label: t('matchCallUp.manualPlayer.fields.phone.label'),
          onChangeText: setPhone,
          optional: true,
          placeholder: t('matchCallUp.manualPlayer.fields.phone.placeholder'),
          value: phone,
        })}

        <View
          style={[
            styles.smsCard,
            {
              backgroundColor: withAlpha(Colors.neutral00, 0.04),
              borderColor: withAlpha(Colors.neutral00, 0.1),
            },
          ]}
        >
          <View style={styles.smsTexts}>
            <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
              {t('matchCallUp.manualPlayer.sms.title')}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {t('matchCallUp.manualPlayer.sms.subtitle')}
            </Text>
          </View>
          <Switch
            accessibilityLabel={t('matchCallUp.manualPlayer.sms.title')}
            onValueChange={setNotifyBySms}
            thumbColor={Colors.neutral00}
            trackColor={{ false: Colors.neutral700, true: Colors.primary500 }}
            value={notifyBySms}
          />
        </View>

        {willBeSilent ? (
          <View
            style={[
              styles.warningCard,
              {
                backgroundColor: withAlpha(Colors.warning500, 0.09),
                borderColor: withAlpha(Colors.warning500, 0.34),
              },
            ]}
          >
            <View style={[styles.warningDot, { backgroundColor: Colors.warning500 }]} />
            <Text style={[Fonts.p3, styles.warningText, { color: Colors.neutral00 }]}>
              {t('matchCallUp.manualPlayer.warning.before', {
                firstname: firstname.trim()
                  || t('matchCallUp.manualPlayer.warning.fallbackName'),
              })}
              {' '}
              <Text style={[Fonts.p3Bold, { color: Colors.warning500 }]}>
                {t('matchCallUp.manualPlayer.warning.strong')}
              </Text>
              {t('matchCallUp.manualPlayer.warning.after')}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          onPress={() => navigation.goBack()}
          style={styles.footerCancel}
          title={t('matchCallUp.manualPlayer.actions.cancel')}
          variant="Secondary"
        />
        <Button
          onPress={handleSubmit}
          style={styles.footerSubmit}
          title={t('matchCallUp.manualPlayer.actions.submit')}
          variant="Primary"
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  fieldInput: {
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fieldLabelRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerCancel: {
    width: 108,
  },
  footerSubmit: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
    paddingVertical: 8,
  },
  headerTexts: {
    flex: 1,
  },
  introCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  list: {
    flex: 1,
  },
  screen: {
    paddingHorizontal: 0,
  },
  separator: {
    height: 1,
    marginBottom: 16,
    marginTop: 4,
  },
  smsCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  smsTexts: {
    flex: 1,
  },
  warningCard: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    padding: 16,
  },
  warningDot: {
    borderRadius: 4,
    height: 8,
    marginTop: 5,
    width: 8,
  },
  warningText: {
    flex: 1,
  },
});

export default MatchCallUpManualPlayer;
