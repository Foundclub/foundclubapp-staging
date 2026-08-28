import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  canReceiveOnboardingClubGift,
  getUserRoleKey,
} from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { scheduleSubscriptionStateRefresh } from '@/domains/subscription/subscriptionRefresh';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { claimOnboardingGift } from '@/services/subscription/subscriptionService';

/**
 * Les sept usages listés par Adel, DANS SON ORDRE. Ce n'est pas une mise en
 * page : c'est la description qu'il a dictée, et l'ordre en fait partie.
 * @type {string[]}
 */
const USAGE_KEYS = ['usage1', 'usage2', 'usage3', 'usage4', 'usage5', 'usage6', 'usage7'];

/**
 * Le seul espacement dont on ait besoin en NOMBRE (il s'additionne au retrait
 * bas du telephone). Partout ailleurs, `Spaces.<type>[n]` rend un objet de
 * style, jamais un nombre.
 * ⛔ La rampe a des TROUS assumes (ni 6, ni 10, ni 14, ni 20...) : un jeton
 * absent rend `undefined` et React Native l'ignore EN SILENCE.
 * @type {number}
 */
const SPACE_24 = 24;

/**
 * ===========================================================================
 * LA PAGE CADEAU — 2ᵉ marche du sas d'inscription (lot ESSAI, 2026-08-28).
 * ===========================================================================
 * Demande d'Adel, mot pour mot : « juste après l'étape de l'onboarding où l'on
 * présente les abonnements : si le dirigeant ne s'est pas abonné, on lui met une
 * page félicitation, vous avez reçu un cadeau — un abonnement club illimité […].
 * Et là un bouton, et rien d'autre : "Débloquer mon offre" […]. Après, c'est la
 * suite logique comme d'habitude. »
 *
 * ⛔ UN SEUL BOUTON, ET AUCUNE AUTRE SORTIE. Pas de « plus tard », pas de croix,
 * pas de lien gris en pied de page. C'est une consigne explicite, et elle est
 * tenue par un témoin qui COMPTE les boutons rendus
 * (`__tests__/OnboardingGiftScreen.test.js`).
 * ⚠️ Ce n'est pas un cul-de-sac pour autant : l'écran PRÉCÉDENT
 * (`SubscriptionOffers`) porte déjà « Continuer gratuitement », et celui-ci
 * ne peut que faire avancer — le bouton mène à la suite du parcours dans TOUS
 * les cas, cadeau accordé, refusé, ou serveur injoignable.
 *
 * 🚪 LE FILET ANTI-PAGE-BLANCHE, repris tel quel de `SubscriptionOffers`
 * (l. 795) : quand la page n'a rien à offrir — entraîneur, dirigeant déjà
 * abonné, dirigeant sans club — elle ne bloque pas, elle fait avancer. Une
 * porte fermée en fin d'inscription est le seul défaut vraiment coûteux ici.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - Les props de navigation.
 * @returns {import('react').ReactElement | null} L'écran, ou `null` quand il n'a rien à dire.
 */
