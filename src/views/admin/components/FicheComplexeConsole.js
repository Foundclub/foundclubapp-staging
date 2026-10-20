import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  gestesPossibles,
  heureCourte,
  jourCourt,
  lignesDuJournal,
  motifValide,
  nomCourt,
} from '@/domains/complexe/consoleDesComplexes';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';
import LogoComplexe from '@/views/complexe/components/LogoComplexe';

import { RouteNames } from '@/navigation/routeNames';

import { useComplexeDeLaConsole, useGesteDeLaConsole } from '@/services/complexe/complexeQueries';

import { COMPLEXES_JOUEUR } from '@/config/fonctionsMasquees';

/** Le compte d'un gérant dans l'explorateur du SuperAdmin (suspension de compte, Q1). */
const UID_DES_COMPTES = 'plugin::users-permissions.user';

/**
 * E-S01 — LA FICHE D'UN COMPLEXE DANS LA CONSOLE — RESA-L5B-2 (20/10/2026), planche ES01 (états
 * 1, 3, 4, 5), plan :1806-1850, serveur RESA-L4 (`GET /superadmin/complexes/:id` et ses gestes).
 * Dans l'ordre : l'identité (logo, nom, « Ville · créé le 13/10 · actif, non vérifié »), le
 * gérant (nom court, « voir le compte » : la suspension de COMPTE reste l'outil existant, Q1), les
 * terrains et réservations, « Voir la page » (E-P02), les SIGNALEMENTS (motif, auteur, date, « À
 * traiter » / « Traité », « Signalement traité »), le JOURNAL, puis les gestes : « Marquer
 * vérifié », « Suspendre » (motif ; réservations à venir gardées) ou « Réactiver », « Retirer »
 * (rouge, définitif : réservations à venir annulées, joueurs prévenus). Les deux gestes à motif se
 * confirment DANS la fiche (pas de fenêtre : sur le site, une <Modal> peint un fond blanc).
 * Partagée par la fiche du téléphone (AdminComplexeDetail) et le volet droit de l'ordinateur.
 * @param {object} props - Les propriétés.
 * @param {string} props.complexeId - documentId du complexe.
 * @returns {import('react').ReactElement} La fiche.
 */
