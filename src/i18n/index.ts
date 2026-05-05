import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import fr from './locales/fr.json';
import de from './locales/de.json';
import it from './locales/it.json';
import en from './locales/en.json';

export const SUPPORTED_LANGUAGES = ['fr', 'de', 'it', 'en'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  en: 'English',
};

export const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  fr: '🇫🇷',
  de: '🇩🇪',
  it: '🇮🇹',
  en: '🇬🇧',
};

type TranslationTree = Record<string, any>;

const cloneTranslation = (translation: TranslationTree): TranslationTree =>
  JSON.parse(JSON.stringify(translation));

const getPathValue = (tree: TranslationTree, path: string) =>
  path.split('.').reduce<any>((current, part) => {
    if (!current || typeof current !== 'object') return undefined;
    return current[part];
  }, tree);

const setPathValue = (tree: TranslationTree, path: string, value: unknown) => {
  if (value === undefined) return;

  const parts = path.split('.');
  let current: TranslationTree = tree;

  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== 'object' || Array.isArray(current[part])) {
      current[part] = {};
    }
    current = current[part];
  }

  const leaf = parts[parts.length - 1];
  if (current[leaf] === undefined) {
    current[leaf] = value;
  }
};

const aliasPath = (tree: TranslationTree, target: string, ...sources: string[]) => {
  if (getPathValue(tree, target) !== undefined) return;

  for (const source of sources) {
    const value = getPathValue(tree, source);
    if (value !== undefined) {
      setPathValue(tree, target, value);
      return;
    }
  }
};

const setDefaultPath = (tree: TranslationTree, target: string, value: string) => {
  if (getPathValue(tree, target) === undefined) {
    setPathValue(tree, target, value);
  }
};

