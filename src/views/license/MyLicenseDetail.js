// @ts-nocheck
/* eslint-disable perfectionist/sort-imports */
// S9, vague S — ECRAN 2 DU PACK « MES COTISATIONS » : LE DETAIL.
//
// 🎯 « Tout ce qui concerne une cotisation, et rien d autre. » On y arrive en
// tapant une carte de la LISTE, et le retour ramene a la liste.
// ⛔ PAS DE SELECTEUR DE CLUB ICI : la liste est le seul chemin entre deux
// cotisations, un selecteur ferait doublon (architecture A).
//
// 🧹 CE QUE CET ECRAN SUPPRIME (defaut 4 du pack) : les cinq cartes d absence
// de l ancien ecran — « Aucun document », « Pas d historique », « Pas encore de
// reçu », « Ta licence n est pas encore disponible », « 1 relance(s) recue(s) ».
// UNE SECTION VIDE NE SE DESSINE PAS. C est la decision D3, non negociable.
//
// 🔒 AA07 / K2 SURVIT ICI : le TELECHARGEMENT des depots en plus de
// l ouverture · la licence s ouvre meme quand le serveur ne remplit que
// `file` · aucun bouton sans fichier. Le temoin
// `MyLicenseDetail.AA07.documents.test.js` l observe.

