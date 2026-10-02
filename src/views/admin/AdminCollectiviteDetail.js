import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  collectiviteTypeLabel,
  toAdminCollectiviteDetail,
} from '@/domains/collectivite/collectiviteDisplay';
import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';
import CollectiviteActivation from '@/views/admin/components/CollectiviteActivation';
import CollectiviteTargetSearch from '@/views/admin/components/CollectiviteTargetSearch';
import ManagerRequestsLink from '@/views/admin/components/ManagerRequestsLink';

import {
  useAddAdminCollectiviteGestionnaire,
  useAdminCollectivite,
  useAttachAdminCollectiviteClub,
  useDetachAdminCollectiviteClub,
  useRemoveAdminCollectiviteGestionnaire,
} from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/** @typedef {{ ok: boolean, texte: string } | null} Retour */

/**
 * 🏛️ CONSOLE › COLLECTIVITES › UNE COLLECTIVITE (D61, 2026-09-29).
 *
 * Ce que « nous » faisons d une collectivite, sur les routes du lot 1a/1d :
 *   - l activer ou la couper (CollectiviteActivation, la meme que dans la liste) ;
 *   - ses CLUBS : rattacher un club par recherche (un club = une collectivite, le serveur
 *     refuse le second en 409), detacher avec confirmation (le club reste intact) ;
 *   - ses GESTIONNAIRES : ajouter un compte par recherche, retirer avec confirmation (le
 *     compte reste intact, il perd l acces a « Ma collectivite ») ;
 *   - ses INSTALLATIONS, en lecture (le gestionnaire les ecrit depuis son espace).
 * Chaque geste relit la collectivite depuis le serveur : l ecran affiche ce qu il rend.
 * @returns {import('react').ReactElement} L ecran.
 */