const TRANSLATION_ALIASES: Array<[string, ...string[]]> = [
  ['depositContract.enterCollaboratorEmail', 'depositContract.emailDescription'],
  ['depositContract.common.clientInfo', 'depositContract.clientInfo'],
  ['depositContract.common.lastName', 'depositContract.lastName'],
  ['depositContract.common.lastNamePlaceholder', 'depositContract.lastNamePlaceholder'],
  ['depositContract.common.firstName', 'depositContract.firstName'],
  ['depositContract.common.firstNamePlaceholder', 'depositContract.firstNamePlaceholder'],
  ['depositContract.common.email', 'depositContract.email'],
  ['depositContract.common.emailPlaceholder', 'depositContract.emailFieldPlaceholder', 'depositContract.emailPlaceholder'],
  ['depositContract.common.phone', 'depositContract.phone'],
  ['depositContract.common.phonePlaceholder', 'depositContract.phonePlaceholder'],
  ['depositContract.common.birthDate', 'depositContract.birthDate'],
  ['depositContract.common.address', 'depositContract.address'],
  ['depositContract.common.streetPlaceholder', 'depositContract.addressPlaceholder'],
  ['depositContract.common.postalCode', 'depositContract.postalCode'],
  ['depositContract.common.postalCodePlaceholder', 'depositContract.postalCodePlaceholder'],
  ['depositContract.common.city', 'depositContract.city'],
  ['depositContract.common.cityPlaceholder', 'depositContract.cityPlaceholder'],
  ['depositContract.common.agentName', 'depositContract.agentName'],
  ['depositContract.common.comments', 'depositContract.comments'],
  ['depositContract.common.additionalInfo', 'depositContract.commentsPlaceholder'],
  ['depositContract.common.documentsToProvide', 'depositContract.documentsToProvide'],
  ['depositContract.common.confirmUpload', 'depositContract.confirmDocuments'],
  ['depositContract.common.documentsAdded', 'depositContract.documentsCount'],
  ['depositContract.common.sending', 'depositContract.submitting'],
  ['depositContract.common.submitForm', 'depositContract.submitForm'],
  ['depositContract.common.effectDate', 'depositContract.effectDate', 'depositContract.vita.effectDate'],
  ['depositContract.sana.currentInsurer', 'depositContract.currentInsurer'],
  ['depositContract.sana.currentInsurerPlaceholder', 'depositContract.currentInsurerPlaceholder'],
  ['depositContract.sana.docs.identity', 'depositContract.requiredDocs.sana.doc1'],
  ['depositContract.sana.docs.residence', 'depositContract.requiredDocs.sana.doc2'],
  ['depositContract.sana.docs.insuranceCard', 'depositContract.requiredDocs.sana.doc3'],
  ['depositContract.vita.docs.proposal', 'depositContract.requiredDocs.vita.doc1'],
  ['depositContract.vita.docs.identityDomicile', 'depositContract.requiredDocs.vita.doc2'],
  ['depositContract.vita.docs.minutes', 'depositContract.requiredDocs.vita.doc3'],
  ['depositContract.medio.docs.identity', 'depositContract.requiredDocs.medio.doc1'],
  ['depositContract.medio.docs.domicile', 'depositContract.requiredDocs.medio.doc2'],
  ['depositContract.medio.docs.vehicleRegistration', 'depositContract.requiredDocs.medio.doc3'],
  ['depositContract.medio.docs.currentPolicy', 'depositContract.requiredDocs.medio.doc4'],
  ['depositContract.business.docs.commerceExtract', 'depositContract.requiredDocs.business.doc1'],
  ['depositContract.business.docs.ceoIdentity', 'depositContract.requiredDocs.business.doc2'],
  ['depositContract.business.docs.staffList', 'depositContract.requiredDocs.business.doc3'],
  ['depositContract.common.desiredEffectDate', 'depositContract.effectDate'],
  ['depositContract.common.fullAddress', 'depositContract.business.companyAddressPlaceholder'],
  ['depositContract.common.insuredSum', 'depositContract.business.insuranceSum'],
  ['depositContract.fillRequired', 'depositContract.requiredFields'],
  ['depositContract.cannotVerify', 'depositContract.verificationError'],
  ['depositContract.cannotSubmit', 'depositContract.submitError'],
  ['depositContract.medio.autoInsurance', 'depositContract.medio.auto'],
  ['depositContract.medio.brand', 'depositContract.medio.vehicleBrand'],
  ['depositContract.medio.model', 'depositContract.medio.vehicleModel'],
  ['depositContract.medio.year', 'depositContract.medio.vehicleYear'],
  ['depositContract.medio.licensePlate', 'depositContract.medio.vehiclePlate'],
  ['depositContract.medio.furnitureValue', 'depositContract.medio.householdAmount'],
  ['depositContract.medio.commentsPlaceholder', 'depositContract.specificNeedsPlaceholder', 'depositContract.commentsPlaceholder'],
  ['depositContract.business.activity', 'depositContract.business.companyActivity'],
  ['depositContract.business.activityPlaceholder', 'depositContract.business.companyActivityPlaceholder'],
  ['depositContract.business.ceo', 'depositContract.business.ceoInfo'],
  ['depositContract.business.title', 'depositContract.business.civility'],
  ['depositContract.business.legalForm', 'depositContract.business.companyForm'],
  ['depositContract.business.swiss', 'depositContract.business.nationalityPlaceholder'],
  ['depositContract.business.permit', 'depositContract.business.residencePermit'],
  ['depositContract.business.rcBusiness', 'depositContract.business.rcCompany'],
  ['depositContract.business.turnover', 'depositContract.business.revenue'],
  ['depositContract.business.deductible', 'depositContract.business.franchise'],
  ['depositContract.business.insuredSumPlaceholder', 'depositContract.business.insuranceSumPlaceholder'],
  ['depositContract.business.laaSupplementary', 'depositContract.business.laaComplementary'],
  ['depositContract.business.lossOfEarnings', 'depositContract.business.sicknessBenefit'],
  ['depositContract.business.nextMeeting', 'depositContract.business.appointmentDate'],
  ['depositContract.business.offerLanguage', 'depositContract.business.language'],
  ['depositContract.business.commentsPlaceholder', 'depositContract.specificNeedsPlaceholder', 'depositContract.commentsPlaceholder'],
  ['forms.familyMember.addTitle', 'forms.newFamilyMember'],
  ['forms.familyMember.editTitle', 'forms.editFamilyMember'],
  ['forms.familyMember.firstName', 'forms.family.firstName'],
  ['forms.familyMember.lastName', 'forms.family.lastName'],
  ['forms.familyMember.relationType', 'forms.family.relationType'],
  ['forms.familyMember.relationTypes.spouse', 'forms.family.spouse'],
  ['forms.familyMember.relationTypes.child', 'forms.family.child'],
  ['forms.familyMember.relationTypes.other', 'forms.family.other'],
  ['forms.familyMember.birthDate', 'forms.family.birthDate'],
  ['forms.familyMember.permitType', 'forms.family.permitType'],
  ['forms.familyMember.permits.none', 'forms.family.none'],
  ['forms.familyMember.nationality', 'forms.family.nationality'],
  ['forms.familyMember.success.added', 'forms.family.memberAdded'],
  ['forms.familyMember.errors.firstNameRequired', 'forms.requiredField'],
  ['forms.familyMember.errors.lastNameRequired', 'forms.requiredField'],
  ['forms.suivi.newTitle', 'forms.newFollowup'],
  ['forms.suivi.editTitle', 'forms.editFollowup'],
  ['forms.suivi.title', 'forms.suivi.title'],
  ['forms.suivi.titlePlaceholder', 'forms.suivi.titlePlaceholder'],
  ['forms.suivi.type', 'forms.suivi.type'],
  ['forms.suivi.selectType', 'forms.suivi.selectType'],
  ['forms.suivi.status', 'forms.suivi.status'],
  ['forms.suivi.selectStatus', 'forms.suivi.selectStatus'],
  ['forms.suivi.reminderDate', 'forms.suivi.reminderDate'],
  ['forms.suivi.description', 'forms.suivi.description'],
  ['forms.suivi.descriptionPlaceholder', 'forms.suivi.descriptionPlaceholder'],
  ['forms.suivi.create', 'forms.suivi.createSuivi', 'forms.create'],
  ['forms.suivi.errors.titleRequired', 'forms.requiredField'],
  ['common.french', 'languages.fr'],
  ['common.german', 'languages.de'],
  ['common.italian', 'languages.it'],
  ['common.english', 'languages.en'],
  ['companyForm.addProduct', 'productForm.addProduct'],
  ['companyForm.editProduct', 'productForm.editProduct'],
  ['companyForm.deleteProduct', 'productForm.deleteProduct'],
  ['companyForm.deleteProductConfirm', 'productForm.deleteProductConfirm'],
  ['companyForm.fixed', 'productForm.fixed'],
  ['companyForm.multiplier', 'productForm.multiplier'],
  ['companyForm.percentage', 'productForm.percentage'],
  ['companyForm.formulaDesc', 'companyForm.formulaDescription'],
  ['companyForm.formulaPlaceholder', 'productForm.formulaPlaceholder'],
  ['mandatForm.birthdate', 'mandatForm.birthDate'],
  ['mandatForm.companyName', 'mandatForm.otherCompanyName', 'companyForm.companyName'],
  ['mandatForm.currentInsurancesDescription', 'mandatForm.currentInsurancesDesc'],
  ['mandatForm.error', 'common.error'],
  ['mandatForm.no', 'common.no'],
  ['mandatForm.pillar3Life', 'mandatForm.lifeInsurance', 'mandatForm.thirdPillar'],
  ['mandatForm.signatureCabinet', 'mandatForm.signatureCompany'],
  ['mandatForm.showPreviewFirst', 'mandatForm.previewError'],
  ['clientMessages.messageError', 'common.error'],
];

