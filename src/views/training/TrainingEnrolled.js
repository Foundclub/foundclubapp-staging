import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ClubCardSurface from '@/components/molecules/clubCard/ClubCardSurface';
import { formatSessionDate } from '@/components/organisms/training/TrainingSessionRow';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

/**
 * « C'EST DANS TON ENTRAÎNEMENT » — la confirmation d'inscription.
 *
 * 🔎 POURQUOI CET ÉCRAN EXISTE. Le bouton de la fiche inscrivait DIRECTEMENT et
 * filait au planning : la personne se retrouvait devant une liste de huit
 * journées sans jamais avoir lu à quoi elle venait de s'engager, ni ce qu'elle
 * doit préparer avant la première.
 *
 * 🔎 ON N'EN REVIENT PAS EN ARRIÈRE, et c'est voulu : l'inscription est faite,
 * il n'y a rien à annuler ici. Les deux boutons REMPLACENT la flèche de retour —
 * « Voir mes séances », ou « Plus tard ». L'écran vit donc à la racine de la
 * navigation, pas dans l'onglet : le dock s'efface, comme sur toute page-tâche.
 */

/** Ce qu'il faut avoir sous la main avant la première séance. */
const A_PREPARER = ['partner', 'phone', 'tripod'];

/**
 * L'écran de confirmation.
 * @param {object} props
 * @param {Record<string, any>} props.navigation
 * @param {Record<string, any>} [props.route]
 * @returns {React.ReactElement} l'écran de confirmation d'inscription
 */
function TrainingEnrolled({ navigation, route = undefined }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();

  const {
    endDate, firstSession, programTitle, sessionsCount, startDate,
  } = route?.params || {};

  return (
    <ScreenContainer bgImage="bg2">
      <ScrollView
        contentContainerStyle={[Spaces.paddingBottom[24], { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <View style={[Spaces.gap[16], { flex: 1 }]}>
          {/* Le rond vert : il dit sans un mot que c'est enregistré. */}
          <View style={{ alignItems: 'center' }}>
            <View style={{
              alignItems: 'center',
              backgroundColor: withAlpha(Colors.success500, 0.16),
              borderColor: Colors.success500,
              borderRadius: 999,
              borderWidth: 2,
              height: 72,
              justifyContent: 'center',
              width: 72,
            }}
            >
              <Text style={[Fonts.h2Bold, { color: Colors.success500 }]}>✓</Text>
            </View>
          </View>

          <Text style={[Fonts.h2Bold, { color: Colors.neutral00, textAlign: 'center' }]}>
            {t('training.enrolled.title')}
          </Text>

          {/*
            🐞 LE TITRE NE DOIT PAS ETRE ECHAPPE. i18next echappe les valeurs
            interpolees : un « / » dans le nom d un programme ressort en « &#x2F; »
            a l ecran — defaut vu le 2026-09-08. `SANS_ECHAPPEMENT` leve la regle
            POUR CET APPEL SEULEMENT ; l appel suivant reste protege.
          */}
          <Text style={[Fonts.p2, { color: Colors.neutral200, textAlign: 'center' }]}>
            {t('training.enrolled.recap', {
              ...SANS_ECHAPPEMENT,
              count: sessionsCount || 0,
              end: formatSessionDate(endDate),
              program: programTitle || '',
              start: formatSessionDate(startDate),
            })}
          </Text>

          {Boolean(firstSession) && (
            <Text style={[Fonts.p3, { color: Colors.primary200, textAlign: 'center' }]}>
              {t('training.enrolled.firstSession', {
                ...SANS_ECHAPPEMENT,
                date: formatSessionDate(startDate),
                day: firstSession,
              })}
            </Text>
          )}

          {/*
            Ce qu'il faut trouver AVANT la première séance. Ce n'est pas du
            décor : sans partenaire ni trépied, le Jour T ne se mesure pas.
          */}
          <ClubCardSurface
            style={[
              Spaces.gap[8],
              {
                borderColor: withAlpha(Colors.primary500, 0.25),
                borderRadius: 12,
                borderWidth: 1,
                padding: 14,
              },
            ]}
          >
            <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
              {t('training.enrolled.before.title')}
            </Text>
            {A_PREPARER.map((clef) => (
              <View key={clef} style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={[Fonts.p3, { color: Colors.primary500 }]}>•</Text>
                <Text style={[Fonts.p3, { color: Colors.neutral200, flex: 1 }]}>
                  {t(`training.enrolled.before.${clef}`)}
                </Text>
              </View>
            ))}
          </ClubCardSurface>

          <View style={[Spaces.gap[8], { marginTop: 'auto' }]}>
            <Button
              onPress={() => navigation.navigate(RouteNames.TrainingSessions)}
              title={t('training.enrolled.seeSessions')}
              variant="Primary"
            />
            <Button
              onPress={() => navigation.navigate(RouteNames.SearchHome)}
              title={t('training.enrolled.later')}
              variant="Ghost"
            />
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default TrainingEnrolled;
