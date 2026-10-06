import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import {
  closureDaysLabel,
  closureErrorMessage,
  closureHoursLabel,
  closureTagLabel,
} from '@/domains/facilityClosure/facilityClosureDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import Loader from '@/components/atoms/loader/Loader';

import {
  useFacilityClosures,
  useReopenFacilityClosure,
} from '@/services/facilityClosure/facilityClosureQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * Une fermeture de la liste : sa pastille, ses jours, ce qu elle touche, Modifier et Rouvrir.
 * « Rouvrir » demande une confirmation (le seul moyen de defaire le geste ; il previent les
 * clubs).
 * @param {{ fermeture: any, canManage: boolean, onModify: (fermeture: any) => void }} props
 * @returns {import('react').ReactElement} La carte.
 */
function CarteDeFermeture({ canManage, fermeture, onModify }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const rouvrir = useReopenFacilityClosure();
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState(/** @type {string | null} */ (null));

  const prevenus = t('collectiviteFermetures.carte.clubs', {
    count: Number(fermeture.notifiedClubsCount) || 0,
    defaultValue_one: '{{count}} club prévenu',
    defaultValue_other: '{{count}} clubs prévenus',
    // FINITIONS18 12 (T16) — « 0 club prévenu » se dit « Aucun club prévenu ».
    defaultValue_zero: 'Aucun club prévenu',
  });
  const ligne = [
    closureHoursLabel(t, fermeture),
    fermeture.kind === 'block' ? fermeture.label : null,
    canManage ? prevenus : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const envoyer = async () => {
    setErreur(null);
    try {
      await rouvrir.mutateAsync({ closureId: fermeture.documentId });
      setConfirmer(false);
    } catch (refus) {
      setErreur(closureErrorMessage(t, refus) || getErrorMessage(/** @type {any} */ (refus)));
    }
  };

  return (
    <View
      style={[
        Spaces.padding[12],
        {
          backgroundColor: withAlpha(Colors.neutral00, 0.04),
          borderColor: withAlpha(Colors.neutral00, 0.1),
          borderRadius: 16,
          borderWidth: 1,
          gap: 8,
        },
      ]}
      testID={`fermeture-${fermeture.documentId}`}
    >
      <View
        style={[
          Alignments.row,
          Alignments.alignCenter,
          { gap: 8, justifyContent: 'space-between' },
        ]}
      >
        <View
          style={[
            Spaces.paddingHorizontal[8],
            {
              backgroundColor: withAlpha(Colors.warning500, 0.16),
              borderColor: withAlpha(Colors.warning500, 0.5),
              borderRadius: 999,
              borderWidth: 1,
              paddingVertical: 2,
            },
          ]}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.warning500 }]}>
            {closureTagLabel(t, fermeture)}
          </Text>
        </View>
        <Text style={[Fonts.p3, Fonts.neutral300]}>{closureDaysLabel(t, fermeture)}</Text>
      </View>
      <Text style={[Fonts.p2, Fonts.neutral100]}>{ligne}</Text>
      {fermeture.message ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('collectiviteFermetures.liste.mot', '« {{mot}} »', {
            mot: fermeture.message,
            ...SANS_ECHAPPEMENT,
          })}
        </Text>
      ) : null}
      {confirmer ? (
        <View style={{ gap: 8 }} testID={`fermeture-rouvrir-confirmation-${fermeture.documentId}`}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t(
              'collectiviteFermetures.liste.rouvrirQuestion',
              'Rouvrir ? Les mêmes clubs seront prévenus.',
            )}
          </Text>
          <View style={[Alignments.row, { gap: 8 }]}>
            <View style={{ flex: 1 }}>
              <Button
                onPress={() => setConfirmer(false)}
                size="small"
                title={t('collectiviteFermetures.confirmer.annuler', 'Annuler')}
                variant="Ghost"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                isLoading={rouvrir.isPending}
                onPress={envoyer}
                size="small"
                testID={`fermeture-rouvrir-oui-${fermeture.documentId}`}
                title={t('collectiviteFermetures.liste.rouvrir', 'Rouvrir')}
                variant="Primary"
              />
            </View>
          </View>
        </View>
      ) : null}
      {canManage && !confirmer ? (
        <View style={[Alignments.row, { gap: 8 }]}>
          <View style={{ flex: 1 }}>
            <Button
              onPress={() => onModify(fermeture)}
              size="small"
              testID={`fermeture-modifier-${fermeture.documentId}`}
              title={t('collectiviteFermetures.liste.modifier', 'Modifier')}
              variant="Secondary"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              onPress={() => setConfirmer(true)}
              size="small"
              testID={`fermeture-rouvrir-${fermeture.documentId}`}
              title={t('collectiviteFermetures.liste.rouvrir', 'Rouvrir')}
              variant="Secondary"
            />
          </View>
        </View>
      ) : null}
      {erreur ? (
        <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.error500]}>
          {erreur}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * 🚧 COLL-C4B (02/10) — L ONGLET « FERMETURES » d une installation de la Ville (design HY521H1,
 * « P4v3-fermer-tel » ecran 6) : chaque fermeture ou blocage qui dure ou vient, ce qu il touche,
 * « Modifier » et « Rouvrir » — le seul moyen de defaire le geste. « Fermer l installation » et
 * « Bloquer un creneau » ouvrent le formulaire. Le serveur dit qui gere (`meta.canManage`) : sans
 * lui, la liste se lit, aucun geste.
 * @param {{ facilityId: string, onClose: () => void, onBlock: () => void,
 *   onModify: (fermeture: any) => void }} props
 * @returns {import('react').ReactElement} L onglet.
 */
function FacilityClosureList({
  facilityId, onBlock, onClose, onModify,
}) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const fermetures = useFacilityClosures(facilityId);
  const canManage = fermetures.data?.meta?.canManage === true;
  const lignes = Array.isArray(fermetures.data?.data) ? fermetures.data.data : [];

  if (fermetures.isLoading) return <Loader />;
  if (fermetures.error) {
    return (
      <View style={{ gap: 12 }}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('collectiviteFermetures.liste.erreur', 'Impossible de charger les fermetures')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>{getErrorMessage(fermetures.error)}</Text>
        <Button
          onPress={() => fermetures.refetch()}
          title={t('facilityList.retry', 'Réessayer')}
          variant="Secondary"
        />
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }} testID="fermetures-onglet">
      {lignes.length ? (
        lignes.map((/** @type {any} */ fermeture) => (
          <CarteDeFermeture
            canManage={canManage}
            fermeture={fermeture}
            key={fermeture.documentId}
            onModify={onModify}
          />
        ))
      ) : (
        <EmptyState
          description={t(
            'collectiviteFermetures.liste.videTexte',
            // eslint-disable-next-line max-len
            'Fermer l’installation prévient les clubs qui y ont une séance ; rien n’est annulé à leur place.',
          )}
          title={t('collectiviteFermetures.liste.vide', 'Aucune fermeture prévue')}
        />
      )}
      {canManage ? (
        <View style={{ gap: 8 }}>
          <Button
            onPress={onClose}
            testID="fermetures-fermer"
            title={t('collectiviteFermetures.liste.fermer', 'Fermer l’installation')}
            variant="Secondary"
          />
          <Button
            onPress={onBlock}
            testID="fermetures-bloquer"
            title={t('collectiviteFermetures.liste.bloquer', 'Bloquer un créneau')}
            variant="Ghost"
          />
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('collectiviteFermetures.liste.rouvrirPrevient', 'Rouvrir prévient les mêmes clubs.')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default FacilityClosureList;
