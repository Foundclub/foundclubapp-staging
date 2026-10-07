import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { findManagedCollectivite } from '@/domains/collectivite/collectiviteDisplay';
import { cheminDuLienDeLaVille } from '@/domains/collectivite/lienDeLaVille';
import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';

import {
  useCollectiviteInvitationLink,
  useInviteClubByFoundClub,
  useMyCollectivites,
  useRotateCollectiviteInvitationLink,
} from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';
import { buildPublicWebUrl } from '@/utils/shareLinks';

import { share } from '@/platform/share';

/**
 * Copie un texte : le presse-papiers du navigateur sur le site, le module natif sur le
 * telephone (meme garde que SuperAdminEntryList : un module absent ne casse rien).
 * @param {string} texte - Le texte.
 * @returns {Promise<boolean>} Vrai si la copie a eu lieu.
 */
const copier = async (texte) => {
  try {
    const presse = typeof navigator !== 'undefined' ? navigator?.clipboard : null;
    if (typeof presse?.writeText === 'function') {
      await presse.writeText(texte);
      return true;
    }
    // eslint-disable-next-line global-require
    const module = require('@react-native-clipboard/clipboard');
    const clipboard = module?.default || module;
    if (typeof clipboard?.setString === 'function') {
      clipboard.setString(texte);
      return true;
    }
  } catch (_erreur) {
    return false;
  }
  return false;
};

/**
 * 🏛️ INVITER UN CLUB ABSENT — COLL-CLUBS (01/10/2026), design HY521H1 page 7 (« P7v3-inviter »).
 *
 * Deux facons, en onglets :
 *   - PAR UN LIEN (le plus simple pour une mairie) : le lien de la Ville, le meme pour tous, a
 *     coller dans un e-mail ou a donner au telephone ; il ne porte aucune donnee personnelle.
 *     « Changer le lien » : l ancien cesse de marcher (on confirme d abord) ;
 *   - PAR FOUNDCLUB : la mairie donne le nom et le contact GENERAL du club. Une DEMANDE est
 *     enregistree pour l equipe FoundClub ; ⛔ l application n envoie aucun e-mail (ecrire a un
 *     tiers est un geste a part, a decider par Adel).
 * Ce qui se passe ensuite (inscrit, rattache) se lit dans « Clubs rattaches », sous la liste.
 * « vous » : la mairie.
 * @returns {import('react').ReactElement} L ecran.
 */
