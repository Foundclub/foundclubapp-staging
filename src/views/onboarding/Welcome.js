import { useTranslation } from 'react-i18next';
import {
  Image, Platform, ScrollView, Text, View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getUserRoleKey,
  markOnboardingComplete,
} from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { storage, useAppContext } from '@/store/appContext';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

import { useTour } from '@/context/TourContext';

/**
 * Welcome screen component shown after completing onboarding.
 * Displays app features and information for new users.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Welcome screen component
 */
function Welcome({ navigation }) {
  // hooks
  const {
    Alignments, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [{ auth }] = useAppContext();
  const {
    getPostOnboardingHomeRoute,
    refetchUserData,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();
  const { startTour } = useTour();
  const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const canShowSubscriptionWelcome = roleKey === 'coach'
    || roleKey === 'president'
    || roleKey === 'superAdmin';
  // Seuls coach et dirigeant demarrent le tour guide v2 (joueur = tour leger a venir).
  const shouldOfferGuidedTour = roleKey === 'coach' || roleKey === 'president';

  // D23 — défaut ⑤ de la recette du 2026-08-07 : « l'écran de bienvenue se
  // saute tout seul ».
  //
  // CE QUI ÉTAIT ICI : un `useEffect` qui, AU MONTAGE, marquait l'écran comme
  // vu, terminait l'onboarding et lançait le tour guidé (décision C10/D2 :
  // « le tour se lance automatiquement, sans clic »). Résultat : l'écran
  // partait avant d'être lu, et le drapeau `hasSeenWelcome_` posé au passage
  // le rendait DÉFINITIVEMENT injoignable — `getNextOnboardingRoute` s'arrête
  // dessus.
  //
  // La décision d'Adel du 2026-08-06 dit l'inverse, mot pour mot :
  // « Bienvenue sort du COMPTEUR mais n'est PAS supprimé. » Il doit arriver à
  // la fin, sans numéro d'étape, montrer les offres et LANCER le tour guidé —
  // depuis son bouton, qui appelle `startTour` juste en dessous. L'auto-départ
  // est donc retiré : c'est la seule chose qui l'empêchait d'être vu.

  // D59 ② — LE CHEMIN EN 3 ETAPES (pack `pw-welcome2.jsx`, frame 12c).
  //
  // CE QUI ETAIT ICI : trois cartes d'offres de meme poids, empilees. Deux
  // defauts nommes par le pack : (a) la hierarchie etait plate alors que la
  // personne EST en Gratuit — la promesse du sous-titre (« debloque la suite
  // quand ton equipe grandit ») n'etait pas dessinee ; (b) la carte Club etait
  // VERTE (`rgba(16,185,129)`, hex hors palette), alors que le code couleur des
  // offres est cyan = Equipe / violet = Club, le vert etant reserve au registre
  // succes et aux coches.
  //
  // Les quotas gratuits restent des constantes produit : des puces statiques
  // evitent l'etat « resume pas encore charge », qui affichait un texte vague au
  // moment le plus vendeur.
  const progressionSteps = [
    {
      accentColor: Colors.success500,
      borderColor: withAlpha(Colors.neutral00, 0.14),
      bullets: [
        t('welcome.subscription.free.bullet1', '1 équipe offerte'),
        // « 1 match » est retire : un match EST un type d'evenement, l'annoncer
        // a part survendait le quota gratuit.
        t('welcome.subscription.free.bullet2', '1 événement et 1 annonce offerts'),
        t('welcome.subscription.free.bullet3', 'Chat illimité, pour toujours'),
      ],
      fillColor: withAlpha(Colors.neutral00, 0.05),
      isReached: true,
      key: 'free',
      kicker: t('welcome.subscription.free.kicker', "Aujourd'hui"),
      kickerColor: Colors.success200,
      title: t('welcome.subscription.free.title', 'Commence sans payer'),
    },
    {
      accentColor: Colors.primary500,
      borderColor: withAlpha(Colors.primary500, 0.32),
      bullets: [
        t('welcome.subscription.team.bullet1', 'Événements et matchs illimités'),
        t('welcome.subscription.team.bullet2', 'Convocations en 2 taps'),
        t('welcome.subscription.team.bullet3', "Cotisation encaissée dans l'app"),
      ],
      fillColor: withAlpha(Colors.primary500, 0.09),
      key: 'team',
      kicker: t('welcome.subscription.team.kicker', 'Quand ton équipe grandit'),
      kickerColor: Colors.primary200,
      title: t('welcome.subscription.team.title', 'Débloque tes équipes'),
    },
    {
      accentColor: Colors.violet500,
      borderColor: withAlpha(Colors.violet500, 0.38),
      bullets: [
        t('welcome.subscription.club.bullet1', 'Toutes les équipes du club incluses'),
        t('welcome.subscription.club.bullet2', 'Installations et réservations'),
        t('welcome.subscription.club.bullet3', 'Sponsors et canal de diffusion'),
      ],
      fillColor: withAlpha(Colors.violet500, 0.09),
      footnote: t('welcome.subscription.club.footnote', 'Réservée aux clubs vérifiés'),
      isLast: true,
      key: 'club',
      kicker: t('welcome.subscription.club.kicker', "Quand ton club s'organise"),
      kickerColor: Colors.violet200,
      title: t('welcome.subscription.club.title', 'Pilote tout le club'),
    },
  ];

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous récupérons ton profil avant de finaliser l'onboarding."
        isLoading
        title="Chargement du profil"
      />
    );
  }

  if (userDataError) {
    return (
      <OnboardingStateView
        actionLabel="Réessayer"
        description={userDataError?.message || 'Impossible de charger ton profil.'}
        onAction={refetchUserData}
        title="Chargement impossible"
      />
    );
  }

  const finalizeOnboarding = () => {
    if (auth?.user?.documentId) {
      storage.set(`hasSeenWelcome_${auth.user.documentId}`, true);
      // Mark onboarding as fully completed so it won't show again
      markOnboardingComplete(auth.user.documentId);
    }
  };

  const navigateAfterOnboarding = (targetRoute, params) => {
    if (Platform.OS === 'web') {
      if (typeof navigation?.replace === 'function') {
        navigation.replace(targetRoute, params);
        return;
      }

      if (typeof navigation?.navigate === 'function') {
        navigation.navigate(targetRoute, params);
        return;
      }
    }

    navigation.reset({
      index: 0,
      routes: [{ name: targetRoute, ...(params ? { params } : {}) }],
    });
  };

  const handleContinue = () => {
    finalizeOnboarding();
    // Tour leger joueur (4 etapes, zero vente) : demarre a la sortie du Welcome.
    if (roleKey === 'player' && startTour('player')) {
      return;
    }
    navigateAfterOnboarding(getPostOnboardingHomeRoute());
  };

  const handleStartTour = () => {
    finalizeOnboarding();
    // Tour guide v2 : navigation directe page par page avec messages de succes
    // (docs/PLAN_TOUR_GUIDE_V2_2026_07_10.md). Fallback home si pas de script.
    const started = startTour(roleKey === 'president' ? 'president' : 'coach');
    if (started) {
      return;
    }
    navigateAfterOnboarding(getPostOnboardingHomeRoute());
  };

  // Une etape du rail : la colonne de gauche porte la pastille et le trait qui
  // relie a l'etape suivante, la carte porte le contenu. Seule la 1re est
  // ACQUISE (pastille pleine + coche) : c'est ce contraste qui dessine un
  // chemin plutot qu'un catalogue.
  const renderProgressionStep = (step) => (
    <View key={step.key} style={[Alignments.row, { columnGap: 12 }]}>
      <View style={[Alignments.alignCenter, { width: 24 }]}>
        <View
          style={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            {
              backgroundColor: step.isReached ? step.accentColor : Colors.transparent,
              borderColor: step.accentColor,
              borderRadius: 11,
              borderWidth: 2,
              height: 22,
              width: 22,
            },
          ]}
        >
          {step.isReached ? (
            <Image
              source={Images.check}
              style={{ height: 11, width: 11 }}
              tintColor={Colors.primary900}
            />
          ) : (
            <View
              style={{
                backgroundColor: step.accentColor,
                borderRadius: 3,
                height: 6,
                width: 6,
              }}
            />
          )}
        </View>
        {step.isLast ? null : (
          <LinearGradient
            colors={[withAlpha(Colors.neutral00, 0.22), withAlpha(Colors.neutral00, 0.07)]}
            style={[Alignments.fill, { width: 2 }]}
          />
        )}
      </View>
      <View
        style={[
          Alignments.fill,
          {
            backgroundColor: step.fillColor,
            borderColor: step.borderColor,
            borderRadius: 16,
            borderWidth: 1,
            marginBottom: step.isLast ? 0 : 10,
            paddingHorizontal: 13,
            paddingVertical: 10,
          },
        ]}
      >
        <Text
          style={[
            Fonts.p4Bold,
            { color: step.kickerColor, letterSpacing: 1.3, textTransform: 'uppercase' },
          ]}
        >
          {step.kicker}
        </Text>
        <Text style={[Fonts.p1Black, Fonts.neutral00, { marginBottom: 6, marginTop: 2 }]}>
          {step.title}
        </Text>
        <View style={[Spaces.gap[4]]}>
          {step.bullets.map((bullet) => (
            // La coche est l'icone du DS, plus le glyphe texte « ✓ » : lui seul
            // garde sa forme quand la personne agrandit la taille du systeme.
            <View key={bullet} style={[Alignments.row, { columnGap: 8 }]}>
              <Image
                source={Images.check}
                style={{ height: 13, marginTop: 2, width: 13 }}
                tintColor={Colors.success500}
              />
              <Text style={[Fonts.p3, Fonts.neutral100, Alignments.fill]}>
                {bullet}
              </Text>
            </View>
          ))}
        </View>
        {step.footnote ? (
          <View style={[Alignments.row, Alignments.alignCenter, { columnGap: 6, marginTop: 7 }]}>
            <Image
              source={Images.shield}
              style={{ height: 11, width: 11 }}
              tintColor={Colors.violet200}
            />
            <Text style={[Fonts.p4Bold, { color: Colors.violet200 }]}>
              {step.footnote}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <FormScreenContainer
      bgImage="bg2"
      // D31 ⑤ — l'écran pose LUI-MÊME le retrait bas (`marginBottom` ci-dessous).
      // Sans ce mode, le conteneur en ajoutait un SECOND : `insets.bottom` était
      // compté deux fois, soit ~34 pt de vide sous le bouton du bas.
      bottomInsetMode="edge-to-edge"
      contentContainerStyle={[
        Spaces.padding[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
        { marginBottom: insets.bottom },
      ]}
      contentWidth="readable"
    >
      {canShowSubscriptionWelcome ? (
        <>
          {/* Titre HORS defilement : apres 6 etapes, il ne doit plus partir au
              premier geste. Le sous-titre est degraisse (p2 au lieu de h4Bold) —
              deux titres gras se concurrencaient. */}
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.h1Bold, Fonts.neutral00]}>
              {t('welcome.subscription.title', 'Bienvenue dans FoundClub')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                roleKey === 'president'
                  ? 'welcome.subscription.presidentSubtitle'
                  : 'welcome.subscription.coachSubtitle',
                roleKey === 'president'
                  ? 'Commence gratuitement. Débloque la suite quand ton club grandit.'
                  : 'Commence gratuitement. Débloque la suite quand ton équipe grandit.',
              )}
            </Text>
          </View>
          {/* La cible est ZERO defilement : le ScrollView n'est qu'un filet pour
              les petits gabarits, d'ou `flexGrow` + centrage. Le degrade de fondu
              bas a ete retire, il voilait la carte Club. */}
          <ScrollView
            contentContainerStyle={[Alignments.justifyCenter, { flexGrow: 1 }]}
            style={[Alignments.fill]}
          >
            <View style={[Spaces.paddingVertical[12]]}>
              {progressionSteps.map(renderProgressionStep)}
            </View>
          </ScrollView>
          <View style={[Spaces.gap[8]]}>
            {/* Reassurance REMONTEE au-dessus du bouton : elle etait sous le pli,
                donc invisible. */}
            <Text style={[Fonts.p3, Fonts.neutral300, Fonts.textCenter]}>
              {t(
                'welcome.subscription.hint',
                'Tu retrouveras les offres à tout moment dans Profil → Mon abonnement.',
              )}
            </Text>
            {shouldOfferGuidedTour ? (
              // Tour guidé obligatoire (décision produit 2026-07-10) : pas d'option
              // « Passer » — le seul chemin de sortie est de démarrer le tour.
              <Button
                onPress={handleStartTour}
                title={t('welcome.tour.actions.start', 'Démarrer le tour guidé')}
                variant="Primary"
              />
            ) : (
              <Button
                onPress={handleContinue}
                title={t('welcome.subscription.actions.skip', 'Continuer')}
                variant="Primary"
              />
            )}
            {/* Pont sous le bouton : il desamorce un tour guide obligatoire en
                disant ce qu'il coute (rien) et ce qu'il produit. */}
            <Text style={[Fonts.p3Bold, Fonts.primary200, Fonts.textCenter]}>
              {t(
                roleKey === 'president'
                  ? 'welcome.subscription.presidentBridge'
                  : 'welcome.subscription.coachBridge',
                roleKey === 'president'
                  ? 'Gratuit · 2 min — tu configures ton club en chemin'
                  : 'Gratuit · 2 min — tu crées ta 1ʳᵉ équipe en chemin',
              )}
            </Text>
          </View>
        </>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[Spaces.gap[40]]}
            style={[Alignments.fill]}
          >
            <View style={[Alignments.alignCenter, Spaces.gap[12]]}>
              <Text style={[Fonts.h1Bold, Fonts.neutral00]}>
                {t('welcome.title')}
              </Text>
              <Image
                source={Images.logo}
                style={{ height: 17, width: 156 }}
              />

            </View>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('welcome.subtitle')}
            </Text>
            <Text style={[Fonts.p1Black, Fonts.neutral00]}>
              {t('welcome.descriptions.search.bold')}
              <Text style={[Fonts.p1, Fonts.neutral00]}>
                {t('welcome.descriptions.search.regular')}
              </Text>
            </Text>
            <Text style={[Fonts.p1Black, Fonts.neutral00]}>
              {t('welcome.descriptions.register.bold')}
              <Text style={[Fonts.p1, Fonts.neutral00]}>
                {t('welcome.descriptions.register.regular')}
              </Text>
            </Text>
            <Text style={[Fonts.p1Black, Fonts.neutral00]}>
              {t('welcome.descriptions.club.bold')}
              <Text style={[Fonts.p1, Fonts.neutral00]}>
                {t('welcome.descriptions.club.regular')}
              </Text>
            </Text>
            <Text style={[Fonts.p1Black, Fonts.neutral00]}>
              {t('welcome.descriptions.info.bold')}
              <Text style={[Fonts.p1, Fonts.neutral00]}>
                {t('welcome.descriptions.info.regular')}
              </Text>
            </Text>
          </ScrollView>
          <View style={[Spaces.gap[12]]}>
            <Button
              onPress={handleContinue}
              title={t('welcome.actions.go')}
              variant="Primary"
            />
          </View>
        </>
      )}
    </FormScreenContainer>
  );
}

export default Welcome;
