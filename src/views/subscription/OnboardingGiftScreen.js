import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  canReceiveOnboardingClubGift,
  getUserRoleKey,
} from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { ONBOARDING_GIFT_DURATION_DAYS } from '@/domains/subscription/onboardingGift';
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
 * Le retrait latéral de l'écran, en NOMBRE. Il vaut celui de `ScreenContainer`,
 * et il est repris ici parce que le panneau du bouton doit toucher les deux
 * bords : on annule la marge du conteneur (`marginHorizontal: -24`) puis on la
 * réapplique au contenu, exactement comme l'écran des offres (l. 1059).
 * ⛔ `Spaces.<type>[n]` rend un objet de style, jamais un nombre : il ne peut
 * pas servir ici.
 * @type {number}
 */
const SCREEN_SIDE_PADDING = 24;

/**
 * La réserve posée SOUS le bouton, en plus du retrait système. Même nombre que
 * le `bottomInsetExtra` par défaut de `ScreenContainer` et que la réserve du
 * panneau collant de l'écran des offres : les deux écrans se suivent, leur
 * plancher est le même.
 * @type {number}
 */
const CTA_BOTTOM_RESERVE = 12;

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
 * 🔴 CE QUE LA RECETTE D'ADEL A CORRIGÉ (lot CADEAU-2, 2026-08-28) : l'écran
 * annonçait « un abonnement club illimité » SANS AUCUNE BORNE. On pouvait
 * légitimement croire à un abonnement définitif. La durée et la gratuité se
 * lisent désormais AVANT la liste des usages, et la durée vient de
 * `ONBOARDING_GIFT_DURATION_DAYS` — jamais d'un nombre recopié dans une phrase.
 *
 * 🎨 LE LANGAGE VISUEL EST CELUI DE L'ÉCRAN QUI PRÉCÈDE (`SubscriptionOffers`),
 * et ce n'est pas une préférence : les deux écrans se suivent dans le sas, ils
 * doivent sembler être le même produit. On lui reprend, à l'identique, la
 * carcasse de carte (fond `primary800` à 72 %, rayon 20, bord 1,5, retrait 16),
 * la pastille arrondie, la coche verte des bénéfices, et le panneau de bouton
 * ancré en bas — fond `primary900`, trait clair en haut, bords à bords.
 *
 * ⛔ UN SEUL BOUTON, ET AUCUNE AUTRE SORTIE. Pas de « plus tard », pas de croix,
 * pas de lien gris en pied de page. C'est une consigne explicite, répétée deux
 * fois par Adel, et elle est tenue par un témoin qui COMPTE les boutons rendus
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
    <ScreenContainer
      bgImage="bg2"
      // Le panneau du bouton descend jusqu'au bord et porte LUI-MEME le retrait
      // systeme : sans `edge-to-edge`, ce retrait serait compte deux fois et une
      // bande d'image de fond reapparaitrait sous le panneau. Contrat ecrit dans
      // `ScreenContainer`, et deja tenu par l'ecran des offres (l. 1055).
      bottomInsetMode="edge-to-edge"
      contentContainerStyle={[Spaces.paddingBottom[0], Spaces.paddingTop[0]]}
    >
      <View style={[Alignments.fill, { marginHorizontal: -SCREEN_SIDE_PADDING }]}>
        <ScrollView
          contentContainerStyle={[Spaces.paddingBottom[24]]}
          showsVerticalScrollIndicator={false}
          style={Alignments.fill}
        >
          <View
            style={[Spaces.gap[16], { paddingHorizontal: SCREEN_SIDE_PADDING }]}
          >
            {/* LE BLOC DE TITRE. La durée et la gratuité s'y lisent AVANT la
                liste des usages : c'est la correction du lot CADEAU-2. */}
            <View style={[Alignments.alignCenter, Spaces.gap[8]]}>
              <View
                style={{
                  // Pastille de l'ecran des offres (`renderChip`, ton « club »).
                  // Violet = Club dans le code couleur du catalogue (cyan =
                  // Equipe) : le cadeau EST une offre Club, il porte sa couleur.
                  backgroundColor: withAlpha(Colors.violet500, 0.14),
                  borderColor: withAlpha(Colors.violet500, 0.45),
                  borderRadius: 999,
                  borderWidth: 1,
                  paddingHorizontal: 11,
                  paddingVertical: 4,
                }}
              >
                <Text style={[Fonts.p4Bold, { color: Colors.violet200 }]}>
                  {t(
                    'profile.subscription.gift.duration',
                    '{{count}} jours offerts',
                    { count: ONBOARDING_GIFT_DURATION_DAYS },
                  )}
                </Text>
              </View>

              <Text style={[Fonts.h2, Fonts.neutral00, Fonts.textCenter]}>
                {t('profile.subscription.gift.title', 'Félicitations !')}
              </Text>
              <Text style={[Fonts.p1, Fonts.neutral100, Fonts.textCenter]}>
                {t(
                  'profile.subscription.gift.subtitle',
                  'Vous avez reçu un cadeau : un abonnement club illimité.',
                )}
              </Text>

              {/* L'ancre de l'ecran, a la place exacte qu'occupe le prix sur les
                  cartes du voisin (`renderPrice`, `Fonts.h3Bold`). Ici le prix
                  EST le message : Adel a insisté sur « il n'a même pas besoin de
                  mettre sa carte bleue ». */}
              <Text style={[Fonts.h3Bold, Fonts.neutral00, Fonts.textCenter]}>
                {t('profile.subscription.gift.free', 'Gratuit, sans carte bancaire')}
              </Text>
            </View>

            {/* LA CARTE. Carcasse identique aux cartes de l'écran des offres
                (`cardBaseStyle`, l. 807), bord violet de la carte Club active. */}
            <View
              style={{
                backgroundColor: withAlpha(Colors.primary800, 0.72),
                borderColor: Colors.violet500,
                borderRadius: 20,
                borderWidth: 1.5,
                padding: 16,
              }}
            >
              <Text style={[Fonts.p4, Fonts.neutral300]}>
                {t('profile.subscription.gift.intro', 'Profitez-en pour :')}
              </Text>

              <View style={[Spaces.gap[8], Spaces.marginTop[12]]}>
                {USAGE_KEYS.map((usageKey) => (
                  <View key={usageKey} style={[Alignments.row, Spaces.gap[8]]}>
                    <Text style={[Fonts.p3Bold, { color: Colors.success500 }]}>✓</Text>
                    <Text style={[Alignments.fill, Fonts.p2, Fonts.neutral100]}>
                      {t(`profile.subscription.gift.${usageKey}`, usageKey)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* CE QUI SE PASSE À LA FIN. Une ligne, calme et honnête : ni
                  menace, ni compte à rebours. Décision d'Adel du 2026-08-28 —
                  les équipes créées restent, on ne peut plus en créer. */}
              <View
                style={[
                  Spaces.marginTop[12],
                  Spaces.paddingTop[12],
                  {
                    borderTopColor: withAlpha(Colors.neutral00, 0.08),
                    borderTopWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {t(
                    'profile.subscription.gift.ending',
                    'À la fin du cadeau, les équipes que vous avez créées restent :'
                      + ' vous ne pourrez simplement plus en créer de nouvelles.',
                  )}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* LE PANNEAU DU BOUTON, ancré en bas et en flux normal sous le
            défilement — le motif exact de l'écran des offres (l. 1301) : rien ne
            peut se cacher dessous, et aucune hauteur n'est réservée au jugé.
            ⛔ RIEN D'AUTRE QU'UN BOUTON ICI. Voir la bannière en tête. */}
        <View
          style={[
            Spaces.gap[8],
            Spaces.paddingTop[12],
            {
              backgroundColor: Colors.primary900,
              borderTopColor: withAlpha(Colors.neutral00, 0.08),
              borderTopWidth: 1,
              paddingBottom: insets.bottom + CTA_BOTTOM_RESERVE,
              paddingHorizontal: SCREEN_SIDE_PADDING,
            },
          ]}
        >
          <Button
            isLoading={isClaiming}
            onPress={handleClaim}
            title={t('profile.subscription.gift.cta', 'Débloquer mon offre')}
            variant="Primary"
          />
          {/* La phrase qui lève la méfiance au moment précis de l'appui, à la
              place du sous-texte du bouton de l'écran des offres. */}
          <Text style={[Fonts.p4, Fonts.neutral300, Fonts.textCenter]}>
            {t('profile.subscription.gift.ctaHint', 'Aucune carte bancaire demandée.')}
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

export default OnboardingGiftScreen;
