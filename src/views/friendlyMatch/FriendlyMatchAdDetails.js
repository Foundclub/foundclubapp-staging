import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import {
  Alert,
  ScrollView,
  Text,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  canApplyToFriendlyMatchAd,
  getHostingSummary,
  normalizeCandidateDates,
} from '@/domains/search/friendlyMatchFlow';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';
import { RouteNames } from '@/navigation/routeNames';

import {
  findMyApplicationOnAd,
  getFriendlyMatchAd,
  getFriendlyMatchApplications,
  getFriendlyMatchChatId,
  withdrawFriendlyMatchApplication,
} from '@/services/friendlyMatch/friendlyMatchService';

import { createLogger } from '@/utils/logger/logger';

import FriendlyMatchApplicationCard from './components/FriendlyMatchApplicationCard';
import FriendlyMatchApplySheet from './components/FriendlyMatchApplySheet';
import { getSlotLabel } from './friendlyMatchDateLabels';

const logger = createLogger('friendly-match-details');

/**
 * La cle d une entite, quelle que soit la forme recue.
 * @param {any} value
 * @returns {string}
 */
const getKey = (value) => String(value?.documentId || value?.id || '').trim();

/**
 * Le libelle d une localisation, quelle que soit sa forme.
 * @param {any} location
 * @returns {string}
 */
const getLocationLabel = (location) => {
  if (!location) return '';
  if (typeof location === 'string') return location;
  return String(
    location.city || location.label || location.name || location.formatted_address || '',
  ).trim();
};