const TRANSLATION_DEFAULTS: Record<SupportedLanguage, Record<string, string>> = {
  fr: {
    'depositContract.common.additionalDocs': 'Documents supplémentaires',
    'depositContract.vita.untilRetirement': "Jusqu'à la retraite",
    'depositContract.vita.divideByTwelve': 'Divisez la prime annuelle par 12',
    'depositContract.vita.requiredDocsTitle': 'Documents requis',
    'depositContract.vita.docProposal': 'Proposition avec déclaration de santé',
    'depositContract.vita.docIdentity': "Pièce d'identité / attestation de domicile",
    'depositContract.vita.docAdequacy': 'Protocole / rapport de conseil',
    'depositContract.vita.docDirectDebit': 'Autorisation de débit direct',
    'depositContract.vita.docMinutes': 'Procès-verbal de conseil',
    'depositContract.business.finalization': 'Finalisation',
    'depositContract.business.staffCount': 'Détails du personnel',
    'depositContract.business.womenCount': 'Femmes - nombre',
    'depositContract.business.womenAvgAge': 'Femmes - âge moyen',
    'depositContract.business.womenSalaries': 'Femmes - salaires',
    'depositContract.business.menCount': 'Hommes - nombre',
    'depositContract.business.menAvgAge': 'Hommes - âge moyen',
    'depositContract.business.menSalaries': 'Hommes - salaires',
    'depositContract.business.zefixNote': 'Extrait Zefix recommandé avant validation.',
    'forms.familyMember.relationTypes.parent': 'Parent',
    'forms.familyMember.permits.b': 'Permis B',
    'forms.familyMember.permits.c': 'Permis C',
    'forms.familyMember.permits.g': 'Permis G',
    'forms.familyMember.permits.l': 'Permis L',
    'forms.familyMember.permits.other': 'Autre',
    'forms.familyMember.success.addedDescription': '{{name}} a été ajouté(e) à la famille et à la liste des adresses',
    'forms.familyMember.errors.createClientError': 'Impossible de créer le client lié',
    'forms.familyMember.errors.genericError': 'Une erreur inattendue est survenue',
    'common.mr': 'Monsieur',
    'common.mrs': 'Madame',
    'common.allTime': 'Toute la période',
    'companyForm.editCommission': 'Modifier la commission',
    'companyForm.commissionConfig': 'Configuration de la commission',
    'companyForm.calculationType': 'Type de calcul',
    'companyForm.fixedAmount': 'Montant (CHF)',
    'companyForm.multiplierValue': 'Multiplicateur',
    'companyForm.percentageValue': 'Pourcentage',
    'clientDetail.emailSentTo': 'Un email a été envoyé à',
    'clientDetail.cannotCreateAccount': 'Impossible de créer le compte',
    'clientDetail.invitationResent': 'Invitation renvoyée',
    'clientDetail.cannotResendInvitation': "Impossible de renvoyer l'invitation",
    'mandatForm.saveError': "Impossible d'enregistrer le mandat.",
  },
  en: {
    'depositContract.common.additionalDocs': 'Additional documents',
    'depositContract.vita.untilRetirement': 'Until retirement',
    'depositContract.vita.divideByTwelve': 'Divide the annual premium by 12',
    'depositContract.vita.requiredDocsTitle': 'Required documents',
    'depositContract.vita.docProposal': 'Proposal with health declaration',
    'depositContract.vita.docIdentity': 'Identity document / proof of residence',
    'depositContract.vita.docAdequacy': 'Advice suitability report',
    'depositContract.vita.docDirectDebit': 'Direct debit authorization',
    'depositContract.vita.docMinutes': 'Advice meeting minutes',
    'depositContract.business.finalization': 'Finalization',
    'depositContract.business.staffCount': 'Staff details',
    'depositContract.business.womenCount': 'Women - count',
    'depositContract.business.womenAvgAge': 'Women - average age',
    'depositContract.business.womenSalaries': 'Women - salaries',
    'depositContract.business.menCount': 'Men - count',
    'depositContract.business.menAvgAge': 'Men - average age',
    'depositContract.business.menSalaries': 'Men - salaries',
    'depositContract.business.zefixNote': 'A Zefix extract is recommended before validation.',
    'forms.familyMember.relationTypes.parent': 'Parent',
    'forms.familyMember.permits.b': 'Permit B',
    'forms.familyMember.permits.c': 'Permit C',
    'forms.familyMember.permits.g': 'Permit G',
    'forms.familyMember.permits.l': 'Permit L',
    'forms.familyMember.permits.other': 'Other',
    'forms.familyMember.success.addedDescription': '{{name}} was added to the family and address list',
    'forms.familyMember.errors.createClientError': 'Unable to create the linked client',
    'forms.familyMember.errors.genericError': 'An unexpected error occurred',
    'common.mr': 'Mr.',
    'common.mrs': 'Mrs.',
    'common.allTime': 'All time',
    'companyForm.editCommission': 'Edit commission',
    'companyForm.commissionConfig': 'Commission settings',
    'companyForm.calculationType': 'Calculation type',
    'companyForm.fixedAmount': 'Amount (CHF)',
    'companyForm.multiplierValue': 'Multiplier',
    'companyForm.percentageValue': 'Percentage',
    'clientDetail.emailSentTo': 'An email was sent to',
    'clientDetail.cannotCreateAccount': 'Unable to create the account',
    'clientDetail.invitationResent': 'Invitation resent',
    'clientDetail.cannotResendInvitation': 'Unable to resend the invitation',
    'mandatForm.saveError': 'Unable to save the mandate.',
  },
  de: {
    'depositContract.common.additionalDocs': 'Zusatzdokumente',
    'depositContract.vita.untilRetirement': 'Bis zur Pensionierung',
    'depositContract.vita.divideByTwelve': 'Jahrespramie durch 12 teilen',
    'depositContract.vita.requiredDocsTitle': 'Erforderliche Dokumente',
    'depositContract.vita.docProposal': 'Antrag mit Gesundheitserklarung',
    'depositContract.vita.docIdentity': 'Ausweis / Wohnsitzbestatigung',
    'depositContract.vita.docAdequacy': 'Beratungsprotokoll',
    'depositContract.vita.docDirectDebit': 'Lastschriftmandat',
    'depositContract.vita.docMinutes': 'Beratungsprotokoll',
    'depositContract.business.finalization': 'Abschluss',
    'depositContract.business.staffCount': 'Personaldetails',
    'depositContract.business.womenCount': 'Frauen - Anzahl',
    'depositContract.business.womenAvgAge': 'Frauen - Durchschnittsalter',
    'depositContract.business.womenSalaries': 'Frauen - Lohne',
    'depositContract.business.menCount': 'Manner - Anzahl',
    'depositContract.business.menAvgAge': 'Manner - Durchschnittsalter',
    'depositContract.business.menSalaries': 'Manner - Lohne',
    'depositContract.business.zefixNote': 'Ein Zefix-Auszug wird vor der Validierung empfohlen.',
    'forms.familyMember.relationTypes.parent': 'Elternteil',
    'forms.familyMember.permits.b': 'Bewilligung B',
    'forms.familyMember.permits.c': 'Bewilligung C',
    'forms.familyMember.permits.g': 'Bewilligung G',
    'forms.familyMember.permits.l': 'Bewilligung L',
    'forms.familyMember.permits.other': 'Andere',
    'forms.familyMember.success.addedDescription': '{{name}} wurde zur Familie und Adressliste hinzugefugt',
    'forms.familyMember.errors.createClientError': 'Der verknupfte Kunde konnte nicht erstellt werden',
    'forms.familyMember.errors.genericError': 'Ein unerwarteter Fehler ist aufgetreten',
    'common.mr': 'Herr',
    'common.mrs': 'Frau',
    'common.allTime': 'Gesamter Zeitraum',
    'companyForm.editCommission': 'Provision bearbeiten',
    'companyForm.commissionConfig': 'Provisionskonfiguration',
    'companyForm.calculationType': 'Berechnungsart',
    'companyForm.fixedAmount': 'Betrag (CHF)',
    'companyForm.multiplierValue': 'Multiplikator',
    'companyForm.percentageValue': 'Prozentsatz',
    'clientDetail.emailSentTo': 'Eine E-Mail wurde gesendet an',
    'clientDetail.cannotCreateAccount': 'Das Konto konnte nicht erstellt werden',
    'clientDetail.invitationResent': 'Einladung erneut gesendet',
    'clientDetail.cannotResendInvitation': 'Die Einladung konnte nicht erneut gesendet werden',
    'mandatForm.saveError': 'Mandat konnte nicht gespeichert werden.',
  },
  it: {
    'depositContract.common.additionalDocs': 'Documenti aggiuntivi',
    'depositContract.vita.untilRetirement': 'Fino al pensionamento',
    'depositContract.vita.divideByTwelve': 'Dividi il premio annuale per 12',
    'depositContract.vita.requiredDocsTitle': 'Documenti richiesti',
    'depositContract.vita.docProposal': 'Proposta con dichiarazione di salute',
    'depositContract.vita.docIdentity': 'Documento di identita / attestato di domicilio',
    'depositContract.vita.docAdequacy': 'Verbale di consulenza',
    'depositContract.vita.docDirectDebit': 'Autorizzazione addebito diretto',
    'depositContract.vita.docMinutes': 'Verbale di consulenza',
    'depositContract.business.finalization': 'Finalizzazione',
    'depositContract.business.staffCount': 'Dettagli del personale',
    'depositContract.business.womenCount': 'Donne - numero',
    'depositContract.business.womenAvgAge': 'Donne - eta media',
    'depositContract.business.womenSalaries': 'Donne - salari',
    'depositContract.business.menCount': 'Uomini - numero',
    'depositContract.business.menAvgAge': 'Uomini - eta media',
    'depositContract.business.menSalaries': 'Uomini - salari',
    'depositContract.business.zefixNote': 'Si consiglia un estratto Zefix prima della convalida.',
    'forms.familyMember.relationTypes.parent': 'Genitore',
    'forms.familyMember.permits.b': 'Permesso B',
    'forms.familyMember.permits.c': 'Permesso C',
    'forms.familyMember.permits.g': 'Permesso G',
    'forms.familyMember.permits.l': 'Permesso L',
    'forms.familyMember.permits.other': 'Altro',
    'forms.familyMember.success.addedDescription': '{{name}} e stato aggiunto alla famiglia e alla rubrica',
    'forms.familyMember.errors.createClientError': 'Impossibile creare il cliente collegato',
    'forms.familyMember.errors.genericError': 'Si e verificato un errore imprevisto',
    'common.mr': 'Signor',
    'common.mrs': 'Signora',
    'common.allTime': 'Tutto il periodo',
    'companyForm.editCommission': 'Modifica commissione',
    'companyForm.commissionConfig': 'Configurazione commissione',
    'companyForm.calculationType': 'Tipo di calcolo',
    'companyForm.fixedAmount': 'Importo (CHF)',
    'companyForm.multiplierValue': 'Moltiplicatore',
    'companyForm.percentageValue': 'Percentuale',
    'clientDetail.emailSentTo': 'Una email e stata inviata a',
    'clientDetail.cannotCreateAccount': "Impossibile creare l'account",
    'clientDetail.invitationResent': 'Invito reinviato',
    'clientDetail.cannotResendInvitation': "Impossibile reinviare l'invito",
    'mandatForm.saveError': 'Impossibile salvare il mandato.',
  },
};

