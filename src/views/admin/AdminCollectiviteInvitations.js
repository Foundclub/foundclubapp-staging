import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { splitAdminInvitations } from '@/domains/collectivite/collectiviteConsole';
import { formatCollectiviteDay } from '@/domains/collectivite/collectiviteDisplay';
import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';
import CollectiviteTargetSearch from '@/views/admin/components/CollectiviteTargetSearch';

import {
  useAdminCollectiviteInvitations,
  useAdminCollectiviteLeads,
  useAttachAdminCollectiviteClub,
  useLinkAdminCollectiviteInvitationClub,
} from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/** @typedef {'rattachements' | 'foundclub' | 'faits' | 'pistes'} Onglet */
/** @typedef {{ ok: boolean, texte: string } | null} Retour */

const ONGLETS = /** @type {Onglet[]} */ (['rattachements', 'foundclub', 'faits', 'pistes']);

/**
 * L'onglet demandé, ou « Rattachements ».
 * @param {unknown} valeur - Le paramètre de la route, ou la valeur choisie.
 * @returns {Onglet} L'onglet.
 */
const lireOnglet = (valeur) => (
  ONGLETS.includes(/** @type {any} */ (valeur)) ? /** @type {Onglet} */ (valeur) : 'rattachements'
);

/**
 * 🏛️ CONSOLE › COLLECTIVITÉS › LES DEMANDES — COLL-CONSOLE (02/10/2026), planche P2-console
 * (design HY521H1, page 2) : la carte « Collectivités » porte les demandes de rattachement et
 * les invitations « Par FoundClub » du lot COLL-CLUBS (SPEC §2 G, D70).
 *
 *   - « Rattachements » : un DIRIGEANT a ouvert le lien de sa Ville et demande le rattachement
 *     de son club. « L'équipe FoundClub vérifie, puis rattache » (D70) : « Rattacher » fait le
 *     geste de la fiche (POST …/clubs/:clubId), et le serveur prévient ses dirigeants.
 *     Un club hors de la commune est signalé AVANT le geste.
 *   - « Par FoundClub » : une mairie a donné le nom et le contact GÉNÉRAL d'un club absent de
 *     FoundClub. Une fois le club inscrit, « Relier à son club » pose le club sur la demande
 *     (PUT /superadmin/collectivite-invitations/:id/club) ; on le rattache ensuite.
 *   - « Rattachés » : ce qui est fait. L'état se LIT (le serveur le calcule) : il ne ment pas.
 * Seul un SuperAdmin arrive ici (pile AdminStack) ; le serveur refuse tout autre compte (403).
 * @returns {import('react').ReactElement} L'écran.
 */