import { useCallback, useMemo, useState } from 'react';
import {
  Alert, Pressable, ScrollView, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import WebFloatingOverlay from '@/components/atoms/webFloatingOverlay/WebFloatingOverlay';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import LinksPlatform from '@/platform/links';
import MediaPlatform from '@/platform/media';
import SharePlatform from '@/platform/share';
import { getDocumentPickerOptions } from '@/platform/media/documentUploadFormats';
// AA07 / K2 — jumeaux `.native` / `.web` : Metro resout le premier, Vite le second.
import { downloadRemoteFile } from '@/platform/media/downloadRemoteFile';

import {
  createLicenseCheckout,
  declareExternalLicensePayment,
  generateLicenseReceipt,
  submitLicenseDocument,
  useLicenseMutation,
  useMyLicenseAssignment,
  useMyLicenses,
} from '@/services/license/licenseQueries';

import { resolveMediaUrl } from '@/utils/mediaUrl';
import { buildPublicWebUrl } from '@/utils/shareLinks';

import {
  formatLicenseMoney,
  getEnabledManualPaymentMethods,
  LicenseEmptyState,
  normalizePaymentModes,
  paymentModeLabels,
} from './licenseDesignSystem';
import {
  campaignTitleOf,
  clubNameOf,
  currencyOf,
  formatMemberDate,
  getHeadlineAmountCents,
  getInstallmentState,
  getMemberStatusOverline,
  getMemberStatusTone,
  getNextInstallment,
  getPaidRatio,
  hasInstallmentPlan,
  installmentOrderOf,
  isSettledAssignment,
  licenseKeyOf,
} from './memberLicenseModel';
import {
  DeclareLicensePaymentSheet,
  glyphForPaymentMethod,
  PayerLinkSheet,
  PayLicenseSheet,
} from './memberLicenseSheets';
import {
  MemberKeyValueTable,
  MemberOverline,
  MemberProgressBar,
  memberRadius,
  MemberRow,
  MemberRowAction,
  memberSpacing,
  MemberStatusPill,
  MemberTile,
  MemberTopBar,
  memberType,
} from './memberLicenseUi';

// Les cinq etats de ligne d echeance, leur glyphe et leur mot.
const INSTALLMENT_GLYPHS = {
  declared: 'hourglass',
  due: 'clock',
  late: 'triangleExclamation',
  paid: 'circleCheck',
  upcoming: 'calendar',
};

const isPickerCancelError = (error) => String(error?.code || error?.message || '')
  .toLowerCase()
  .includes('cancel');

const paymentDate = (payment = {}) => String(
  payment.validatedAt || payment.paidAt || payment.createdAt || '',
).slice(0, 10);

/**
 * LA CARTE DE MONTANT — un seul chiffre a le droit d etre gros.
 *
 * ⛔ Total et paye passent en 13/400 sur une ligne. Trois montants de meme
 * taille (defaut 5 du pack) ne se lisent pas.
 * @param {object} props
 * @param {any} props.assignment
 * @param {import('react').ReactNode} [props.footer]
 * @returns {import('react').ReactElement}
 */
function AmountCard({ assignment, footer }) {
  const { Colors, Fonts } = useTheme();
  const type = memberType(Fonts);
  const tone = getMemberStatusTone(Colors, assignment.status);
  const currency = currencyOf(assignment);
  const status = String(assignment?.status || '');
  const headline = getHeadlineAmountCents(assignment);
  const due = Number(assignment?.amountDueCents) || 0;
  const paid = Number(assignment?.amountPaidCents) || 0;

  let headlineStyle = Fonts.neutral00;
  if (status === 'paid') headlineStyle = Fonts.success500;
  else if (status === 'cancelled') headlineStyle = Fonts.neutral400;
  else if (status === 'waived') headlineStyle = Fonts.neutral300;

  const dueLabel = formatLicenseMoney(due, currency);
  let context = 'Aucun paiement pour l’instant';
  if (status === 'waived') context = `Cotisation de ${dueLabel} offerte par le club`;
  else if (status === 'cancelled') context = 'Annulée par le club';
  else if (status === 'paid') context = `${dueLabel} réglés`;
  else if (paid > 0) {
    context = `${formatLicenseMoney(paid, currency)} déjà payés sur ${dueLabel}`;
  }

  return (
    <View style={{
      backgroundColor: Colors.primary700,
      borderColor: withAlpha(tone, status === 'overdue' ? 0.45 : 0.32),
      borderRadius: memberRadius.hero,
      borderWidth: 1,
      gap: memberSpacing.rowGap,
      padding: 16,
    }}
    >
      <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 12 }}>
        <MemberTile glyph={status === 'waived' ? 'gift' : 'euroCircle'} tone={tone} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={[type.title, Fonts.neutral00]}>
            {campaignTitleOf(assignment)}
          </Text>
          {/* MARQUEE — le nom du club se lit en entier */}
          <MarqueeText
            style={[type.meta, Fonts.neutral300]}
            text={clubNameOf(assignment)}
          />
        </View>
        <MemberStatusPill status={assignment.status} />
      </View>
      <Text style={[type.overline, { color: Colors.neutral500 }]}>
        {getMemberStatusOverline(assignment.status)}
      </Text>
      <Text style={[
        type.headline,
        headlineStyle,
        status === 'cancelled' ? { textDecorationLine: 'line-through' } : null,
      ]}
      >
        {formatLicenseMoney(headline, currency)}
      </Text>
      <Text style={[type.subtitle, Fonts.neutral300]}>{context}</Text>
      {/* ⛔ Pas de barre quand il n y a rien a progresser (exemptee, annulee). */}
      {['cancelled', 'waived'].includes(status)
        ? null
        : <MemberProgressBar ratio={getPaidRatio(assignment)} />}
      {footer ? (
        <View style={{
          borderTopColor: withAlpha(Colors.neutral00, 0.08),
          borderTopWidth: 1,
          paddingTop: memberSpacing.rowGap,
        }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

/**
 * ECRAN 2 — « Ma cotisation ».
 * @param {object} props
 * @param {any} props.navigation
 * @param {any} props.route
 * @returns {import('react').ReactElement}
 */
function MyLicenseDetail({ navigation, route }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const type = memberType(Fonts);
  const routeAssignmentId = route?.params?.assignmentId;
  const listQuery = useMyLicenses();
  const assignmentQuery = useMyLicenseAssignment(routeAssignmentId, {
    enabled: Boolean(routeAssignmentId),
  });
  const assignments = useMemo(() => listQuery.data || [], [listQuery.data]);
  // 💡 CE QUI EXISTAIT DEJA ET QU ON REUTILISE (§1 bis, barreau 2) :
  // `/licenses/me` rend les affectations DEJA PEUPLEES. Ouvrir un detail depuis
  // la liste ne coute donc AUCUN appel reseau — la requete par identifiant
  // n existe que pour les entrees profondes (notification, lien web).
  const fromList = useMemo(
    () => assignments.find((item) => licenseKeyOf(item) === String(routeAssignmentId || '')),
    [assignments, routeAssignmentId],
  );
  const current = assignmentQuery.data || fromList || null;

  const [menuVisible, setMenuVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [paySheetVisible, setPaySheetVisible] = useState(false);
  const [declareSheetVisible, setDeclareSheetVisible] = useState(false);
  const [payerSheetVisible, setPayerSheetVisible] = useState(false);
  // 🗂️ « Replier n est pas cacher » : un dossier complet tient sur UNE ligne
  // verte, et le detail des pieces reste a un tap. C est la seule section
  // repliable de la page (cadre 4B du pack).
  const [dossierExpanded, setDossierExpanded] = useState(false);

  const assignmentId = licenseKeyOf(current);
  const campaignId = current?.campaign?.documentId || current?.campaign?.id;
  const checkoutMutation = useLicenseMutation(
    ({ amountCents, provider }) => createLicenseCheckout(assignmentId, { amountCents, provider }),
    campaignId,
  );
  const declareMutation = useLicenseMutation(
    ({ amountCents, method }) => declareExternalLicensePayment(
      assignmentId,
      { amountCents, method },
    ),
    campaignId,
  );
  const documentMutation = useLicenseMutation(
    (payload) => submitLicenseDocument(assignmentId, payload),
    campaignId,
  );
  const receiptMutation = useLicenseMutation(
    (paymentId) => generateLicenseReceipt(paymentId),
    campaignId,
  );

  const refreshCurrent = useCallback(() => {
    listQuery.refetch();
    if (routeAssignmentId) assignmentQuery.refetch();
  }, [assignmentQuery, listQuery, routeAssignmentId]);

  // AA07 / K2 — UN SEUL ENDROIT QUI SAIT TROUVER LE FICHIER D UN DEPOT.
  // 🧨 LE DEFAUT QUE CELA SUPPRIME : « Voir ma licence » s affichait sur
  // `file.url` mais AGISSAIT sur `submission.file.url`. Deux chemins pour un
  // seul bouton ⇒ des que le serveur remplit l un sans l autre, le bouton
  // apparait et repond « Document indisponible ». La condition d affichage et
  // le geste lisent desormais LA MEME chose.
  const fileUrlOf = useCallback((source) => resolveMediaUrl(
    source?.file?.url
    || source?.submission?.file?.url
    || source?.file?.formats?.thumbnail?.url
    || '',
  ), []);

  const openUploadedDocument = useCallback(async (source) => {
    const url = fileUrlOf(source);
    if (!url) {
      Alert.alert('Document indisponible', 'Aucun fichier exploitable n est rattaché à ce dépôt.');
      return;
    }
    await LinksPlatform.openUrl(url);
  }, [fileUrlOf]);

  // AA07 / K2 — LE TELECHARGEMENT, DEMANDE EXPLICITEMENT PAR ADEL.
  // ⛔ Ce n est PAS un doublon d « Ouvrir » : ouvrir AFFICHE le fichier,
  // telecharger le POSE dans le telephone. Deux gestes, deux libelles.
  const downloadDocument = useCallback(async (source, fileName) => {
    const url = fileUrlOf(source);
    if (!url) {
      Alert.alert('Document indisponible', 'Aucun fichier exploitable n est rattaché à ce dépôt.');
      return;
    }
    try {
      await downloadRemoteFile({ fileName, url });
    } catch (error) {
      Alert.alert(
        'Téléchargement impossible',
        error?.message || 'Le document n a pas pu être enregistré sur ton téléphone.',
      );
    }
  }, [fileUrlOf]);

  // T03 — le MODELE que le club met a disposition. Il vient de la DEMANDE
  // (`templateFile`), pas d un depot : c est le meme fichier pour tout le club.
  const downloadTemplate = useCallback(async (request) => {
    const url = resolveMediaUrl(request?.templateFile?.url || '');
    if (!url) {
      Alert.alert(
        'Modèle indisponible',
        'Le club n a pas encore déposé de modèle pour cette pièce.',
      );
      return;
    }
    try {
      await downloadRemoteFile({ fileName: request?.templateFile?.name || undefined, url });
    } catch (error) {
      Alert.alert(
        'Téléchargement impossible',
        error?.message || 'Le modèle n a pas pu être enregistré sur ton téléphone.',
      );
    }
  }, []);

  const uploadDocument = useCallback(async (request) => {
    if (!assignmentId) return;
    try {
      const picked = await MediaPlatform.pickDocument(getDocumentPickerOptions());
      const file = Array.isArray(picked) ? picked[0] : picked;
      if (!file) return;
      documentMutation.mutate({
        documentRequestId: request?.id || request?.documentId,
        file,
      }, {
        onSuccess: () => {
          refreshCurrent();
          Alert.alert('Pièce envoyée', 'Le club pourra maintenant la vérifier.');
        },
      });
    } catch (error) {
      if (isPickerCancelError(error)) return;
      Alert.alert('Envoi impossible', error?.message || 'La pièce n a pas pu être envoyée.');
    }
  }, [assignmentId, documentMutation, refreshCurrent]);

  const payerLink = useMemo(() => {
    if (!current?.securePaymentToken) return null;
    return buildPublicWebUrl({ path: `/licenses/pay/${current.securePaymentToken}` });
  }, [current?.securePaymentToken]);

  const sharePayerLink = useCallback(() => {
    if (!payerLink) {
      Alert.alert(
        'Lien indisponible',
        'Le lien de paiement sera disponible après génération par le club.',
      );
      return;
    }
    SharePlatform.share({
      message: `Paiement cotisation FoundClub: ${payerLink}`,
      url: payerLink,
    })
      .then(() => setPayerSheetVisible(false))
      .catch((error) => {
        Alert.alert(
          'Partage indisponible',
          error?.message || 'Impossible de partager le lien depuis ce navigateur.',
        );
      });
  }, [payerLink]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate(RouteNames.MyLicenses);
  }, [navigation]);

  const isCampaignPaused = current?.campaign?.status === 'paused';
  const paymentModes = normalizePaymentModes(current?.campaign?.paymentModes);
  const onlineMethods = useMemo(() => [
    paymentModes.helloasso ? { label: 'HelloAsso', mode: 'helloasso' } : null,
    paymentModes.external_link ? { label: 'Lien du club', mode: 'external' } : null,
  ].filter(Boolean), [paymentModes.external_link, paymentModes.helloasso]);
  const manualMethods = useMemo(
    () => getEnabledManualPaymentMethods(current?.campaign?.paymentModes),
    [current?.campaign?.paymentModes],
  );

  const confirmCheckout = useCallback((choice, provider) => {
    if (isCampaignPaused) {
      Alert.alert(
        'Campagne en pause',
        'Cette campagne est suspendue. Le paiement reprendra quand le club la rouvrira.',
      );
      return;
    }
    checkoutMutation.mutate({ amountCents: choice?.amountCents, provider }, {
      onError: (error) => Alert.alert(
        'Paiement indisponible',
        error?.message || 'Aucun lien de paiement configuré.',
      ),
      onSuccess: async (result) => {
        setPaySheetVisible(false);
        if (result?.checkoutUrl) {
          await LinksPlatform.openUrl(result.checkoutUrl);
          navigation.navigate(RouteNames.LicenseCheckoutStatus, {
            assignmentId,
            paymentId: result?.payment?.documentId || result?.payment?.id,
            provider,
          });
        }
      },
    });
  }, [assignmentId, checkoutMutation, isCampaignPaused, navigation]);

  const confirmDeclaration = useCallback((choice, method) => {
    declareMutation.mutate({ amountCents: choice?.amountCents, method }, {
      onError: (error) => Alert.alert(
        'Déclaration impossible',
        error?.message || 'Le club n a pas pu être prévenu.',
      ),
      onSuccess: () => {
        setDeclareSheetVisible(false);
        refreshCurrent();
        // ✅ « Une action, un retour » : on dit ce qui a change ET ce qui ne
        // change pas — declarer ne fait pas bouger le solde.
        Alert.alert(
          'Déclaration envoyée',
          'Ton solde ne bouge pas tant que le club n a pas vérifié. Tu peux corriger en attendant.',
        );
      },
    });
  }, [declareMutation, refreshCurrent]);

  if (listQuery.isLoading || assignmentQuery.isLoading) {
    return (
      <ScreenContainer bottomInsetMode="screen" withHeaderPadding>
        <MemberTopBar onBack={goBack} title="Ma cotisation" />
        <LicenseEmptyState description="On récupère ta cotisation." title="Chargement" />
      </ScreenContainer>
    );
  }

  if (!current) {
    return (
      <ScreenContainer bottomInsetMode="screen" withHeaderPadding>
        <MemberTopBar onBack={goBack} title="Ma cotisation" />
        <LicenseEmptyState
          action={(
            <Button
              onPress={() => navigation.navigate(RouteNames.MyLicenses)}
              title="Voir mes cotisations"
              variant="Secondary"
            />
          )}
          description="Cette cotisation n est pas disponible pour ton compte."
          title="Cotisation introuvable"
        />
      </ScreenContainer>
    );
  }

  const currency = currencyOf(current);
  const status = String(current.status || '');
  const dueLabel = formatLicenseMoney(current.amountDueCents, currency);
  const remainingLabel = formatLicenseMoney(current.amountRemainingCents, currency);
  const licenceDate = formatMemberDate(current?.officialLicenseDocument?.uploadedAt);
  const nextInstallment = getNextInstallment(current);
  const installments = current?.installments || [];
  const documentRequests = current?.campaign?.documentRequests || [];
  const officialLicenseDocument = current?.officialLicenseDocument || null;
  const submissionByRequestId = new Map(
    (current?.documentSubmissions || [])
      .map((submission) => [licenseKeyOf(submission?.documentRequest), submission])
      .filter(([key]) => key),
  );
  // Une relance ne se dessine QUE si elle a quelque chose a dire, et jamais
  // pendant qu une declaration attend (regle d existence du pack).
  const reminders = status === 'manual_review' ? [] : (current?.reminders || []);
  // « Encaisse » = le club a vraiment recu l argent. Une declaration en attente
  // n est pas un paiement : elle vit dans l echeancier, en bordure tiretee.
  const payments = (current?.payments || [])
    .filter((payment) => ['confirmed', 'partially_refunded', 'refunded'].includes(payment?.status));
  const receiptCount = payments.filter((payment) => payment?.receipt).length;
  const requiredRequests = documentRequests.filter((item) => item?.required !== false);
  const validatedCount = documentRequests.filter(
    (item) => submissionByRequestId.get(licenseKeyOf(item))?.status === 'validated',
  ).length;
  const piecesPlural = validatedCount > 1 ? 's' : '';
  const isDossierComplete = Boolean(fileUrlOf(officialLicenseDocument))
    && requiredRequests.every(
      (item) => submissionByRequestId.get(licenseKeyOf(item))?.status === 'validated',
    );
  const isOpen = !isCampaignPaused && !isSettledAssignment(current);
  const canPayOnline = onlineMethods.length > 0 && isOpen;
  const canDeclare = manualMethods.length > 0 && isOpen;
  const showActionBar = !isSettledAssignment(current) && (canPayOnline || canDeclare);
  // 📐 S9-ter — LES MESURES DU FLOTTANT, ECRITES UNE SEULE FOIS.
  // Un calque RECOUVRE : le degagement du contenu et la position du bouton
  // doivent venir du MEME calcul, sinon ils divergent au premier reglage.
  const floatingBottom = insets.bottom + 12;
  const floatingClearance = showActionBar ? 52 + floatingBottom + 24 : 32;

  // Le pied de la carte de montant : UNE seule ligne, celle qui compte.
  let cardFooter = null;
  if (status === 'paid') {
    const lastReceipt = payments.find((payment) => payment?.receipt)?.receipt;
    cardFooter = lastReceipt ? (
      <Button
        onPress={() => downloadDocument(
          { file: lastReceipt?.pdfFile },
          `recu-${lastReceipt?.receiptNumber || ''}`,
        )}
        title="Télécharger le reçu"
        variant="Secondary"
      />
    ) : (
      <Text style={[type.rowState, Fonts.neutral300]}>Reçu en attente du club.</Text>
    );
  } else if (status === 'waived') {
    cardFooter = (
      <Text style={[type.rowState, Fonts.neutral300]}>
        {current?.waiveReasonVisibleToMember && current?.waiveReason
          ? current.waiveReason
          : 'Le club prend cette cotisation à sa charge.'}
      </Text>
    );
  } else if (status === 'cancelled') {
    cardFooter = (
      <Text style={[type.rowState, Fonts.neutral300]}>
        {current?.discountReason || 'Cette cotisation a été annulée par le club.'}
      </Text>
    );
  } else {
    const nextDate = formatMemberDate(nextInstallment?.dueDate || current?.dueDate);
    cardFooter = nextDate ? (
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
        <GlyphIcon color={Colors.primary500} name="calendar" size={18} />
        <Text style={[type.keyValue, Fonts.neutral00]}>
          {nextInstallment?.amountRemainingCents
            ? `${formatLicenseMoney(nextInstallment.amountRemainingCents, currency)} le ${nextDate}`
            : `À payer avant le ${nextDate}`}
        </Text>
      </View>
    ) : (
      // 🚫 JAMAIS « Date limite : Non définie ». Une donnee absente n est pas
      // une information : on dit ce que ca change pour le joueur.
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
        <GlyphIcon color={Colors.neutral300} name="hourglass" size={18} />
        <Text style={[type.rowState, Fonts.neutral300]}>
          Le club n a pas encore fixé de date. Tu peux payer dès maintenant.
        </Text>
      </View>
    );
  }

  const menuEntries = [
    assignments.length > 1
      ? {
        glyph: 'euroCircle',
        label: 'Toutes mes cotisations',
        onPress: () => navigation.navigate(RouteNames.MyLicenses),
      }
      : null,
    // S9-ter — L ACTION SECONDAIRE DESCEND ICI.
    // Quand « Payer » est le bouton flottant, « J ai paye hors app » n a plus de
    // place a l ecran : Adel veut UN seul element visible fort. Un lien discret
    // sous le flottant aurait recree le « plusieurs blocs » qu il vient de faire
    // retirer — et il aurait flotte, lui aussi, au-dessus du contenu.
    canDeclare && canPayOnline
      ? {
        glyph: 'landmark',
        label: 'J’ai payé hors app',
        onPress: () => setDeclareSheetVisible(true),
      }
      : null,
    // S9-ter — « QUELQU UN PAIE POUR MOI » : LE BOUTON PART, LA FONCTION RESTE.
    // 🗣️ Adel : « le bouton "Quelqu un paie pour moi", enleve-le ».
    // ⛔ Il a demande de retirer LE BOUTON, pas la fonctionnalite — et il y a de
    // l argent derriere. L entree est donc GENERALISEE : elle n est plus reservee
    // au cas « le club encaisse en ligne », elle apparait des que le lien existe.
    payerLink
      ? {
        glyph: 'creditCard',
        label: 'Quelqu’un paie pour moi',
        onPress: () => setPayerSheetVisible(true),
      }
      : null,
    {
      glyph: 'envelope',
      label: 'Écrire au club',
      onPress: () => navigation.navigate(RouteNames.NewConversation, {}),
    },
    { glyph: 'circleInformation', label: 'Comment ça marche', onPress: () => setHelpVisible(true) },
  ].filter(Boolean);

  return (
    // ⛔ `edge-to-edge` : le calque flottant applique DEJA `insets.bottom`.
    // Laisser `screen` le compterait deux fois et decollerait le bouton du bord.
    <ScreenContainer bottomInsetMode="edge-to-edge" withHeaderPadding>
      <MemberTopBar onBack={goBack} onMenu={() => setMenuVisible(true)} title="Ma cotisation" />
      {/*
        S9-bis / defaut 1 — POURQUOI CE `Alignments.fill` N EST PAS DECORATIF.
        Adel, recette du 25/08 : « la page est figee, le bouton du bas est coupe ».
        `ScreenContainer` range ses enfants dans `Alignments.grow1`, qui vaut
        `flexGrow: 1` SEUL (`theme/alignements.js:110`) — et `flexShrink` vaut 0
        par defaut en Yoga. Aucun frere ne peut donc RETRECIR : le ScrollView
        prenait la hauteur de son contenu, sa zone visible egalait sa zone de
        contenu (⇒ rien a faire defiler) et il poussait la barre d action hors de
        l ecran (⇒ bouton coupe). Un seul defaut, deux symptomes.
        `Alignments.fill` = `flex: 1` = grow 1 + SHRINK 1 + basis 0 : la zone
        defilante prend exactement la place restante entre les deux barres.
        🔒 Temoin : `MyLicenseDetail.S9bis.defilement.test.js`.
      */}
      <ScrollView
        contentContainerStyle={{
          gap: memberSpacing.section,
          paddingBottom: floatingClearance,
        }}
        showsVerticalScrollIndicator={false}
        style={Alignments.fill}
      >
        <AmountCard assignment={current} footer={cardFooter} />

        {isCampaignPaused ? (
          <MemberRow
            glyph="hourglass"
            glyphColor={Colors.warning500}
            state="Les paiements reprendront quand le club rouvrira la campagne."
            title="Campagne temporairement suspendue"
          />
        ) : null}

        {/* ── 2. L ECHEANCIER — 2 echeances ou plus, et statut actif ────────── */}
        {hasInstallmentPlan(current) ? (
          <View style={{ gap: memberSpacing.rowGap }}>
            <MemberOverline
              hint={`${installments.length} échéances · ${dueLabel}`}
              title="Échéancier"
            />
            {installments.map((installment) => {
              const state = getInstallmentState(installment, {
                assignmentStatus: status,
                isNextDue: licenseKeyOf(installment) === licenseKeyOf(nextInstallment),
              });
              const dueDate = formatMemberDate(installment.dueDate, { withYear: false });
              const stateLabels = {
                declared: 'Déclarée · le club vérifie',
                due: 'À payer',
                late: 'En retard',
                paid: 'Payée',
                upcoming: 'À venir',
              };
              const glyphColors = {
                declared: Colors.warning500,
                due: Colors.warning400,
                late: Colors.error500,
                paid: Colors.success500,
                upcoming: Colors.neutral400,
              };
              return (
                <MemberRow
                  amount={formatLicenseMoney(installment.amountDueCents, currency)}
                  // 🔴 Le SEUL fond colore de l ecran : une echeance depassee.
                  background={state === 'late' ? withAlpha(Colors.error500, 0.1) : undefined}
                  borderColor={state === 'late' ? withAlpha(Colors.error500, 0.45) : undefined}
                  dashed={state === 'declared'}
                  emphasis={state === 'due'}
                  glyph={INSTALLMENT_GLYPHS[state]}
                  glyphColor={glyphColors[state]}
                  key={licenseKeyOf(installment) || installmentOrderOf(installment)}
                  muted={state === 'upcoming'}
                  state={stateLabels[state]}
                  title={dueDate
                    ? `${installmentOrderOf(installment)} · ${dueDate}`
                    : `Échéance ${installmentOrderOf(installment)}`}
                />
              );
            })}
            {status === 'partial' && canPayOnline ? (
              <Button
                onPress={() => setPaySheetVisible(true)}
                title={`Tout solder — ${remainingLabel}`}
                variant="Secondary"
              />
            ) : null}
          </View>
        ) : null}

        {/* ── 3. MON DOSSIER — licence et pieces dans le MEME bloc ──────────── */}
        {officialLicenseDocument || documentRequests.length ? (
          <View style={{ gap: memberSpacing.rowGap }}>
            <MemberOverline
              hint={documentRequests.length
                ? `${documentRequests.length} pièce${documentRequests.length > 1 ? 's' : ''}`
                : undefined}
              title="Mon dossier"
            />
            {isDossierComplete ? (
              <MemberRow
                glyph="circleCheck"
                glyphColor={Colors.success500}
                onPress={() => setDossierExpanded((open) => !open)}
                state={[
                  'Licence validée',
                  validatedCount
                    ? `${validatedCount} pièce${piecesPlural} reçue${piecesPlural}`
                    : null,
                ].filter(Boolean).join(' · ')}
                title="Dossier complet"
                trailing={(
                  <GlyphIcon
                    color={Colors.primary500}
                    name={dossierExpanded ? 'chevronLeft' : 'chevronRight'}
                    size={20}
                  />
                )}
              />
            ) : null}
            {isDossierComplete && !dossierExpanded ? null : (
              <>
                {officialLicenseDocument ? (
                  <MemberRow
                    glyph="idCard"
                    glyphColor={fileUrlOf(officialLicenseDocument)
                      ? Colors.success500
                      : Colors.neutral300}
                // 🩹 UN ETAT, PAS UNE ABSENCE. « Ta licence n est pas encore
                // disponible » ne disait pas QUI bloque. ⚠️ L ouverture S8 du
                // pack (etat reel de la demande a la federation) n existe pas
                // cote serveur : on dit donc ce qu on SAIT, sans l inventer.
                    state={fileUrlOf(officialLicenseDocument)
                      ? `Disponible depuis le ${licenceDate || 'dépôt du club'}`
                      : 'Le club ne l a pas encore déposée.'}
                    title={officialLicenseDocument?.request?.name || 'Ma licence'}
                    trailing={fileUrlOf(officialLicenseDocument) ? (
                      <View style={{ flexDirection: 'row', gap: memberSpacing.rowGap }}>
                        <MemberRowAction
                          glyph="idCard"
                          label="Ouvrir ma licence"
                          onPress={() => openUploadedDocument(officialLicenseDocument)}
                        />
                        <MemberRowAction
                          glyph="arrowDownToBracket"
                          label="Télécharger ma licence"
                          onPress={() => downloadDocument(officialLicenseDocument, 'ma-licence')}
                        />
                      </View>
                    ) : null}
                  />
                ) : null}
                {documentRequests.map((request) => {
                  const submission = submissionByRequestId.get(licenseKeyOf(request));
                  const hasFile = Boolean(fileUrlOf(submission));
                  const dueDate = formatMemberDate(request?.dueDate, { withYear: false });
                  // ⛔ UNE PIECE DIT TOUJOURS QUI ATTEND QUOI, ET JUSQU A QUAND.
                  let state = request?.required === false ? 'Facultatif' : 'Obligatoire';
                  if (dueDate) state += ` · à remettre avant le ${dueDate}`;
                  if (submission?.status === 'validated') state = 'Validée par le club';
                  else if (submission) state = 'Envoyée · le club vérifie';
                  return (
                    <View
                      key={licenseKeyOf(request) || request?.name}
                      style={{ gap: memberSpacing.rowGap }}
                    >
                      <MemberRow
                        dashed={Boolean(submission) && submission?.status !== 'validated'}
                        glyph={submission?.status === 'validated' ? 'fileCheck' : 'fileArrowUp'}
                        glyphColor={submission?.status === 'validated'
                          ? Colors.success500
                          : Colors.warning400}
                        state={submission?.refusalReason || state}
                        stateColor={submission?.refusalReason ? Colors.error300 : undefined}
                        title={request?.name || 'Pièce demandée'}
                        trailing={hasFile ? (
                          <View style={{ flexDirection: 'row', gap: memberSpacing.rowGap }}>
                            <MemberRowAction
                              glyph="fileCheck"
                              label="Ouvrir le document"
                              onPress={() => openUploadedDocument(submission)}
                            />
                            <MemberRowAction
                              glyph="arrowDownToBracket"
                              label="Télécharger le document"
                              onPress={() => downloadDocument(
                                submission,
                                request?.name || undefined,
                              )}
                            />
                          </View>
                        ) : null}
                      />
                      <View style={{ flexDirection: 'row', gap: memberSpacing.rowGap }}>
                        {/* « Deposer » est un GESTE, pas une navigation : 36 px,
                        rayon 999, plein cyan. */}
                        <Button
                          isLoading={documentMutation.isPending}
                          onPress={() => uploadDocument(request)}
                          size="sm"
                          style={{ borderRadius: memberRadius.pill, flex: 1 }}
                          title={submission ? 'Remplacer ma pièce' : 'Déposer'}
                        />
                        {request?.templateFile?.url ? (
                          <Button
                            onPress={() => downloadTemplate(request)}
                            size="sm"
                            style={{ borderRadius: memberRadius.pill, flex: 1 }}
                            title="Télécharger le modèle"
                            variant="Secondary"
                          />
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        ) : null}

        {/* ── 4. RELANCES — de vrais messages, pas un compteur ──────────────── */}
        {reminders.length ? (
          <View style={{ gap: memberSpacing.rowGap }}>
            <MemberOverline title="Relances du club" />
            {reminders.map((reminder) => (
              <View
                key={licenseKeyOf(reminder) || reminder?.sentAt}
                style={{
                  backgroundColor: Colors.primary800,
                  borderColor: withAlpha(Colors.neutral00, 0.08),
                  borderRadius: memberRadius.row,
                  borderWidth: 1,
                  gap: memberSpacing.rowGap,
                  padding: memberSpacing.cardPadding,
                }}
              >
                <View style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  justifyContent: 'space-between',
                }}
                >
                  <Text style={[type.rowTitle, Fonts.neutral00]}>Relance du club</Text>
                  {reminder?.amountRequestedCents ? (
                    <Text style={[type.amount, Fonts.neutral00]}>
                      {formatLicenseMoney(reminder.amountRequestedCents, currency)}
                    </Text>
                  ) : null}
                </View>
                <Text style={[type.rowState, Fonts.neutral300]}>
                  {[
                    formatMemberDate(reminder?.sentAt),
                    reminder?.channel === 'email' ? 'e-mail' : 'notification',
                  ].filter(Boolean).join(' · ')}
                </Text>
                {reminder?.message ? (
                  <Text style={[type.subtitle, Fonts.neutral100]}>{reminder.message}</Text>
                ) : null}
                {canPayOnline && reminder?.amountRequestedCents ? (
                  <Button
                    onPress={() => setPaySheetVisible(true)}
                    size="sm"
                    title={`Payer ${formatLicenseMoney(reminder.amountRequestedCents, currency)}`}
                    variant="Secondary"
                  />
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* ── 5. PAIEMENTS — une ligne, un recu (D4) ────────────────────────── */}
        {payments.length ? (
          <View style={{ gap: memberSpacing.rowGap }}>
            <MemberOverline
              hint={`${payments.length} · ${formatLicenseMoney(current.amountPaidCents, currency)}`}
              title="Paiements"
            />
            {payments.map((payment) => {
              const receipt = payment?.receipt || null;
              const canGenerate = !receipt
                && ['confirmed', 'partially_refunded'].includes(payment?.status);
              // ⛔ Le geste se calcule AVANT le rendu : une fonction qui rend du
              // JSX dans une prop serait un composant recree a chaque passage,
              // et React detruirait la ligne au lieu de la mettre a jour.
              let receiptAction = null;
              if (receipt?.pdfFile?.url) {
                receiptAction = (
                  <MemberRowAction
                    glyph="arrowDownToBracket"
                    label="Télécharger le reçu"
                    onPress={() => downloadDocument(
                      { file: receipt.pdfFile },
                      `recu-${receipt.receiptNumber || ''}`,
                    )}
                  />
                );
              } else if (canGenerate) {
                // ⛔ « Generer » n est PAS « telecharger » : ce geste fabrique le
                // document, il ne le pose pas dans le telephone. Il garde donc le
                // glyphe DOCUMENT du pack (`fc-fileAlt`), pas sa fleche de
                // telechargement (`fc-download`). Deux gestes, deux glyphes.
                receiptAction = (
                  <MemberRowAction
                    glyph="receiptAlt"
                    label="Générer mon reçu"
                    onPress={() => receiptMutation.mutate(licenseKeyOf(payment), {
                      onSuccess: () => {
                        refreshCurrent();
                        Alert.alert(
                          'Reçu généré',
                          'Ton reçu est maintenant disponible sur ce paiement.',
                        );
                      },
                    })}
                  />
                );
              }
              return (
                <MemberRow
                  amount={formatLicenseMoney(payment.amountCents, payment.currency || currency)}
                  glyph={glyphForPaymentMethod(payment.method)}
                  glyphColor={Colors.success500}
                  key={licenseKeyOf(payment)}
                  // ⛔ UNE LIGNE SANS RECU NE MONTRE PAS DE BOUTON MORT : elle
                  // dit pourquoi il n y en a pas.
                  state={[
                    formatMemberDate(paymentDate(payment), { withYear: false }),
                    paymentModeLabels[payment.method] || payment.method,
                    receipt?.receiptNumber ? `reçu ${receipt.receiptNumber}` : null,
                    !receipt && !canGenerate ? 'reçu en attente du club' : null,
                  ].filter(Boolean).join(' · ')}
                  title={formatMemberDate(paymentDate(payment)) || 'Paiement'}
                  trailing={receiptAction}
                />
              );
            })}
            {receiptCount > 1 ? (
              <Text style={[type.meta, Fonts.neutral400]}>
                {`${receiptCount} reçus disponibles sur cette cotisation.`}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* ── 6. LA CAMPAGNE — les informations froides, tout en bas ────────── */}
        <View style={{ gap: memberSpacing.rowGap }}>
          <MemberOverline title="La campagne" />
          <MemberKeyValueTable
            rows={[
              { label: 'Campagne', value: current?.campaign?.name },
              { label: 'Club', value: clubNameOf(current) },
              { label: 'Section', value: current?.team?.name || current?.categoryLabel },
              { label: 'Montant', value: formatLicenseMoney(current.amountDueCents, currency) },
              // ⛔ LA LIGNE DISPARAIT QUAND IL N Y A PAS DE DATE : un tiret est
              // la meme non-information que « Non definie ».
              {
                label: 'Date limite',
                value: formatMemberDate(current?.dueDate || current?.campaign?.dueDate),
              },
            ]}
          />
        </View>

        {/* ── 7. LE CONTACT DU CLUB — toujours ──────────────────────────────── */}
        <View style={{ gap: memberSpacing.rowGap }}>
          <MemberOverline title="Une question ?" />
          <MemberRow
            glyph="envelope"
            glyphColor={Colors.primary500}
            // 🕳️ OUVERTURE S6 : le serveur ne designe aucun referent par club.
            // Le repli v1 decide le 25/08 est la conversation existante.
            state="Un délai, une aide, une erreur de montant : ça se règle en parlant."
            title="Écrire au club"
            trailing={(
              <MemberRowAction
                glyph="envelope"
                label="Écrire au club"
                onPress={() => navigation.navigate(RouteNames.NewConversation, {})}
              />
            )}
          />
        </View>
      </ScrollView>

      {/*
        S9-ter — UN SEUL BEAU BOUTON, ET IL FLOTTE.
        🗣️ Adel, recette du 25/08 : la barre du bas faisait « trop de blocs
        separes ». Sur un ecran qui empile deja carte de montant, echeancier,
        dossier et paiements, un 5e bandeau a fond plein tranchait.
        ⇒ Plus de bandeau : UN bouton, en calque au-dessus du contenu defilant.
        L action secondaire et le tiers payeur descendent au menu ⋯ — la
        fonctionnalite survit, le bouton s en va (c est ce qu Adel a demande).

        🧱 POURQUOI `WebFloatingOverlay` ET PAS UN SIMPLE `View` : c est la brique
        maison qui rend un calque identique sur le telephone et sur le site
        (`WebFloatingOverlay.web.js` l ancre au viewport).
        ⛔ POURQUOI PAS `getFloatingActionContainerStyle` : ce helper est taille
        pour un BOUTON ROND ancre a droite, et il degage la hauteur du DOCK —
        que cet ecran n a pas (il vit hors des onglets, cf. PrivateNavigator).
        Ici le bouton fait toute la largeur et n a aucun dock a franchir.
      */}
      {showActionBar ? (
        <WebFloatingOverlay
          style={{
            bottom: floatingBottom,
            left: 16,
            position: 'absolute',
            right: 16,
            zIndex: 1000,
          }}
        >
          {canPayOnline ? (
            <Button
              isLoading={checkoutMutation.isPending}
              onPress={() => setPaySheetVisible(true)}
              style={ApplicationStyle.shadow200}
              title={`Payer ${remainingLabel}`}
            />
          ) : (
            <Button
              onPress={() => setDeclareSheetVisible(true)}
              style={ApplicationStyle.shadow200}
              title="J'ai payé hors app"
            />
          )}
        </WebFloatingOverlay>
      ) : null}

      {menuVisible ? (
        <BottomModal
          close={() => setMenuVisible(false)}
          isVisible
          scrollable={false}
          snapPoints={['42%']}
          webPresentation="dialog"
        >
          <View style={{ gap: memberSpacing.rowGap }}>
            {menuEntries.map((entry) => (
              <Pressable
                accessibilityRole="button"
                key={entry.label}
                onPress={() => { setMenuVisible(false); entry.onPress(); }}
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  gap: 12,
                  minHeight: memberSpacing.target,
                  paddingHorizontal: 4,
                }}
              >
                <GlyphIcon color={Colors.primary500} name={entry.glyph} size={20} />
                <Text style={[type.rowTitle, Fonts.neutral00]}>{entry.label}</Text>
              </Pressable>
            ))}
          </View>
        </BottomModal>
      ) : null}

      {helpVisible ? (
        <BottomModal
          close={() => setHelpVisible(false)}
          isVisible
          snapPoints={['52%']}
          webPresentation="dialog"
        >
          <View style={{ gap: memberSpacing.rowGap }}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Comment ça marche</Text>
            <Text style={[type.subtitle, Fonts.neutral200]}>
              Ta cotisation est fixée par ton club. Si elle se paie en plusieurs fois,
              chaque échéance a sa date : tu règles celle qui arrive, ou tu soldes tout.
            </Text>
            <Text style={[type.subtitle, Fonts.neutral200]}>
              Si tu as payé en espèces, par chèque ou par virement, dis-le avec
              « J ai payé hors app ». Ton solde ne bougera qu une fois le club passé.
            </Text>
            <Text style={[type.subtitle, Fonts.neutral200]}>
              Chaque paiement encaissé porte son reçu. Les saisons terminées restent
              consultables : un reçu se retrouve indéfiniment.
            </Text>
          </View>
        </BottomModal>
      ) : null}

      {paySheetVisible ? (
        <PayLicenseSheet
          assignment={current}
          isLoading={checkoutMutation.isPending}
          onClose={() => setPaySheetVisible(false)}
          onConfirm={confirmCheckout}
          onlineMethods={onlineMethods}
        />
      ) : null}

      {declareSheetVisible ? (
        <DeclareLicensePaymentSheet
          assignment={current}
          isLoading={declareMutation.isPending}
          methods={manualMethods}
          onClose={() => setDeclareSheetVisible(false)}
          onConfirm={confirmDeclaration}
        />
      ) : null}

      {payerSheetVisible ? (
        <PayerLinkSheet
          amountCents={current.amountRemainingCents}
          assignment={current}
          onClose={() => setPayerSheetVisible(false)}
          onShare={sharePayerLink}
        />
      ) : null}
    </ScreenContainer>
  );
}

export default MyLicenseDetail;
