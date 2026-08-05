export default {
  addCoach: {
    actions: {
      invite: 'Inviter',
      save: 'Ajouter',
    },
    alerts: {
      alreadyExist: {
        actions: {
          addToClub: 'Ajouter au club',
          cancel: 'Annuler',
        },
        description: "Le détenteur de ce numéro de téléphone utilise l'application sous le nom de {{firstname}} {{lastname}}. Veux-tu l'ajouter à ton club ?",
        title: 'Un utilisateur existe déjà avec ce numéro de téléphone.',
      },
      alreadyInClub: {
        description: "Un utilisateur du nom de {{firstname}} {{lastname}} est déjà membre d'un autre club.",
        title: "Impossible d'ajouter cet·te entraîneur·e à l'équipe",
      },
      success: {
        description: "L'entraîneur·e {{trainerName}} a bien été ajouté·e à ton club.",
        title: 'Ajout réussi !',
      },
    },
    fields: {
      birthdate: {
        label: 'Date de naissance',
        placeholder: 'JJ/MM/AAAA',
      },
      firstname: {
        label: 'Prénom',
        placeholder: 'Luc',
      },
      lastname: {
        label: 'Nom',
        placeholder: 'Harne',
      },
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '+33612345678',
      },
    },
    subtitles: {
      avatar: "Ajoute une photo de profil pour que l'on puisse reconnaître l'entraîneur·e facilement.",
      birthdate: "Renseigne la date de naissance de l'entraîneur·e.",
      name: "Renseigne le nom et prénom de l'entraîneur·e.",
    },
    titles: {
      birthdate: 'Quelle est sa date de naissance ?',
      main: 'Ajouter un·e entraîneur·e',
      name: "Comment s'appelle l'entraîneur·e ?",
    },
  },
  addSponsor: {
    actions: {
      save: 'Ajouter',
    },
    fields: {
      link: {
        label: 'Lien vers le site du partenaire',
        placeholder: 'https://www.nike.com',
      },
      logo: 'Logo du partenaire',
      title: {
        label: 'Nom du partenaire',
        placeholder: 'Nike',
      },
    },
    title: 'Ajouter un partenaire',
  },
  APIerrors: {
    // Authentication errors
    AUTHENTICATION_FAILED: "Échec d'authentification.",
    INVALID_TOKEN: "Jeton d'authentification invalide.",
    MISSING_TOKEN: "Jeton d'authentification manquant.",
    OTP_ERROR: 'Une erreur est survenue lors de la connexion OTP',

    // Authorization errors
    FORBIDDEN: 'Accès refusé.',
    // Repli quand un écran n'héberge pas encore la feuille de vente : le refus est bien un
    // refus d'abonnement, pas un refus de droits — les deux ne se disent pas pareil.
    SUBSCRIPTION_PERMISSION_DENIED: "Cette action nécessite une offre FoundClub active. Rends-toi dans Mon abonnement pour l'activer.",
    UNAUTHORIZED: "Tu n'es pas autorisé·e à effectuer cette action.",

    // Validation errors
    INVALID_FIELD_FORMAT: 'Format de champ invalide.',
    MISSING_REQUIRED_FIELD: 'Un champ obligatoire est manquant.',
    VALIDATION_ERROR: 'Erreur de validation.',

    // User errors
    EMAIL_TAKEN: 'Cette adresse email est déjà utilisée.',
    PHONE_NUMBER_TAKEN: 'Ce numéro de téléphone est déjà utilisé.',
    USER_ALREADY_EXISTS: 'Cet utilisateur existe déjà.',
    USER_NOT_FOUND: 'Utilisateur introuvable.',
    USERNAME_TAKEN: "Ce nom d'utilisateur est déjà utilisé.",

    // Club errors
    CLUB_DELETE_ERROR: 'Erreur lors de la suppression du club.',
    CLUB_IMPORT_ERROR: "Erreur lors de l'import des données du club.",
    CLUB_NOT_FOUND: 'Club introuvable.',
    CLUB_SPONSOR_ERROR: 'Erreur concernant le partenaire du club.',
    CLUB_UPDATE_ERROR: 'Erreur lors de la mise à jour du club.',
    USER_NOT_IN_CLUB: "L'utilisateur n'est pas membre du club.",

    // Membership request errors
    MEMBERSHIP_REQUEST_ALREADY_PROCESSED: "La demande d'adhésion a déjà été traitée.",
    MEMBERSHIP_REQUEST_NOT_PENDING: "La demande d'adhésion n'est pas en attente.",
    MEMBERSHIP_REQUEST_REFUSED: "La demande d'adhésion a été refusée.",

    // Sport errors
    SPORT_DELETE_ERROR: 'Erreur lors de la suppression du sport.',

    // Trainer errors
    NOT_A_TRAINER: "L'utilisateur n'est pas un·e entraîneur·e.",
    TRAINER_ALREADY_IN_CLUB: "L'entraîneur·e est déjà membre d'un club.",
    TRAINER_HAS_TEAMS: "L'entraîneur·e est associé·e à des équipes.",
    TRAINER_IS_UNIQUE_TEAM_TRAINER: "L'entraîneur·e est le/la seul·e entraîneur·e de l'équipe.",
    TRAINER_NOT_FOUND: 'Entraîneur·e introuvable.',
    TRAINER_NOT_IN_CLUB: "L'entraîneur·e n'est pas membre du club.",

    // Team errors
    CLUB_MAX_TEAM_NUMBER_REACHED: 'Le nombre maximum d\'équipes pour ce club a été atteint.',
    TEAM_CLUB_REQUIRED: 'Un club est requis pour chaque équipe.',
    TEAM_MEMBER_POLICY_ERROR: 'Pour effectuer cette action, tu dois être membre de l\'équipe.',
    TEAM_PLAYER_REMOVE_ERROR: 'Erreur lors de la suppression du/de la joueur·se de l\'équipe.',
    TEAM_TRAINER_CONNECT_REQUIRED: 'La connexion avec l\'entraîneur·e est requise.',
    TEAM_TRAINER_REMOVE_ERROR: 'Erreur lors de la suppression de l\'entraîneur·e de l\'équipe.',
    TEAM_TRAINER_REQUIRED: 'Au moins un·e entraîneur·e est requis·e pour chaque équipe.',
    TEAM_TRAINER_SET_REQUIRED: 'Une équipe d\'entraîneur·e·s est requise.',

    // Department errors
    DEPARTMENT_IMPORT_ERROR: 'Erreur lors de l\'import des données du département.',
    DEPARTMENT_REQUIRED: 'Le département est requis.',

    // Event errors
    EVENT_ALREADY_MISSING: 'Tu as déjà répondu absent à cet événement.',
    EVENT_CANCEL_ERROR: "Erreur lors de l'annulation de l'événement.",
    EVENT_CAPACITY_ERROR: "La capacité maximale de l'événement est atteinte.",
    EVENT_CREATE_ERROR: "Erreur lors de la création de l'événement.",
    EVENT_DATE_ERROR: "La date de l'événement est invalide.",
    EVENT_DATE_PAST: "La date ou l'heure de l'événement est déjà passée.",
    EVENT_FIND_ERROR: "Erreur lors de la recherche de l'événement.",
    EVENT_INVALID_TIME_RANGE: "L'heure de fin doit être après l'heure de début.",
    EVENT_IS_NOT_ACTIVE_ERROR: "L'événement n'est pas actif.",
    EVENT_LOCATION_REQUIRED: 'Un lieu est requis pour créer un événement.',
    EVENT_MISSING_ERROR: "Erreur lors de la réponse à l'événement.",
    EVENT_PARTICIPATION_ACCEPT_ERROR: "Erreur lors de l'acceptation de la participation.",
    EVENT_PARTICIPATION_ALREADY_TREATED: 'La demande de participation a déjà été traitée.',
    EVENT_PARTICIPATION_CREATE_ERROR: 'Erreur lors de la création de la participation.',
    EVENT_PARTICIPATION_REFUSE_ERROR: 'Erreur lors du refus de la participation.',
    EVENT_SLOT_CONFLICT: 'Un conflit de créneau a été détecté pour ce lieu.',
    EVENT_UPDATE_ERROR: "Erreur lors de la mise à jour de l'événement.",
    EVENT_USER_ALREADY_IN_EVENT_ERROR: "L'utilisateur est déjà inscrit à cet événement.",
    EVENT_USER_NOT_PLAYER_OF_TEAM_ERROR: "L'utilisateur n'est pas joueur de l'équipe.",

    // Event participation request errors
    EVENT_PARTICIPATION_ALREADY_HAS_A_REQUEST_POLICY_ERROR: 'Une demande de participation existe déjà pour cet événement.',
    EVENT_PARTICIPATION_DELETE_ERROR: 'Erreur lors de la suppression de la participation à l\'événement.',
    EVENT_PARTICIPATION_REQUEST_ALREADY_EXISTS: 'Une demande de participation existe déjà.',
    EVENT_PARTICIPATION_REQUEST_NOT_FOUND: 'Demande de participation introuvable.',
    EVENT_PARTICIPATION_REQUEST_POLICY_ERROR: 'Violation de la politique concernant les demandes de participation.',
    EVENT_PLAYER_POLICY_ERROR: 'Violation de la politique concernant les joueur·se·s.',

    // Chat errors
    CHAT_ID_NOT_PROVIDED: 'ID de chat non fourni.',
    FAILED_TO_ACCESS_CHAT: 'Impossible d\'accéder au chat.',
    FAILED_TO_JOIN_CHAT: 'Impossible de rejoindre le chat.',
    FAILED_TO_SEND_MESSAGE: 'Impossible d\'envoyer le message.',
    MESSAGE_TOO_LONG: 'Le message est trop long.',
    RATE_LIMIT_EXCEEDED: 'Limite de taux dépassée.',
    USER_NOT_PARTICIPANT_OF_CHAT: 'L\'utilisateur·rice n\'est pas participant·e du chat.',

    // Server errors
    DATABASE_ERROR: 'Erreur de base de données.',
    INTERNAL_SERVER_ERROR: 'Erreur interne du serveur.',

    // File upload errors
    FILE_TOO_LARGE: 'Fichier trop volumineux.',
    FILE_UPLOAD_ERROR: 'Erreur lors du téléchargement du fichier.',
    INVALID_FILE_TYPE: 'Type de fichier invalide.',

    // Policy errors
    CHAT_MESSAGE_NOT_FOUND_POLICY_ERROR: 'CHAT_MESSAGE_NOT_FOUND_POLICY_ERROR',
    CHAT_MESSAGE_REPORT_NOT_FOUND_POLICY_ERROR: 'CHAT_MESSAGE_REPORT_NOT_FOUND_POLICY_ERROR',
    CHAT_NOT_FOUND_POLICY_ERROR: 'CHAT_NOT_FOUND_POLICY_ERROR',
    CLUB_MANAGER_CREATE_POLICY_ERROR: 'CLUB_MANAGER_CREATE_POLICY_ERROR',
    CLUB_MANAGER_POLICY_ERROR: 'Violation de la politique concernant les dirigeant·e·s du club.',
    CLUB_MEMBER_POLICY_ERROR: 'Violation de la politique concernant les membres du club.',
    CLUB_STAFF_CREATE_POLICY_ERROR: 'Violation de la politique de création de personnel du club.',
    CLUB_STAFF_POLICY_ERROR: 'Violation de la politique concernant le personnel du club.',
    error: 'Erreur',
    EVENT_TRAINER_CREATE_POLICY_ERROR: "Violation de la politique de création d'événements par les entraîneur·e·s.",
    EVENT_TRAINER_POLICY_ERROR: 'Violation de la politique concernant les entraîneur·e·s et les événements.',
    generic: 'Une erreur est survenue. Merci de réessayer plus tard.',
    HAD_PENDING_MEMBERSHIP_REQUEST_POLICY_ERROR: "Tu as déjà une demande d'adhésion en attente.",
    MANAGER_TRAINER_CLUB_POLICY_ERROR: 'Violation de la politique concernant les entraîneur·e·s et dirigeant·e·s du club.',
    MANAGER_WITH_CLUB_POLICY_ERROR: 'Violation de la politique concernant les dirigeant·e·s avec club.',
    phoneNumberAlreadyUsed: 'Ce numéro est déjà utilisé par {{firstname}} {{lastname}}.',
    phoneNumberAlreadyUsedWithClub: 'Ce numéro est déjà utilisé par un·e entraîneur·e qui appartient à un club.',
    'Request failed with status code 404': 'La ressource demandée est introuvable.',
    schemaMismatch: 'Un problème est survenu lors de la récupération des informations.'
      + ' Merci de vérifier que ton application est à jour ou réessayer plus tard.',
    TEAM_MANAGER_POLICY_ERROR: 'Violation de la politique concernant les gestionnaires d\'équipe.',
    TEAM_TRAINER_CREATE_POLICY_ERROR: 'Violation de la politique de création d\'événements par les entraîneur·e·s.',
    title: 'Erreur',
    UNIQUE_CLUB_CHAT_POLICY_ERROR: 'Violation de la politique concernant les discussions de club.',
    UNIQUE_TEAM_CHAT_POLICY_ERROR: 'Violation de la politique concernant les discussions d\'équipe.',
    UNIQUE_WHISPER_CHAT_POLICY_ERROR: 'Violation de la politique concernant les discussions privées.',
    unknown: 'Une erreur inconnue est survenue.',
    USER_NOT_FOUND_POLICY_ERROR: 'Violation de la politique concernant les utilisateurs introuvables.',
  },
  club: {
    fields: {
      address: {
        label: 'Adresse',
        placeholder: 'Adresse du club',
      },
      email: {
        label: 'Email',
        placeholder: 'Email du club',
      },
      name: {
        label: 'Nom',
        placeholder: 'Nom du club',
      },
      phoneNumber: {
        label: 'Téléphone',
        placeholder: 'Téléphone du club',
      },
    },
  },
  clubDetails: {
    actions: {
      claimClub: "C'est mon club",
      contactTrainers: 'Contacter les entraîneur·e·s',
      delete: 'Supprimer',
      editInfo: 'Modifier',
      join: "C'est mon club !",
      joinAsMyClub: "C'est mon club !",
      leave: 'Quitter le club',
      manageJoinRequests: 'Voir les demandes d\'affiliation',
      requestJoin: 'Demander à rejoindre ce club',
      requestPending: 'Demande en attente',
    },
    alerts: {
      deleteSponsor: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        description: 'Es-tu sûr·e de vouloir continuer ?',
        title: 'Tu es sur le point de supprimer le partenaire {{sponsorName}}.',
      },
      deleteTrainer: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        description: 'Le compte ne sera pas supprimé, mais l\'entraîneur·e ne sera plus lié·e au club. Es-tu sûr·e de vouloir continuer ?',
        title: 'Tu es sur le point de supprimer cet·te entraîneur·e.',
      },
      inviteTrainer: {
        message: 'Bonjour {{coachName}} !'
          + '\nTu as été désigné·e comme entraîneur·e dans le club {{clubName}}.'
          + "\nTélécharge l'application Found Club pour finaliser la création de ton compte"
          + ' et commencer à gérer tes équipes et tes événements.',
        title: 'Bienvenue sur Found Club !',
      },
      joinClub: {
        actions: {
          ok: 'OK',
        },
        description: 'Ton dirigeant·e va recevoir ta demande et la traiter dès que possible.',
        title: "Ta demande d'adhésion a bien été envoyée",
      },
      leave: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Quitter le club',
        },
        description: "Tu ne seras plus lié·e à ce club ni à ses équipes en tant qu'encadrant·e. Es-tu sûr·e de vouloir continuer ?",
        error: 'Impossible de quitter ce club pour le moment.',
        title: 'Quitter le club ?',
      },
      myClub: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Contacter Found Club',
        },
        description: 'Contacte nos équipes pour accéder aux fonctionnalités réservées aux dirigeant·e·s et aux entraîneur·e·s du club.',
        title: 'Tu es dirigeant·e de ce club ?',
      },
    },
    titles: {
      activities: 'Sports',
      coachs: 'Nos entraîneur·e·s',
      owners: 'Nos dirigeant·e·s',
      sponsors: 'Nos partenaires',
      teams: 'Nos équipes',
    },
  },
  clubEdit: {
    title: 'Modifier le club',
  },
  clubFilters: {
    actions: {
      apply: 'Appliquer les filtres',
      clear: 'Effacer les filtres',
    },
    fields: {
      activity: {
        label: 'Sport',
        placeholder: 'Sélectionner une activité',
      },
      city: {
        label: 'Ville',
        placeholder: 'Marseille',
      },
      radius: {
        label: 'Dans un rayon autour de : ',
      },
    },
  },
  clubList: {
    actions: {
      createClub: 'Ajouter mon club',
    },
    fields: {
      search: 'Rechercher',
    },
    noData: 'Aucun club ne correspond à la recherche.',
    title: 'Trouver mon club',
  },
  clubMembershipRequestList: {
    actions: {
      accept: 'Accepter',
      reject: 'Refuser',
    },
    errors: {
      accept: 'Impossible de valider la demande pour le moment.',
      missingRequester: 'Impossible de traiter cette demande. Demande au joueur de renvoyer sa demande.',
      reject: 'Impossible de refuser la demande pour le moment.',
    },
    fields: {
      accepted: 'Demande acceptée',
      claimAccepted: '{{firstname}} a bien été ajouté·e comme dirigeant·e du club.',
      claimAcceptedTitle: 'Dirigeant ajouté',
      pending: "{{firstname}} s'est signalé·e comme entraîneur·e de cette équipe",
      pendingClaim: '{{firstname}} souhaite revendiquer la gestion de ce club.',
      rejected: 'Demande refusée',
    },
    noData: 'Aucune demande d\'affiliation en attente',
    title: 'Demandes d\'affiliation',
  },
  clubWizard: {
    activities: {
      empty: 'Aucun sport ne correspond.',
      searchLabel: 'Rechercher un sport',
      searchPlaceholder: 'Football, basket…',
      subtitle: 'Sélectionne les sports pratiqués dans ton club (tu pourras en ajouter plus tard).',
      title: 'Quels sports pratiques-tu ?',
    },
    address: {
      label: 'Adresse du club',
      placeholder: 'Rue, ville…',
      subtitle: 'Recherche l\'adresse de ton club. Elle le rend visible sur la carte et près des joueurs.',
      title: 'Où se trouve ton club ?',
    },
    contact: {
      alsoDirector: 'Je suis aussi dirigeant de ce club',
      alsoDirectorSubtitle: 'Coche si tu gères aussi le club (et pas seulement une équipe).',
      emailInvalid: 'Adresse email invalide.',
      emailLabel: 'Email du club (facultatif)',
      emailPlaceholder: 'contact@club.fr',
      phoneLabel: 'Téléphone du club (facultatif)',
      phonePlaceholder: '0612345678',
      skip: 'Passer cette étape',
      subtitle: 'Ces coordonnées aident les joueurs à contacter ton club. Tu peux les ajouter plus tard.',
      title: 'Coordonnées du club',
    },
    name: {
      duplicateHint: 'C\'est peut-être l\'un de ceux-ci ?',
      label: 'Nom du club',
      placeholder: 'FC Marseille',
      subtitle: 'Donne le nom officiel de ton club. On vérifie au passage qu\'il n\'existe pas déjà.',
      title: 'Quel est le nom de ton club ?',
    },
    recap: {
      address: 'Adresse',
      create: 'Créer mon club',
      createAnyway: 'Créer quand même',
      duplicateHint: 'Rejoins-le s\'il s\'agit du tien, ou touche « Créer quand même » si c\'est un autre club.',
      duplicateTitle: 'Un club très proche existe déjà',
      email: 'Email',
      error: 'Impossible de créer le club.',
      missing: 'Renseigne au moins le nom et l\'adresse du club.',
      name: 'Nom',
      phone: 'Téléphone',
      sports: 'Sports',
      subtitle: 'Vérifie les informations avant de créer ton club.',
      successDescription: 'Ton club est en ligne. Notre équipe le vérifiera prochainement.',
      successTitle: 'Club créé !',
      title: 'Récapitulatif',
    },
  },
  common: {
    actions: {
      askLater: 'Plus tard',
      cancel: 'Annuler',
      confirm: 'Confirmer',
      continueLater: 'Continuer plus tard',
      create: 'Créer',
      delete: 'Supprimer',
      next: 'Continuer',
      ok: 'OK',
      openInGps: 'Ouvrir dans le GPS',
      photoFromCamera: 'Prendre une photo',
      photoFromGallery: 'Choisir depuis la galerie',
      save: 'Enregistrer',
    },
    back: 'Retour',
    chat: 'Conversation',
    close: 'Fermer',
    error: 'Erreur',
    finish: 'Terminer',
    ignore: 'Ignorer',
    messages: {
      noData: 'Aucune donnée disponible',
    },
    next: 'Suivant',
    previous: 'Précédent',
    skip: 'Passer',
    view: 'Voir',
  },
  conversation: {
    actions: {
      copy: 'Copier',
      copySuccess: {
        description: 'Le message a été copié.',
        title: 'Copié',
      },
      copyUnavailable: 'Le presse-papiers est indisponible sur cette build.',
      delete: 'Supprimer',
      deleteConfirm: {
        description: 'Ce message sera supprimé pour tous les participants.',
        title: 'Supprimer le message',
      },
      deleteError: 'Impossible de supprimer ce message.',
      edit: 'Modifier',
      editModal: {
        addFile: 'Ajouter un fichier',
        addMedia: 'Ajouter un média',
        attachmentFallback: 'Pièce jointe',
        attachments: 'Pièces jointes',
        noAttachments: 'Aucune pièce jointe',
        placeholder: 'Modifier le texte...',
        takePhoto: 'Prendre une photo',
        title: 'Modifier le message',
      },
      modalTitle: 'Actions du message',
      reply: 'Répondre',
      report: 'Signaler',
    },
    attachments: {
      camera: 'Camera',
      contact: 'Contact',
      createPoll: 'Créer un sondage',
      document: 'Document',
      documentDisabled: 'Indisponible sur cette build',
      event: 'Événement',
      noContact: 'Aucun contact partageable',
      photos: 'Photos',
      pickFile: 'Envoyer un fichier',
      pickMedia: 'Envoyer un média',
      poll: 'Sondage',
      subtitle: 'Partage du contenu dans cette conversation',
      takePhoto: 'Prendre une photo',
      title: 'Ajouter',
      unavailable: 'Bientôt disponible',
    },
    messagePlaceholder: 'Message',
    modals: {
      actions: {
        report: 'Signaler le message',
        seeUser: 'Voir le profil',
      },
      reportSuccess: {
        description: 'Merci de ton retour, nous allons traiter ta demande dans les plus brefs délais.',
        title: 'Ton signalement a bien été envoyé',
      },
    },
    poll: {
      bubble: {
        anonymousBadge: 'Sondage anonyme',
        detailsHint: 'Appuie sur une option pour voter ou modifier ton vote. '
          + 'Appuie à nouveau pour le retirer, ou ouvre la carte pour les détails.',
        questionFallback: 'Question',
        selectedBadge: 'Ton vote',
      },
      common: {
        member: 'Membre',
        vote: 'vote',
      },
      details: {
        anonymousHint: 'Ce sondage est anonyme. Les votants ne sont pas affichés.',
        anonymousVotes: 'Votes anonymes',
        createdBy: 'Créé par',
        date: 'Date',
        infoTitle: 'Informations du sondage',
        notFound: 'Ce sondage est introuvable ou a été supprimé.',
        noVotes: 'Aucun vote pour cette option.',
        syncInProgress: 'Le sondage est en cours de synchronisation.',
        syncTitle: 'Information',
        title: 'Détail du sondage',
        visibleVotes: 'Votes visibles',
        voteCount: 'Nombre de votes',
        voteHint: 'Sélectionne une option pour voter ou modifier ton vote. '
          + 'Appuie à nouveau dessus pour retirer ton vote. '
          + "Le detail des votants s'affiche quand le sondage n'est pas anonyme.",
        votesByOption: 'Votes par option',
      },
      errors: {
        chatMissing: 'Conversation introuvable.',
        createFailed: 'Impossible de créer ce sondage.',
        duplicateOptions: 'Chaque option doit être différente.',
        incomplete: 'Le sondage est incomplet.',
        minOptions: 'Ajoute au moins deux options.',
        optionAlreadyUsed: 'Cette option est déjà utilisée.',
        questionRequired: 'Ajoute une question pour ton sondage.',
        sendUnavailable: 'Connexion messagerie indisponible. Réessaie dans quelques secondes.',
        voteSave: 'Impossible de sauvegarder ce vote.',
      },
      footer: {
        mode: 'mode',
      },
      form: {
        addOption: '+ Ajouter une option',
        addOptionA11y: 'Ajouter une option',
        allowMultipleVotes: 'Autoriser plusieurs votes',
        allowMultipleVotesA11y: 'Autoriser plusieurs votes',
        allowMultipleVotesHint: 'Active cette option pour permettre à chacun de voter pour plusieurs réponses.',
        isAnonymous: 'Sondage anonyme',
        isAnonymousA11y: 'Sondage anonyme',
        isAnonymousDisabledHint: 'Les membres pourront voir qui a voté pour chaque option.',
        isAnonymousEnabledHint: 'Les votes restent anonymes pour les autres membres.',
        optionPlaceholder: 'Option {{index}}',
        optionsLabel: 'Options',
        questionLabel: 'Question',
        questionPlaceholder: 'Ex: Quel créneau te convient ?',
        removeOptionA11y: 'Supprimer l option {{index}}',
        submit: 'Envoyer le sondage',
        subtitle: 'Pose une question, ajoute des options et lance le vote.',
      },
      modes: {
        multiple: 'multiple',
        single: 'unique',
      },
      visibility: {
        anonymous: 'anonyme',
        visible: 'visible',
      },
    },
    shareContact: {
      empty: 'Aucun contact partageable dans ce chat.',
      send: 'Partager',
      title: 'Partager un contact',
    },
    shareEvent: {
      empty: 'Aucun événement disponible.',
      planningTitle: 'Événements de mon planning',
      publicEmpty: 'Aucun événement public disponible.',
      publicPickerTitle: 'Partager un événement public',
      searchPlaceholder: 'Rechercher un événement',
      sharePublicAction: 'Partager un événement public',
      title: 'Partager un événement',
    },
    shareLocation: {
      placeholder: 'Rechercher une adresse',
      send: 'Partager',
      title: 'Partager une localisation',
    },
    voice: {
      hint: 'Glisser gauche pour annuler, glisser haut pour verrouiller.',
      hintShort: 'Maintiens appuyé pour enregistrer',
      locked: 'Note vocale verrouillée',
      lockedHint: 'Enregistrement verrouillé. Touche envoyer ou annuler.',
      permissionDescription: 'Autorise le micro pour envoyer des notes vocales.',
      permissionTitle: 'Micro requis',
      recording: 'Enregistrement vocal',
      sendErrorDescription: 'Impossible d\'envoyer la note vocale. Réessaie.',
      sendErrorTitle: 'Envoi impossible',
      sending: 'Envoi en cours...',
      stopErrorDescription: 'Impossible de finaliser l\'enregistrement vocal. Réessaie.',
      unavailableDescription: 'Le module vocal n\'est pas disponible sur cette build.',
      unavailableTitle: 'Vocal indisponible',
    },
  },
  createClubRequest: {
    actions: {
      create: 'Ajouter le club',
      ok: 'OK',
    },
    alerts: {
      description: "L'équipe Found Club va examiner ta demande et te recontacter dans les plus brefs délais.",
      title: 'Ta demande de création de club a bien été envoyée',
    },
    fields: {
      clubName: {
        label: 'Nom du club',
        placeholder: 'FC Marseille',
      },
      holderFirstname: {
        label: 'Prénom du responsable',
        placeholder: 'Luc',
      },
      holderLastname: {
        label: 'Nom du responsable',
        placeholder: 'Harne',
      },
      holderPhone: {
        label: 'Numéro de téléphone du responsable',
        placeholder: '0612345678',
      },
    },
    title: 'Ajouter un club',
  },
  errorPage: {
    action: 'Recharger la page',
    subtitle: 'Une erreur est survenue.',
    title: 'Oups !',
  },
  event: {
    shareChatAccessibilityHint: 'Partager l’événement dans cette conversation',
    shareChatCardHint: 'Partage direct FoundClub',
    shareChatType: {
      club: 'Club',
      group: 'Groupe',
      multisport: 'Omnisport',
      team: 'Équipe',
      whisper: 'Privé',
    },
    sharedEvent: 'Événement partagé',
    shareEyebrow: 'Diffusion',
    shareInChat: 'Partager dans une conversation',
    shareInChatHint: 'Envoi direct dans FoundClub.',
    shareNoChatAvailable: 'Aucune conv disponible.',
    shareNoChatAvailableHint: 'Rejoins ou crée une conversation pour partager cet événement ici.',
    shareOutsideHint: 'SMS, mail ou application externe',
    shareOutsideLabel: 'Lien externe',
    shareSubtitle: 'Choisis un canal pour envoyer cette fiche rapidement.',
  },
  eventDetails: {
    actions: {
      accept: 'Accepter',
      cancelEvent: 'Annuler l\'événement',
      cancelResponse: 'Annuler ma participation',
      edit: 'Modifier l\'événement',
      editResponse: 'Modifier ma réponse',
      join: 'Participer',
      refuse: 'Refuser',
      remind: 'Relancer',
    },
    fields: {
      description: 'À propos',
      participationRequests: 'Demandes de participation',
      participations: 'Participants',
    },
    invitedTeams: {
      externalBadge: 'Ouvert à tous',
      externalHistoricalTitle: 'Historique participants externes',
      historicalPending: '{{count}} réponse(s) en attente',
      historicalTitle: 'Historique équipe retirée',
      homeTeamBadge: 'Équipe organisatrice',
      invitedTeamBadge: 'équipe invitée',
    },
    managePanel: {
      cancel: 'Annuler',
      edit: 'Modifier',
      feature: 'À la une',
      lineup: 'Compo',
      title: 'Gérer l\'événement',
      tournamentSettings: 'Réglages tournoi',
    },
    modals: {
      accept: {
        title: 'Es-tu sûr·e de vouloir accepter cette demande ?',
      },
      actions: {
        cancel: 'Annuler',
        confirm: 'Confirmer',
        report: 'Signaler',
      },
      cancelEvent: {
        description: 'Une fois annulé, l\'événement ne sera plus visible par les participant·e·s.',
        title: 'Es-tu sûr·e de vouloir annuler cet événement ?',
      },
      deleteParticipation: {
        actions: {
          cancel: 'Non, retour',
          confirm: 'Oui, annuler',
        },
        description: 'Es-tu sûr·e de vouloir annuler ta participation à cet événement ?',
        title: 'Annuler ma participation',
      },
      editResponse: {
        description: "En modifiant ta réponse tu indiques ta participation à l'événement",
        title: 'Modifier ma réponse',
      },
      recurrenceCancel: {
        actions: {
          all: 'Tous les événements',
          future: 'Cet événement et les suivants',
          thisEvent: 'Cet événement',
        },
        description: 'Cet événement fait partie d\'une série. Que veux-tu annuler ?',
        title: 'Annulation d un événement récurrent',
      },
      refuse: {
        fields: {
          reason: {
            label: 'Raison du refus',
            optionalHint: 'Ce champ est optionnel.',
            placeholder: 'Il faut avoir plus de 16 ans.',
          },
        },
        title: 'Es-tu sûr·e de vouloir refuser cette demande ?',
      },
      remindSuccess: {
        description: 'Les joueur·se·s vont recevoir une notification pour leur rappeler de répondre à l\'événement.',
        title: 'Ton relance a bien été envoyée',
      },
      reportEvent: {
        description: 'Merci de nous indiquer la raison pour laquelle tu signales cet événement.',
        fields: {
          reason: {
            label: 'Raison du signalement',
            placeholder: 'Cet événement est inapproprié.',
          },
        },
        title: 'Signaler un événement',
      },
      reportSuccess: {
        description: 'Merci de ton retour, nous allons traiter ta demande dans les plus brefs délais.',
        title: 'Ton signalement a bien été envoyé',
      },
    },
    participationStatus: {
      missing: 'Absent·e·s',
      notAnswered: 'Sans réponse',
      participating: 'Présent·e·s',
    },
  },
  eventEdit: {
    actions: {
      save: 'Enregistrer',
    },
    fields: {
      capacity: {
        label: 'Nombre de participant·e·s',
        placeholder: 'Illimité',
      },
      club: {
        label: 'Club',
        placeholder: 'Sélectionner un club',
      },
      date: {
        label: "Date de l'événement",
        placeholder: 'JJ/MM/AAAA',
      },
      description: {
        label: 'Description',
        placeholder: 'Événement de détection ouvert à tous·tes les joueur·se·s.',
      },
      endTime: {
        label: 'Heure de fin',
        placeholder: 'HH:mm',
      },
      invitedTeams: {
        label: 'Inviter des équipes',
        myTeams: 'MES ÉQUIPES',
        otherTeams: 'AUTRES ÉQUIPES',
        placeholder: 'Sélectionner des équipes',
      },
      isRecurrent: {
        label: 'Événement récurrent',
      },
      location: {
        label: 'Lieu',
        placeholder: '2 rue du stade, 69000 Lyon',
      },
      pricePerPerson: {
        label: 'Prix par personne (€)',
        placeholder: 'Ex: 10',
      },
      recurrenceDay: {
        label: 'Jour de la récurrence',
      },
      recurrenceEndDate: {
        label: 'Date de fin de la récurrence',
        placeholder: 'JJ/MM/AAAA',
      },
      recurrenceFrequency: {
        label: 'Fréquence de la récurrence',
        options: {
          month: 'Mensuel',
          week: 'Hebdomadaire',
        },
      },
      recurrenceStartDate: {
        label: 'Date de début de la récurrence',
        placeholder: 'JJ/MM/AAAA',
      },
      sessionStatus: {
        label: "Visibilité de l'événement",
        options: {
          closed: 'Privé',
          open: 'Public',
        },
      },
      startTime: {
        label: 'Heure de début',
        placeholder: 'HH:mm',
      },
      team: {
        label: 'Équipe',
        placeholder: 'Sélectionner une équipe',
      },
      time: {
        label: "Horaire de l'événement",
        placeholder: 'JJ/MM/AAAA',
      },
      totalPlayers: {
        label: 'Nombre total de joueurs',
        placeholder: 'Ex: 10',
      },
      type: {
        label: 'Type d\'événement',
        placeholder: 'Sélectionner un type d\'événement',
      },
      validationMode: {
        label: 'Mode de validation',
        options: {
          auto: 'Automatique',
          manual: 'Manuelle',
        },
      },
    },
    title: 'Créer un événement',
    titleEdit: 'Modifier l\'événement',
  },

  eventFilters: {
    actions: {
      apply: 'Appliquer les filtres',
      clear: 'Effacer les filtres',
    },
    fields: {
      activity: {
        label: 'Sport',
        placeholder: 'Sélectionner un sport',
      },
      category: {
        label: 'Catégorie',
        placeholder: 'Sélectionner une catégorie',
      },
      club: {
        label: 'Club',
        placeholder: 'Sélectionner un club',
      },
      date: {
        label: 'Date',
        placeholder: 'Sélectionner une date',
      },
      level: {
        label: 'Niveau',
        placeholder: 'Sélectionner un niveau',
      },
      sessionStatus: {
        label: 'Statut de la session',
        options: {
          closed: 'Fermé',
          open: 'Ouvert',
        },
        placeholder: 'Sélectionner un statut',
      },
      team: {
        label: 'Équipe',
        placeholder: 'Sélectionner une équipe',
        selectClubFirst: 'Sélectionner un club avant l\'équipe',
      },
      type: {
        label: 'Type d\'événement',
        placeholder: 'Sélectionner un type d\'événement',
      },
    },
    infos: {
      activity: 'Le sport pratiqué par l\'équipe (football, basketball, handball, etc.).\n\nFiltrer par sport te permet de ne voir que les événements correspondant à ton discipline.',
      category: 'La catégorie d\'âge de l\'équipe (U7, U9, U11, U13, Senior, etc.).\n\nTu peux sélectionner plusieurs catégories pour voir tous les événements correspondants.',
      level: 'Le niveau de jeu de l\'équipe (Départemental, Régional, National, etc.).\n\nCe filtre t\'aide à trouver des événements adaptés à ton niveau de pratique.',
      type: 'Le type d\'événement (Entraînement, Match, Détection, Tournoi, etc.).\n\nSélectionne plusieurs types pour voir différentes activités.',
    },
  },
  eventList: {
    actions: {
      about: 'À propos',
      absent: 'Absent·e',
      add: 'Ajouter un événement',
      findEvent: 'Trouver un événement',
      join: 'Participer',
      present: 'Présent·e',
    },
    featured: 'À la une :',
    info: {
      alreadyJoined: 'Je participe !',
      alreadyMissing: 'Je serai absent·e',
      declinedRequest: 'Demande refusée',
      pendingRequest: 'Demande en attente',
    },
    joinModal: {
      actions: {
        cancel: 'Annuler',
        confirm: 'Confirmer ma participation',
      },
      checkboxes: {
        conditions: "J'accepte les conditions pour participer à l'événement",
        responsibility: 'Je déclare avoir pris connaissance de la "Déclaration de responsabilité et acceptation des risques"',
      },
      description: 'Je soussigné(e), participant majeur ou, le cas échéant, représentant légal du participant mineur, reconnais et accepte ce qui suit :'
        + '\n\nRôle de Found Club : '
        + '\n    - Found Club est une plateforme de mise en relation et n\'organise pas l\'événement. Found Club ne fournit aucune assurance liée à la participation.'
        + '\n\nTrajets aller/retour :'
        + '\n    - Sauf transport expressément organisé par l\'organisateur, le trajet vers et depuis l\'événement est sous ma responsabilité (ou celle du représentant légal pour un mineur), y compris assurance et choix du mode de transport.'
        + '\n\nAssurance :'
        + '\n    - J\'atteste disposer (ou, pour un mineur, que l\'enfant dispose) d\'une couverture d\'assurance appropriée (ex. licence fédérale en cours et/ou responsabilité civile). J\'ai compris que Found Club n\'assure ni les dommages corporels ni matériels.'
        + '\n\nAptitude médicale :'
        + '\nJ\'atteste être apte à la pratique au jour de l\'événement (ou que l\'enfant est apte, conformément aux exigences fédérales : certificat/questionnaire le cas échéant) et je m\'engage à ne pas participer / ne pas autoriser la participation en cas de doute sur l\'état de santé.'
        + '\n\nLimites de responsabilité (droit FR) :'
        + '\nDans la mesure permise par la loi, je m\'engage à ne pas rechercher la responsabilité de Found Club du fait de la participation ; cette clause ne s\'applique pas en cas de faute lourde ou intentionnelle ou de manquement grave aux obligations de sécurité imputable à Found Club ou à l\'organisateur.'
        + '\n\nRèglement & sécurité :'
        + '\nJe m\'engage (ou j\'engage le mineur) à respecter le règlement, les consignes de sécurité et les instructions des encadrants ; l\'organisateur peut refuser ou interrompre la participation en cas de non-respect.'
        + '\n\nUrgence médicale :'
        + '\nJ\'autorise l\'organisateur à prévenir les secours en cas d\'urgence ; pour un mineur, j\'autorise l\'organisateur à accompagner l\'enfant si nécessaire et je m\'engage à rester joignable.',
      title: 'DÉCLARATION DE RESPONSABILITÉ ET ACCEPTATION DES RISQUES',
      validation: 'En cochant les cases et en validant mon inscription, je confirme avoir lu, compris et accepté la présente déclaration et j\'accepte de participer à l\'événement dans ces conditions.',
    },
    loadingDesc: 'Nous chargeons les événements correspondant à ta recherche.',
    loadingTitle: 'Chargement des événements',
    loadingUpdating: 'Actualisation des événements...',
    noData: 'Aucun événement trouvé.',
    title: 'Mes événements',
  },
  eventWizard: {
    common: {
      stepCounter: 'Étape {{current}}/{{total}}',
    },
    errors: {
      datePast: "La date ou l'heure de début doit être dans le futur.",
      genericCreate: "Erreur de création d'événement.",
      invalidTimeRange: "L'heure de fin doit être après l'heure de début.",
      invitesFetch: 'Impossible de charger les équipes à inviter.',
      locationRequired: 'Un lieu est requis.',
      noOtherTeams: 'Aucune autre équipe disponible à inviter.',
      noTeams: 'Aucune équipe organisatrice disponible.',
      noTypes: "Aucun type d'événement disponible.",
      recurrenceDatesRequired: 'Les dates de récurrence sont obligatoires.',
      recurrenceDaysRequired: 'Sélectionne au moins un jour de récurrence.',
      recurrenceInvalidRange: 'La date de fin de récurrence doit être après la date de début.',
      slotConflict: 'Conflit de créneau détecté pour le lieu sélectionné.',
    },
    partial: {
      actions: {
        keep: 'Conserver les créations',
        retry: 'Réessayer les échecs',
        rollback: 'Annuler les créations',
      },
      noCreated: "Aucun événement n'a été créé.",
      rollbackPartial: "{{count}} annulation(s) n'ont pas pu être finalisées.",
      rollbackSuccess: 'Les événements créés ont été annulés.',
      summary: '{{success}} succès / {{failed}} échec(s).',
      title: 'Création partielle détectée',
    },
    recap: {
      actions: {
        create: 'Créer les événements',
        createShort: 'Créer',
        edit: 'Modifier',
      },
      capacity: 'Participants max: {{value}}',
      completedCount: '{{done}}/5 infos clés complétées',
      dateLabel: 'Date',
      incomplete: 'à compléter',
      invitedTeamsTitle: 'équipes invitées',
      invitesCount: '{{count}} équipe(s) invitée(s)',
      noDescription: 'Aucune description',
      notSet: 'Non renseigné',
      organizationTitle: 'Organisation',
      participationTitle: 'Participation',
      pricePerPerson: 'Prix par personne: {{value}}',
      quickOverviewTitle: 'Vue d\'ensemble',
      ready: 'Prêt à créer',
      recurrenceCount: '{{count}} occurrence(s) prévues',
      reservationMode: 'Mode de réservation: {{value}}',
      sections: {
        description: 'Description',
        location: 'Lieu',
        logistics: 'Logistique',
        participants: 'Participants',
        reservation: 'Réservation',
        team: 'Équipe',
        type: 'Type',
        validation: 'Validation',
        visibility: 'Visibilité',
      },
      timeLabel: 'Horaire',
      totalPlayers: 'Joueurs attendus: {{value}}',
      totalPlayersTitle: 'Joueurs attendus',
      validationMode: 'Validation: {{value}}',
      whenWhereTitle: 'Quand et lieu',
    },
    steps: {
      description: {
        label: 'Description',
        placeholder: 'Ajoute des détails utiles pour les participants.',
        subtitle: 'Ajoute un contexte clair pour cet événement.',
        title: 'Description',
      },
      invites: {
        myTeams: 'MES ÉQUIPES',
        otherTeams: 'AUTRES ÉQUIPES',
        subtitle: 'Invite des équipes, ou passe cette étape.',
        title: 'Invitations',
      },
      location: {
        addInstallation: 'Ajouter une installation',
        addressMissing: 'Adresse non renseignée',
        helper: 'Sélectionne un lieu du club ou saisis une adresse externe.',
        installationHelper: 'Choisis une installation existante de ton club.',
        noInstallations: 'Aucune installation disponible pour ce club.',
        subtitle: 'Le lieu est obligatoire pour continuer.',
        title: 'Lieu',
      },
      logistics: {
        isRecurrent: 'Événement récurrent',
        recurrenceDays: 'Jours de récurrence',
        recurrenceInterval: 'Intervalle de récurrence',
        recurrenceIntervalDecrement: "Réduire l'intervalle de récurrence",
        recurrenceIntervalIncrement: "Augmenter l'intervalle de récurrence",
        recurrenceIntervalMonthlyMany: 'Tous les {{count}} mois',
        recurrenceIntervalMonthlyOne: 'Tous les mois',
        recurrenceIntervalWeeklyMany: 'Toutes les {{count}} semaines',
        recurrenceIntervalWeeklyOne: 'Toutes les semaines',
        recurrenceTitle: 'Configuration récurrence',
        reservationMode: 'Mode de réservation',
        reservationTitle: 'Paramêtres réservation',
        subtitle: "Configure date, horaires et règles d'accès.",
        title: 'Logistique',
      },
      participants: {
        fixed: 'Capacité fixe',
        hint: 'Tu pourras encore modifier ces valeurs avant la création finale.',
        modeHintFixed: 'Mode capacité fixe: nombre de places limite.',
        modeHintUnlimited: 'Mode illimité: aucun plafond de participants.',
        modeLabel: 'Mode de capacité',
        playersUnit: 'joueurs max',
        previewCapacity: 'Capacité: {{value}}',
        previewMode: 'Mode: {{value}}',
        previewTitle: 'Apercu',
        previewTotalPlayers: 'Joueurs attendus: {{value}}',
        quickPresets: 'Valeurs rapides',
        subtitle: 'Choisis une capacité max, ou laisse l événement en accès illimité.',
        summaryTitle: 'Résumé',
        title: 'Participants',
        totalPlayersExceedsCapacity: 'Le nombre de joueurs attendus ne peut pas dépasser la capacité max.',
        unlimited: 'Illimité',
        unlimitedHint: 'Aucune limite de places',
        unlimitedLabel: 'Illimité',
      },
      recap: {
        subtitle: 'Vérifie les informations avant création.',
        title: 'Récapitulatif',
      },
      team: {
        createTeamCta: 'Créer une équipe',
        createTeamHint: "Crée d'abord ton équipe, puis reviens créer ton événement.",
        subtitle: "Sélectionne l'équipe organisatrice.",
        title: 'Équipe organisatrice',
      },
      type: {
        subtitle: "Sélectionne le type d'événement.",
        title: "Type d'événement",
      },
      validation: {
        autoDesc: 'Les participants peuvent confirmer automatiquement leur présence.',
        autoRuleOne: 'Check-in simplifie pour les joueurs',
        autoRuleTwo: 'Ideal pour les sessions ouvertes',
        manualDesc: 'Le coach validé manuellement les participants.',
        manualRuleOne: 'Contrôle total par le staff',
        manualRuleTwo: 'Recommandé pour les groupes fermés',
        optionLabel: 'Mode {{title}}',
        previewTitle: 'Mode sélectionne',
        recommended: 'Recommandé',
        selectedHint: 'Mode actuellement sélectionné.',
        selectHint: 'Sélectionne ce mode de validation.',
        subtitle: "Définis comment valider les présences à l'événement.",
        title: 'Mode de validation',
      },
      visibility: {
        public: 'Public',
        publicDesc: 'Visible pour tous les profils qui y ont accès.',
        subtitle: "Définis qui peut voir l'événement.",
        team: 'Équipe',
        teamDesc: "Visibilité uniquement pour les membres de l'équipe créatrice de l'événement.",
        title: 'Visibilité',
      },
    },
  },
  facilityForm: {
    actions: {
      create: 'Créer',
      save: 'Enregistrer',
    },
    capacity: {
      teamPlural: 'équipes simultanées',
      teamSingular: 'équipe simultanée',
    },
    conflictModes: {
      allow: {
        description: 'Le créneau reste confirmé, les dirigeants sont notifiés.',
        label: 'Autoriser et notifier',
      },
      pending: {
        description: 'Le créneau passe en demande, un dirigeant valide avant confirmation.',
        label: 'Demande en attente',
      },
    },
    defaults: {
      name: 'Nom de l\'installation',
      type: 'Type inconnu',
    },
    errors: {
      addressGeocodeRequired: 'Sélectionne une adresse géolocalisée dans la liste.',
      planningColorInvalid: 'Sélectionne une couleur validé.',
    },
    fields: {
      address: 'Adresse (lieu exact)',
      capacity: 'Capacité',
      capacityConflictMode: 'Comportement en cas de conflit',
      name: 'Nom de l\'installation',
      planningColor: 'Couleur dans le planning',
      type: 'Type',
    },
    hints: {
      addressSelection: 'Sélectionne une adresse dans la liste pour activer le GPS.',
      gpsActive: '✓ GPS activé',
      planningColor: 'Cette couleur apparaîtra dans le planning pour identifier rapidement l\'installation.',
    },
    placeholders: {
      address: 'Ex: 12 Rue du Stade...',
      name: 'Ex: Terrain Honneur, Salle A...',
    },
    subtitle: {
      create: 'Configure une nouvelle installation pour ton club.',
      edit: 'Mets à jour les informations de cette installation.',
    },
    title: {
      create: 'Nouvelle installation',
      edit: 'Modifier l\'installation',
    },
  },
  facilityList: {
    actions: {
      add: 'Ajouter',
      viewPlanning: 'Voir planning',
    },
    badges: {
      multisport: 'Multisport',
      shared: 'Partagee',
    },
    capacity: {
      hintPlural: 'Capacité simultanée: {{count}} équipes',
      hintSingular: 'Capacité simultanée: {{count}} équipe',
      teamPlural: 'équipes simultanées',
      teamSingular: 'équipe simultanée',
    },
    defaults: {
      addressMissing: 'Adresse non renseignée',
      facilityName: 'Installation',
      unknownType: 'Type inconnu',
    },
    labels: {
      planningColor: 'Couleur planning',
    },
    planning: {
      allClubFacilities: 'Toutes installations',
      allSharedFacilities: 'Toutes partagées',
      occupiedBy: 'Occupé par {{clubName}}',
      scopeClub: 'Mon club',
      scopeShared: 'Partagees',
      sharedEmpty: 'Aucune installation partagée disponible pour ce club.',
      sharedFallbackTitle: 'Occupation',
      sharedLabel: 'Planning partagé',
    },
    readOnlyHint: 'Installation partagée, modification depuis le multisport uniquement.',
    sections: {
      club: 'Installations du club',
      shared: 'Installations partagées',
    },
    sharedOwnerHint: 'Installation partagée du multisport {{ownerName}}. Lecture seule côté club.',
  },
  home: {
    fields: {
      type: {
        label: 'Trouver',
        options: {
          club: 'un club',
          event: 'un événement',
          reservation: 'une réservation',
          team: 'une équipe',
        },
      },
    },
  },
  homeHub: {
    account: {
      logoutDescription: 'Veux-tu te déconnecter de ton compte ?',
      logoutTitle: 'Déconnexion',
    },
    alerts: {
      featuredFallback: {
        description: 'Aucun club omnisport détecté. Redirection vers les demandes du club.',
        title: 'Information',
      },
      missingContext: {
        description: 'Aucun club disponible pour gérer les demandes à la une.',
        title: 'Contexte manquant',
      },
      noClub: {
        description: 'Ton compte doit être rattaché à un club pour gérer ces demandes.',
        title: 'Club introuvable',
      },
      noTrainedTeams: {
        description: 'Tu dois être entraîneur d\'au moins une équipe pour gérer les demandes d\'adhésion.',
        title: 'Aucune équipe disponible',
      },
    },
    cards: {
      account: {
        logout: {
          subtitle: 'Ferme ta session sur cet appareil.',
          title: 'Déconnexion',
        },
        switch: {
          subtitle: 'Bascule vers un autre compte connecté.',
          title: 'Changer de compte',
        },
        tutorial: {
          subtitle: 'Relancer un tutoriel ou réinitialiser les guides.',
          title: 'Tutoriels et aide',
        },
      },
      league: {
        subtitle: 'Le mode compétitif de FoundClub.',
        title: 'FoundClub League',
      },
      manage: {
        addAd: {
          subtitle: 'Publie une annonce de recrutement.',
          title: 'Ajouter une annonce',
        },
        addEvent: {
          subtitle: 'Crée un entraînement, un match\u2026',
          title: 'Ajouter un événement',
        },
        clubRequests: {
          subtitle: "Valider ou refuser les demandes d'adhésion au club.",
          title: 'Demandes adhésion club',
        },
        featuredRequests: {
          subtitle: 'Traite les demandes d événements à la une du club.',
          title: 'Demandes événements à la une',
        },
        licenses: {
          subtitle: 'Suis les statuts de tes membres.',
          title: 'Cotisations',
        },
        manageClub: {
          subtitle: 'Ton espace club pour tout piloter.',
          title: 'Gérer mon club',
        },
        myAds: {
          subtitle: 'Consulte et gère tes annonces.',
          title: 'Mes annonces',
        },
        requests: {
          subtitle: 'Traite les demandes de ton organisation.',
          title: 'Demandes',
        },
        teamRequests: {
          subtitle: 'Traite les demandes d adhésion des joueurs à tes équipes.',
          title: 'Demandes adhésion équipes',
        },
      },
      profile: {
        alerts: {
          subtitle: 'Reçois des notifications ciblées.',
          title: 'Gérer mes alertes',
        },
        edit: {
          subtitle: 'Mets à jour tes informations.',
          title: 'Modifier mon profil',
        },
        history: {
          subtitle: 'Ajoute ou ajuste ton parcours.',
          title: 'Historique sportif',
        },
        subscription: {
          fallbackSubtitle: 'Consulte tes offres, quotas gratuits et équipes couvertes.',
          title: 'Mon abonnement',
        },
        view: {
          subtitle: 'Consulte les infos de ton profil.',
          title: 'Voir mon profil',
        },
      },
      quick: {
        chat: {
          subtitle: 'Ouvre ta messagerie.',
          title: 'Messagerie',
        },
        license: {
          subtitle: 'Ton statut et ton reste à payer.',
          title: 'Ma cotisation',
        },
        planning: {
          subtitle: 'Retrouve tes événements à venir.',
          title: 'Mon planning',
        },
        teams: {
          subtitle: 'Accède à tes équipes et leurs infos.',
          title: 'Mes équipes',
        },
      },
      search: {
        ads: {
          subtitle: 'Postuler aux annonces de recherche des équipes.',
          title: 'Recrutement',
        },
        amicaux: {
          subtitle: 'Trouve un adversaire pour ton équipe.',
          title: 'Matchs amicaux',
        },
        clubs: {
          subtitle: 'Trouve la page d\u2019un club.',
          title: 'Club',
        },
        events: {
          subtitle: 'Détections, séances d\u2019essai, matchs\u2026',
          title: 'Événement',
        },
        profiles: {
          subtitle: 'Trouve des profils ouverts.',
          title: 'Profils',
        },
        reservations: {
          subtitle: 'Réserve un terrain (foot à 5\u2026).',
          title: 'Réservations',
        },
      },
    },
    roles: {
      coach: 'Entraîneur',
      player: 'Joueur',
      president: 'Dirigeant',
    },
    sections: {
      account: 'Compte',
      league: 'FoundClub League',
      manageClub: 'Gérer mon club',
      manageTeams: 'Gérer mes équipes',
      profile: 'Mon profil',
      quickNav: 'Navigation rapide',
      search: 'Rechercher',
    },
    title: 'Accueil',
  },
  homeHubTutorial: {
    actions: {
      scrollDown: 'Descendre',
    },
    center: {
      actions: {
        pickFeature: 'Choisir un tutoriel de fonctionnalité',
        relaunchHome: 'Relancer le tutoriel Accueil',
        resetAll: 'Réinitialiser tous les tutoriels',
      },
      subtitle: 'Relance un tutoriel ou réinitialise tous les guides.',
      title: 'Tutoriels et aide',
    },
    entry: {
      actions: {
        skip: 'Passer',
        start: 'Lancer le tutoriel complet',
      },
      description: 'Tu peux lancer le tutoriel complet pour tout comprendre, ou explorer l\'application par te même.',
      subtitle: 'FoundClub est un outil conçu pour t\'accompagner dans toute ton aventure sportive, peu importe ton sport.',
      title: 'Bienvenue sur FoundClub',
    },
    featurePicker: {
      subtitle: 'Sélectionne une fonctionnalité à découvrir.',
      title: 'Choisir un tutoriel',
    },
    reset: {
      confirm: 'Réinitialiser',
      description: 'Tous les tutoriels seront remis a zéro pour ce compte.',
      title: 'Réinitialiser les tutoriels',
    },
    steps: {
      accountLogout: {
        description: 'Déconnecte-te proprement de l appareil actuel.',
        title: 'Déconnexion',
      },
      accountSwitch: {
        description: 'Ouvre la modale pour changer ou ajouter un compte.',
        title: 'Changer de compte',
      },
      header: {
        description: 'Cette page te donne un accès rapide à toutes les fonctionnalités principales.',
        title: 'Accueil FoundClub',
      },
      league: {
        description: 'Bascule vers FoundClub League pour les fonctionnalités compétitives.',
        title: 'FoundClub League',
      },
      manageAddAd: {
        description: 'Publie une annonce de recrutement pour cibler des profils précis.',
        title: 'Ajouter une annonce',
      },
      manageAddEvent: {
        description: 'Crée un entraînement, match ou détection pour tes équipes.',
        title: 'Ajouter un événement',
      },
      manageClub: {
        description: 'Accèdes à ton espace club pour piloter ton organisation.',
        title: 'Gérer mon club',
      },
      manageClubRequests: {
        description: 'Traite les demandes d\'adhésion reçues par ton club.',
        title: 'Demandes adhésion club',
      },
      manageFeaturedRequests: {
        description: 'Valide les demandes d événements à la une de ton organisation.',
        title: 'Demandes événements à la une',
      },
      manageRequests: {
        description: 'Regroupe et traite toutes les demandes depuis un seul onglet.',
        title: 'Demandes',
      },
      manageTeamRequests: {
        description: 'Valide ou refuse les demandes pour rejoindre tes équipes.',
        title: 'Demandes adhésion équipes',
      },
      profileAlerts: {
        description: 'Configure des alertes personnalisees selon tes recherches.',
        title: 'Gérer mes alertes',
      },
      profileEdit: {
        description: 'Modifie tes informations personnelles et sportives.',
        title: 'Modifier mon profil',
      },
      profileHistory: {
        description: 'Ajoute tes expériences via le wizard historique.',
        title: 'Historique sportif',
      },
      profileView: {
        description: 'Consulte ta page profil complète.',
        title: 'Voir mon profil',
      },
      quickChat: {
        description: 'Ouvre ta messagerie et suis tes conversations.',
        title: 'Messagerie',
      },
      quickPlanning: {
        description: 'Accèdes rapidement à ton planning personnel.',
        title: 'Mon planning',
      },
      quickTeams: {
        description: 'Retrouve toutes tes équipes et leurs pages.',
        title: 'Mes équipes',
      },
      searchAds: {
        description: 'Consulte les annonces de recrutement et les profils disponibles.',
        title: 'Rechercher des annonces',
      },
      searchClubs: {
        description: 'Explore les clubs et ouvre leur fiche détaillée.',
        title: 'Rechercher un club',
      },
      searchEvents: {
        description: 'Trouve des événements sportifs en utilisant les filtres de recherche.',
        title: 'Rechercher un événement',
      },
      searchReservations: {
        description: 'Accèdes aux réservations et filtre selon ton activité.',
        title: 'Rechercher une réservation',
      },
      tutorialCenter: {
        description: 'Relance un tutoriel quand tu veux, ou remets tout a zéro.',
        title: 'Tutoriels et aide',
      },
    },
  },
  login: {
    actions: {
      login: 'Se connecter',
      register: 'Créer un compte',
    },
    fields: {
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '0612345678',
      },
    },
    or: 'ou',
    subtitle: 'Renseigne ton numéro de téléphone.',
    title: 'Connecte-toi',
  },
  menu: {
    chat: 'Messagerie',
    home: 'Accueil',
    myClub: 'Mon club',
    myTeams: 'Mes équipes',
    planning: 'Mon planning',
    requests: 'Demandes',
    search: 'Rechercher',
  },
  menuDock: {
    chat: 'Messages',
    home: 'Accueil',
    myClub: 'Club',
    myTeams: 'Équipes',
    planning: 'Planning',
    search: 'Recherche',
  },
  messaging: {
    noData: 'Aucune conversation trouvée.',
    title: 'Messages privés',
  },
  modals: {
    actions: {
      search: 'Rechercher...',
      select: 'Sélectionner',
    },
    phone: {
      title: 'Sélectionner un pays',
    },
  },
  multisport: {
    accessibility: {
      addSponsor: 'Ajouter un partenaire',
      callPhone: 'Appeler le club',
      deleteSection: 'Supprimer la section',
      editClub: 'Modifier les informations du club',
      openAdminHint: 'Ouvrir le profil du dirigeant',
      openSectionHint: 'Ouvrir le detail de la section',
      sendEmail: 'Envoyer un email au club',
    },
    actions: {
      addAd: {
        subtitle: 'Publier une annonce de recherche de profil.',
        title: 'Ajouter une annonce',
      },
      addEvent: {
        subtitle: 'Créer un événement pour une section ou une équipe.',
        title: 'Ajouter un événement',
      },
      createSection: {
        title: 'Créer une section',
      },
      manageClub: {
        subtitle: 'Modifier les informations et réglages du club.',
        title: 'Gérer mon club',
      },
      requests: {
        subtitle: 'Traiter les demandes en attente de ton organisation.',
        title: 'Demandes',
      },
    },
    badge: 'OMNISPORT',
    createSection: {
      actions: {
        create: 'Créer la section',
        creating: 'Création...',
      },
      fields: {
        address: {
          label: 'Adresse / Ville *',
          placeholder: 'Rechercher une adresse',
        },
        managerPhone: {
          help: 'Ce numéro sera utilisé pour rattacher le dirigeant à la section.',
          label: 'Numéro du dirigeant (optionnel)',
          placeholder: 'Ex: 0612345678',
        },
        name: {
          label: 'Nom de la section *',
          placeholder: 'Ex: Football, Basketball',
        },
        sport: {
          label: 'Sport',
          noResults: 'Aucun sport ne correspond à ta recherche.',
          placeholder: 'Choisir un sport',
        },
      },
      info: 'Une fois créée, la section pourra accueillir équipes, événements et membres.',
      subtitle: 'Crée une section sportive pour ton club multisport.',
      title: 'Nouvelle section',
    },
    deleteSectionConfirm: 'Es-tu sûr de vouloir supprimer la section "{{name}}" ? Cette action est irréversible.',
    deleteSectionTitle: 'Supprimer la section',
    edit: {
      fields: {
        phone: {
          label: 'Téléphone',
          placeholder: 'Téléphone',
        },
      },
    },
    empty: {
      admins: 'Aucun dirigeant rattaché.',
      partners: 'Aucun partenaire ajouté.',
      sections: 'Aucune section disponible pour le moment.',
    },
    fallback: {
      noClub: 'Aucun club multisport associé à ce compte.',
    },
    formErrors: {
      addressRequired: "L'adresse est obligatoire.",
      generic: 'Une erreur est survenue lors de la création de la section.',
      sectionNameRequired: 'Le nom de la section est obligatoire.',
    },
    hero: {
      summary: 'Vue globale du club multisport et de ses sections.',
    },
    labels: {
      members: 'membres',
      teams: 'équipes',
    },
    sectionCreated: 'La section a été créée avec succès.',
    sectionCreatedMessage: 'La section "{{name}}" a été créée avec succès.',
    sectionCreatedTitle: 'Section créée',
    sectionDeleted: 'La section a été supprimée avec succès.',
    stats: {
      admins: 'Dirigeants',
      members: 'Membres',
      sections: 'Sections',
      teams: 'Équipes',
    },
    titles: {
      admins: 'Dirigeants omnisport',
      partners: 'Partenaires',
      quickActions: 'Actions rapides',
      sections: 'Mes sections',
    },
    tutorial: {
      mainDescription: 'Gère tes sections, tes membres et tes actions rapides depuis un seul écran.',
      mainTitle: 'Gestion multisport',
    },
  },
  myEventList: {
    actions: {
      closeTimeFilter: 'Valider',
    },
    fields: {
      timeFilter: {
        next: 'Mes prochains événements',
        past: 'Mes événements passés',
        selectDate: 'Sélectionner une date',
      },
      type: {
        all: 'Tous',
      },
    },
  },
  myTeamList: {

    title: 'Mes équipes',
  },
  notifications: {
    details: {
      participationDeclined: {
        actions: {
          viewEvent: "Voir l'événement",
        },
        eventFallback: 'Événement indisponible',
        labels: {
          decisionDate: 'Date de décision',
          event: 'Événement',
          reason: 'Motif',
          status: 'Statut',
        },
        reasonFallback: "Aucun motif précisé par l'organisateur.",
        screenTitle: 'Détail notification',
        statusDeclined: 'Demande refusée',
        subtitle: 'Ta demande de participation a été refusée.',
        title: 'Demande refusée',
        unknownDate: 'Date indisponible',
      },
    },
    labels: {
      participationDeclined: 'Refusee',
    },
  },
  onboarding: {
    optionalStepHint: 'Cette étape n\'est pas obligatoire, mais elle reste utile pour améliorer ton expérience FoundClub.',
  },
  onboardingAffiliation: {
    a11y: {
      askForHelpHint: 'Envoie une demande aux superadmins FoundClub.',
      backHint: 'Revient à l\'étape précédente de l\'onboarding.',
      cardHintClub: 'Ouvre la fiche du club pour confirmer l\'affiliation.',
      cardHintClubSelect: 'Sélectionne ce club pour voir ses équipes.',
      cardHintTeam: "Ouvre la fiche de l'équipe pour demander à rejoindre.",
      cardLabelClub: 'Ouvrir la fiche du club {{name}}',
      cardLabelClubSelect: 'Sélectionner le club {{name}}',
      cardLabelTeam: "Ouvrir la fiche de l'équipe {{name}}",
      continueLaterHint: 'Passe cette étape et continue l\'onboarding.',
      filterHint: 'Ouvre les filtres de recherche de club.',
      filterLabel: 'Ouvrir les filtres',
      modalCancelHint: 'Ferme la fenêtre de demande.',
      modalCommentHint: 'Ajoute des informations utiles à la recherche.',
      modalNameHintClub: 'Renseigne le nom du club que tu recherches.',
      modalNameHintTeam: "Renseigne le nom de l'équipe que tu recherches.",
      modalSendHint: 'Envoie ta demande aux superadmins.',
      nearbyHint: 'Autorise la localisation pour classer les clubs par distance.',
      notFoundHintClub: 'Envoie une demande d\'aide si ton club est introuvable.',
      notFoundHintTeam: 'Envoie une demande d\'aide si ton équipe est introuvable.',
      retryHint: 'Relance la recherche de résultats.',
      searchInputHintClub: 'Saisis le nom du club pour filtrer la liste.',
      searchInputHintTeam: "Saisis le nom de l'équipe pour filtrer la liste.",
      searchInputLabelClub: 'Champ nom du club',
      searchInputLabelTeam: "Champ nom de l'équipe",
      sportChipHint: 'Filtre la liste sur ton sport.',
      tooltipNextHint: 'Passe à l étape suivante du tutoriel.',
      tooltipPreviousHint: 'Revient à l\'étape précédente du tutoriel.',
      tooltipSkipHint: 'Quitte le tutoriel guide.',
    },
    actions: {
      askForHelp: 'Besoin d\'aide ? Nous contacter',
      changeClub: 'Changer de club',
      continueLater: 'Continuer plus tard',
      notFoundClub: 'Je ne trouve pas mon club',
      notFoundTeam: 'Je ne trouve pas mon équipe',
      skip: 'Passer',
    },
    addClub: {
      action: 'Ajouter',
      subtitle: 'Ajoute-le en 2 minutes, on s\'occupe du reste.',
      title: 'Ton club n\'est pas là ?',
    },
    addTeam: {
      subtitle: 'Signale-la, on s\'occupe du reste.',
      title: 'Ton équipe n\'est pas là ?',
    },
    chips: {
      nearby: 'Autour de moi',
    },
    common: {
      roleTargetClub: 'club',
      roleTargetTeam: 'équipe',
    },
    feedback: {
      missingInfoMessageClub: 'Renseigne le nom du club recherché.',
      missingInfoMessageTeam: "Renseigne le nom de l'équipe recherchée.",
      missingInfoTitle: 'Information manquante',
      requestError: 'Impossible d\'envoyer ta demande.',
      requestSentDescription: 'Ta demande a été envoyée aux superadmins. Tu recevras une notification.',
      requestSentTitle: 'Demande envoyée',
    },
    filtersTutorial: {
      activityDescription: 'Sélectionne un sport pour filtrer uniquement les clubs correspondants.',
      activityTitle: 'Sport',
      applyDescription: 'Applique tes filtres pour revenir à la liste avec des résultats plus précis.',
      applyTitle: 'Appliquer',
      cityDescription: 'Choisis une ville ou une adresse pour centrer la recherche des clubs.',
      cityTitle: 'Localisation',
      radiusDescription: 'Ajuste le rayon en kilomêtres autour de ta localisation.',
      radiusTitle: 'Rayon de recherche',
    },
    modal: {
      commentLabel: 'Commentaire (optionnel)',
      commentPlaceholder: 'Ex: ville, catégorie, orthographe probable...',
      description: 'Donne un maximum de contexte pour aider les superadmins.',
      nameLabelClub: 'Nom du club recherché *',
      nameLabelTeam: "Nom de l'équipe recherchée *",
      namePlaceholderClub: 'Ex: Olympique ...',
      namePlaceholderTeam: 'Ex: U17 Nationaux ...',
      send: 'Envoyer',
      titleClub: 'Je ne trouve pas mon club',
      titleTeam: 'Je ne trouve pas mon équipe',
    },
    results: {
      openClubFallback: 'Voir fiche club',
      openTeamFallback: 'Voir fiche équipe',
    },
    search: {
      filtersActive_one: '{{count}} filtre actif',
      filtersActive_other: '{{count}} filtres actifs',
      placeholderClub: 'Nom du club ou ville',
      placeholderTeam: "Nom de l'équipe",
    },
    sections: {
      nearby: 'PRÈS DE CHEZ TOI',
      results: 'RÉSULTATS',
      suggestions: 'SUGGESTIONS',
      teams: 'ÉQUIPES',
    },
    selectedClubLabel: 'Club sélectionné',
    states: {
      emptyWithoutQueryClub: 'Aucun club à afficher pour le moment.',
      emptyWithoutQueryTeam: 'Aucune équipe à afficher pour le moment.',
      emptyWithQueryClub: 'Aucun club trouvé pour "{{query}}".',
      emptyWithQueryTeam: 'Aucune équipe trouvée pour "{{query}}".',
      errorSubtitle: 'Vérifie ta connexion puis réessaie.',
      errorTitle: 'Impossible de charger les résultats',
      loading: 'Recherche en cours...',
      retry: 'Réessayer',
    },
    subtitleClub: 'On personnalise ton accueil, ton planning et tes annonces autour de ton club.',
    subtitleClubSelection: 'Recherche puis sélectionne ton club pour voir ses équipes.',
    subtitleClubStaff: 'Retrouve ton club pour le gérer sur FoundClub.',
    subtitleTeam: 'Recherche ton équipe puis ouvre sa fiche pour envoyer ta demande.',
    subtitleTeamFromClub: 'Recherche ton équipe dans le club sélectionné puis ouvre sa fiche pour envoyer ta demande.',
    titleClub: 'Trouve ton club',
    titleTeam: 'Trouve ton équipe',
    tutorial: {
      stepFiltersDescription: 'On va maintenant ouvrir les filtres pour affiner ta recherche.',
      stepFiltersTitle: 'Ouvrir les filtres',
      stepNotFoundDescriptionClub: 'Si tu ne trouves pas ton club, envoie une demande guidée aux superadmins.',
      stepNotFoundDescriptionTeam: 'Si tu ne trouves pas ton équipe, envoie une demande guidée aux superadmins.',
      stepNotFoundTitleClub: 'Je ne trouve pas mon club',
      stepNotFoundTitleTeam: 'Je ne trouve pas mon équipe',
      stepResultDescriptionClub: "Ouvre la fiche du club pour utiliser le bouton C'est mon club.",
      stepResultDescriptionClubSelect: 'Sélectionne ton club pour afficher ensuite ses équipes.',
      stepResultDescriptionTeam: "Ouvre la fiche de l'équipe pour envoyer ta demande de rejoindre.",
      stepResultTitleClub: 'Sélectionner un club',
      stepResultTitleTeam: 'Sélectionner une équipe',
      stepSearchDescription: 'Tape le nom du {{roleTargetLabel}} pour filtrer la liste.',
      stepSearchTitle: 'Recherche',
    },
  },
  otp: {
    actions: {
      confirm: 'Confirmer',
    },
    fields: {
      code: {
        label: 'Code de confirmation',
        placeholder: '123456',
      },
    },
    subtitle: 'Entre le code reçu par SMS.',
    title: 'Confirme ton numéro',
  },
  permissions: {
    camera: {
      denied: 'Permission caméra refusée',
      message: 'L\'application a besoin d\'accéder à ta caméra pour prendre une photo.',
      title: 'Permission Caméra',
    },
  },
  planning: {
    fullscreen: {
      club: 'Planning club',
      clubShared: 'Planning partagé',
      cm: 'Planning omnisport',
      personal: 'Mon planning',
    },
  },
  playerCard: {
    editCardCta: 'Modifier mes infos',
    generating: 'Génération de l\'image…',
    rarityHint: 'Complète ton profil et ton parcours pour monter en rareté.',
    saveCta: 'Enregistrer l\'image',
    savedDescription: 'Ta carte a été ajoutée aux photos de ton téléphone (album FoundClub).',
    savedTitle: 'Image enregistrée',
    saveError: 'Impossible d\'enregistrer l\'image pour le moment.',
    saveErrorPermission: 'Autorise l\'accès aux photos pour enregistrer ta carte.',
    screenSubtitle: 'Partage ta carte, gagne en visibilité et fais-toi détecter.',
    screenTitle: 'Ma carte de collection',
    shareCta: 'Partager ma carte',
    // Carte (contenu)
    coachChip: 'COACH',
    field: {
      age: 'Âge',
      city: 'Ville',
      nationality: 'Nationalité',
      position: 'Poste',
      role: 'Rôle',
      sport: 'Sport',
      yearsUnit: 'ans',
    },
    historyEmpty: 'Parcours à compléter',
    historyTitle: 'PARCOURS',
    lockedLabel: 'Aperçu — accord parental requis',
    noClub: 'SANS CLUB',
    nowShort: 'Auj.',
    previewChip: 'APERÇU',
    rarity: {
      common: 'COMMUNE',
      epic: 'ÉPIQUE',
      legendary: 'LÉGENDAIRE',
      rare: 'RARE',
    },
    rarityA11y: 'Rareté',
    tagAvailable: 'DISPONIBLE',
    tagAvailableA11y: 'Disponible',
    // Formats d'export
    formatFeed: 'Feed',
    formatStory: 'Story',
    // Reveal fin d'onboarding
    revealContinue: 'Plus tard, continuer',
    revealEyebrow: 'Bienvenue',
    revealTitle: 'Voici ta carte de collection',
    // Garde-fou mineurs
    minorGuardDescription: 'Ce profil concerne un mineur. La publication de la carte nécessite l\'accord d\'un parent ou représentant légal.',
    minorGuardTitle: 'Accord parental requis',
    requestConsent: 'Demander l\'accord parental',
    // Partage (message natif)
    sentDescription: 'Ta carte a bien été partagée. Ouvrir la conversation ?',
    sentTitle: 'Carte envoyée',
    shareAvailableSuffix: 'Je cherche un club !',
    shareError: 'Impossible de générer l\'image pour le moment.',
    shareFallbackName: 'Ma carte FoundClub',
    shareIntro: 'Voici ma carte FoundClub.',
    shareLinkLabel: 'Retrouve-moi sur FoundClub',
    shareOpenWith: 'Ouvrir ta carte avec…',
    sharePermissionError: 'FoundClub n\'a pas le droit d\'enregistrer dans ton téléphone. '
      + 'Autorise-le dans les réglages, puis réessaie.',
    shareSavedGallery: 'Ta carte est enregistrée dans tes photos (album FoundClub). '
      + 'Choisis maintenant où la publier.',
    shareSaveError: 'L\'enregistrement a échoué. '
      + 'Il reste peut-être trop peu de place sur ton téléphone.',
    uploadError: 'L\'envoi de l\'image a échoué.',
    // ShareCardModal
    shareChatA11yHint: 'Envoyer ma carte dans cette conversation',
    shareChatCardHint: 'Envoi direct FoundClub',
    shareChatType: {
      club: 'Club',
      group: 'Groupe',
      multisport: 'Omnisport',
      team: 'Équipe',
      whisper: 'Privé',
    },
    shareCloseA11y: 'Fermer le partage',
    shareEyebrow: 'Diffusion',
    shareGenerating: 'Génération de l\'image…',
    shareInChat: 'Envoyer dans une conversation',
    shareInChatHint: 'Ta carte est envoyée en image.',
    shareNoChat: 'Aucune conversation disponible.',
    shareNoChatHint: 'Rejoins ou crée une conversation pour envoyer ta carte ici.',
    shareOutsideHint: 'SMS, mail ou « Enregistrer l\'image »',
    shareOutsideLabel: 'Lien externe',
    shareSubtitle: 'Choisis un canal pour diffuser ta carte de collection.',
    shareTitle: 'Partager ma carte',
    shareViaOther: 'Partager via… (SMS, Mail, Enregistrer)',
    // Carte équipe
    recruitTitle: 'RECRUTE · SÉANCES D\'ESSAI',
    rosterEmpty: 'Effectif à compléter',
    rosterField: 'Effectif',
    teamChip: 'ÉQUIPE',
  },
  profile: {
    accountSwitcher: {
      active: 'Actif',
      addAccount: 'Ajouter un compte',
      close: 'Fermer',
      singleAccountHint: 'Ce compte est le seul connecté sur cet appareil. Tu peux en ajouter un autre ou te déconnecter.',
      switching: 'Changement…',
      title: 'Changer de compte',
    },
    actions: {
      addAccount: 'Ajouter un compte',
      adminDashboardClassic: 'Dashboard admin classique',
      confirmDeleteAvatar: 'Es-tu sûr de vouloir supprimer cette image ?',
      deleteAccount: 'Supprimer mon compte',
      edit: 'Modifier mon profil',
      findClub: 'Trouver mon club',
      findTeam: 'Trouver une équipe',
      ignore: 'Ignorer',
      logout: 'Déconnexion',
      manageAlerts: 'Gérer mes alertes',
      manageClub: 'Gérer mon club',
      manageClubJoinRequests: 'Gérer les demandes d\'affiliation au club',
      manageEvents: 'Gérer mes événements',
      manageRequests: 'Gérer mes demandes',
      manageTeamJoinRequests: 'Gérer les demandes d\'adhésion aux équipes',
      manageTeams: 'Gérer mes équipes',
      myTeams: 'Mes équipes',
      save: 'Continuer',
      superAdminLeagueDashboard: 'Dashboard League',
      switchAccount: 'Changer de compte',
      view: 'Voir mon profil',
    },
    alerts: {
      deleteAlert: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        // Lot L28 : le serveur retire desormais les inscriptions a venir et
        // previent le staff. Cette phrase l annonce AVANT la confirmation.
        consequences: 'Tes inscriptions aux événements à venir seront retirées et tes entraîneurs'
          + ' en seront informés. Ton historique passé est conservé. Cette action est définitive.',
        subtitle: 'Pour demander la suppression de ton compte merci de remplir le formulaire de contact'
          + ' suivant en précisant ta demande.',
        title: 'Supprimer ton compte ?',
      },
      maxAccounts: {
        message: 'Tu ne peux pas connecter plus de {{count}} comptes sur cet appareil.',
        title: 'Limite atteinte',
      },
    },
    fields: {
      birthdate: {
        label: 'Date de naissance',
        placeholder: 'JJ/MM/AAAA',
      },
      firstname: {
        label: 'Prénom',
        placeholder: 'Luc',
      },
      height: {
        label: 'Taille (m)',
        placeholder: '1,80',
      },
      jerseyNumber: {
        label: 'Numéro de maillot',
        placeholder: 'Ex. 10 (vide = automatique)',
      },
      lastname: {
        label: 'Nom',
        placeholder: 'Harne',
      },
      nationality: {
        label: 'Nationalité',
        placeholder: 'Ex. Française, FRA…',
      },
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '+33612345678',
      },
      position: {
        label: 'Poste',
        placeholder: 'Ailier',
      },
      section: {
        label: 'Section',
        placeholder: 'Sélectionner une section',
      },
      sections: {
        female: 'Féminine',
        male: 'Masculine',
      },
      types: {
        coach: 'Entraîneur·e',
        player: 'Joueur·se',
        president: 'Dirigeant·e',
      },
      weight: {
        label: 'Poids (kg)',
        placeholder: '80',
      },
    },
    identity: {
      roles: {
        coach: 'Entraîneur',
        new: 'Membre',
        player: 'Joueur',
        president: 'Dirigeant',
        superAdmin: 'Administrateur',
      },
      roleWithClub: '{{role}} · {{club}}',
    },
    sections: {
      account: 'Compte',
      administration: 'Administration',
      profileActivity: 'Profil & activité',
    },
    // L33 — le parcours Abonnement est en trois ecrans : le hub (gerer), le
    // carrousel (choisir) et la matrice (comparer). Ces cles nomment les
    // rangees du hub et les entetes natifs des deux ecrans pousses.
    subscription: {
      actions: {
        changeOffer: 'Changer d\'offre',
        compareOffers: 'Comparer les offres',
        restore: 'Restaurer mes achats',
        viewClub: 'Voir mon club',
        viewClubHint: 'Demandes · certification',
        viewOffers: 'Voir les offres',
      },
      compareHeaderTitle: 'Comparer',
      cta: 'Voir le détail des offres',
      headerTitle: 'Abonnement',
      offersHeaderTitle: 'Changer d\'offre',
      quota: {
        labels: {
          EVENT_PUBLISH: 'Événements',
          FREE_TEAM: 'Équipes',
          MATCH_PUBLISH: 'Matchs',
          RECRUITMENT_AD_PUBLISH: 'Recrutement',
        },
        remaining_one: '{{count}} offert restant',
        remaining_other: '{{count}} offerts restants',
        used: 'offert utilisé',
      },
      states: {
        club: 'Club · actif',
        clubUnverified: 'Club · actif',
        free: 'Gratuit',
        team: 'Équipe',
      },
      status: {
        club: 'Les droits Club sont actifs sur tout ton club.',
        clubUnverified: 'Tes droits Club sont actifs. Ton club est en cours de certification par la plateforme.',
        free: 'Tu utilises l\'offre gratuite FoundClub.',
        team: 'Tes équipes couvertes profitent des droits Équipe.',
      },
      title: 'Mon abonnement',
    },
    subtitles: {
      avatar: "Ajoute une photo de profil pour que l'on puisse te reconnaître facilement.",
      birthdate: 'Renseigne ta date de naissance.',
      name: 'Renseigne ton nom et prénom.',
      section: 'Renseigne la catégorie de sexe dans laquelle tu évolues',
      type: 'Renseigne ta fonction principale.',
    },
    titles: {
      avatar: 'Une photo de profil ?',
      birthdate: 'Quelle est ta date de naissance ?',
      edit: 'Modifier mes informations',
      name: "Comment t'appelles-tu ?",
      profile: 'Mon compte',
      section: 'Dans quelle section évolues-tu ?',
      type: 'Quel est ton statut ?',
    },
    updateError: 'Impossible d\'enregistrer ton profil pour le moment. Vérifie ta connexion et réessaie.',
  },
  register: {
    actions: {
      register: 'Continuer',
    },
    fields: {
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '0612345678',
      },
    },
    subtitle: 'Renseigne ton numéro de téléphone.',
    title: 'Crée ton compte',
  },
  requestsHub: {
    actionError: 'Impossible de traiter la demande.',
    assignNow: 'Assigner maintenant',
    clubAssignedMessage: "{{name}} a été ajouté au club. Veux-tu l'assigner à une équipe maintenant ?",
    clubAssignedTitle: 'Entraîneur ajouté',
    clubClaimAssignedMessage: '{{name}} a été ajouté comme dirigeant du club.',
    clubClaimAssignedTitle: 'Dirigeant ajouté',
    empty: 'Aucune demande en attente',
    filters: {
      all: 'Toutes',
      club: 'Club',
      event: 'Événement',
      featured: 'À la une',
      team: 'Équipe',
    },
    forbidden: 'Cet onglet est réservé aux entraîneur·e·s et aux dirigeant·e·s.',
    migratedBannerAction: "Ouvrir l'onglet Demandes",
    migratedBannerTitle: 'Ce flux a été migré vers Demandes.',
    partialError: 'Source indisponible',
    rejectEventMessage: 'L\'événement sera annulé.',
    rejectEventTitle: 'Refuser la demande ?',
    rejectFeaturedMessage: 'Le demandeur sera notifié du refus.',
    rejectFeaturedTitle: 'Refuser la demande ?',
    title: 'Demandes',
    types: {
      club: 'Club',
      event: 'Événement',
      featured: 'À la une',
      team: 'Équipe',
      unknown: 'Demande',
    },
  },
  // L16 — chaque bouton dit CE QU'ON OBTIENT (un fichier, un format), jamais un
  // verbe abstrait. `share` porte desormais le geste principal : envoyer l'AFFICHE.
  showcase: {
    customize: 'Personnaliser le texte',
    customizeHint: 'Modifie les textes avant de télécharger. Laisse vide pour garder le texte proposé.',
    downloadError: 'Le téléchargement a échoué. Vérifie ta connexion et réessaie.',
    error: 'Le visuel n\'a pas pu être généré.',
    fieldEquipe: 'Équipe',
    fieldLieu: 'Lieu',
    fieldNiveau: 'Niveau',
    fieldQrLabel: 'Texte sous le QR code',
    fieldTitre: 'Titre',
    fieldTitreAccent: 'Accroche',
    generating: 'Génération du visuel…',
    later: 'Plus tard',
    // Android : la feuille de partage de React Native jette le fichier (cf. L20).
    // Le geste devient « enregistrer, puis ouvrir avec » — les libellés le disent.
    openWith: 'Ouvrir l’affiche avec…',
    placeholderQrLabel: 'Scanne pour participer',
    placeholderQrLabelDecouverte: 'Scanne pour essayer',
    placeholderTitre: 'Viens montrer',
    placeholderTitreAccent: 'ce que tu vaux.',
    placeholderTitreAccentDecouverte: 'tu vas aimer.',
    placeholderTitreDecouverte: 'Viens essayer,',
    poster: 'Affiche A4 à imprimer',
    posterHint: 'Fichier PDF, prêt pour l’imprimante du club.',
    posterHintSave: 'Fichier PDF enregistré dans tes téléchargements, '
      + 'prêt pour l’imprimante du club.',
    reset: 'Réinitialiser',
    retry: 'Réessayer',
    save: 'Enregistrer l’affiche',
    savedDownloads: 'C’est enregistré dans tes téléchargements.',
    savedGallery: 'C’est enregistré dans ta galerie photo.',
    saveError: 'L’enregistrement a échoué. '
      + 'Il reste peut-être trop peu de place sur ton téléphone.',
    saveHint: 'Elle part dans ta galerie photo, telle que tu la vois. '
      + 'Tu choisis ensuite l’application qui l’ouvre.',
    savePermissionError: 'FoundClub n’a pas le droit d’enregistrer dans ton téléphone. '
      + 'Autorise-le dans les réglages, puis réessaie.',
    sendInChat: 'Envoyer dans une conversation',
    sendInChatHint: 'Directement dans une discussion FoundClub.',
    share: 'Envoyer l’affiche',
    shareHint: 'L’image part telle que tu la vois. Dans la fenêtre de partage, tu peux aussi l’enregistrer dans ton téléphone.',
    shareIntro: 'Viens participer à notre détection / séance d’essai !',
    shareLabel: 'Voir l’événement',
    story: 'Version story 9:16',
    storyHint: 'Image verticale plein écran, pour Instagram, WhatsApp ou Snap.',
    storyHintSave: 'Image verticale plein écran, enregistrée dans ta galerie, '
      + 'pour Instagram, WhatsApp ou Snap.',
    subtitle: 'Fais-le voir. Plus il est vu, plus tu remplis.',
    title: 'Ton événement est en ligne',
    variantHint: 'Choisir le style {{label}}',
  },
  squadDetails: {
    actions: {
      deleteTeam: 'Supprimer la squad',
      deleteTeamError: 'Impossible de supprimer la squad.',
      edit: 'Modifier',
      editTeam: 'Modifier la squad',
      menuDescription: 'Choisis une action.',
      menuTitle: 'Actions squad',
      openRequests: 'Voir les demandes',
      requests: 'Demandes',
      unavailableTitle: 'Action non disponible',
    },
    defaultName: 'Squad',
    delete: {
      confirmationWithName: 'Es-tu sur de vouloir supprimer la squad "{{teamName}}" ? Cette action est irreversible.',
      title: 'Supprimer la squad',
    },
    join: {
      pending: 'Demande en attente...',
      request: 'Demander à rejoindre',
    },
    labels: {
      locationUnknown: 'Localisation non renseignée',
    },
    roster: {
      captain: 'Capitaine',
      player: 'Joueur',
      title: 'Effectif',
    },
    slots: {
      added: 'Créneau ajouté',
      addTitle: 'Ajouter un créneau',
      deleteConfirm: 'Veux-tu vraiment supprimer ce créneau ?',
      deleted: 'Créneau supprimé',
      deleteError: 'Impossible de supprimer le créneau',
      editTitle: 'Modifier le créneau',
      joinHint: 'Rejoins la squad pour participer aux créneaux.',
      multipleAdded: '{{count}} créneaux ajoutes',
      saveError: 'Impossible de sauvegarder le créneau',
      statusError: 'Impossible de modifier ton statut.',
      updated: 'Créneau modifié',
    },
  },
  // L11 — écran d'après-achat : la liste reflète la matrice serveur
  // (subscription-permission.ts) via getSubscriptionUnlockedCapabilities,
  // ne pas y ajouter une capacité que le serveur ne débloque pas.
  subscriptionSuccess: {
    firstActions: {
      club: 'Gérer mon club',
      composition: 'Préparer ma compo',
      events: 'Publier un événement ou un match',
      recruitment: 'Publier une annonce de recrutement',
    },
    firstActionTitle: 'Que veux-tu faire en premier pour profiter de ton abonnement ?',
    unlockedTitle: 'Ton offre débloque :',
    unlocks: {
      clubRoles: 'Gestion des entraîneurs et dirigeants',
      clubTeams: 'Toutes les équipes du club couvertes',
      composition: 'Composition et convocations',
      dues: 'Campagnes de cotisations',
      events: 'Événements et matchs illimités',
      facilities: 'Installations du club',
      recruitment: 'Annonces de recrutement illimitées',
      sponsors: 'Sponsors du club',
      teams: 'Équipes supplémentaires',
    },
    // Tour 7a — version courte des mêmes libellés pour la grille à 2 colonnes.
    // Raccourci d'AFFICHAGE seulement : la liste vient toujours de
    // getSubscriptionUnlockedCapabilities. Une capacité absente d'ici retombe
    // sur son libellé long ci-dessus (`teams` est dans ce cas), elle ne
    // disparaît jamais de l'écran.
    unlocksShort: {
      clubRoles: 'Rôles du club',
      clubTeams: 'Toutes les équipes du club',
      composition: 'Compo & convocations',
      dues: 'Cotisations',
      events: 'Événements illimités',
      facilities: 'Installations',
      recruitment: 'Annonces illimitées',
      sponsors: 'Sponsors',
    },
  },
  superAdminContentManager: {
    actions: {
      addId: 'Ajouter ID',
      apply: 'Appliquer',
      cancel: 'Annuler',
      close: 'Fermer',
      copyId: 'Copier ID',
      createEntry: 'Créer une entrée',
      delete: 'Supprimer',
      deleteEntry: 'Supprimer l\'entrée',
      deleting: 'Suppression...',
      edit: 'Modifier',
      exitSelection: 'Quitter sélection',
      hide: 'Masquer',
      more: 'Plus d actions',
      multiSelect: 'Sélection multiple',
      next: 'Suivant',
      previous: 'Précédent',
      processing: 'Traitement...',
      publish: 'Publier',
      refresh: 'Rafraichir',
      remove: 'Retirer',
      save: 'Enregistrer',
      saving: 'Enregistrement...',
      search: 'Chercher',
      selectAll: 'Tout sélectionner',
      show: 'Afficher',
      unpublish: 'Dépublier',
      unselectAll: 'Tout desélectionner',
    },
    alerts: {
      bulkFailedTitle: 'Action de masse impossible',
      copyFailedTitle: 'Copié impossible',
      deleteFailedTitle: 'Suppression impossible',
      emptySelectionMessage: 'Sélectionne au moins une entrée.',
      emptySelectionTitle: 'Sélection vide',
      filePickerUnavailable: 'Le sélecteur de fichiers est indisponible sur cette build.',
      fileResolveFailed: 'Impossible de récupérer ce fichier.',
      fileSelectFailed: 'Impossible de sélectionner ce fichier.',
      openCameraFailed: 'Impossible d\'ouvrir la camera.',
      openGalleryFailed: 'Impossible d\'ouvrir la galerie.',
      reasonRequiredMessage: 'Minimum 3 caractères.',
      reasonRequiredTitle: 'Raison requise',
      relationSearchFailedTitle: 'Recherche impossible',
      relationSearchMinChars: 'Merci de saisir au moins 1 caractère.',
      relationSearchTitle: 'Recherche relation',
      saveFailedTitle: 'Enregistrement impossible',
      takePhotoFailed: 'Impossible de prendre une photo.',
      uploadFailedTitle: 'Upload impossible',
      uploadNoFile: 'Aucun fichier n\'a été reçu par le serveur.',
      validationTitle: 'Validation',
    },
    bulkModal: {
      description: 'entrée(s) seront traitées. Une raison d\'audit est obligatoire.',
      reasonPlaceholder: 'Raison obligatoire (minimum 3 caractères)',
      titleSuffix: 'les entrées',
    },
    common: {
      genericError: 'Une erreur est survenue.',
      id: 'ID',
      reason: 'Raison',
      unknown: 'inconnue',
    },
    deleteModal: {
      description: 'Action definitive. Une raison d\'audit est obligatoire.',
      reasonPlaceholder: 'Raison obligatoire (minimum 3 caractères)',
      title: 'Supprimer l\'entrée',
    },
    detail: {
      createdAt: 'Crée le',
      noAudit: 'Aucun log disponible.',
      noKeyFields: 'Aucun champ clé détecté.',
      noRelations: 'Aucune relation ou media exploitable.',
      rawJsonCollapsed: 'Vue avancée repliée pour garder l\'écran lisible.',
      sections: {
        audit: 'Audit récent',
        keyFields: 'Champs clés',
        rawJson: 'JSON complet',
        relationsMedia: 'Relations / Médias',
        summary: 'Résumé',
      },
      shortId: 'ID court',
      updatedAt: 'Modifié le',
    },
    empty: {
      explorerDescription: 'Ajuste la recherche ou vérifie les permissions Super Admin.',
      explorerTitle: 'Aucun content-type trouvé',
      listDescription: 'Aucune donnée ne correspond aux filtres actifs.',
      listTitle: 'Aucune entrée',
    },
    explorer: {
      collectionType: 'collection type',
      draftPublish: 'draft + publish',
      results: 'Résultats',
      searchPlaceholder: 'Rechercher un content-type',
      singleType: 'single type',
      subtitle: 'Parcours tous les content-types API Strapi.',
      title: 'Explorer Content Manager',
      types: 'Types',
    },
    feedback: {
      bulkApplied: 'action(s) appliquée(s)',
      clipboardUnavailable: 'Copié indisponible sur cette build',
      entryDeleted: 'Entrée supprimée',
      idCopied: 'ID copié',
    },
    form: {
      allowedTypes: 'Types autorisés',
      documentIdToAdd: 'documentId à ajouter',
      editableFields: 'Champs éditables',
      mediaMultipleAllowed: 'Média multiple autorisé',
      mediaSingle: 'Média unique',
      no: 'Non',
      noEditableFields: 'Aucun champ détecté',
      noMediaSelected: 'Aucun média sélectionné.',
      none: 'Aucun',
      rawFallbackHint: 'Champs non totalement supportés en mode guide:',
      rawFallbackTitle: 'Fallback JSON avancé',
      reasonLabel: 'Raison (optionnelle sauf règles sensibles)',
      reasonPlaceholder: 'Ajouter un contexte d\'audit',
      relationDocumentId: 'documentId relation',
      relationTo: 'Relation vers',
      searchRelationPlaceholder: 'Rechercher une relation...',
      sections: {
        advanced: 'Avancé',
        advancedHint: 'JSON, rich text et champs complexes.',
        booleanEnum: 'Booléens / Enums',
        booleanEnumHint: 'Valeurs à choix rapide.',
        media: 'Médias',
        mediaHint: 'Ajoute images ou fichiers.',
        relations: 'Relations',
        relationsHint: 'Associe des entrées liées.',
        scalars: 'Scalaires',
        scalarsHint: 'Texte, nombres et dates.',
      },
      titleCreate: 'Créer une entrée',
      titleEdit: 'Modifier une entrée',
      type: 'Type',
      uploading: 'Upload en cours...',
      yes: 'Oui',
    },
    list: {
      page: 'Page',
      searchPlaceholder: 'Rechercher une entrée',
      selectedEntries: 'entrée(s) sélectionnée(s)',
      total: 'Total',
      updatedPrefix: 'Maj:',
    },
    media: {
      camera: 'Camera',
      file: 'Fichier',
      gallery: 'Galerie',
    },
  },

  /* eslint-disable perfectionist/sort-objects */
  reservationFilters: {
    fields: {
      maxPrice: {
        label: 'Prix maximum par personne',
        placeholder: 'Ex: 20',
      },
      startTime: {
        label: '? partir de',
        placeholder: 'Heure de début',
      },
    },
  },

  reservation: {
    actions: {
      cancelRequest: 'Annuler la demande',
      participate: 'Réserver',
      requestFeatured: 'Demander la mise à la une',
    },
    card: {
      missingPlayers: 'Il manque {{count}} joueur',
      missingPlayers_plural: 'Il manque {{count}} joueurs',
      pricePerPerson: '{{price}}€/pers',
    },
    featured: 'À la une :',
    featuredRequest: {
      approved: 'Approuvée',
      cancelError: 'Erreur lors de l\'annulation',
      cancelSuccess: 'Demande annulée',
      pending: 'Demande en attente',
      rejected: 'Refusée',
      requestError: 'Erreur lors de l\'envoi de la demande',
      requestSuccess: 'Demande envoyée avec succès',
      title: 'Mise en avant',
    },
    filters: {
      detections: 'Détections',
      openTrainings: 'Entraînements ouverts',
      tournaments: 'Tournois',
    },
    mode: {
      fullGroup: 'J\'ai déjà mon groupe complet',
      invalidPlayerCount: 'Merci de entrer un nombre validé',
      playerCount: 'Combien de joueurs as-tu ?',
      recruiting: 'Il me manque des joueurs',
      selectMode: 'Merci de sélectionner un mode',
      title: 'Comment veux-tu participer ?',
      tooManyPlayers: 'Le nombre doit être inférieur au total',
    },
    noData: 'Aucune réservation trouvée.',
    title: 'Événements :',
  },
  searchTypeSwitcher: {
    amicaux: 'Matchs amicaux',
    recruitment: 'Recrutement',
  },
  teamSlotList: {
    add: '+ Ajouter',
    checkInSoon: 'Check-in bientôt disponible.',
    comingSoon: 'Bientôt disponible',
    confirmedPlayers: 'Joueurs confirmés',
    cta: {
      confirmPresence: 'Je suis present',
      removePresence: 'Retirer ma présence',
    },
    empty: 'Aucun créneau défini.',
    joinHint: 'Rejoindre la squad pour participer.',
    memberHelp: 'Touche pour confirmer ta présence.',
    status: {
      complete: 'Complet',
      confirmed: '{{count}}/{{required}} confirmés',
      remaining: 'Encore {{count}}',
    },
    title: 'Disponibilités (créneaux)',
  },
  teamDetails: {
    actions: {
      contactTeam: 'Contacter',
      defaultComposition: 'Composition type',
      edit: 'Modifier',
      join: "C'est mon équipe !",
      leave: "Quitter l'équipe",
      openPanel: 'Ouvrir',
      panelTitle: "Actions d'équipe",
      stats: 'Statistiques',
      teamChat: 'Équipe',
    },
    alerts: {
      deleteTrainer: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer du club',
        },
        description: 'Le compte ne sera pas supprimé, mais l\'entraîneur·e ne sera plus lié·e au club ni à aucune de ces équipes.'
          + ' Si tu souhaites le retirer seulement de cette équipe merci de passer par le bouton de modification de l\'équipe.',
        title: 'Tu es sur le point de supprimer cet·te entraîneur·e de ton club.',
      },
      invitePlayers: {
        alreadyHaveTheApp: "J'ai déjà l'application",
        downloadOnAndroid: 'Télécharger sur Android',
        downloadOnIOS: 'Télécharger sur iOS',
        message: 'Bonjour !'
          + '\nVotre équipe {{teamName}} de ton club {{clubName}} t\'attend !'
          + "\nTélécharge l'application Found Club pour finaliser la création de ton compte"
          + ' et commencer accéder et participer aux événements de ton équipe.',
        title: 'Tes coéquipiers t\'attendent !',
      },
      joinRequest: {
        actions: {
          ok: 'OK',
        },
        description: 'Ton entraîneur·e va recevoir ta demande et la traiter dès que possible.',
        title: 'Ta demande d\'adhésion a bien été envoyée',
      },
      leave: {
        actions: {
          cancel: 'Annuler',
          confirm: "Quitter l'équipe",
        },
        description: 'Tu es sur le point de quitter l\'équipe. Une fois cette action validée tu ne pourras plus participer aux entraînements et matchs.',
        title: 'Es-tu sûr·e de vouloir quitter cette équipe ?',
      },
    },
    external: {
      prompt: {
        cta: 'Ajouter le classement',
        description: "Tu peux ajouter le lien du classement de ta ligue pour retrouver directement dans l'application ton classement, ton calendrier et tes statistiques.",
        title: 'Ajoute le classement de ta ligue',
      },
    },
    myTitle: 'Mon équipe',
    sections: {
      nextEvents: 'Prochains événements',
      players_one: 'Joueur·se',
      players_other: 'Joueur·se·s',
      trainers_one: 'Entraîneur·e',
      trainers_other: 'Entraîneur·e·s',
    },
    stats: {
      summaryHint: 'Consulte les statistiques détaillées de ton équipe.',
    },
    tabs: {
      calendar: 'Calendrier',
      infos: 'Infos',
      standings: 'Classement',
      stats: 'Stats',
    },
    title: 'Équipe',
  },
  /* eslint-enable perfectionist/sort-objects */
  teamEdit: {
    actions: {
      save: 'Enregistrer',
    },
    fields: {
      activities: {
        label: 'Sports',
        placeholder: 'Sélectionner un sport',
      },
      category: {
        label: 'Catégorie',
        placeholder: 'Sélectionner une catégorie',
      },
      description: {
        label: 'Description',
        placeholder: 'Équipe senior évoluant en championnat régional depuis 2015.',
      },
      level: {
        label: 'Niveau',
        placeholder: 'Sélectionner un niveau',
      },
      name: {
        label: 'Nom de l\'équipe',
        placeholder: 'Les lions de Marseille',
      },
      section: {
        label: 'Section',
        placeholder: 'Sélectionner une section',
      },
      trainers: {
        label: 'Entraîneur·e·s',
        placeholder: 'Sélectionner un·e entraîneur·e',
      },
    },
    title: 'Créer une équipe',
    titleEdit: "Modifier l'équipe",
  },
  teamFilters: {
    actions: {
      apply: 'Appliquer les filtres',
      clear: 'Effacer les filtres',
    },
    fields: {
      activities: {
        label: 'Sports',
        placeholder: 'Sélectionner un sport',
      },
      category: {
        label: 'Catégorie',
        placeholder: 'Sélectionner une catégorie',
      },
      level: {
        label: 'Niveau',
        placeholder: 'Sélectionner un niveau',
      },
      section: {
        label: 'Section',
        placeholder: 'Sélectionner une section',
      },
    },
  },
  teamList: {
    actions: {
      add: 'Ajouter une équipe',
    },
    alerts: {
      maxTeamLimitReached: {
        actions: {
          cancel: 'Abandon',
          contact: 'Contacter Found Club',
        },
        description: 'Tu as atteint le nombre maximum d\'équipes autorisées dans ton club. Merci de contacter Found Club pour débloquer cette limite.',
        title: 'Limite d\'équipes atteinte',
      },
    },
    badges: {
      coach: 'COACH',
      invitation: 'INVITATION',
      pending: 'EN ATTENTE',
      player: 'JOUEUR·SE',
    },
    fields: {
      category: 'Catégorie',
      level: 'Niveau',
      members: 'Membres',
      section: 'Section',
    },
    noData: 'Aucune équipe trouvée.',
    searchPlaceholder: 'Mes équipes',
    stats: {
      members: 'Membres',
      trainers: 'Entraîneur·e·s',
    },
    title: 'Équipes de mon club',
  },
  teamMembershipRequestList: {
    actions: {
      accept: 'Accepter',
      reject: 'Refuser',
    },
    fields: {
      accepted: 'Demande acceptée',
      pending: "{{firstname}} s'est signalé comme joueur·se de l'équipe",
      rejected: 'Demande refusée',
    },
    noData: 'Aucune demande d\'adhésion en attente',
    title: 'Demandes d\'adhésion',
  },
  userDetails: {
    actions: {
      contact: 'Contacter',
      sendMessage: 'Envoyer un message',
    },
    badges: {
      lookingForClub: 'En recherche de club',
    },
    empty: {
      club: 'Aucun club renseigne',
      coachTeams: 'Aucune équipe entraînée',
      playerTeams: 'Aucune équipe joueur',
    },
    fields: {
      address: 'Adresse',
      age: 'Age',
      bestLevel: 'Niveau',
      birthdate: 'Date de naissance',
      birthYear: 'Année de naissance',
      category: 'Catégorie',
      email: 'Email',
      height: 'Taille (m)',
      history: 'Historique sportif',
      phone: 'Téléphone',
      position: 'Poste',
      section: 'Section',
      sport: 'Sport',
      weight: 'Poids (kg)',
    },
    historySummary: {
      count: '{{count}} expérience(s)',
    },
    notSet: 'Non renseigné',
    private: 'Privé',
    sections: {
      personal: 'Infos personnelles',
      sport: 'Profil sportif',
    },
    teamGroups: {
      coach: 'Équipes entraînées',
      player: 'Équipes joueur',
    },
    title: 'Infos profil',
    titles: {
      teams: 'Équipes',
    },
  },
  welcome: {
    actions: {
      go: 'Allons-y !',
    },
    descriptions: {
      club: {
        bold: '- Rejoins un club',
        regular: 'et progresse dans ta carrière sportive.',
      },
      info: {
        bold: '- Reste informé·e',
        regular: ' des nouveautés grâce aux notifications',
      },
      register: {
        bold: '- Inscris-toi',
        regular: ' à des entraînements et détections ouverts',
      },
      search: {
        bold: '- Recherche',
        regular: ' des clubs et des événements près de chez toi.',
      },
    },
    subtitle: 'Prêt·e à trouver ton club et évoluer dans le sport ?',
    title: 'Bienvenu·e sur',
  },
};