function AdminCollectiviteDetail() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const route = useRoute();
  /** @type {{ collectiviteId?: string, justCreated?: boolean } | undefined} */
  const routeParams = /** @type {any} */ (route?.params);
  const collectiviteId = routeParams?.collectiviteId || null;
  // COLL-CONSOLE (02/10) — la fiche qui remplace le formulaire de creation dit ce qui reste.
  const justCreated = routeParams?.justCreated === true;

  const lecture = useAdminCollectivite(collectiviteId);
  const [retourClubs, setRetourClubs] = useState(/** @type {Retour} */ (null));
  const [retourGestionnaires, setRetourGestionnaires] = useState(/** @type {Retour} */ (null));
  const erreur = (/** @type {any} */ e) => ({ ok: false, texte: getErrorMessage(e) });

  const rattacher = useAttachAdminCollectiviteClub();
  const detacher = useDetachAdminCollectiviteClub();
  const nommer = useAddAdminCollectiviteGestionnaire();
  const retirer = useRemoveAdminCollectiviteGestionnaire();

  if (lecture.isLoading) {
    return (
      <AdminStateView
        description={t('adminCollectivites.detail.loading', 'Lecture de la collectivité…')}
        isLoading
        title={t('adminCollectivites.list.title', 'Collectivités')}
      />
    );
  }
  if (lecture.error) {
    return (
      <AdminStateView
        actionLabel={t('adminCollectivites.list.retry', 'Réessayer')}
        description={getErrorMessage(/** @type {any} */ (lecture.error))}
        onAction={() => lecture.refetch?.()}
        title={t('adminCollectivites.list.errorTitle', 'Collectivités indisponibles')}
      />
    );
  }
  const detail = toAdminCollectiviteDetail(lecture.data);
  if (!detail) {
    return (
      <AdminStateView
        description={t(
          'APIerrors.COLLECTIVITE_NOT_FOUND',
          'Cette collectivité est introuvable : elle a peut-être été supprimée.',
        )}
        title={t('adminCollectivites.list.title', 'Collectivités')}
      />
    );
  }

  const ville = { collectivite: formatCollectiviteOfferedBy(detail.name), ...SANS_ECHAPPEMENT };
  const ids = { collectiviteId: detail.documentId };
  const carteStyle = {
    backgroundColor: `${Colors.primary700}73`,
    borderColor: `${Colors.primary500}80`,
    gap: 12,
  };

  const onRattacher = (/** @type {any} */ cible) => {
    setRetourClubs(null);
    const valeurs = { club: cible?.label, ...ville };
    rattacher.mutate({ ...ids, clubId: cible?.documentId }, {
      onError: (/** @type {any} */ e) => setRetourClubs(erreur(e)),
      onSuccess: (/** @type {any} */ reponse) => {
        const offre = reponse?.data?.offer;
        let texte = t('adminCollectivites.detail.attachedInactive', valeurs);
        if (offre === 'granted') texte = t('adminCollectivites.detail.attachedGranted', valeurs);
        if (offre === 'already-paid') {
          texte = t('adminCollectivites.detail.attachedAlreadyPaid', valeurs);
        }
        setRetourClubs({ ok: true, texte });
      },
    });
  };

  const onDetacher = (/** @type {{ documentId: string, name: string }} */ club) => {
    const valeurs = { club: club.name, ...ville };
    Alert.alert(
      t('adminCollectivites.detail.detachTitle', 'Détacher {{club}} ?', valeurs),
      t('adminCollectivites.detail.detachMessage', valeurs),
      [
        { style: 'cancel', text: t('adminCollectivites.activation.cancel', 'Annuler') },
        {
          onPress: () => {
            setRetourClubs(null);
            detacher.mutate({ ...ids, clubId: club.documentId }, {
              onError: (/** @type {any} */ e) => setRetourClubs(erreur(e)),
              onSuccess: () => setRetourClubs({
                ok: true,
                texte: t('adminCollectivites.detail.detached', '{{club}} est détaché.', valeurs),
              }),
            });
          },
          style: 'destructive',
          text: t('adminCollectivites.detail.detach', 'Détacher'),
        },
      ],
    );
  };

  const onNommer = (/** @type {any} */ cible) => {
    setRetourGestionnaires(null);
    const valeurs = { nom: cible?.label, ...ville };
    nommer.mutate({ ...ids, userId: cible?.documentId }, {
      onError: (/** @type {any} */ e) => setRetourGestionnaires(erreur(e)),
      onSuccess: () => setRetourGestionnaires({
        ok: true,
        texte: t('adminCollectivites.detail.managerAdded', valeurs),
      }),
    });
  };

  const onRetirer = (/** @type {{ documentId: string, name: string }} */ compte) => {
    const valeurs = { nom: compte.name, ...ville };
    Alert.alert(
      t('adminCollectivites.detail.removeManagerTitle', 'Retirer {{nom}} ?', valeurs),
      t('adminCollectivites.detail.removeManagerMessage', valeurs),
      [
        { style: 'cancel', text: t('adminCollectivites.activation.cancel', 'Annuler') },
        {
          onPress: () => {
            setRetourGestionnaires(null);
            retirer.mutate({ ...ids, userId: compte.documentId }, {
              onError: (/** @type {any} */ e) => setRetourGestionnaires(erreur(e)),
              onSuccess: () => setRetourGestionnaires({
                ok: true,
                texte: t(
                  'adminCollectivites.detail.managerRemoved',
                  '{{nom}} ne gère plus {{collectivite}}.',
                  valeurs,
                ),
              }),
            });
          },
          style: 'destructive',
          text: t('adminCollectivites.detail.removeManager', 'Retirer'),
        },
      ],
    );
  };

  const afficherRetour = (/** @type {Retour} */ retour) => (retour ? (
    <Text style={[Fonts.p3Bold, retour.ok ? Fonts.success500 : Fonts.error500]}>
      {retour.texte}
    </Text>
  ) : null);

  const titreSection = (/** @type {string} */ texte) => (
    <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{texte}</Text>
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
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => lecture.refetch?.()}
            refreshing={Boolean(lecture.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={{ gap: 6 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t('adminCollectivites.list.title', 'Collectivités').toUpperCase()}
          </Text>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>{detail.name}</Text>
          <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
            <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
              {collectiviteTypeLabel(t, detail.type)}
            </Text>
            <Text style={[Fonts.p3Bold, detail.isActive ? Fonts.success500 : Fonts.warning500]}>
              {detail.isActive
                ? t('adminCollectivites.status.active', 'Active')
                : t('adminCollectivites.status.inactive', 'Inactive')}
            </Text>
          </View>
          <CollectiviteActivation collectivite={detail} />
        </View>

        {justCreated ? (
          <View
            accessibilityRole="summary"
            style={[
              ApplicationStyle.card,
              Spaces.padding[16],
              {
                backgroundColor: `${Colors.success500}1F`,
                borderColor: `${Colors.success500}66`,
                gap: 4,
              },
            ]}
            testID="admin-collectivite-creee"
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t('collectiviteConsole.creer.creee', '{{name}} est créée, inactive.', {
                name: detail.name, ...SANS_ECHAPPEMENT,
              })}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'collectiviteConsole.creer.ensuite',
                'Ensuite : rattache ses clubs, nomme un gestionnaire, puis active-la.',
              )}
            </Text>
          </View>
        ) : null}

        <View
          style={[ApplicationStyle.card, Spaces.padding[16], carteStyle]}
          testID="admin-collectivite-clubs"
        >
          {titreSection(t('adminCollectivites.list.clubsCount', 'Clubs rattachés : {{nombre}}', {
            nombre: detail.clubs.length,
          }))}
          {detail.clubs.length === 0 ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t('adminCollectivites.detail.noClub', 'Aucun club rattaché.')}
            </Text>
          ) : detail.clubs.map((/** @type {any} */ club) => (
            <View
              key={club.documentId}
              style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}
              testID={`admin-collectivite-club-${club.documentId}`}
            >
              <ClubLogoMark logoUrl={club.logoUrl} name={club.name} size={32} />
              <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
                {club.name}
              </Text>
              <Button
                disabled={detacher.isPending}
                onPress={() => onDetacher(club)}
                size="sm"
                title={t('adminCollectivites.detail.detach', 'Détacher')}
                variant="Secondary"
              />
            </View>
          ))}
          <CollectiviteTargetSearch
            deja={new Set(detail.clubs.map((/** @type {any} */ club) => club.documentId))}
            dejaTexte={t('adminCollectivites.detail.alreadyAttached', 'Déjà rattaché')}
            enCours={rattacher.isPending}
            kind="club"
            libelleAction={t('adminCollectivites.detail.attach', 'Rattacher')}
            onChoisir={onRattacher}
            placeholder={t('adminCollectivites.detail.searchClub', 'Rattacher un club : son nom')}
            testID="admin-collectivite-recherche-club"
          />
          {afficherRetour(retourClubs)}
        </View>

        {/* COLL-ACCUEIL (01/10) — SEULEMENT le lien « Ouvrir dans la file » (le reste : C-CONSOLE). */}
        <ManagerRequestsLink collectiviteId={collectiviteId} />

        <View
          style={[ApplicationStyle.card, Spaces.padding[16], carteStyle]}
          testID="admin-collectivite-gestionnaires"
        >
          {titreSection(t('adminCollectivites.detail.managersCount', 'Gestionnaires : {{nombre}}', {
            nombre: detail.gestionnaires.length,
          }))}
          {detail.gestionnaires.length === 0 ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t('adminCollectivites.detail.noManager', 'Aucun gestionnaire.')}
            </Text>
          ) : detail.gestionnaires.map((/** @type {any} */ compte) => (
            <View
              key={compte.documentId}
              style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}
              testID={`admin-collectivite-gestionnaire-${compte.documentId}`}
            >
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {compte.name || compte.email || compte.documentId}
                </Text>
                {compte.email ? (
                  <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral300]}>{compte.email}</Text>
                ) : null}
              </View>
              <Button
                disabled={retirer.isPending}
                onPress={() => onRetirer({
                  documentId: compte.documentId,
                  name: compte.name || compte.email || compte.documentId,
                })}
                size="sm"
                title={t('adminCollectivites.detail.removeManager', 'Retirer')}
                variant="Secondary"
              />
            </View>
          ))}
          <CollectiviteTargetSearch
            deja={new Set(detail.gestionnaires.map((/** @type {any} */ c) => c.documentId))}
            dejaTexte={t('adminCollectivites.detail.alreadyManager', 'Déjà gestionnaire')}
            enCours={nommer.isPending}
            kind="user"
            libelleAction={t('adminCollectivites.detail.addManager', 'Ajouter')}
            onChoisir={onNommer}
            placeholder={t(
              'adminCollectivites.detail.searchUser',
              'Ajouter un gestionnaire : nom ou e-mail',
            )}
            testID="admin-collectivite-recherche-compte"
          />
          {afficherRetour(retourGestionnaires)}
        </View>

        <View
          style={[ApplicationStyle.card, Spaces.padding[16], carteStyle]}
          testID="admin-collectivite-installations"
        >
          {titreSection(t(
            'adminCollectivites.detail.installationsCount',
            'Installations : {{nombre}}',
            {
              nombre: detail.installations.length,
            },
          ))}
          {detail.installations.length === 0 ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t(
                'adminCollectivites.detail.noInstallation',
                'Aucune installation : le gestionnaire les ajoute depuis « Ma collectivité ».',
              )}
            </Text>
          ) : detail.installations.map((/** @type {any} */ installation) => (
            <View key={installation.documentId} style={{ gap: 2 }}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{installation.name}</Text>
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {installation.maxSlots === null
                  ? installation.type
                  : t(
                    'adminCollectivites.detail.installationLine',
                    '{{type}} · capacité : {{nombre}}',
                    {
                      nombre: installation.maxSlots,
                      type: installation.type,
                      ...SANS_ECHAPPEMENT,
                    },
                  )}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default AdminCollectiviteDetail;