function CollectiviteInviteClub() {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const route = useRoute();
  const routeParams = /** @type {{ collectiviteId?: string } | undefined} */ (route?.params);
  const collectiviteId = routeParams?.collectiviteId || null;

  const mine = useMyCollectivites();
  const collectivite = findManagedCollectivite(mine.data, collectiviteId);
  const lien = useCollectiviteInvitationLink(collectiviteId);
  const changer = useRotateCollectiviteInvitationLink();
  const inviter = useInviteClubByFoundClub();

  const [onglet, setOnglet] = useState(/** @type {'lien' | 'foundclub'} */ ('lien'));
  const [confirmerLeChangement, setConfirmerLeChangement] = useState(false);
  const [retour, setRetour] = useState('');
  const [nomDuClub, setNomDuClub] = useState('');
  const [contactDuClub, setContactDuClub] = useState('');
  const [demandeTransmise, setDemandeTransmise] = useState(false);

  const ville = collectivite?.name
    ? formatCollectiviteOfferedBy(collectivite.name)
    : t('collectiviteClubs.detail.theCity', 'la Ville');
  const token = /** @type {any} */ (lien.data)?.token || null;
  const adresse = token ? buildPublicWebUrl({ path: cheminDuLienDeLaVille(token) }) : null;

  const copierLeLien = async () => {
    if (!adresse) return;
    const copie = await copier(adresse);
    setRetour(copie
      ? t('collectiviteClubs.invite.copied', 'Lien copié.')
      : t(
        'collectiviteClubs.invite.copyFailed',
        'La copie a échoué : sélectionnez le lien ci-dessus.',
      ));
  };
  const partagerLeLien = async () => {
    if (!adresse) return;
    try {
      await share({
        message: t(
          'collectiviteClubs.invite.shareMessage',
          '{{ville}} vous invite à inscrire votre club sur FoundClub : {{adresse}}',
          { adresse, ville, ...SANS_ECHAPPEMENT },
        ),
        title: t('collectiviteClubs.invite.shareTitle', 'Invitation de la Ville sur FoundClub'),
        url: adresse,
      });
    } catch (_erreur) {
      setRetour(t(
        'collectiviteClubs.invite.shareFailed',
        'Le partage n’a pas pu s’ouvrir : copiez le lien.',
      ));
    }
  };
  const changerLeLien = () => {
    if (!collectiviteId) return;
    changer.mutate({ collectiviteId }, {
      onSettled: () => setConfirmerLeChangement(false),
      onSuccess: () => setRetour(t(
        'collectiviteClubs.invite.changed',
        'Nouveau lien : l’ancien ne marche plus.',
      )),
    });
  };
  const transmettre = () => {
    if (!collectiviteId) return;
    inviter.mutate({
      clubContact: contactDuClub.trim(),
      clubName: nomDuClub.trim(),
      collectiviteId,
    }, {
      onSuccess: () => {
        setNomDuClub('');
        setContactDuClub('');
        setDemandeTransmise(true);
      },
    });
  };

  const boiteDuLien = {
    backgroundColor: withAlpha(Colors.primary500, 0.08),
    borderColor: Colors.primary500,
    borderRadius: 12,
    borderStyle: /** @type {'dashed'} */ ('dashed'),
    borderWidth: 1,
  };

  const renderLien = () => (
    <View style={{ gap: 14 }}>
      <Text style={[Fonts.p2, Fonts.neutral100]}>
        {t(
          'collectiviteClubs.invite.linkIntro',
          // eslint-disable-next-line max-len
          'Un club n’est pas encore sur FoundClub ? Envoyez-lui le lien de {{ville}} : il inscrit son club, puis l’équipe FoundClub le rattache à la Ville.',
          { ville, ...SANS_ECHAPPEMENT },
        )}
      </Text>
      <View
        accessibilityLabel={t(
          'collectiviteClubs.invite.linkLabel',
          'Lien d’invitation de la Ville',
        )}
        style={[Spaces.padding[12], boiteDuLien]}
        testID="inviter-lien"
      >
        <Text selectable style={[Fonts.p2Bold, Fonts.primary200]}>
          {adresse || (lien.error ? getErrorMessage(/** @type {any} */ (lien.error)) : '…')}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        <Button
          disabled={!adresse}
          onPress={copierLeLien}
          title={t('collectiviteClubs.invite.copy', 'Copier le lien')}
        />
        <Button
          disabled={!adresse}
          onPress={partagerLeLien}
          title={t('collectiviteClubs.invite.share', 'Partager…')}
          variant="Secondary"
        />
      </View>
      {retour ? <Text style={[Fonts.p3Bold, Fonts.success200]}>{retour}</Text> : null}
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {t(
          'collectiviteClubs.invite.linkHint',
          // eslint-disable-next-line max-len
          'Le même lien sert à tous les clubs. Vous pouvez le changer à tout moment : l’ancien ne marche plus.',
        )}
      </Text>
      {confirmerLeChangement ? (
        <View style={{ gap: 8 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t(
              'collectiviteClubs.invite.changeConfirm',
              'Les clubs qui ont l’ancien lien ne pourront plus l’ouvrir. Changer quand même ?',
            )}
          </Text>
          <View style={[Alignments.row, { gap: 8 }]}>
            <Button
              isLoading={changer.isPending}
              onPress={changerLeLien}
              size="sm"
              title={t('collectiviteClubs.invite.change', 'Changer le lien')}
              variant="Danger"
            />
            <Button
              onPress={() => setConfirmerLeChangement(false)}
              size="sm"
              title={t('common.cancel', 'Annuler')}
              variant="Ghost"
            />
          </View>
        </View>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={!adresse}
          onPress={() => setConfirmerLeChangement(true)}
          style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
          testID="inviter-changer"
        >
          <Text style={[Fonts.p2Bold, Fonts.primary200]}>
            {t('collectiviteClubs.invite.change', 'Changer le lien')}
          </Text>
        </TouchableOpacity>
      )}
      {changer.error ? (
        <Text style={[Fonts.p3, Fonts.error300]}>
          {getErrorMessage(/** @type {any} */ (changer.error))}
        </Text>
      ) : null}
    </View>
  );

  const pret = nomDuClub.trim().length > 0 && contactDuClub.trim().length > 0;
  const renderFoundClub = () => (
    <View style={{ gap: 14 }}>
      <Text style={[Fonts.p2, Fonts.neutral100]}>
        {t(
          'collectiviteClubs.invite.foundclubIntro',
          // eslint-disable-next-line max-len
          'FoundClub l’invite au nom de la Ville. Une fois inscrit, il vous est rattaché par l’équipe FoundClub.',
        )}
      </Text>
      <Input
        label={t('collectiviteClubs.invite.clubName', 'Nom du club')}
        maxLength={200}
        onChangeText={(/** @type {string} */ texte) => {
          setNomDuClub(texte);
          setDemandeTransmise(false);
        }}
        placeholder={t('collectiviteClubs.invite.clubNamePlaceholder', 'Le nom du club')}
        testID="inviter-nom"
        value={nomDuClub}
      />
      <View style={{ gap: 4 }}>
        <Input
          label={t(
            'collectiviteClubs.invite.clubContact',
            'Son contact général (e-mail ou téléphone du club)',
          )}
          maxLength={200}
          onChangeText={(/** @type {string} */ texte) => {
            setContactDuClub(texte);
            setDemandeTransmise(false);
          }}
          placeholder={t('collectiviteClubs.invite.clubContactPlaceholder', 'Le contact du club')}
          testID="inviter-contact"
          value={contactDuClub}
        />
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'collectiviteClubs.invite.clubContactHint',
            'Le contact du club, pas celui d’une personne.',
          )}
        </Text>
      </View>
      <Button
        disabled={!pret}
        isLoading={inviter.isPending}
        onPress={transmettre}
        title={t('collectiviteClubs.invite.send', 'Transmettre à l’équipe FoundClub')}
      />
      {demandeTransmise ? (
        <Text style={[Fonts.p3Bold, Fonts.success200]}>
          {t(
            'collectiviteClubs.invite.sent',
            // eslint-disable-next-line max-len
            'Demande transmise. Vous la retrouvez dans « Clubs rattachés », sous la liste des clubs.',
          )}
        </Text>
      ) : null}
      {inviter.error ? (
        <Text style={[Fonts.p3, Fonts.error300]}>
          {getErrorMessage(/** @type {any} */ (inviter.error))}
        </Text>
      ) : null}
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{
          gap: 16, maxWidth: 640, paddingBottom: 24, paddingTop: 12, width: '100%',
        }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={{ gap: 4 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {(collectivite?.name || t('collectivite.home.kicker', 'Ma collectivité')).toUpperCase()}
          </Text>
          <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('collectiviteClubs.invite.title', 'Inviter un club absent de FoundClub')}
          </Text>
        </View>
        <SegmentedControl
          onChange={(/** @type {string} */ valeur) => setOnglet(
            valeur === 'foundclub' ? 'foundclub' : 'lien',
          )}
          options={[
            { label: t('collectiviteClubs.invite.byLink', 'Par un lien'), value: 'lien' },
            {
              label: t('collectiviteClubs.invite.byFoundClub', 'Par FoundClub'),
              value: 'foundclub',
            },
          ]}
          value={onglet}
        />
        {onglet === 'lien' ? renderLien() : renderFoundClub()}
      </ScrollView>
    </ScreenContainer>
  );
}

export default CollectiviteInviteClub;
