import { useNavigation, useRoute } from '@react-navigation/native';
import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  PermissionsAndroid,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  ACTUALITE_ATTACHMENTS_MAX,
  ACTUALITE_AUDIENCES,
  ACTUALITE_BODY_MAX,
  ACTUALITE_CATEGORIES,
  ACTUALITE_TITLE_MAX,
  actualiteFormErrors,
  audienceLabel,
  audiencePreview,
  categoryLabel,
  isImageAttachment,
  toActualitePayload,
} from '@/domains/collectivite/collectiviteActualites';
import { findManagedCollectivite } from '@/domains/collectivite/collectiviteDisplay';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import Loader from '@/components/atoms/loader/Loader';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import ChatAttachmentSheet from '@/components/organisms/chatAttachmentSheet/ChatAttachmentSheet';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ActualiteCarte, {
  PieceJointeActualite,
} from '@/views/collectivite/components/ActualiteCarte';

import { RouteNames } from '@/navigation/routeNames';

import {
  useActualiteMutations,
  useActualiteRecipients,
  useCollectiviteActualites,
} from '@/services/collectivite/collectiviteActualiteQueries';
import { uploadActualiteFile } from '@/services/collectivite/collectiviteActualiteService';
import {
  useCollectiviteInstallations,
  useMyCollectivites,
} from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';
import { createLogger } from '@/utils/logger/logger';

import MediaPlatform from '@/platform/media';
import { ecouterLeDepot } from '@/platform/media/depotDeFichiers';
import { getDocumentPickerOptions } from '@/platform/media/documentUploadFormats';
import { useIsDesktop } from '@/responsive';

/**
 * Un sélecteur annulé n'est pas une panne (image-picker : `didCancel` ; documents : un code).
 * @param {any} erreur - Ce que le sélecteur a jeté.
 * @returns {boolean} Vrai pour une annulation.
 */
const estAnnulation = (erreur) => /cancel/i.test(String(erreur?.code || erreur?.message || ''));

// T9 (C18) : l'échec d'une pièce jointe ne disait que « Réessayez » — sa cause part au journal.
const journal = createLogger('collectivite-actualite');

/**
 * 📰 PUBLIER (OU MODIFIER) UNE ACTUALITÉ DE LA VILLE — COLL-C4A (02/10/2026).
 * Design validé HY521H1 page 3 : planches P3b-actu-tel (écrans 1 et 2) et P3b-actu-ordi.
 *
 * Un type, un titre, un texte ; des pièces jointes par la feuille « Ajouter » de la messagerie
 * (`ChatAttachmentSheet`), réduite à trois actions sur sept : Photos, Caméra, Document (sondage,
 * événement, contact et localisation n'ont pas de sens dans un canal où personne ne répond) ; et
 * POUR QUI : tous les membres, les dirigeants, ou les clubs d'une installation. Une phrase dit
 * qui la recevra, comptée par le serveur. Sur ordinateur, l'aperçu exact à droite, et pas de
 * caméra.
 *
 * Paramètres de route : `collectiviteId` ; `actualiteId` pour « Modifier » ; `retour: 'liste'`
 * quand on vient de « Actualités de la Ville » (on y revient au lieu d'empiler un second écran).
 * @returns {import('react').ReactElement} L'écran.
 */