function AdminCollectiviteInvitations() {
  const { t } = useTranslation();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const params = /** @type {{ collectiviteId?: string, onglet?: string } | undefined} */ (
    route?.params
  );
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const [onglet, setOnglet] = useState(() => lireOnglet(params?.onglet));
  const [relierId, setRelierId] = useState(/** @type {string | null} */ (null));
  const [retours, setRetours] = useState(/** @type {Record<string, Retour>} */ ({}));
  const demandes = useAdminCollectiviteInvitations();
  // VOIE 3 (« collectivité A », 07/10) : les pistes « Prévenir ma mairie », leur propre lecture.
  const pistes = useAdminCollectiviteLeads();
  const lesPistes = Array.isArray(pistes.data) ? pistes.data : [];
  const rattacher = useAttachAdminCollectiviteClub();
  const relier = useLinkAdminCollectiviteInvitationClub();
  const enCours = Boolean(rattacher.isPending || relier.isPending);

  if (demandes.isLoading) {
    return (
      <AdminStateView
        description={t('collectiviteConsole.demandes.chargement', 'Lecture des demandes…')}
        isLoading
        title={t('collectiviteConsole.demandes.titre', 'Rattachements et invitations')}
      />
    );
  }
  if (demandes.error) {
    return (
      <AdminStateView
        actionLabel={t('adminCollectivites.list.retry', 'Réessayer')}
        description={getErrorMessage(/** @type {any} */ (demandes.error))}
        onAction={() => demandes.refetch?.()}
        title={t('collectiviteConsole.demandes.indisponibles', 'Demandes indisponibles')}
      />
    );
  }

  // Depuis la fiche d'une Ville : ses demandes seulement.
  const toutes = Array.isArray(demandes.data) ? demandes.data : [];
  const lignes = params?.collectiviteId
    ? toutes.filter((ligne) => ligne?.collectivite?.documentId === params.collectiviteId)
    : toutes;
  const piles = splitAdminInvitations(lignes);
  const pileDe = {
    faits: piles.done,
    foundclub: piles.foundclub,
    pistes: lesPistes,
    rattachements: piles.attachRequests,
  };
  const affichees = pileDe[onglet];

  const poserRetour = (/** @type {string} */ id, /** @type {Retour} */ retour) => setRetours(
    (avant) => ({ ...avant, [id]: retour }),
  );
  const echecDe = (/** @type {string} */ id) => (/** @type {any} */ e) => poserRetour(
    id,
    { ok: false, texte: getErrorMessage(e) },
  );
  const villeDe = (/** @type {any} */ demande) => formatCollectiviteOfferedBy(
    demande?.collectivite?.name || '',
  );
  // FINITIONS15 point 8 : planche P2-fiche, « Envoyée le jeu. 1 oct. ».
  const dateDe = (/** @type {unknown} */ valeur) => formatCollectiviteDay(
    /** @type {any} */ (valeur),
  );

  const onRattacher = (/** @type {any} */ demande) => {
    const collectiviteId = demande?.collectivite?.documentId;
    const clubId = demande?.club?.documentId;
    if (!collectiviteId || !clubId) return;
    poserRetour(demande.documentId, null);
    const valeurs = {
      club: demande.club.name || '', collectivite: villeDe(demande), ...SANS_ECHAPPEMENT,
    };
    rattacher.mutate({ clubId, collectiviteId }, {
      onError: echecDe(demande.documentId),
      onSuccess: (/** @type {any} */ reponse) => {
        const offre = reponse?.data?.offer;
        let texte = t('adminCollectivites.detail.attachedInactive', valeurs);
        if (offre === 'granted') texte = t('adminCollectivites.detail.attachedGranted', valeurs);
        if (offre === 'already-paid') {
          texte = t('adminCollectivites.detail.attachedAlreadyPaid', valeurs);
        }
        const prevenus = t(
          'collectiviteConsole.demandes.dirigeantsPrevenus',
          'Ses dirigeants sont prévenus.',
        );
        poserRetour(demande.documentId, { ok: true, texte: `${texte} ${prevenus}` });
      },
    });
  };

  const onRelier = (/** @type {any} */ demande, /** @type {any} */ club) => {
    poserRetour(demande.documentId, null);
    relier.mutate({ clubId: club?.documentId || null, invitationId: demande.documentId }, {
      onError: echecDe(demande.documentId),
      onSuccess: () => {
        setRelierId(null);
        poserRetour(demande.documentId, {
          ok: true,
          texte: club
            ? t('collectiviteConsole.demandes.relie', 'Demande reliée à {{club}}.', {
              club: club.label || '', ...SANS_ECHAPPEMENT,
            })
            : t(
              'collectiviteConsole.demandes.delie',
              'Demande déliée : elle attend de nouveau son club.',
            ),
        });
      },
    });
  };

  const carteStyle = [
    ApplicationStyle.borderRadius16,
    Spaces.padding[16],
    {
      backgroundColor: withAlpha(Colors.primary700, 0.45),
      borderColor: withAlpha(Colors.primary500, 0.5),
      borderWidth: 1,
      gap: 8,
    },
  ];

  const ligneVille = (/** @type {any} */ demande) => (
    <Text style={[Fonts.p3, Fonts.neutral300]}>
      {t('collectiviteConsole.demandes.pourVille', 'Pour {{ville}} · le {{date}}', {
        date: dateDe(demande?.createdAt),
        ville: villeDe(demande),
        ...SANS_ECHAPPEMENT,
      })}
    </Text>
  );

  const retourDe = (/** @type {any} */ demande) => {
    const retour = retours[demande.documentId];
    return retour ? (
      <Text
        accessibilityRole={retour.ok ? undefined : 'alert'}
        style={[Fonts.p3Bold, retour.ok ? Fonts.success500 : Fonts.error300]}
      >
        {retour.texte}
      </Text>
    ) : null;
  };

  const boutonRattacher = (/** @type {any} */ demande) => (
    <Button
      disabled={enCours}
      isLoading={rattacher.isPending && rattacher.variables?.clubId === demande?.club?.documentId}
      onPress={() => onRattacher(demande)}
      size="sm"
      title={t('collectiviteConsole.demandes.rattacher', 'Rattacher à {{ville}}', {
        ville: demande?.collectivite?.name || '', ...SANS_ECHAPPEMENT,
      })}
      variant="Primary"
    />
  );

  const carteRattachement = (/** @type {any} */ demande) => (
    <View key={demande.documentId} style={carteStyle} testID={`demande-${demande.documentId}`}>
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{demande?.club?.name || ''}</Text>
      {ligneVille(demande)}
      {demande?.outsideCommune ? (
        <Text style={[Fonts.p3Bold, Fonts.warning500]}>
          {t(
            'collectiviteConsole.demandes.horsCommune',
            'Hors de la commune : vérifie que le club joue bien à {{ville}} avant de le rattacher.',
            { ville: demande?.collectivite?.name || '', ...SANS_ECHAPPEMENT },
          )}
        </Text>
      ) : null}
      {boutonRattacher(demande)}
      {retourDe(demande)}
    </View>
  );

  const carteParFoundClub = (/** @type {any} */ demande) => {
    const relie = Boolean(demande?.club?.documentId);
    const relances = Number(demande?.remindCount) || 0;
    return (
      <View key={demande.documentId} style={carteStyle} testID={`demande-${demande.documentId}`}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{demande?.clubName || ''}</Text>
        {ligneVille(demande)}
        {demande?.clubContact ? (
          <Text selectable style={[Fonts.p3, Fonts.neutral100]}>
            {t(
              'collectiviteConsole.demandes.contact',
              'Contact donné par la mairie : {{contact}}',
              { contact: demande.clubContact, ...SANS_ECHAPPEMENT },
            )}
          </Text>
        ) : null}
        {relances > 0 ? (
          <Text style={[Fonts.p3Bold, Fonts.warning500]}>
            {t('collectiviteConsole.demandes.relancee', {
              count: relances,
              date: dateDe(demande?.remindedAt),
              defaultValue_one: 'Relancée {{count}} fois, le {{date}}',
              defaultValue_other: 'Relancée {{count}} fois, la dernière le {{date}}',
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
        ) : null}
        {relie ? (
          <>
            <Text style={[Fonts.p2Bold, Fonts.success500]}>
              {t('collectiviteConsole.demandes.inscrit', 'Inscrit sur FoundClub : {{club}}', {
                club: demande.club.name || '', ...SANS_ECHAPPEMENT,
              })}
            </Text>
            {boutonRattacher(demande)}
            <Button
              disabled={enCours}
              onPress={() => onRelier(demande, null)}
              size="sm"
              title={t('collectiviteConsole.demandes.delier', 'Délier ce club')}
              variant="Ghost"
            />
          </>
        ) : null}
        {!relie && relierId === demande.documentId ? (
          <CollectiviteTargetSearch
            deja={new Set()}
            dejaTexte=""
            enCours={enCours}
            kind="club"
            libelleAction={t('collectiviteConsole.demandes.relierCe', 'Relier')}
            onChoisir={(/** @type {any} */ club) => onRelier(demande, club)}
            placeholder={t(
              'collectiviteConsole.demandes.chercherClub',
              'Le club inscrit : son nom',
            )}
            testID={`relier-${demande.documentId}`}
          />
        ) : null}
        {!relie && relierId !== demande.documentId ? (
          <Button
            disabled={enCours}
            onPress={() => setRelierId(demande.documentId)}
            size="sm"
            title={t('collectiviteConsole.demandes.relier', 'Relier à son club inscrit')}
            variant="Secondary"
          />
        ) : null}
        {retourDe(demande)}
      </View>
    );
  };

  // VILLE-INVITER-CLUB (07/10, « lien A ») : une demande du lien REFUSÉE par la Ville est
  // traitée, elle aussi ; la carte le dit, sans bouton (la console garde « Rattacher » sur la
  // fiche de la Ville).
  const carteFaite = (/** @type {any} */ demande) => {
    const refusee = demande?.status !== 'attached' && demande?.answer === 'refused';
    const valeurs = { ville: demande?.collectivite?.name || '', ...SANS_ECHAPPEMENT };
    return (
      <View key={demande.documentId} style={carteStyle} testID={`demande-${demande.documentId}`}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {demande?.club?.name || demande?.clubName || ''}
        </Text>
        <Text style={[Fonts.p3Bold, refusee ? Fonts.error300 : Fonts.success500]}>
          {refusee
            ? t('collectiviteConsole.demandes.refuseeParLaVille', 'Refusée par {{ville}}', valeurs)
            : t('collectiviteConsole.demandes.rattacheA', 'Rattaché à {{ville}}', valeurs)}
        </Text>
        {retourDe(demande)}
      </View>
    );
  };

  // VOIE 3 — une piste : le club, la mairie à contacter (sa commune du référentiel), la date, le
  // contact GÉNÉRAL du club (déjà public dans l'annuaire, D15). Aucune personne.
  const cartePiste = (/** @type {any} */ piste) => {
    const contact = [piste?.club?.email, piste?.club?.phoneNumber, piste?.club?.websiteUrl]
      .filter(Boolean);
    const commune = [piste?.communeName, piste?.communeCode ? `(${piste.communeCode})` : null]
      .filter(Boolean)
      .join(' ');
    return (
      <View key={piste.documentId} style={carteStyle} testID={`piste-${piste.documentId}`}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{piste?.club?.name || ''}</Text>
        <Text style={[Fonts.p2Bold, Fonts.primary200]}>
          {t('collectiviteConsole.demandes.pisteCommune', 'Mairie à contacter : {{commune}}', {
            commune, ...SANS_ECHAPPEMENT,
          })}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t('collectiviteConsole.demandes.pisteLe', 'Signalée par un dirigeant le {{date}}', {
            date: dateDe(piste?.createdAt),
            ...SANS_ECHAPPEMENT,
          })}
        </Text>
        {contact.map((ligne) => (
          <Text key={ligne} selectable style={[Fonts.p3, Fonts.neutral100]}>{ligne}</Text>
        ))}
        {piste?.attached ? (
          <Text style={[Fonts.p3Bold, Fonts.success500]}>
            {t(
              'collectiviteConsole.demandes.pisteRattache',
              'Rattaché depuis à une collectivité : rien à faire.',
            )}
          </Text>
        ) : null}
      </View>
    );
  };

  const vides = {
    faits: t(
      'collectiviteConsole.demandes.videFaits',
      'Aucun club rattaché par ces demandes pour l’instant.',
    ),
    foundclub: t(
      'collectiviteConsole.demandes.videFoundClub',
      'Aucune invitation « Par FoundClub » en attente.',
    ),
    pistes: t(
      'collectiviteConsole.demandes.videPistes',
      'Aucune piste « Prévenir ma mairie » pour l’instant.',
    ),
    rattachements: t(
      'collectiviteConsole.demandes.videRattachements',
      'Aucune demande de rattachement en attente.',
    ),
  };
  const carteDe = {
    faits: carteFaite,
    foundclub: carteParFoundClub,
    pistes: cartePiste,
    rattachements: carteRattachement,
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingTop: 12 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => demandes.refetch?.()}
            refreshing={Boolean(demandes.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={{ gap: 4 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t('adminCollectivites.list.title', 'Collectivités').toUpperCase()}
          </Text>
          <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('collectiviteConsole.demandes.titre', 'Rattachements et invitations')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t(
              'collectiviteConsole.demandes.dit',
              // eslint-disable-next-line max-len
              'Une demande de rattachement vient d’un dirigeant qui a ouvert le lien de sa Ville. Une invitation « Par FoundClub » vient d’une mairie : le club n’est pas encore inscrit. Vérifie, puis rattache.',
            )}
          </Text>
        </View>
        <SegmentedControl
          onChange={(/** @type {string} */ valeur) => {
            setOnglet(lireOnglet(valeur));
            setRelierId(null);
          }}
          options={[
            {
              label: t(
                'collectiviteConsole.demandes.ongletRattachements',
                'Rattachements ({{nombre}})',
                { nombre: piles.attachRequests.length },
              ),
              value: 'rattachements',
            },
            {
              label: t(
                'collectiviteConsole.demandes.ongletFoundClub',
                'Par FoundClub ({{nombre}})',
                { nombre: piles.foundclub.length },
              ),
              value: 'foundclub',
            },
            {
              label: t('collectiviteConsole.demandes.ongletFaits', 'Rattachés ({{nombre}})', {
                nombre: piles.done.length,
              }),
              value: 'faits',
            },
            {
              label: t('collectiviteConsole.demandes.ongletPistes', 'Pistes ({{nombre}})', {
                nombre: lesPistes.length,
              }),
              value: 'pistes',
            },
          ]}
          value={onglet}
          // VT18E (07/10, capture S18a) — « Rattachés (0) » était coupé au bord : les onglets
          // passent à la ligne plutôt que de déborder.
          wrapLabels
        />
        {params?.collectiviteId ? (
          <Button
            onPress={() => navigation.setParams?.({ collectiviteId: undefined })}
            size="sm"
            title={t(
              'collectiviteConsole.demandes.toutesLesVilles',
              'Voir les demandes de toutes les Villes',
            )}
            variant="Ghost"
          />
        ) : null}
        {affichees.length === 0 ? (
          <Text style={[Fonts.p2, Fonts.neutral200]} testID="demandes-vide">{vides[onglet]}</Text>
        ) : affichees.map((demande) => carteDe[onglet](demande))}
      </ScrollView>
    </ScreenContainer>
  );
}

export default AdminCollectiviteInvitations;
