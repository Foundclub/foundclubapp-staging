import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';

import { choisirLaPhotoDuGroupe } from '@/domains/messaging/photoDuGroupe';
import { buildDeclaredChildCardProps } from '@/domains/playerCard/cardModel';
import useShareCard from '@/domains/playerCard/useShareCard';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Icone from '@/components/atoms/SvgIcon/SvgIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import PlayerCard, { CARD_EXPORT_WIDTH } from '@/components/organisms/playerCard/PlayerCard';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { S_ELIDE } from '@/views/profile/parent/BandeauDeResultat';

import {
  useSetDeclaredChildPhoto,
  useUpdateDeclaredChild,
} from '@/services/declaredChild/declaredChildQueries';
import { buildChildCardPayload } from '@/services/declaredChild/declaredChildRules';

import { getImageUrl } from '@/utils/imageUrl';

import { FILE_SHARE_OUTCOMES } from '@/platform/share/fileShareContract';

/**
 * Les champs de la carte tels que la fiche les porte, en texte (ce que montrent les cases).
 * @param {any} enfant - La fiche.
 * @returns {{ city: string, nationality: string, number: string, position: string }} - Les cases.
 */
const champsDeLaFiche = (enfant) => ({
  city: String(enfant?.city || ''),
  nationality: String(enfant?.nationality || ''),
  number: enfant?.number === null || enfant?.number === undefined ? '' : String(enfant.number),
  position: String(enfant?.position || ''),
});

/**
 * Un lien texte (44 px de haut au moins), motif de la fiche de l'enfant.
 * @param {object} props - Les propriétés.
 * @param {string} props.libelle - Ce qu il fait.
 * @param {() => void} props.onPress - Le geste.
 * @param {string} props.testID - L étiquette de test.
 * @returns {import('react').ReactElement} - Le lien.
 */
function Lien({ libelle, onPress, testID }) {
  const { Alignments, Colors, Fonts } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={[Alignments.alignCenter, Alignments.justifyCenter, styles.lien]}
      testID={testID}
    >
      <Text style={[Fonts.p2Bold, { color: Colors.primary300 }]}>{libelle}</Text>
    </TouchableOpacity>
  );
}

/**
 * PAR-L13 (13/10, design parent planche 13) — LA CARTE DE COLLECTION D UN ENFANT DE MOINS DE
 * 13 ANS, « pareille que les autres » (décision d'Adel du 12/10, registre des mineurs lignes 22
 * et 23 : photo oui, ville et nationalité oui, code QR NON, écran « ce qui part » avant partage).
 *
 * Une VUE de la route « Mes enfants » (`carte`), comme sa fiche : aucune route neuve.
 *  - E28 (`nouvelle`, juste après « Déclarer mon enfant ») : sa carte, et LÀ on demande maillot,
 *    poste, ville et nationalité ; la carte se remplit à mesure. « Enregistrer sa carte » ou
 *    « Plus tard » ramènent à « Mes enfants » (où l'annonce de la création attend).
 *  - E29 (depuis sa fiche) : la carte complète, « Ajouter sa photo » (le parent seul ; le serveur
 *    l'efface avec la fiche), « Ni code ni lien », partager, enregistrer l'image, la modifier.
 *  - E30 : AVANT tout partage, la feuille qui nomme ce qui part (photo, ville, nationalité
 *    comprises) et ce qui ne part jamais (un code ou un lien). Le partage envoie l'IMAGE seule.
 * La carte est la `PlayerCard` de tout le monde (réparée par L14) : sans `qrValue` ni statut.
 * @param {object} props - Les propriétés.
 * @param {any} props.enfant - La fiche (`GET /declared-children/mine`).
 * @param {boolean} [props.nouvelle] - E28 : la fiche vient d'être déclarée.
 * @param {() => void} props.onFini - Retour à « Mes enfants ».
 * @returns {import('react').ReactElement} - La page.
 */