function CollectiviteActualiteForm() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const isDesktop = useIsDesktop();
  /** @type {{ actualiteId?: string, collectiviteId?: string, retour?: string } | undefined} */
  const parametres = (route?.params);
  const collectiviteId = parametres?.collectiviteId || null;
  const actualiteId = parametres?.actualiteId || null;

  const mine = useMyCollectivites();
  const collectivite = findManagedCollectivite(mine.data, collectiviteId);
  const actualites = useCollectiviteActualites(collectiviteId, { enabled: Boolean(actualiteId) });
  const installations = useCollectiviteInstallations(collectiviteId);
  const { modifier, publier } = useActualiteMutations(collectiviteId);
  const liste = Array.isArray(actualites.data) ? actualites.data : [];
  const existante = actualiteId
    ? liste.find((actualite) => actualite?.documentId === actualiteId) || null
    : null;

  const [categorie, setCategorie] = useState('autre');
  const [titre, setTitre] = useState('');
  const [texte, setTexte] = useState('');
  const [audience, setAudience] = useState('membres');
  const [installationId, setInstallationId] = useState(/** @type {string | null} */ (null));
  const [pieces, setPieces] = useState(/** @type {any[]} */ ([]));
  const [prete, setPrete] = useState(!actualiteId);
  const [feuille, setFeuille] = useState(false);
  const [envoiPiece, setEnvoiPiece] = useState(/** @type {string | null} */ (null));
  const [tentee, setTentee] = useState(false);
  const [erreurServeur, setErreurServeur] = useState('');
  // COLL-C4A3 — le glisser-déposer n'existe que sur le site, sur ordinateur.
  const depotPossible = Platform.OS === 'web' && isDesktop;
  const [zoneDepot, setZoneDepot] = useState(/** @type {any} */ (null));
  const [survolDepot, setSurvolDepot] = useState(false);

  // COLL-C4A3 (planche 18) — une CROIX ferme l'écran, pas une flèche : on annule une saisie.
  const renderHeaderLeft = useCallback(() => (
    <HeaderBackButton
      accessibilityLabel={t('collectiviteActualites.form.annuler', 'Annuler')}
      iconName="close"
    />
  ), [t]);
  useLayoutEffect(() => {
    navigation.setOptions?.({ headerLeft: renderHeaderLeft });
  }, [navigation, renderHeaderLeft]);

  // « Modifier » : le formulaire se remplit UNE fois, à la lecture de l'actualité.
  useEffect(() => {
    if (prete || !existante) return;
    setCategorie(existante.category || 'autre');
    setTitre(existante.title || '');
    setTexte(existante.body || '');
    setAudience(existante.audience || 'membres');
    setInstallationId(existante.facility?.documentId || null);
    setPieces(Array.isArray(existante.attachments) ? existante.attachments : []);
    setPrete(true);
  }, [existante, prete]);

  const destinataires = useActualiteRecipients(collectiviteId, {
    audience,
    facilityId: audience === 'installation' ? installationId : null,
  });
  const nombreDeClubs = Number.isInteger(destinataires.data?.clubsCount)
    ? destinataires.data.clubsCount
    : null;

  const formulaire = {
    attachments: pieces,
    audience,
    body: texte,
    category: categorie,
    facilityId: installationId,
    title: titre,
  };
  const fautes = actualiteFormErrors(formulaire);
  const enCours = publier.isPending || modifier.isPending;

  /**
   * Un échec d'envoi dit la même phrase, que le fichier ait été choisi ou lâché ; sa cause part au
   * journal. Une annulation du sélecteur n'est pas un échec.
   * @param {unknown} erreur - Ce qui a été jeté.
   */
  const direLEchec = (erreur) => {
    if (estAnnulation(erreur)) return;
    journal.warn('Piece jointe non envoyee', erreur);
    setErreurServeur(t(
      'collectiviteActualites.form.pieceEchec',
      'La pièce jointe n’a pas pu être envoyée. Réessayez.',
    ));
  };

  /**
   * Téléverse les fichiers, UN PAR UN, et ajoute chacun aux pièces jointes dès qu'il est parti.
   * @param {any[]} choisis - Ce que rend le sélecteur, ou les fichiers lâchés.
   * @returns {Promise<void>} Fini quand le dernier est parti ; jette au premier échec.
   */
  const televerser = (choisis) => choisis.reduce(async (precedent, brut) => {
    await precedent;
    const fichier = await uploadActualiteFile(brut);
    if (fichier?.id) setPieces((avant) => [...avant, fichier]);
  }, Promise.resolve());

  const ajouterPiece = async (/** @type {'photos' | 'camera' | 'document'} */ cle) => {
    setFeuille(false);
    // T9 (C18) : un nouvel essai efface le message d'un échec précédent.
    setErreurServeur('');
    if (pieces.length >= ACTUALITE_ATTACHMENTS_MAX) return;
    try {
      let choisi = null;
      if (cle === 'document') {
        // T9 (C18) : la COPIE du document part, comme dans la messagerie (platform/media).
        // COLL-FIX2 (T10) : et le sélecteur s'ouvre comme celui de la messagerie, qui envoie des
        // documents : en mode « import » (ACTION_GET_CONTENT), pas « open ».
        choisi = await MediaPlatform.pickDocument({
          ...getDocumentPickerOptions(),
          localCopy: true,
          mode: 'import',
        });
      } else if (cle === 'camera') {
        if (Platform.OS === 'android') {
          const accord = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
          if (accord !== PermissionsAndroid.RESULTS.GRANTED) return;
        }
        choisi = await MediaPlatform.capturePhoto();
      } else {
        choisi = await MediaPlatform.pickImage();
      }
      if (!choisi || choisi?.didCancel) return;
      setEnvoiPiece(cle);
      await televerser([choisi]);
    } catch (erreur) {
      direLEchec(erreur);
    } finally {
      setEnvoiPiece(null);
    }
  };

  // COLL-C4A3 — des fichiers lâchés sur le site suivent le chemin d'un fichier choisi, dans la
  // limite des pièces jointes ; rien ne part pendant un autre envoi.
  const deposer = async (/** @type {any[]} */ fichiers) => {
    const place = ACTUALITE_ATTACHMENTS_MAX - pieces.length;
    if (envoiPiece || place <= 0 || fichiers.length === 0) return;
    setErreurServeur('');
    setEnvoiPiece('depot');
    try {
      await televerser(fichiers.slice(0, place));
    } catch (erreur) {
      direLEchec(erreur);
    } finally {
      setEnvoiPiece(null);
    }
  };
  // L'écoute du navigateur appelle toujours la DERNIÈRE version (pièces et envoi à jour), sans
  // être rebranchée à chaque frappe.
  const deposerRef = useRef(deposer);
  deposerRef.current = deposer;
  useEffect(() => {
    if (!depotPossible) return undefined;
    return ecouterLeDepot(zoneDepot, {
      onFichiers: (fichiers) => deposerRef.current(fichiers),
      onSurvol: setSurvolDepot,
    });
  }, [depotPossible, zoneDepot]);

  const enregistrer = async () => {
    setTentee(true);
    setErreurServeur('');
    if (Object.keys(fautes).length > 0) return;
    const data = toActualitePayload(formulaire);
    try {
      if (actualiteId) await modifier.mutateAsync({ actualiteId, data });
      else await publier.mutateAsync(data);
      if (parametres?.retour === 'liste' || actualiteId) navigation.goBack();
      else navigation.replace(RouteNames.CollectiviteActualites, { collectiviteId });
    } catch (erreur) {
      setErreurServeur(getErrorMessage(/** @type {any} */ (erreur)));
    }
  };

  const puce = (
    /** @type {string} */ valeur,
    /** @type {string} */ libelle,
    /** @type {boolean} */ actif,
    /** @type {() => void} */ onPress,
    /** @type {string} */ testID,
  ) => (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ checked: actif }}
      key={valeur}
      onPress={onPress}
      style={[
        ApplicationStyle.borderRadius12,
        {
          backgroundColor: actif
            ? withAlpha(Colors.primary500, 0.22)
            : withAlpha(Colors.neutral00, 0.05),
          borderColor: actif ? Colors.primary500 : withAlpha(Colors.neutral00, 0.12),
          borderWidth: 1,
          justifyContent: 'center',
          minHeight: 44,
          paddingHorizontal: 12,
        },
      ]}
      testID={testID}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{libelle}</Text>
    </TouchableOpacity>
  );

  const etiquette = (/** @type {string} */ libelle) => (
    <Text style={[Fonts.p3Bold, Fonts.neutral200]}>{libelle}</Text>
  );

  // Sur ordinateur, la caméra n'a pas de sens (planche P3b-actu-ordi) : Photo et Document.
  const actionsDeLaFeuille = [
    {
      key: 'photos',
      label: t('collectiviteActualites.form.photos', 'Photos'),
      loading: envoiPiece === 'photos',
    },
    ...(Platform.OS === 'web' ? [] : [{
      key: 'camera',
      label: t('collectiviteActualites.form.camera', 'Caméra'),
      loading: envoiPiece === 'camera',
    }]),
    {
      key: 'document',
      label: t('collectiviteActualites.form.document', 'Document'),
      loading: envoiPiece === 'document',
    },
  ];

  const boutonsAjouter = isDesktop ? (
    <View style={[Alignments.row, Alignments.alignCenter, Alignments.wrap, { gap: 8 }]}>
      {actionsDeLaFeuille.map((action) => (
        <Button
          disabled={Boolean(envoiPiece)}
          isLoading={action.loading}
          isOption
          key={action.key}
          onPress={() => ajouterPiece(/** @type {any} */ (action.key))}
          size="sm"
          testID={`actualite-form-ajouter-${action.key}`}
          title={action.label}
          variant="SecondaryLight"
        />
      ))}
      {depotPossible ? (
        <Text style={[Fonts.p3, Fonts.neutral300]} testID="actualite-form-glisser">
          {t('collectiviteActualites.form.glisser', 'ou glissez un fichier ici')}
        </Text>
      ) : null}
    </View>
  ) : (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={Boolean(envoiPiece)}
      onPress={() => setFeuille(true)}
      style={[Alignments.row, Alignments.alignCenter, { gap: 8, minHeight: 44 }]}
      testID="actualite-form-ajouter"
    >
      {envoiPiece ? <Loader size="small" /> : (
        <Image
          source={Images.plus}
          style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.primary500]}
        />
      )}
      <Text style={[Fonts.p2Bold, Fonts.primary500]}>
        {t('collectiviteActualites.form.ajouter', 'Ajouter une photo ou un document')}
      </Text>
    </TouchableOpacity>
  );

  const blocPieces = (
    <View style={{ gap: 8 }}>
      {pieces.map((fichier) => (
        <PieceJointeActualite
          fichier={fichier}
          key={String(fichier?.id)}
          onRetirer={() => setPieces((avant) => avant.filter((autre) => autre?.id !== fichier?.id))}
          sousTitre={isImageAttachment(fichier)
            ? t('collectiviteActualites.form.photoJointe', 'Photo jointe')
            : t('collectiviteActualites.form.documentJoint', 'Document joint')}
        />
      ))}
      {pieces.length < ACTUALITE_ATTACHMENTS_MAX ? boutonsAjouter : null}
    </View>
  );

  const fauteTitre = fautes.title === 'tooLong'
    ? t('collectiviteActualites.form.fautes.titre.tooLong', 'Le titre est trop long.')
    : t('collectiviteActualites.form.fautes.titre.required', 'Donnez un titre à l’actualité.');
  const listeInstallations = Array.isArray(installations.data) ? installations.data : [];
  const formulaireRendu = (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        {etiquette(t('collectiviteActualites.form.type', 'Type'))}
        <View
          accessibilityLabel={t('collectiviteActualites.form.type', 'Type')}
          accessibilityRole="radiogroup"
          style={[Alignments.row, Alignments.wrap, { gap: 8 }]}
        >
          {ACTUALITE_CATEGORIES.map((valeur) => puce(
            valeur,
            categoryLabel(t, valeur),
            categorie === valeur,
            () => setCategorie(valeur),
            `actualite-form-type-${valeur}`,
          ))}
        </View>
      </View>
      <Input
        error={tentee && fautes.title ? fauteTitre : undefined}
        label={t('collectiviteActualites.form.titre', 'Titre')}
        maxLength={ACTUALITE_TITLE_MAX}
        onChangeText={setTitre}
        testID="actualite-form-titre"
        value={titre}
      />
      <Input
        error={tentee && fautes.body
          ? t('collectiviteActualites.form.fautes.texteTropLong', 'Le texte est trop long.')
          : undefined}
        label={t('collectiviteActualites.form.texte', 'Texte')}
        maxLength={ACTUALITE_BODY_MAX}
        multiline
        numberOfLines={5}
        onChangeText={setTexte}
        testID="actualite-form-texte"
        value={texte}
      />
      {blocPieces}
      <View style={{ gap: 8 }}>
        {etiquette(t('collectiviteActualites.form.pourQui', 'Pour qui'))}
        <View
          accessibilityLabel={t('collectiviteActualites.form.pourQui', 'Pour qui')}
          accessibilityRole="radiogroup"
          style={[Alignments.row, Alignments.wrap, { gap: 8 }]}
        >
          {ACTUALITE_AUDIENCES.map((valeur) => puce(
            valeur,
            audienceLabel(t, valeur),
            audience === valeur,
            () => setAudience(valeur),
            `actualite-form-pour-${valeur}`,
          ))}
        </View>
        {audience === 'installation' ? (
          <View
            accessibilityLabel={t(
              'collectiviteActualites.form.quelleInstallation',
              'Quelle installation ?',
            )}
            accessibilityRole="radiogroup"
            style={[Alignments.row, Alignments.wrap, { gap: 8 }]}
            testID="actualite-form-installations"
          >
            {listeInstallations.map((installation) => puce(
              String(installation?.documentId),
              String(installation?.name || ''),
              installationId === installation?.documentId,
              () => setInstallationId(installation?.documentId || null),
              `actualite-form-installation-${installation?.documentId}`,
            ))}
          </View>
        ) : null}
        {tentee && fautes.facility ? (
          <Text style={[Fonts.p3, Fonts.error300]}>
            {t('collectiviteActualites.form.fautes.installation', 'Choisissez l’installation.')}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const phrase = audience === 'installation' && !installationId
    ? t(
      'collectiviteActualites.form.choisirInstallation',
      'Choisissez l’installation : ses clubs la recevront.',
    )
    : audiencePreview(t, { audience, clubsCount: nombreDeClubs });
  const pied = (
    <View style={{ gap: 12 }}>
      <Text style={[Fonts.p3, Fonts.neutral300]} testID="actualite-form-destinataires">
        {phrase}
      </Text>
      {erreurServeur ? (
        <Text
          accessibilityRole="alert"
          style={[Fonts.p3Bold, Fonts.error300]}
          testID="actualite-form-erreur"
        >
          {erreurServeur}
        </Text>
      ) : null}
      <Button
        disabled={enCours || Boolean(envoiPiece)}
        isLoading={enCours}
        onPress={enregistrer}
        testID="actualite-form-publier"
        title={actualiteId
          ? t('collectiviteActualites.form.enregistrer', 'Enregistrer')
          : t('collectiviteActualites.form.publier', 'Publier')}
        variant="Primary"
      />
    </View>
  );

  const apercu = (
    <View style={{ gap: 12 }} testID="actualite-form-apercu">
      <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
        {t('collectiviteActualites.form.apercu', 'Ce que liront les membres')}
      </Text>
      <ActualiteCarte
        actualite={{
          attachments: pieces,
          body: texte.trim(),
          category: categorie,
          publishedAt: new Date().toISOString(),
          title: titre.trim() || t('collectiviteActualites.form.titreVide', 'Titre de l’actualité'),
        }}
        signature={collectivite?.name || ''}
        testID="actualite-form-apercu-carte"
      />
      {pied}
    </View>
  );

  let corps;
  if (!prete) {
    corps = <Loader />;
  } else if (isDesktop) {
    // COLL-C4A3 — tout l'écran reçoit un fichier lâché (le formulaire ET l'aperçu) : lâché à
    // côté d'une zone trop petite, il serait ouvert par le navigateur, et la saisie perdue.
    corps = (
      <View
        ref={depotPossible ? setZoneDepot : undefined}
        style={[
          Alignments.row,
          {
            alignItems: 'flex-start',
            borderColor: 'transparent',
            borderRadius: 16,
            borderWidth: 1,
            gap: 24,
          },
          survolDepot ? {
            backgroundColor: withAlpha(Colors.primary500, 0.08),
            borderColor: Colors.primary500,
            borderStyle: 'dashed',
          } : null,
        ]}
        testID="actualite-form-depot"
      >
        <View style={{ flex: 1, minWidth: 0 }}>{formulaireRendu}</View>
        <View style={{ width: 400 }}>{apercu}</View>
      </View>
    );
  } else {
    corps = (
      <View style={{ gap: 20 }}>
        {formulaireRendu}
        {pied}
      </View>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {corps}
      </ScrollView>
      <BottomModal
        close={() => setFeuille(false)}
        headerComponent={(
          <Text style={[Fonts.h3, Fonts.neutral00, Fonts.textCenter]}>
            {t('collectiviteActualites.form.feuilleTitre', 'Ajouter')}
          </Text>
        )}
        isVisible={feuille}
      >
        <ChatAttachmentSheet
          actions={/** @type {any} */ (actionsDeLaFeuille)}
          onActionPress={(cle) => ajouterPiece(/** @type {any} */ (cle))}
        />
      </BottomModal>
    </ScreenContainer>
  );
}

export default CollectiviteActualiteForm;