function OnboardingGiftScreen({ navigation, route }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { clubVerificationSummary, subscriptionAccessLevel, userData } = useAuth();

  // L40 — l'origine est un COLIS : cet écran ne la devine jamais, la porte qui
  // l'a monté la lui donne. Le repli sur `Welcome` n'est pas une précaution :
  // c'est la seule marche qui termine l'inscription (`markOnboardingComplete`),
  // et un dirigeant qui la sauterait serait le seul inscrit à ne jamais finir.
  const resumeRouteName = String(route?.params?.resumeRouteName || '').trim()
    || RouteNames.Welcome;

  const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  // MEME RESOLUTION QUE L'ECRAN VOISIN (SubscriptionOffers l. 255-257), et ce
  // n'est pas une precaution : les deux sources derivent du MEME `user.club`
  // cote serveur (`getClubVerificationSummary` le lit de la, et
  // `claimOnboardingGift` aussi). Lire les deux ne peut donc pas diverger de ce
  // que le serveur fera — ca couvre seulement le cas ou l'une des deux reponses
  // n'a pas encore peuple la relation.
  const clubDocumentId = String(
    clubVerificationSummary?.clubDocumentId || userData?.club?.documentId || '',
  ).trim();
  const canShowGift = canReceiveOnboardingClubGift({
    clubDocumentId,
    roleKey,
    subscriptionAccessLevel,
  });

  const [isClaiming, setIsClaiming] = useState(false);
  // ⚠️ LE VERROU EST UNE REFERENCE, PAS L'ETAT — et c'est un temoin qui l'a
  // impose. Deux appuis dans le meme battement lisent tous les deux
  // `isClaiming === false` : une mise a jour d'etat React n'est pas visible
  // avant le rendu suivant. Le cadeau serait reclame DEUX fois, et seul le
  // carnet unique du serveur l'aurait arrete. Une reference change tout de
  // suite.
  const claimLock = useRef(false);

  // On REMPLACE, on n'empile pas : le retour depuis la bienvenue rouvrirait
  // sinon une page qui annonce un cadeau déjà reçu (défaut D81).
  const leaveGift = useCallback(() => {
    if (typeof navigation?.replace === 'function') {
      navigation.replace(resumeRouteName, undefined);
      return;
    }
    navigation.navigate(resumeRouteName, undefined);
  }, [navigation, resumeRouteName]);

  useEffect(() => {
    if (!canShowGift) {
      leaveGift();
    }
  }, [canShowGift, leaveGift]);

  const handleClaim = useCallback(async () => {
    // Deux appuis rapides ne doivent réclamer qu'une fois. Le serveur s'en
    // protège aussi (la colonne du carnet est UNIQUE), mais il ne devrait pas
    // avoir à le faire pour un double-tap.
    if (claimLock.current) return;
    claimLock.current = true;
    setIsClaiming(true);

    try {
      await claimOnboardingGift();
      // Les droits viennent d'être ouverts côté serveur : sans cette relance,
      // « Mon abonnement » afficherait encore « Gratuit » jusqu'au redémarrage
      // de l'app (défaut L08, mesuré sur la build 2.6.1).
      scheduleSubscriptionStateRefresh(queryClient);
    } catch {
      // ⛔ AUCUNE ALERTE, ET C'EST DÉLIBÉRÉ. Un cadeau qu'on n'a pas pu poser
      // n'est pas une faute du dirigeant, et lui montrer une erreur à la
      // dernière marche de son inscription serait le pire moment de tout le
      // parcours. Le serveur journalise, le cron répare, la personne avance.
    }

    leaveGift();
  }, [leaveGift, queryClient]);

  if (!canShowGift) {
    return null;
  }

  return (
    <ScreenContainer>
      <View
        style={[
          Alignments.fill,
          Alignments.justifyCenter,
          Spaces.paddingHorizontal[24],
          Spaces.gap[24],
          // Le retrait bas du telephone n'est jamais ecrit en dur : il change
          // d'un modele a l'autre (R07 point 6).
          { paddingBottom: SPACE_24 + insets.bottom },
        ]}
      >
        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.h2, Fonts.neutral00, Fonts.textCenter]}>
            {t('profile.subscription.gift.title', 'Félicitations !')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral100, Fonts.textCenter]}>
            {t(
              'profile.subscription.gift.subtitle',
              'Vous avez reçu un cadeau : un abonnement club illimité.',
            )}
          </Text>
        </View>

        <View
          style={[
            Spaces.padding[16],
            Spaces.gap[12],
            {
              // Violet = Club dans le code couleur des offres (cyan = Equipe).
              // Le cadeau EST une offre Club : il porte donc sa couleur.
              backgroundColor: withAlpha(Colors.violet500, 0.09),
              borderColor: withAlpha(Colors.violet500, 0.38),
              borderRadius: 16,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('profile.subscription.gift.intro', 'Profitez-en pour :')}
          </Text>
          {USAGE_KEYS.map((usageKey) => (
            <View
              key={usageKey}
              style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}
            >
              <View
                style={{
                  backgroundColor: Colors.violet200,
                  borderRadius: 4,
                  height: 8,
                  width: 8,
                }}
              />
              <Text style={[Fonts.p2, Fonts.neutral00, Alignments.fill]}>
                {t(`profile.subscription.gift.${usageKey}`, usageKey)}
              </Text>
            </View>
          ))}
        </View>

        {/* ⛔ RIEN D'AUTRE SOUS CE BOUTON. Voir la bannière en tête. */}
        <Button
          isLoading={isClaiming}
          onPress={handleClaim}
          title={t('profile.subscription.gift.cta', 'Débloquer mon offre')}
          variant="Primary"
        />
      </View>
    </ScreenContainer>
  );
}

export default OnboardingGiftScreen;