function ChildCardPage({ enfant, nouvelle = false, onFini }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { width: largeurEcran } = useWindowDimensions();
  const {
    cardRef, isBusy, saveCardToGallery, shareCard,
  } = useShareCard();
  const { isPending: enregistrementEnCours, mutate: modifierLaFiche } = useUpdateDeclaredChild();
  const { isPending: envoiDeLaPhoto, mutate: poserLaPhoto } = useSetDeclaredChildPhoto();

  const [enEdition, setEnEdition] = useState(nouvelle);
  const [saisie, setSaisie] = useState(() => champsDeLaFiche(enfant));
  const [erreur, setErreur] = useState('');
  const [erreurPhoto, setErreurPhoto] = useState('');
  const [partageOuvert, setPartageOuvert] = useState(false);

  const documentId = enfant?.documentId;
  const prenom = String(enfant?.firstname || '').trim();
  const elide = S_ELIDE.test(prenom) ? 'Elided' : '';
  const avecPrenom = { firstname: prenom, ...SANS_ECHAPPEMENT };
  const aUnePhoto = Boolean(enfant?.photo?.url);

  const carte = useMemo(() => {
    const { photoUrl, ...props } = buildDeclaredChildCardProps({
      enfant,
      libelles: {
        noTeam: t('myChildren.screen.noTeam'),
        years: t('playerCard.field.yearsUnit'),
      },
      saisie: enEdition ? saisie : null,
    });
    return { ...props, photo: photoUrl ? { uri: getImageUrl(photoUrl) } : undefined };
  }, [enEdition, enfant, saisie, t]);

  /**
   * Range une case de la carte.
   * @param {'city' | 'nationality' | 'number' | 'position'} cle - La case.
   * @returns {(valeur: string) => void} - Le rangement.
   */
  const poser = (cle) => (valeur) => setSaisie((avant) => ({ ...avant, [cle]: valeur }));

  const quitterLEdition = () => (nouvelle ? onFini() : setEnEdition(false));

  const enregistrer = () => {
    setErreur('');
    const payload = buildChildCardPayload(saisie, enfant || {});
    if (!Object.keys(payload).length) {
      quitterLEdition();
      return;
    }
    modifierLaFiche({ documentId, payload }, {
      onError: () => setErreur(t('myChildren.card.saveError')),
      onSuccess: quitterLEdition,
    });
  };

  const annulerLEdition = () => {
    setSaisie(champsDeLaFiche(enfant));
    setErreur('');
    setEnEdition(false);
  };

  const choisirLaPhoto = async () => {
    setErreurPhoto('');
    const choix = await choisirLaPhotoDuGroupe('galerie', t);
    if (!choix) return;
    if ('erreur' in choix) {
      setErreurPhoto(choix.erreur);
      return;
    }
    poserLaPhoto({ documentId, photo: choix.fichier }, {
      onError: () => setErreurPhoto(t('myChildren.card.photoError')),
    });
  };

  const retirerLaPhoto = () => {
    setErreurPhoto('');
    modifierLaFiche({ documentId, payload: { photo: null } }, {
      onError: () => setErreurPhoto(t('myChildren.card.photoError')),
    });
  };

  const enregistrerLImage = async () => {
    try {
      const enregistree = await saveCardToGallery();
      if (enregistree) {
        Alert.alert(t('playerCard.savedTitle'), t('myChildren.card.savedDescription'));
      }
    } catch (err) {
      const message = String(/** @type {any} */ (err)?.message || '');
      const refus = message.includes('gallery_permission_denied');
      Alert.alert(
        t('common.error'),
        refus ? t('playerCard.saveErrorPermission') : t('playerCard.saveError'),
      );
    }
  };

  // E30 — l'IMAGE seule : aucun message, donc aucun lien (`buildCardShareMessage` en ajoute un
  // pour les autres cartes ; celle-ci ne mène à aucune page).
  const partagerLImage = async () => {
    try {
      const resultat = await shareCard({
        dialogTitle: t('myChildren.card.shareOpenWith'),
        title: t(`myChildren.card.title${elide}`, avecPrenom),
      });
      setPartageOuvert(false);
      if (resultat?.outcome === FILE_SHARE_OUTCOMES.GALLERY) {
        Alert.alert(t('playerCard.savedTitle'), t('myChildren.card.sharedGallery'));
      }
    } catch {
      setPartageOuvert(false);
      Alert.alert(t('common.error'), t('playerCard.shareError'));
    }
  };

  const largeurCarte = Math.min(largeurEcran - 48, 560);

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Alignments.fill]}
      // Les quatre cases de la carte restent au-dessus du clavier. Le défilement est CELUI DE
      // L'ÉCRAN (pas `keyboardScroll`, qui y mettrait tout) : la carte de capture, plus bas,
      // reste hors de lui, comme sur « Ma carte de collection ».
      keyboardAvoiding
    >
      <ScrollView
        contentContainerStyle={[Spaces.gap[16], Spaces.paddingTop[16], Spaces.paddingBottom[24]]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={[Alignments.alignCenter, Spaces.gap[8]]}>
          {nouvelle ? (
            <Text style={[Fonts.label, styles.surtitre, { color: Colors.primary200 }]}>
              {t('myChildren.card.eyebrow')}
            </Text>
          ) : null}
          <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00, styles.centre]}>
            {t(`myChildren.card.title${elide}`, avecPrenom)}
          </Text>
        </View>

        <View style={[Alignments.alignCenter, styles.emplacementCarte]}>
          {/* eslint-disable-next-line react/jsx-props-no-spreading */}
          <PlayerCard {...carte} width={largeurCarte} />
        </View>

        {enEdition ? (
          <View style={[Spaces.gap[16]]}>
            <Text style={[Fonts.p2, Fonts.neutral200]}>{t('myChildren.card.hint')}</Text>
            <Input
              inputMode="numeric"
              keyboardType="number-pad"
              label={t('myChildren.card.numberLabel')}
              maxLength={2}
              onChangeText={poser('number')}
              placeholder={t('myChildren.card.numberPlaceholder')}
              testID="child-card-number"
              value={saisie.number}
            />
            <Input
              label={t('myChildren.card.positionLabel')}
              maxLength={80}
              onChangeText={poser('position')}
              placeholder={t('myChildren.form.positionPlaceholder')}
              testID="child-card-position"
              value={saisie.position}
            />
            <Input
              label={t('myChildren.card.cityLabel')}
              maxLength={80}
              onChangeText={poser('city')}
              placeholder={t('myChildren.card.cityPlaceholder')}
              testID="child-card-city"
              value={saisie.city}
            />
            <Input
              label={t('myChildren.card.nationalityLabel')}
              maxLength={80}
              onChangeText={poser('nationality')}
              placeholder={t('myChildren.card.nationalityPlaceholder')}
              testID="child-card-nationality"
              value={saisie.nationality}
            />
            {erreur ? (
              <Text accessibilityLiveRegion="polite" style={[Fonts.p3, { color: Colors.error500 }]}>
                {erreur}
              </Text>
            ) : null}
            <Button
              disabled={enregistrementEnCours}
              isLoading={enregistrementEnCours}
              onPress={enregistrer}
              title={t('myChildren.card.save')}
            />
            <Button
              onPress={nouvelle ? onFini : annulerLEdition}
              title={nouvelle ? t('myChildren.form.later') : t('myChildren.form.cancel')}
              variant="Ghost"
            />
          </View>
        ) : (
          <View style={[Spaces.gap[12]]}>
            <Button
              disabled={envoiDeLaPhoto}
              icon="camera"
              isLoading={envoiDeLaPhoto}
              onPress={choisirLaPhoto}
              title={aUnePhoto ? t('myChildren.card.changePhoto') : t('myChildren.card.addPhoto')}
              variant="SecondaryLight"
            />
            {aUnePhoto ? (
              <Lien
                libelle={t('myChildren.card.removePhoto')}
                onPress={retirerLaPhoto}
                testID="child-card-photo-remove"
              />
            ) : null}
            {erreurPhoto ? (
              <Text accessibilityLiveRegion="polite" style={[Fonts.p3, { color: Colors.error500 }]}>
                {erreurPhoto}
              </Text>
            ) : null}
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
              <Icone color={Colors.neutral300} height={18} name="shield" width={18} />
              <Text style={[Fonts.p3, Fonts.neutral300, styles.etire]}>
                {t('myChildren.card.noLink')}
              </Text>
            </View>
            <Button
              disabled={isBusy}
              icon="share"
              iconPosition="after"
              isLoading={isBusy}
              onPress={() => setPartageOuvert(true)}
              title={t(`myChildren.card.share${elide}`, avecPrenom)}
            />
            <Button
              disabled={isBusy}
              onPress={enregistrerLImage}
              title={t('playerCard.saveCta')}
              variant="Secondary"
            />
            <Lien
              libelle={t('myChildren.card.edit')}
              onPress={() => setEnEdition(true)}
              testID="child-card-edit"
            />
          </View>
        )}
      </ScrollView>

      {/* La carte HORS ÉCRAN, à la taille de l'export : c'est elle que l'image capture. */}
      <View collapsable={false} pointerEvents="none" style={styles.horsEcran}>
        <View collapsable={false} ref={cardRef}>
          {/* eslint-disable-next-line react/jsx-props-no-spreading */}
          <PlayerCard {...carte} width={CARD_EXPORT_WIDTH / 2} />
        </View>
      </View>

      <BottomModal close={() => setPartageOuvert(false)} isVisible={partageOuvert}>
        <View style={[Spaces.gap[16], Spaces.paddingTop[8]]}>
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
              {t(`myChildren.card.sheet.title${elide}`, avecPrenom)}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>{t('myChildren.card.sheet.subtitle')}</Text>
          </View>
          <Text style={[Fonts.p3Bold, Fonts.neutral200, styles.intertitre]}>
            {t('myChildren.card.sheet.shownTitle')}
          </Text>
          <View style={[Alignments.row, Spaces.gap[8]]}>
            <Icone color={Colors.success500} height={20} name="check" width={20} />
            <Text style={[Fonts.p2, Fonts.neutral100, styles.etire]}>
              {t('myChildren.card.sheet.shown')}
            </Text>
          </View>
          <Text style={[Fonts.p3Bold, Fonts.neutral200, styles.intertitre]}>
            {t('myChildren.card.sheet.neverTitle')}
          </Text>
          <View style={[Alignments.row, Spaces.gap[8]]}>
            <Icone color={Colors.error500} height={20} name="close" width={20} />
            <Text style={[Fonts.p2, Fonts.neutral100, styles.etire]}>
              {t('myChildren.card.sheet.never')}
            </Text>
          </View>
          <Button
            disabled={isBusy}
            icon="share"
            iconPosition="after"
            isLoading={isBusy}
            onPress={partagerLImage}
            title={t('myChildren.card.sheet.confirm')}
          />
          <Button
            onPress={() => setPartageOuvert(false)}
            title={t('myChildren.form.cancel')}
            variant="Ghost"
          />
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centre: { textAlign: 'center' },
  emplacementCarte: { paddingVertical: 8 },
  etire: { flex: 1 },
  horsEcran: { left: -9999, position: 'absolute', top: 0 },
  intertitre: { letterSpacing: 1.2, textTransform: 'uppercase' },
  lien: { minHeight: 44 },
  surtitre: { letterSpacing: 1, textTransform: 'uppercase' },
});

export default ChildCardPage;
