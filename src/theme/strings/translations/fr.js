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
        description: "Le détenteur de ce numéro de téléphone utilise l'application sous le nom de {{firstname}} {{lastname}}. Voulez-vous l'ajouter à votre club ?",
        title: 'Un utilisateur existe déjà avec ce numéro de téléphone.',
      },
      alreadyInClub: {
        description: "Un utilisateur du nom de {{firstname}} {{lastname}} est déjà membre d'un autre club.",
        title: "Impossible d'ajouter cet·te entraîneur·e à l'équipe",
      },
      success: {
        description: "L'entraîneur·e {{trainerName}} a bien été ajouté·e à votre club.",
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
      avatar: "Ajoutez une photo de profil pour que l'on puisse reconnaître l'entraîneur·e facilement.",
      birthdate: "Renseignez la date de naissance de l'entraîneur·e.",
      name: "Renseignez le nom et prénom de l'entraîneur·e.",
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
    UNAUTHORIZED: "Vous n'êtes pas autorisé·e à effectuer cette action.",

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
    TEAM_MEMBER_POLICY_ERROR: 'Pour effectuer cette action, vous devez être membre de l\'équipe.',
    TEAM_PLAYER_REMOVE_ERROR: 'Erreur lors de la suppression du/de la joueur·se de l\'équipe.',
    TEAM_TRAINER_CONNECT_REQUIRED: 'La connexion avec l\'entraîneur·e est requise.',
    TEAM_TRAINER_REMOVE_ERROR: 'Erreur lors de la suppression de l\'entraîneur·e de l\'équipe.',
    TEAM_TRAINER_REQUIRED: 'Au moins un·e entraîneur·e est requis·e pour chaque équipe.',
    TEAM_TRAINER_SET_REQUIRED: 'Une équipe d\'entraîneur·e·s est requise.',

    // Department errors
    DEPARTMENT_IMPORT_ERROR: 'Erreur lors de l\'import des données du département.',
    DEPARTMENT_REQUIRED: 'Le département est requis.',

    // Event errors
    EVENT_ALREADY_MISSING: 'Vous avez déjà répondu absent à cet événement.',
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
    generic: 'Une erreur est survenue. Veuillez réessayer plus tard.',
    HAD_PENDING_MEMBERSHIP_REQUEST_POLICY_ERROR: "Vous avez déjà une demande d'adhésion en attente.",
    MANAGER_TRAINER_CLUB_POLICY_ERROR: 'Violation de la politique concernant les entraîneur·e·s et dirigeant·e·s du club.',
    MANAGER_WITH_CLUB_POLICY_ERROR: 'Violation de la politique concernant les dirigeant·e·s avec club.',
    phoneNumberAlreadyUsed: 'Ce numéro est déjà utilisé par {{firstname}} {{lastname}}.',
    phoneNumberAlreadyUsedWithClub: 'Ce numéro est déjà utilisé par un·e entraîneur·e qui appartient à un club.',
    'Request failed with status code 404': 'La ressource demandée est introuvable.',
    schemaMismatch: 'Un problème est survenu lors de la récupération des informations.'
      + ' Veuillez vérifier que votre application est à jour ou réessayer plus tard.',
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
        description: 'Êtes-vous sûr·e de vouloir continuer ?',
        title: 'Vous êtes sur le point de supprimer le partenaire {{sponsorName}}.',
      },
      deleteTrainer: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        description: 'Le compte ne sera pas supprim\u00e9, mais l\'entra\u00eeneur\u00b7e ne sera plus li\u00e9\u00b7e au club. \u00cates-vous s\u00fbr\u00b7e de vouloir continuer ?',
        title: 'Vous êtes sur le point de supprimer cet·te entraîneur·e.',
      },
      inviteTrainer: {
        message: 'Bonjour {{coachName}} !'
          + '\nVous avez été désigné·e comme entraîneur·e dans le club {{clubName}}.'
          + "\nTéléchargez l'application Found Club pour finaliser la création de votre compte"
          + ' et commencer à gérer vos équipes et vos événements.',
        title: 'Bienvenue sur Found Club !',
      },
      joinClub: {
        actions: {
          ok: 'OK',
        },
        description: 'Votre dirigeant·e va recevoir votre demande et la traiter dès que possible.',
        title: "Votre demande d'adhésion a bien été envoyée",
      },
      leave: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Quitter le club',
        },
        description: "Vous ne serez plus lié·e à ce club ni à ses équipes en tant qu'encadrant·e. Êtes-vous sûr·e de vouloir continuer ?",
        error: 'Impossible de quitter ce club pour le moment.',
        title: 'Quitter le club ?',
      },
      myClub: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Contacter Found Club',
        },
        description: 'Contactez nos équipes pour accéder aux fonctionnalités réservées aux dirigeant·e·s et aux entraîneur·e·s du club.',
        title: 'Vous êtes dirigeant·e de ce club ?',
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
      missingRequester: 'Impossible de traiter cette demande. Demandez au joueur de renvoyer sa demande.',
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
  common: {
    actions: {
      askLater: 'Plus tard',
      cancel: 'Annuler',
      confirm: 'Confirmer',
      continueLater: 'Continuer plus tard',
      create: 'Créer',
      delete: 'Supprimer',
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
      subtitle: 'Partagez du contenu dans cette conversation',
      takePhoto: 'Prendre une photo',
      title: 'Ajouter',
      unavailable: 'Bientot disponible',
    },
    messagePlaceholder: 'Message',
    modals: {
      actions: {
        report: 'Signaler le message',
        seeUser: 'Voir le profil',
      },
      reportSuccess: {
        description: 'Merci de votre retour, nous allons traiter votre demande dans les plus brefs delais.',
        title: 'Votre signalement a bien été envoyé',
      },
    },
    poll: {
      bubble: {
        anonymousBadge: 'Sondage anonyme',
        detailsHint: 'Appuie sur une option pour voter ou modifier ton vote. '
          + 'Appuie a nouveau pour le retirer, ou ouvre la carte pour les details.',
        questionFallback: 'Question',
        selectedBadge: 'Votre vote',
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
        voteHint: 'Selectionnez une option pour voter ou modifier votre vote. '
          + 'Appuyez a nouveau dessus pour retirer votre vote. '
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
        sendUnavailable: 'Connexion messagerie indisponible. Réessayez dans quelques secondes.',
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
        questionPlaceholder: 'Ex: Quel créneau vous convient ?',
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
      hintShort: 'Maintenez appuyé pour enregistrer',
      locked: 'Note vocale verrouillée',
      lockedHint: 'Enregistrement verrouillé. Touchez envoyer ou annuler.',
      permissionDescription: 'Autorisez le micro pour envoyer des notes vocales.',
      permissionTitle: 'Micro requis',
      recording: 'Enregistrement vocal',
      sendErrorDescription: 'Impossible d\'envoyer la note vocale. Réessayez.',
      sendErrorTitle: 'Envoi impossible',
      sending: 'Envoi en cours...',
      stopErrorDescription: 'Impossible de finaliser l\'enregistrement vocal. Réessayez.',
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
      description: "L'équipe Found Club va examiner votre demande et vous recontacter dans les plus brefs délais.",
      title: 'Votre demande de création de club a bien été envoyée',
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
      cancelEvent: 'Annuler l\'évènement',
      cancelResponse: 'Annuler ma participation',
      edit: 'Modifier l\'évènement',
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
    modals: {
      accept: {
        title: 'Êtes-vous sûr·e de vouloir accepter cette demande ?',
      },
      actions: {
        cancel: 'Annuler',
        confirm: 'Confirmer',
        report: 'Signaler',
      },
      cancelEvent: {
        description: 'Une fois annulé, l\'évènement ne sera plus visible par les participant·e·s.',
        title: 'Êtes-vous sûr·e de vouloir annuler cet évènement ?',
      },
      deleteParticipation: {
        actions: {
          cancel: 'Non, retour',
          confirm: 'Oui, annuler',
        },
        description: 'Êtes-vous sûr·e de vouloir annuler votre participation à cet évènement ?',
        title: 'Annuler ma participation',
      },
      editResponse: {
        description: "En modifiant votre réponse vous indiquez votre participation à l'évènement",
        title: 'Modifier ma réponse',
      },
      recurrenceCancel: {
        actions: {
          all: 'Tous les événements',
          future: 'Cet événement et les suivants',
          thisEvent: 'Cet événement',
        },
        description: 'Cet événement fait partie d\'une série. Que voulez-vous annuler ?',
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
        title: 'Êtes-vous sûr·e de vouloir refuser cette demande ?',
      },
      remindSuccess: {
        description: 'Les joueur·se·s vont recevoir une notification pour leur rappeler de répondre à l\'évènement.',
        title: 'Votre relance a bien été envoyée',
      },
      reportEvent: {
        description: 'Merci de nous indiquer la raison pour laquelle vous signalez cet évènement.',
        fields: {
          reason: {
            label: 'Raison du signalement',
            placeholder: 'Cet évènement est inapproprié.',
          },
        },
        title: 'Signaler un évènement',
      },
      reportSuccess: {
        description: 'Merci de votre retour, nous allons traiter votre demande dans les plus brefs délais.',
        title: 'Votre signalement a bien été envoyé',
      },
    },
    participationStatus: {
      missing: 'Absent\u00b7e\u00b7s',
      notAnswered: 'Sans r\u00e9ponse',
      participating: 'Pr\u00e9sent\u00b7e\u00b7s',
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
        label: "Date de l'évènement",
        placeholder: 'JJ/MM/AAAA',
      },
      description: {
        label: 'Description',
        placeholder: 'Évènement de détection ouvert à tous·tes les joueur·se·s.',
      },
      endTime: {
        label: 'Heure de fin',
        placeholder: 'HH:mm',
      },
      invitedTeams: {
        label: 'Inviter des équipes',
        myTeams: 'MES \u00c9QUIPES',
        otherTeams: 'AUTRES \u00c9QUIPES',
        placeholder: 'Sélectionner des équipes',
      },
      isRecurrent: {
        label: 'Évènement récurrent',
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
        label: "Horaire de l'évènement",
        placeholder: 'JJ/MM/AAAA',
      },
      totalPlayers: {
        label: 'Nombre total de joueurs',
        placeholder: 'Ex: 10',
      },
      type: {
        label: 'Type d\'évènement',
        placeholder: 'Sélectionner un type d\'évènement',
      },
      validationMode: {
        label: 'Mode de validation',
        options: {
          auto: 'Automatique',
          manual: 'Manuelle',
        },
      },
    },
    title: 'Créer un évènement',
    titleEdit: 'Modifier l\'évènement',
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
        label: 'Type d\'évènement',
        placeholder: 'Sélectionner un type d\'évènement',
      },
    },
    infos: {
      activity: 'Le sport pratiqué par l\'équipe (football, basketball, handball, etc.).\n\nFiltrer par sport vous permet de ne voir que les événements correspondant à votre discipline.',
      category: 'La catégorie d\'âge de l\'équipe (U7, U9, U11, U13, Senior, etc.).\n\nVous pouvez sélectionner plusieurs catégories pour voir tous les événements correspondants.',
      level: 'Le niveau de jeu de l\'équipe (Départemental, Régional, National, etc.).\n\nCe filtre vous aide à trouver des événements adaptés à votre niveau de pratique.',
      type: 'Le type d\'événement (Entraînement, Match, Détection, Tournoi, etc.).\n\nSélectionnez plusieurs types pour voir différentes activités.',
    },
  },
  eventList: {
    actions: {
      about: '\u00C0 propos',
      absent: 'Absent\u00B7e',
      add: 'Ajouter un \u00E9v\u00E9nement',
      findEvent: 'Trouver un \u00E9v\u00E9nement',
      join: 'Participer',
      present: 'Pr\u00E9sent\u00B7e',
    },
    featured: '\u00C0 la une :',
    info: {
      alreadyJoined: 'Je participe !',
      alreadyMissing: 'Je serai absent\u00B7e',
      pendingRequest: 'Demande en attente',
    },
    joinModal: {
      actions: {
        cancel: 'Annuler',
        confirm: 'Confirmer ma participation',
      },
      checkboxes: {
        conditions: "J'accepte les conditions pour participer \u00E0 l'\u00E9v\u00E9nement",
        responsibility: 'Je d\u00E9clare avoir pris connaissance de la "D\u00E9claration de responsabilit\u00E9 et acceptation des risques"',
      },
      description: 'Je soussign\u00E9(e), participant majeur ou, le cas \u00E9ch\u00E9ant, repr\u00E9sentant l\u00E9gal du participant mineur, reconnais et accepte ce qui suit :'
        + '\n\nR\u00F4le de Found Club : '
        + '\n    - Found Club est une plateforme de mise en relation et n\'organise pas l\'\u00E9v\u00E9nement. Found Club ne fournit aucune assurance li\u00E9e \u00E0 la participation.'
        + '\n\nTrajets aller/retour :'
        + '\n    - Sauf transport express\u00E9ment organis\u00E9 par l\'organisateur, le trajet vers et depuis l\'\u00E9v\u00E9nement est sous ma responsabilit\u00E9 (ou celle du repr\u00E9sentant l\u00E9gal pour un mineur), y compris assurance et choix du mode de transport.'
        + '\n\nAssurance :'
        + '\n    - J\'atteste disposer (ou, pour un mineur, que l\'enfant dispose) d\'une couverture d\'assurance appropri\u00E9e (ex. licence f\u00E9d\u00E9rale en cours et/ou responsabilit\u00E9 civile). J\'ai compris que Found Club n\'assure ni les dommages corporels ni mat\u00E9riels.'
        + '\n\nAptitude m\u00E9dicale :'
        + '\nJ\'atteste \u00EAtre apte \u00E0 la pratique au jour de l\'\u00E9v\u00E9nement (ou que l\'enfant est apte, conform\u00E9ment aux exigences f\u00E9d\u00E9rales : certificat/questionnaire le cas \u00E9ch\u00E9ant) et je m\'engage \u00E0 ne pas participer / ne pas autoriser la participation en cas de doute sur l\'\u00E9tat de sant\u00E9.'
        + '\n\nLimites de responsabilit\u00E9 (droit FR) :'
        + '\nDans la mesure permise par la loi, je m\'engage \u00E0 ne pas rechercher la responsabilit\u00E9 de Found Club du fait de la participation ; cette clause ne s\'applique pas en cas de faute lourde ou intentionnelle ou de manquement grave aux obligations de s\u00E9curit\u00E9 imputable \u00E0 Found Club ou \u00E0 l\'organisateur.'
        + '\n\nR\u00E8glement & s\u00E9curit\u00E9 :'
        + '\nJe m\'engage (ou j\'engage le mineur) \u00E0 respecter le r\u00E8glement, les consignes de s\u00E9curit\u00E9 et les instructions des encadrants ; l\'organisateur peut refuser ou interrompre la participation en cas de non-respect.'
        + '\n\nUrgence m\u00E9dicale :'
        + '\nJ\'autorise l\'organisateur \u00E0 pr\u00E9venir les secours en cas d\'urgence ; pour un mineur, j\'autorise l\'organisateur \u00E0 accompagner l\'enfant si n\u00E9cessaire et je m\'engage \u00E0 rester joignable.',
      title: 'D\u00C9CLARATION DE RESPONSABILIT\u00C9 ET ACCEPTATION DES RISQUES',
      validation: 'En cochant les cases et en validant mon inscription, je confirme avoir lu, compris et accept\u00E9 la pr\u00E9sente d\u00E9claration et j\'accepte de participer \u00E0 l\'\u00E9v\u00E9nement dans ces conditions.',
    },
    loadingDesc: 'Nous chargeons les \u00E9v\u00E9nements correspondant \u00E0 votre recherche.',
    loadingTitle: 'Chargement des \u00E9v\u00E9nements',
    loadingUpdating: 'Actualisation des \u00E9v\u00E9nements...',
    noData: 'Aucun \u00E9v\u00E9nement trouv\u00E9.',
    title: 'Mes \u00E9v\u00E9nements',
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
      noCreated: "Aucun événement n'a été cree.",
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
        addressMissing: 'Adresse non renseignee',
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
        subtitle: "Configure date, horaires et regles d'accès.",
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
        totalPlayersExceedsCapacity: 'Le nombre de joueurs attendus ne peut pas depasser la capacité max.',
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
        autoDesc: 'Les participants peuvent confirmer automatiquement leur presence.',
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
    capacity: {
      teamPlural: 'équipes simultanées',
      teamSingular: 'équipe simultanée',
    },
    errors: {
      addressGeocodeRequired: 'Sélectionnez une adresse géolocalisée dans la liste.',
      planningColorInvalid: 'Sélectionnez une couleur validé.',
    },
    fields: {
      planningColor: 'Couleur dans le planning',
    },
    hints: {
      addressSelection: 'Sélectionnez une adresse dans la liste pour activer le GPS.',
      planningColor: 'Cette couleur apparaîtra dans le planning pour identifier rapidement l\'installation.',
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
      addressMissing: 'Adresse non renseignee',
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
          event: 'un évènement',
          reservation: 'une réservation',
          team: 'une équipe',
        },
      },
    },
  },
  homeHub: {
    account: {
      logoutDescription: 'Voulez-vous vous déconnecter de votre compte ?',
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
        description: 'Votre compte doit être rattaché à un club pour gérer ces demandes.',
        title: 'Club introuvable',
      },
      noTrainedTeams: {
        description: 'Vous devez être entraîneur d\'au moins une équipe pour gérer les demandes d\'adhésion.',
        title: 'Aucune équipe disponible',
      },
    },
    cards: {
      account: {
        logout: {
          subtitle: 'Fermer votre session sur cet appareil.',
          title: 'Déconnexion',
        },
        switch: {
          subtitle: 'Basculer vers un autre compte connecte.',
          title: 'Changer de compte',
        },
        tutorial: {
          subtitle: 'Relancer un tutoriel ou réinitialiser les guides.',
          title: 'Tutoriels et aide',
        },
      },
      league: {
        subtitle: 'Accéder à FoundClub League et à ses fonctionnalités compétitives.',
        title: 'FoundClub League',
      },
      manage: {
        addAd: {
          subtitle: 'Publier une annonce pour rechercher un profil particulier.',
          title: 'Ajouter une annonce',
        },
        addEvent: {
          subtitle: "Cr\u00e9e rapidement un entra\u00eenement, match ou s\u00e9ance d'essai.",
          title: 'Ajouter un \u00e9v\u00e9nement',
        },
        clubRequests: {
          subtitle: "Valider ou refuser les demandes d'adh\u00e9sion au club.",
          title: 'Demandes adh\u00e9sion club',
        },
        featuredRequests: {
          subtitle: 'Traite les demandes d \u00e9v\u00e9nements \u00e0 la une du club.',
          title: 'Demandes \u00e9v\u00e9nements \u00e0 la une',
        },
        manageClub: {
          subtitle: 'Acc\u00e9dez \u00e0 votre espace club pour piloter votre organisation.',
          title: 'G\u00e9rer mon club',
        },
        requests: {
          subtitle: 'Traitez toutes les demandes de votre organisation depuis un seul écran.',
          title: 'Demandes',
        },
        teamRequests: {
          subtitle: 'Traite les demandes d adh\u00e9sion des joueurs \u00e0 vos \u00e9quipes.',
          title: 'Demandes adh\u00e9sion \u00e9quipes',
        },
      },
      profile: {
        alerts: {
          subtitle: 'Créer des alertes pour recevoir des notifications personnalisees selon vos recherches.',
          title: 'G\u00e9rer mes alertes',
        },
        edit: {
          subtitle: 'Mettre à jour vos informations personnelles et sportives.',
          title: 'Modifier mon profil',
        },
        history: {
          subtitle: 'Ajouter ou ajuster votre historique sportif.',
          title: 'Historique sportif',
        },
        view: {
          subtitle: 'Consulter les informations de votre compte.',
          title: 'Voir mon profil',
        },
      },
      quick: {
        chat: {
          subtitle: 'Ouvrir rapidement votre messagerie.',
          title: 'Messagerie',
        },
        planning: {
          subtitle: 'Retrouver vos événements à venir et votre planning personnel.',
          title: 'Mon planning',
        },
        teams: {
          subtitle: 'Accéder à vos équipes et à leurs informations.',
          title: 'Mes équipes',
        },
      },
      search: {
        ads: {
          subtitle: 'Postuler aux annonces de recherche des équipes.',
          title: 'Annonces',
        },
        clubs: {
          subtitle: 'Trouver votre page club pour voir toutes ses informations.',
          title: 'Club',
        },
        events: {
          subtitle: "Trouve des d\u00e9tections, s\u00e9ances d'essai, entra\u00eenements et matchs.",
          title: '\u00c9v\u00e9nement',
        },
        reservations: {
          subtitle: 'R\u00e9serve rapidement un terrain (foot \u00e0 5, padel, etc.).',
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
      manageClub: 'G\u00e9rer mon club',
      manageTeams: 'G\u00e9rer mes \u00e9quipes',
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
      subtitle: 'Relancez un tutoriel ou réinitialisez tous les guides.',
      title: 'Tutoriels et aide',
    },
    entry: {
      actions: {
        skip: 'Passer',
        start: 'Lancer le tutoriel complet',
      },
      description: 'Vous pouvez lancer le tutoriel complet pour tout comprendre, ou explorer l\'application par vous même.',
      subtitle: 'FoundClub est un outil concu pour vous accompagner dans toute votre aventure sportive, peu importe votre sport.',
      title: 'Bienvenue sur FoundClub',
    },
    featurePicker: {
      subtitle: 'Sélectionnez une fonctionnalité à découvrir.',
      title: 'Choisir un tutoriel',
    },
    reset: {
      confirm: 'Réinitialiser',
      description: 'Tous les tutoriels seront remis a zero pour ce compte.',
      title: 'Réinitialiser les tutoriels',
    },
    steps: {
      accountLogout: {
        description: 'Déconnectez-vous proprement de l appareil actuel.',
        title: 'Déconnexion',
      },
      accountSwitch: {
        description: 'Ouvrez la modale pour changer ou ajouter un compte.',
        title: 'Changer de compte',
      },
      header: {
        description: 'Cette page vous donne un accès rapide à toutes les fonctionnalités principales.',
        title: 'Accueil FoundClub',
      },
      league: {
        description: 'Basculez vers FoundClub League pour les fonctionnalités compétitives.',
        title: 'FoundClub League',
      },
      manageAddAd: {
        description: 'Publiez une annonce de recrutement pour cibler des profils précis.',
        title: 'Ajouter une annonce',
      },
      manageAddEvent: {
        description: 'Créez un entraînement, match ou détection pour vos équipes.',
        title: 'Ajouter un événement',
      },
      manageClub: {
        description: 'Accédez à votre espace club pour piloter votre organisation.',
        title: 'Gérer mon club',
      },
      manageClubRequests: {
        description: 'Traitez les demandes d\'adhésion reçues par votre club.',
        title: 'Demandes adhésion club',
      },
      manageFeaturedRequests: {
        description: 'Validez les demandes d événements à la une de votre organisation.',
        title: 'Demandes événements à la une',
      },
      manageRequests: {
        description: 'Regroupez et traitez toutes les demandes depuis un seul onglet.',
        title: 'Demandes',
      },
      manageTeamRequests: {
        description: 'Validez ou refusez les demandes pour rejoindre vos équipes.',
        title: 'Demandes adhésion équipes',
      },
      profileAlerts: {
        description: 'Configurez des alertes personnalisees selon vos recherches.',
        title: 'Gérer mes alertes',
      },
      profileEdit: {
        description: 'Modifiez vos informations personnelles et sportives.',
        title: 'Modifier mon profil',
      },
      profileHistory: {
        description: 'Ajoutez vos experiences via le wizard historique.',
        title: 'Historique sportif',
      },
      profileView: {
        description: 'Consultez votre page profil complete.',
        title: 'Voir mon profil',
      },
      quickChat: {
        description: 'Ouvrez votre messagerie et suivez vos conversations.',
        title: 'Messagerie',
      },
      quickPlanning: {
        description: 'Accédez rapidement à votre planning personnel.',
        title: 'Mon planning',
      },
      quickTeams: {
        description: 'Retrouvez toutes vos équipes et leurs pages.',
        title: 'Mes équipes',
      },
      searchAds: {
        description: 'Consultez les annonces de recrutement et les profils disponibles.',
        title: 'Rechercher des annonces',
      },
      searchClubs: {
        description: 'Explorez les clubs et ouvrez leur fiche détaillée.',
        title: 'Rechercher un club',
      },
      searchEvents: {
        description: 'Trouvez des événements sportifs en utilisant les filtres de recherche.',
        title: 'Rechercher un événement',
      },
      searchReservations: {
        description: 'Accédez aux réservations et filtrez selon votre activité.',
        title: 'Rechercher une réservation',
      },
      tutorialCenter: {
        description: 'Relancez un tutoriel quand vous voulez, ou remettez tout a zero.',
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
    myTeams: 'Mes \u00e9quipes',
    planning: 'Mon planning',
    requests: 'Demandes',
    search: 'Rechercher',
  },
  menuDock: {
    chat: 'Messages',
    home: 'Accueil',
    myClub: 'Club',
    myTeams: '\u00c9quipes',
    planning: 'Planning',
    search: 'Recherche',
  },
  messaging: {
    noData: 'Aucune conversation trouv\u00E9e.',
    title: 'Messages priv\u00E9s',
  },
  modals: {
    actions: {
      search: 'Rechercher...',
      select: 'S\u00E9lectionner',
    },
    phone: {
      title: 'S\u00E9lectionner un pays',
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
        subtitle: 'Traiter les demandes en attente de votre organisation.',
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
          label: 'Numero du dirigeant (optionnel)',
          placeholder: 'Ex: 0612345678',
        },
        name: {
          label: 'Nom de la section *',
          placeholder: 'Ex: Football, Basketball',
        },
        sport: {
          label: 'Sport',
          noResults: 'Aucun sport ne correspond à votre recherche.',
          placeholder: 'Choisir un sport',
        },
      },
      info: 'Une fois créée, la section pourra accueillir équipes, événements et membres.',
      subtitle: 'Créez une section sportive pour votre club multisport.',
      title: 'Nouvelle section',
    },
    deleteSectionConfirm: 'Êtes-vous sûr de vouloir supprimer la section "{{name}}" ? Cette action est irréversible.',
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
      mainDescription: 'Gérez vos sections, vos membres et vos actions rapides depuis un seul écran.',
      mainTitle: 'Gestion multisport',
    },
  },
  myEventList: {
    actions: {
      closeTimeFilter: 'Valider',
    },
    fields: {
      timeFilter: {
        next: 'Mes prochains évènements',
        past: 'Mes évènements passés',
        selectDate: 'Sélectionner une date',
      },
      type: {
        all: 'Tous',
      },
    },
  },
  myTeamList: {

    title: 'Mes \u00e9quipes',
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
        subtitle: 'Votre demande de participation a été refusée.',
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
      modalCancelHint: 'Ferme la fenetre de demande.',
      modalCommentHint: 'Ajoute des informations utiles à la recherche.',
      modalNameHintClub: 'Renseigne le nom du club que tu recherches.',
      modalNameHintTeam: "Renseigne le nom de l'équipe que tu recherches.",
      modalSendHint: 'Envoie ta demande aux superadmins.',
      notFoundHintClub: 'Envoie une demande d\'aide si ton club est introuvable.',
      notFoundHintTeam: 'Envoie une demande d\'aide si ton équipe est introuvable.',
      retryHint: 'Relance la recherche de résultats.',
      searchInputHintClub: 'Saisis le nom du club pour filtrer la liste.',
      searchInputHintTeam: "Saisis le nom de l'équipe pour filtrer la liste.",
      searchInputLabelClub: 'Champ nom du club',
      searchInputLabelTeam: "Champ nom de l'équipe",
      tooltipNextHint: 'Passe à l étape suivante du tutoriel.',
      tooltipPreviousHint: 'Revient à l\'étape précédente du tutoriel.',
      tooltipSkipHint: 'Quitte le tutoriel guide.',
    },
    actions: {
      changeClub: 'Changer de club',
      continueLater: 'Continuer plus tard',
      notFoundClub: 'Je ne trouve pas mon club',
      notFoundTeam: 'Je ne trouve pas mon équipe',
    },
    common: {
      roleTargetClub: 'club',
      roleTargetTeam: 'équipe',
    },
    feedback: {
      missingInfoMessageClub: 'Renseigne le nom du club recherché.',
      missingInfoMessageTeam: "Renseigne le nom de l'équipe recherchée.",
      missingInfoTitle: 'Information manquante',
      requestError: 'Impossible d\'envoyer votre demande.',
      requestSentDescription: 'Votre demande a été envoyée aux superadmins. Vous recevrez une notification.',
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
      description: 'Donnez un maximum de contexte pour aider les superadmins.',
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
      placeholderClub: 'Nom du club',
      placeholderTeam: "Nom de l'équipe",
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
    subtitleClub: 'Recherche ton club puis ouvre sa fiche pour le rejoindre ou le revendiquer.',
    subtitleClubSelection: 'Recherche puis sélectionne ton club pour voir ses équipes.',
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
      message: 'L\'application a besoin d\'accéder à votre caméra pour prendre une photo.',
      title: 'Permission Caméra',
    },
  },
  planning: {
    fullscreen: {
      club: 'Planning club',
      clubShared: 'Planning partag\u00E9',
      cm: 'Planning omnisport',
      personal: 'Mon planning',
    },
  },
  profile: {
    actions: {
      confirmDeleteAvatar: 'Êtes-vous sûr de vouloir supprimer cette image ?',
      deleteAccount: 'Supprimer mon compte',
      edit: 'Modifier mon profil',
      findClub: 'Trouver mon club',
      findTeam: 'Trouver une équipe',
      ignore: 'Ignorer',
      logout: 'D\u00e9connexion',
      manageAlerts: 'G\u00e9rer mes alertes',
      manageClub: 'G\u00e9rer mon club',
      manageClubJoinRequests: 'Gérer les demandes d\'affiliation au club',
      manageEvents: 'Gérer mes évènements',
      manageRequests: 'Gérer mes demandes',
      manageTeamJoinRequests: 'Gérer les demandes d\'adhésion aux équipes',
      manageTeams: 'Gérer mes équipes',
      myTeams: 'Mes \u00e9quipes',
      save: 'Continuer',
    },
    alerts: {
      deleteAlert: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        subtitle: 'Pour demander la suppression de votre compte merci de remplir le formulaire de contact'
          + ' suivant en précisant votre demande.',
        title: 'Supprimer votre compte ?',
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
      lastname: {
        label: 'Nom',
        placeholder: 'Harne',
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
    subtitles: {
      avatar: "Ajoute une photo de profil pour que l'on puisse te reconnaître facilement.",
      birthdate: 'Renseigne ta date de naissance.',
      name: 'Renseigne ton nom et prénom.',
      section: 'Renseigne la catégorie de sexe dans laquelle tu évolues',
      type: 'Renseignez votre fonction principale.',
    },
    titles: {
      avatar: 'Une photo de profil ?',
      birthdate: 'Quelle est ta date de naissance ?',
      edit: 'Modifier mes informations',
      name: "Comment t'appelles-tu ?",
      profile: 'Mon compte',
      section: 'Dans quelle section évolues-tu ?',
      type: 'Quel est votre statut ?',
    },
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
    clubAssignedMessage: "{{name}} a été ajouté au club. Voulez-vous l'assigner à une équipe maintenant ?",
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
    rejectFeaturedMessage: 'Le demandeur sera notifie du refus.',
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
  squadDetails: {
    actions: {
      deleteTeam: 'Supprimer la squad',
      deleteTeamError: 'Impossible de supprimer la squad.',
      edit: 'Modifier',
      editTeam: 'Modifier la squad',
      menuDescription: 'Choisissez une action.',
      menuTitle: 'Actions squad',
      openRequests: 'Voir les demandes',
      requests: 'Demandes',
      unavailableTitle: 'Action non disponible',
    },
    defaultName: 'Squad',
    delete: {
      confirmationWithName: 'Etes-vous sur de vouloir supprimer la squad "{{teamName}}" ? Cette action est irreversible.',
      title: 'Supprimer la squad',
    },
    join: {
      pending: 'Demande en attente...',
      request: 'Demander à rejoindre',
    },
    labels: {
      locationUnknown: 'Localisation non renseignee',
    },
    roster: {
      captain: 'Capitaine',
      player: 'Joueur',
      title: 'Effectif',
    },
    slots: {
      added: 'Créneau ajouté',
      addTitle: 'Ajouter un créneau',
      deleteConfirm: 'Voulez-vous vraiment supprimer ce créneau ?',
      deleted: 'Créneau supprimé',
      deleteError: 'Impossible de supprimer le créneau',
      editTitle: 'Modifier le créneau',
      joinHint: 'Rejoignez la squad pour participer aux créneaux.',
      multipleAdded: '{{count}} créneaux ajoutes',
      saveError: 'Impossible de sauvegarder le créneau',
      statusError: 'Impossible de modifier votre statut.',
      updated: 'Créneau modifié',
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
      exitSelection: 'Quitter selection',
      hide: 'Masquer',
      more: 'Plus d actions',
      multiSelect: 'Selection multiple',
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
      emptySelectionMessage: 'Sélectionnez au moins une entrée.',
      emptySelectionTitle: 'Sélection vide',
      filePickerUnavailable: 'Le sélecteur de fichiers est indisponible sur cette build.',
      fileResolveFailed: 'Impossible de récupérer ce fichier.',
      fileSelectFailed: 'Impossible de sélectionner ce fichier.',
      openCameraFailed: 'Impossible d\'ouvrir la camera.',
      openGalleryFailed: 'Impossible d\'ouvrir la galerie.',
      reasonRequiredMessage: 'Minimum 3 caracteres.',
      reasonRequiredTitle: 'Raison requise',
      relationSearchFailedTitle: 'Recherche impossible',
      relationSearchMinChars: 'Merci de saisir au moins 1 caractere.',
      relationSearchTitle: 'Recherche relation',
      saveFailedTitle: 'Enregistrement impossible',
      takePhotoFailed: 'Impossible de prendre une photo.',
      uploadFailedTitle: 'Upload impossible',
      uploadNoFile: 'Aucun fichier n\'a été recu par le serveur.',
      validationTitle: 'Validation',
    },
    bulkModal: {
      description: 'entrée(s) seront traitées. Une raison d\'audit est obligatoire.',
      reasonPlaceholder: 'Raison obligatoire (minimum 3 caracteres)',
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
      reasonPlaceholder: 'Raison obligatoire (minimum 3 caracteres)',
      title: 'Supprimer l\'entrée',
    },
    detail: {
      createdAt: 'Cree le',
      noAudit: 'Aucun log disponible.',
      noKeyFields: 'Aucun champ cle détecté.',
      noRelations: 'Aucune relation ou media exploitable.',
      rawJsonCollapsed: 'Vue avancée repliée pour garder l\'écran lisible.',
      sections: {
        audit: 'Audit recent',
        keyFields: 'Champs clés',
        rawJson: 'JSON complet',
        relationsMedia: 'Relations / Médias',
        summary: 'Résumé',
      },
      shortId: 'ID court',
      updatedAt: 'Modifié le',
    },
    empty: {
      explorerDescription: 'Ajustez la recherche ou vérifiez les permissions Super Admin.',
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
      subtitle: 'Parcourez tous les content-types API Strapi.',
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
      reasonLabel: 'Raison (optionnelle sauf regles sensibles)',
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
        mediaHint: 'Ajoutez images ou fichiers.',
        relations: 'Relations',
        relationsHint: 'Associez des entrées liées.',
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
      invalidPlayerCount: 'Veuillez entrer un nombre validé',
      playerCount: 'Combien de joueurs avez-vous ?',
      recruiting: 'Il me manque des joueurs',
      selectMode: 'Veuillez sélectionner un mode',
      title: 'Comment voulez-vous participer ?',
      tooManyPlayers: 'Le nombre doit être inférieur au total',
    },
    noData: 'Aucune réservation trouvée.',
    title: 'Évènements :',
  },
  searchTypeSwitcher: {
    recruitment: 'Recrutement',
  },
  teamSlotList: {
    add: '+ Ajouter',
    checkInSoon: 'Check-in bientot disponible.',
    comingSoon: 'Bientot disponible',
    confirmedPlayers: 'Joueurs confirmés',
    cta: {
      confirmPresence: 'Je suis present',
      removePresence: 'Retirer ma presence',
    },
    empty: 'Aucun créneau defini.',
    joinHint: 'Rejoindre la squad pour participer.',
    memberHelp: 'Touchez pour confirmer votre presence.',
    status: {
      complete: 'Complet',
      confirmed: '{{count}}/{{required}} confirmés',
      remaining: 'Encore {{count}}',
    },
    title: 'Disponibilites (créneaux)',
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
          + ' Si vous souhaitez le retirer seulement de cette équipe merci de passer par le bouton de modification de l\'équipe.',
        title: 'Vous êtes sur le point de supprimer cet·te entraîneur·e de votre club.',
      },
      invitePlayers: {
        alreadyHaveTheApp: "J'ai déjà l'application",
        downloadOnAndroid: 'Télécharger sur Android',
        downloadOnIOS: 'Télécharger sur iOS',
        message: 'Bonjour !'
          + '\nVotre équipe {{teamName}} de votre club {{clubName}} vous attend !'
          + "\nTéléchargez l'application Found Club pour finaliser la création de votre compte"
          + ' et commencer accéder et participer aux évènements de votre équipe.',
        title: 'Vos coéquipiers vous attendent !',
      },
      joinRequest: {
        actions: {
          ok: 'OK',
        },
        description: 'Votre entraîneur·e va recevoir votre demande et la traiter dès que possible.',
        title: 'Votre demande d\'adhésion a bien été envoyée',
      },
      leave: {
        actions: {
          cancel: 'Annuler',
          confirm: "Quitter l'équipe",
        },
        description: 'Vous êtes sur le point de quitter l\'équipe. Une fois cette action validée vous ne pourrez plus participer aux entraînements et matchs.',
        title: 'Êtes-vous sûr·e de vouloir quitter cette équipe ?',
      },
    },
    external: {
      prompt: {
        cta: 'Ajouter le classement',
        description: "Vous pouvez ajouter le lien du classement de votre ligue pour retrouver directement dans l'application votre classement, votre calendrier et vos statistiques.",
        title: 'Ajoutez le classement de votre ligue',
      },
    },
    myTitle: 'Mon équipe',
    sections: {
      nextEvents: 'Prochains évènements',
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
        description: 'Vous avez atteint le nombre maximum d\'équipes autorisées dans votre club. Veuillez contacter Found Club pour débloquer cette limite.',
        title: 'Limite d\'équipes atteinte',
      },
    },
    fields: {
      category: 'Catégorie',
      level: 'Niveau',
      members: 'Membres',
      section: 'Section',
    },
    noData: 'Aucune \u00e9quipe trouv\u00e9e.',
    searchPlaceholder: 'Mes \u00e9quipes',
    title: '\u00c9quipes de mon club',
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
      birthYear: 'Annee de naissance',
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
        regular: ' des clubs et des évènements près de chez toi.',
      },
    },
    subtitle: 'Prêt·e à trouver ton club et évoluer dans le sport ?',
    title: 'Bienvenu·e sur',
  },
};