/**
 * Le detail d une annonce de match amical (§4.3-4.4).
 *
 * Deux lectures du meme ecran, selon de quel cote on est :
 *   · staff de l ANNONCE  -> il voit les propositions recues et y repond ;
 *   · toute autre equipe  -> elle voit l annonce et propose un match.
 *
 * Le fil de discussion n est PAS reecrit ici : candidater ouvre une vraie
 * conversation cote serveur (friendly-match-workflow.ts:277-283), et cet ecran
 * se contente d y emmener — c est `RouteNames.Conversation` qui existe deja,
 * avec ses messages, ses pieces jointes et ses notifications.
 * @param {{ navigation: any, route: any }} props
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchAdDetails({ navigation, route }) {
  const adId = route?.params?.adId;
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());
  const { userData } = /** @type {any} */ (useAuth());

  const [ad, setAd] = useState(/** @type {any} */ (null));
  const [applications, setApplications] = useState(/** @type {any[]} */ ([]));
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isApplySheetVisible, setIsApplySheetVisible] = useState(false);

  const isAuthenticated = Boolean(userData?.documentId);
  const canApply = canApplyToFriendlyMatchAd(userData);

  const managedTeams = useMemo(() => {
    const seen = new Set();
    return [
      ...(userData?.myTeams || []),
      ...(userData?.trainedTeams || []),
    ].filter((team) => {
      const key = getKey(team);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [userData?.myTeams, userData?.trainedTeams]);

  const managedTeamIds = useMemo(() => managedTeams.map(getKey), [managedTeams]);

  // Cote annonceur : soit j encadre l equipe qui publie, soit j en suis l auteur.
  const isAdSideStaff = useMemo(() => {
    if (!ad) return false;
    if (getKey(ad.author) && getKey(ad.author) === getKey(userData)) return true;
    return managedTeamIds.includes(getKey(ad.team));
  }, [ad, managedTeamIds, userData]);

  const myApplication = useMemo(
    () => findMyApplicationOnAd(ad, managedTeamIds),
    [ad, managedTeamIds],
  );

  const loadAd = useCallback(async () => {
    if (!adId) {
      setLoadError('Annonce introuvable.');
      setIsLoading(false);
      return;
    }
    try {
      const loadedAd = await getFriendlyMatchAd(adId);
      setAd(loadedAd);
      setLoadError('');
    } catch (error) {
      logger.error('Chargement de l annonce amicale impossible', { error });
      setLoadError('Cette annonce n’est plus disponible.');
    } finally {
      setIsLoading(false);
    }
  }, [adId]);

  useEffect(() => {
    loadAd();
  }, [loadAd]);

  // Les candidatures completes (avec leur fil) ne sont lisibles que par le staff
  // de l annonce : GET /friendly-match-ads/:id/applications le verifie
  // (assertManagesAdSide). Pour tout le monde d autre, ce qui est populé sur
  // l annonce suffit — et un 403 ici ne doit pas vider l ecran.
  useEffect(() => {
    let isCurrent = true;
    if (ad && isAdSideStaff) {
      getFriendlyMatchApplications(adId)
        .then((loaded) => { if (isCurrent) setApplications(loaded); })
        .catch((error) => logger.error('Chargement des propositions impossible', { error }));
    }
    return () => { isCurrent = false; };
  }, [ad, adId, isAdSideStaff]);

  /**
   * Emmene dans le fil de la candidature. Si l identifiant manque (relation non
   * populée par le serveur), on ouvre la messagerie plutot que de ne rien faire :
   * le fil existe, il est juste introuvable d ici.
   * @param {any} application
   * @returns {void}
   */
  const openConversation = useCallback((/** @type {any} */ application) => {
    const chatId = getFriendlyMatchChatId(application);
    if (chatId) {
      navigation.navigate(RouteNames.Conversation, { chatId });
      return;
    }
    Alert.alert(
      'Discussion ouverte',
      'La discussion avec l’autre staff t’attend dans ta messagerie.',
      [
        { style: 'cancel', text: 'Plus tard' },
        { onPress: () => navigation.navigate(RouteNames.Chat), text: 'Ouvrir la messagerie' },
      ],
    );
  }, [navigation]);

  const handleApplyPress = useCallback(() => {
    if (!isAuthenticated) {
      openPublicAuthFlow(navigation, {
        origin: 'friendly-match-details',
        source: 'friendly-match-apply',
      });
      return;
    }
    setIsApplySheetVisible(true);
  }, [isAuthenticated, navigation]);

  /**
   * Apres l envoi : on relit l annonce (le POST rend la candidature sans son
   * fil) puis on emmene dans la discussion — c est tout l interet de candidater.
   * @param {any} application
   * @returns {Promise<void>}
   */
  const handleApplied = useCallback(async (/** @type {any} */ application) => {
    setIsApplySheetVisible(false);
    let freshApplication = application;
    try {
      const freshAd = await getFriendlyMatchAd(adId);
      setAd(freshAd);
      freshApplication = findMyApplicationOnAd(freshAd, managedTeamIds) || application;
    } catch (error) {
      logger.error('Relecture de l annonce apres candidature impossible', { error });
    }
    openConversation(freshApplication);
  }, [adId, managedTeamIds, openConversation]);

  const handleWithdraw = useCallback(() => {
    Alert.alert(
      'Retirer ma proposition',
      'L’autre staff ne verra plus ta proposition. La discussion, elle, reste.',
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: async () => {
            try {
              await withdrawFriendlyMatchApplication(getKey(myApplication));
              await loadAd();
            } catch (error) {
              logger.error('Retrait de candidature impossible', { error });
              Alert.alert(
                'Retrait impossible',
                /** @type {any} */ (error)?.message || 'Réessaie dans un instant.',
              );
            }
          },
          style: 'destructive',
          text: 'Retirer',
        },
      ],
    );
  }, [loadAd, myApplication]);

  if (isLoading) {
    return (
      <ScreenContainer bgImage="bg2" responsivePadding>
        <Loader />
      </ScreenContainer>
    );
  }

  if (loadError || !ad) {
    return (
      <ScreenContainer bgImage="bg2" responsivePadding>
        <View style={[Spaces.padding[24], Spaces.marginTop[24], {
          backgroundColor: withAlpha(Colors.primary900, 0.94),
          borderColor: withAlpha(Colors.primary500, 0.15),
          borderRadius: 16,
          borderWidth: 1,
        }]}
        >
          <Text style={[Fonts.p1, { color: Colors.neutral100, textAlign: 'center' }]}>
            {loadError || 'Cette annonce n’est plus disponible.'}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const hostingSummary = getHostingSummary(ad);
  const slots = normalizeCandidateDates(ad.candidateDates);
  const locationLabel = getLocationLabel(ad.location);
  const radiusLabel = ad.travelRadiusKm ? `dans un rayon de ${ad.travelRadiusKm} km` : '';
  const pendingApplications = applications.filter(
    (/** @type {any} */ application) => application?.status === 'pending',
  );
  const pendingLabel = pendingApplications.length > 1 ? 'propositions' : 'proposition';
  const settledApplications = applications.filter(
    (/** @type {any} */ application) => application?.status !== 'pending',
  );

  /**
   * Un bloc encadre, le motif visuel unique de l ecran.
   * @param {string} title
   * @param {import('react').ReactNode} children
   * @returns {import('react').ReactElement}
   */
  const renderCard = (title, children) => (
    <View style={[Spaces.padding[16], Spaces.gap[8], {
      backgroundColor: withAlpha(Colors.primary900, 0.94),
      borderColor: withAlpha(Colors.primary500, 0.15),
      borderRadius: 16,
      borderWidth: 1,
    }]}
    >
      <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>{title}</Text>
      {children}
    </View>
  );

  return (
    <ScreenContainer bgImage="bg2" responsivePadding>
      <ScrollView
        contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[128]]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[Spaces.gap[4]]}>
          <Text style={[Fonts.h3, Fonts.neutral00]}>
            {ad.team?.name || 'Une équipe'}
          </Text>
          <Text style={[Fonts.p2, { color: withAlpha(Colors.neutral100, 0.63) }]}>
            {[ad.team?.club?.name, ad.category?.name, ad.level?.name]
              .filter(Boolean).join(' · ')}
          </Text>
        </View>

        {ad.status !== 'open' ? (
          <View style={[Spaces.padding[12], {
            backgroundColor: withAlpha(Colors.warning500, 0.12),
            borderColor: withAlpha(Colors.warning500, 0.4),
            borderRadius: 12,
            borderWidth: 1,
          }]}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>
              {ad.status === 'matched'
                ? 'Cette annonce a trouvé son adversaire.'
                : 'Cette annonce n’accepte plus de proposition.'}
            </Text>
          </View>
        ) : null}

        {renderCard(
          'Ce que cette équipe propose', (
            <View style={[Spaces.gap[4]]}>
              <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>
                {hostingSummary.label}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                {[locationLabel, radiusLabel].filter(Boolean).join(' · ')}
              </Text>
              {ad.format ? (
                <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                  {`Format : ${ad.format}`}
                </Text>
              ) : null}
              {ad.refereeing ? (
                <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                  {`Arbitrage : ${ad.refereeing}`}
                </Text>
              ) : null}
            </View>
          ),
        )}

        {renderCard(
          slots.length > 1 ? 'Dates proposées' : 'Date proposée', (
            <View style={[Spaces.gap[4]]}>
              {slots.length === 0 ? (
                <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Aucune date proposée.</Text>
              ) : slots.map((/** @type {any} */ slot) => (
                <Text key={slot.date} style={[Fonts.p3, { color: Colors.neutral200 }]}>
                  {getSlotLabel(slot)}
                </Text>
              ))}
            </View>
          ),
        )}

        {ad.description ? renderCard(
          'Le mot du staff', (
            <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>{ad.description}</Text>
          ),
        ) : null}

        {isAdSideStaff ? (
          <View style={[Spaces.gap[12]]}>
            <Text style={[Fonts.h4, Fonts.neutral00, Spaces.marginTop[8]]}>
              {pendingApplications.length > 0
                ? `${pendingApplications.length} ${pendingLabel} à traiter`
                : 'Les propositions reçues'}
            </Text>

            {applications.length === 0 ? (
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                Personne n’a encore répondu. Les équipes du secteur voient ton annonce.
              </Text>
            ) : null}

            {[...pendingApplications, ...settledApplications].map(
              (/** @type {any} */ application) => (
                <FriendlyMatchApplicationCard
                  ad={ad}
                  application={application}
                  key={getKey(application)}
                  onOpenConversation={() => openConversation(application)}
                  onResponded={loadAd}
                />
              ),
            )}
          </View>
        ) : null}

        {!isAdSideStaff && myApplication ? renderCard(
          'Ta proposition', (
            <View style={[Spaces.gap[12]]}>
              <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                {myApplication.status === 'accepted'
                  ? 'Elle a été acceptée : le match est dans le planning de ton équipe.'
                  : 'Elle est envoyée. La suite se joue dans la discussion.'}
              </Text>
              <Button
                onPress={() => openConversation(myApplication)}
                title="Ouvrir la discussion"
                variant="Primary"
              />
              {myApplication.status === 'pending' ? (
                <Button
                  onPress={handleWithdraw}
                  title="Retirer ma proposition"
                  variant="Secondary"
                />
              ) : null}
            </View>
          ),
        ) : null}

        {!isAdSideStaff && !myApplication && ad.status === 'open' ? (
          <View style={[Spaces.gap[8], Spaces.marginTop[8]]}>
            <Button
              disabled={isAuthenticated && !canApply}
              onPress={handleApplyPress}
              title="Proposer un match"
              variant="Primary"
            />
            <Text style={[
              Fonts.p4,
              Alignments.alignCenter,
              { color: withAlpha(Colors.neutral100, 0.63) },
            ]}
            >
              {isAuthenticated && !canApply
                ? 'Seuls un entraîneur ou un dirigeant peuvent proposer un match.'
                : 'Répondre ouvre une discussion entre les deux staffs.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <FriendlyMatchApplySheet
        ad={ad}
        managedTeams={managedTeams}
        onClose={() => setIsApplySheetVisible(false)}
        onSubmitted={handleApplied}
        visible={isApplySheetVisible}
      />
    </ScreenContainer>
  );
}

export default FriendlyMatchAdDetails;