const enrichTranslation = (
  translation: TranslationTree,
  language: SupportedLanguage
): TranslationTree => {
  const enriched = cloneTranslation(translation);

  for (const [target, ...sources] of TRANSLATION_ALIASES) {
    aliasPath(enriched, target, ...sources);
  }

  for (const [target, value] of Object.entries(TRANSLATION_DEFAULTS[language])) {
    setDefaultPath(enriched, target, value);
  }

  return enriched;
};

const resources = {
  fr: { translation: enrichTranslation(fr, 'fr') },
  de: { translation: enrichTranslation(de, 'de') },
  it: { translation: enrichTranslation(it, 'it') },
  en: { translation: enrichTranslation(en, 'en') },
};

const extractLeafKey = (key: string) => {
  const withoutNs = key.includes(":") ? key.split(":").slice(1).join(":") : key;
  return withoutNs.split(".").pop() || withoutNs;
};

const humanize = (raw: string) => {
  const spaced = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return raw;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const MISSING_KEY_OVERRIDES: Record<SupportedLanguage, Record<string, string>> = {
  fr: { system: "Système", activeCount: "Actifs", inactiveCount: "Inactifs" },
  en: { system: "System", activeCount: "Active", inactiveCount: "Inactive" },
  de: { system: "System", activeCount: "Aktiv", inactiveCount: "Inaktiv" },
  it: { system: "Sistema", activeCount: "Attivi", inactiveCount: "Inattivi" },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fr',
    supportedLngs: SUPPORTED_LANGUAGES,

    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'preferred_language',
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: false,
    },

    returnNull: false,
    returnEmptyString: false,

    // Never show raw translation keys in the UI.
    parseMissingKeyHandler: (key) => {
      const lang = (i18n.language?.split('-')[0] || 'fr') as SupportedLanguage;
      const leaf = extractLeafKey(key);
      return MISSING_KEY_OVERRIDES[lang]?.[leaf] ?? humanize(leaf);
    },
  });

export default i18n;