function FicheComplexeConsole({ complexeId }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const lecture = useComplexeDeLaConsole(complexeId);
  const geste = useGesteDeLaConsole();
  const [confirmer, setConfirmer] = useState(/** @type {'retirer' | 'suspendre' | null} */ (null));
  const [motif, setMotif] = useState('');
  const [message, setMessage] = useState(
    /** @type {{ texte: string, ton: 'erreur' | 'interdit' | 'ok' } | null} */ (null),
  );

  const carte = {
    backgroundColor: withAlpha(Colors.primary700, 0.45),
    borderColor: withAlpha(Colors.primary500, 0.5),
    borderRadius: 16,
    borderWidth: 1,
  };
  const titreSection = (/** @type {string} */ texte) => (
    <Text
      accessibilityRole="header"
      style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}
    >
      {texte.toUpperCase()}
    </Text>
  );

  if (lecture.isLoading) {
    return (
      <View
        accessibilityState={{ busy: true }}
        style={{ gap: 12 }}
        testID="console-fiche-chargement"
      >
        {[72, 120, 96].map((hauteur) => (
          <View
            key={hauteur}
            style={[
              ApplicationStyle.borderRadius16,
              { backgroundColor: withAlpha(Colors.neutral00, 0.06), height: hauteur },
            ]}
          />
        ))}
      </View>
    );
  }
  const fiche = lecture.data;
  if (!fiche?.complexe) {
    return (
      <BandeauComplexe
        action={t('complexeConsole.reessayer', 'Réessayer')}
        onAction={() => lecture.refetch?.()}
        testID="console-fiche-erreur"
        texte={t('complexeConsole.fiche.erreur', 'Impossible de charger ce complexe.')}
        ton="erreur"
      />
    );
  }

  const { complexe } = fiche;
  const nom = String(complexe.name || '');
  const gestes = gestesPossibles(complexe);
  const aVenir = Number(fiche.reservations?.aVenir) || 0;
  let etat = t('complexeConsole.etats.actif', 'actif, non vérifié');
  if (complexe.status === 'suspendu') etat = t('complexeConsole.etats.suspendu', 'suspendu');
  else if (complexe.status === 'retire') etat = t('complexeConsole.etats.retire', 'retiré');
  else if (complexe.verified) etat = t('complexeConsole.etats.actifVerifie', 'actif, vérifié');
  const identite = [
    complexe.city,
    t('complexeConsole.creeLe', 'créé le {{date}}', {
      date: jourCourt(complexe.createdAt), ...SANS_ECHAPPEMENT,
    }),
    etat,
  ].filter(Boolean).join(' · ');

  /**
   * Un geste, puis le bandeau qui dit ce qui a changé (ou le refus).
   * @param {Record<string, any>} demande - `geste`, `motif`, `signalementId`, `verified`.
   * @param {string} texte - Ce que dit le bandeau en cas de succès.
   * @param {'interdit' | 'ok'} [ton] - Le ton du bandeau.
   */
  const faire = async (demande, texte, ton = 'ok') => {
    setMessage(null);
    try {
      await geste.mutateAsync({ complexeId, ...demande });
      setConfirmer(null);
      setMotif('');
      setMessage({ texte, ton });
    } catch {
      setMessage({
        texte: t('complexeConsole.gestes.echec', 'Le geste n’a pas abouti. Réessaie.'),
        ton: 'erreur',
      });
    }
  };
  const avecLeNom = { nom, ...SANS_ECHAPPEMENT };

  const signalements = Array.isArray(fiche.signalements) ? fiche.signalements : [];
  const blocSignalements = (
    <View style={[carte, Spaces.padding[16], { gap: 12 }]} testID="console-signalements">
      {titreSection(t('complexeConsole.fiche.signalements', 'Signalements'))}
      {signalements.length ? signalements.map((/** @type {any} */ signalement) => {
        const ouvert = signalement.status !== 'traite';
        return (
          <View
            key={signalement.documentId}
            style={{ gap: 4 }}
            testID={`console-signalement-${signalement.documentId}`}
          >
            <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
                {String(signalement.motifLabel || signalement.motif || '')}
              </Text>
              <Text style={[Fonts.p3Bold, ouvert ? Fonts.warning500 : Fonts.success500]}>
                {ouvert
                  ? t('complexeConsole.fiche.signalementATraiter', 'À traiter')
                  : t('complexeConsole.fiche.signalementTraite', 'Traité')}
              </Text>
            </View>
            {signalement.details ? (
              <Text style={[Fonts.p2, Fonts.neutral100]}>{String(signalement.details)}</Text>
            ) : null}
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t('complexeConsole.fiche.parAuteur', 'Par {{nom}} · {{jour}} à {{heure}}', {
                heure: heureCourte(signalement.createdAt),
                jour: jourCourt(signalement.createdAt),
                nom: nomCourt(signalement.auteur) || String(signalement.auteurNom || ''),
                ...SANS_ECHAPPEMENT,
              })}
            </Text>
            {ouvert && gestes.verifier ? (
              <View
                style={{ alignSelf: 'flex-start' }}
                testID={`console-traiter-${signalement.documentId}`}
              >
                <Button
                  disabled={geste.isPending}
                  onPress={() => faire(
                    { geste: 'traiter', signalementId: signalement.documentId },
                    t('complexeConsole.gestes.traite', 'Signalement traité.'),
                  )}
                  size="sm"
                  title={t('complexeConsole.gestes.signalementTraite', 'Signalement traité')}
                  variant="Secondary"
                />
              </View>
            ) : null}
          </View>
        );
      }) : (
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t('complexeConsole.fiche.aucunSignalement', 'Aucun signalement.')}
        </Text>
      )}
    </View>
  );

  const blocJournal = (
    <View style={[carte, Spaces.padding[16], { gap: 8 }]} testID="console-journal">
      {titreSection(t('complexeConsole.fiche.journal', 'Journal'))}
      {lignesDuJournal(fiche).map((ligne) => (
        <Text key={`${ligne.cle}-${String(ligne.quand)}`} style={[Fonts.p2, Fonts.neutral100]}>
          {[
            t(`complexeConsole.fiche.journalLignes.${ligne.cle}`, {
              date: jourCourt(ligne.quand), ...SANS_ECHAPPEMENT,
            }),
            ligne.motif ? `« ${ligne.motif} »` : '',
          ].filter(Boolean).join(' · ')}
        </Text>
      ))}
    </View>
  );

  let dit = t(
    'complexeConsole.gestes.suspendreDit',
    'Il n’apparaîtra plus dans l’app ni sur le site. Ses réservations à venir sont gardées.',
  );
  if (confirmer === 'retirer') {
    dit = aVenir
      ? t('complexeConsole.gestes.retirerDit', {
        count: aVenir,
        defaultValue_one: 'Sa réservation à venir sera annulée et le joueur prévenu.',
        // eslint-disable-next-line max-len
        defaultValue_other: 'Ses {{count}} réservations à venir seront annulées et les joueurs prévenus.',
      })
      : t('complexeConsole.gestes.retirerAucune', 'Aucune réservation à venir à annuler.');
  }
  const confirmation = confirmer ? (
    <View
      style={[carte, Spaces.padding[16], {
        borderColor: withAlpha(confirmer === 'retirer' ? Colors.error500 : Colors.warning500, 0.6),
        gap: 10,
      }]}
      testID="console-confirmer"
    >
      <Text accessibilityRole="header" style={[Fonts.p1Bold, Fonts.neutral00]}>
        {confirmer === 'retirer'
          ? t('complexeConsole.gestes.retirerTitre', 'Retirer définitivement ?')
          : t('complexeConsole.gestes.suspendreTitre', 'Suspendre {{nom}} ?', avecLeNom)}
      </Text>
      <Text style={[Fonts.p2, Fonts.neutral100]}>{dit}</Text>
      <Input
        accessibilityLabel={t('complexeConsole.gestes.motif', 'Motif')}
        label={t('complexeConsole.gestes.motif', 'Motif')}
        maxLength={300}
        multiline
        onChangeText={(valeur) => setMotif(String(valeur))}
        value={motif}
      />
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {t('complexeConsole.gestes.motifDit', '3 caractères au moins : il est envoyé au gérant.')}
      </Text>
      <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
        <Button
          onPress={() => {
            setConfirmer(null);
            setMotif('');
          }}
          size="sm"
          title={t('complexeConsole.gestes.annuler', 'Annuler')}
          variant="Ghost"
        />
        <View testID="console-confirmer-geste">
          <Button
            disabled={!motifValide(motif) || geste.isPending}
            isLoading={geste.isPending}
            onPress={() => (confirmer === 'retirer'
              ? faire(
                { geste: 'retirer', motif: motif.trim() },
                t('complexeConsole.gestes.retire', '{{nom}} est retiré de FoundClub.', avecLeNom),
                'interdit',
              )
              : faire(
                { geste: 'suspendre', motif: motif.trim() },
                t(
                  'complexeConsole.gestes.suspendu',
                  '{{nom}} est suspendu : il n’apparaît plus.',
                  avecLeNom,
                ),
              ))}
            size="sm"
            title={confirmer === 'retirer'
              ? t('complexeConsole.gestes.retirer', 'Retirer')
              : t('complexeConsole.gestes.suspendre', 'Suspendre')}
            variant={confirmer === 'retirer' ? 'DangerFilled' : 'Secondary'}
          />
        </View>
      </View>
    </View>
  ) : null;

  const pied = (
    <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]} testID="console-gestes">
      {gestes.verifier ? (
        <Button
          disabled={geste.isPending}
          onPress={() => faire(
            { geste: 'verifier', verified: !complexe.verified },
            complexe.verified
              ? t('complexeConsole.gestes.nonVerifie', '« Vérifié » est retiré.')
              : t('complexeConsole.gestes.verifie', '{{nom}} est marqué vérifié.', avecLeNom),
          )}
          size="sm"
          title={complexe.verified
            ? t('complexeConsole.gestes.retirerVerifie', 'Retirer « Vérifié »')
            : t('complexeConsole.gestes.marquerVerifie', 'Marquer vérifié')}
          variant="Secondary"
        />
      ) : null}
      {gestes.suspendre ? (
        <Button
          disabled={geste.isPending}
          onPress={() => setConfirmer('suspendre')}
          size="sm"
          title={t('complexeConsole.gestes.suspendre', 'Suspendre')}
          variant="Secondary"
        />
      ) : null}
      {gestes.reactiver ? (
        <Button
          disabled={geste.isPending}
          onPress={() => faire(
            { geste: 'reactiver' },
            t('complexeConsole.gestes.reactive', '{{nom}} est visible à nouveau.', avecLeNom),
          )}
          size="sm"
          title={t('complexeConsole.gestes.reactiver', 'Réactiver')}
          variant="Primary"
        />
      ) : null}
      {gestes.retirer ? (
        <Button
          disabled={geste.isPending}
          onPress={() => setConfirmer('retirer')}
          size="sm"
          title={t('complexeConsole.gestes.retirer', 'Retirer')}
          variant="Danger"
        />
      ) : null}
    </View>
  );

  const gerants = Array.isArray(fiche.gerants) ? fiche.gerants : [];
  return (
    <View style={{ gap: 12 }} testID="console-fiche">
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
        <LogoComplexe logo={complexe.logo || null} nom={nom} taille={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text accessibilityRole="header" style={[Fonts.h3Bold, Fonts.neutral00]}>{nom}</Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>{identite}</Text>
        </View>
      </View>
      {message ? (
        <BandeauComplexe testID="console-message" texte={message.texte} ton={message.ton} />
      ) : null}
      <View style={[carte, Spaces.padding[16], { gap: 8 }]}>
        {titreSection(t('complexeConsole.fiche.gerant', 'Gérant'))}
        {gerants.map((/** @type {any} */ gerant) => (
          <View
            key={gerant.documentId || nomCourt(gerant)}
            style={[Alignments.row, Alignments.alignCenter, Alignments.wrap, { gap: 6 }]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{nomCourt(gerant)}</Text>
            {gerant.bloque ? (
              <Text style={[Fonts.p3Bold, Fonts.error500]}>
                {t('complexeConsole.fiche.compteBloque', 'compte suspendu')}
              </Text>
            ) : null}
            {gerant.documentId ? (
              <TouchableOpacity
                accessibilityRole="link"
                onPress={() => navigation.navigate(RouteNames.SuperAdminEntryDetail, {
                  documentId: gerant.documentId,
                  uid: UID_DES_COMPTES,
                  uidDisplayName: t('adminStack.titles.users', 'Utilisateurs'),
                })}
                style={[Alignments.justifyCenter, { minHeight: 44 }]}
              >
                <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                  {t('complexeConsole.fiche.voirLeCompte', 'voir le compte')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {[
            t('complexeConsole.fiche.terrains', {
              count: Array.isArray(fiche.terrains) ? fiche.terrains.length : 0,
              defaultValue_one: '{{count}} terrain',
              defaultValue_other: '{{count}} terrains',
            }),
            t('complexeConsole.fiche.reservations', {
              count: Number(fiche.reservations?.total) || 0,
              defaultValue_one: '{{count}} réservation',
              defaultValue_other: '{{count}} réservations',
            }),
            t('complexeConsole.fiche.aVenir', { count: aVenir, defaultValue: '{{count}} à venir' }),
          ].join(' · ')}
        </Text>
        {COMPLEXES_JOUEUR && complexe.status === 'actif' && complexe.slug ? (
          <TouchableOpacity
            accessibilityRole="link"
            onPress={() => navigation.navigate(
              RouteNames.ReserverComplexe,
              { slug: complexe.slug },
            )}
            style={[Alignments.justifyCenter, { alignSelf: 'flex-start', minHeight: 44 }]}
          >
            <Text style={[Fonts.p2Bold, Fonts.primary500]}>
              {t('complexeConsole.fiche.voirLaPage', 'Voir la page')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {blocSignalements}
      {blocJournal}
      {confirmation || pied}
    </View>
  );
}

export default FicheComplexeConsole;
