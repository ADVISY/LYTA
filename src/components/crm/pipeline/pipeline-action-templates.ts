/**
 * Templates d'actions par stade du pipeline.
 *
 * Pour chaque stage, liste des actions récurrentes qu'un courtier fait
 * souvent. Le menu "..." de chaque colonne Kanban affiche ces templates.
 *
 * Au clic sur un template :
 *   - Crée une tâche (kind='task') liée à l'opportunité (parent_suivi_id)
 *   - Préremplit le titre + description avec les variables du client
 *   - Le courtier peut ensuite envoyer email/SMS depuis cette tâche
 *
 * Plus tard : remplacer par une table DB `pipeline_action_templates`
 * gérable depuis Paramètres > Pipeline.
 */
import type { PipelineStage } from "@/hooks/useSuivis";
import {
  Mail,
  Phone,
  MessageSquare,
  FileText,
  Calendar,
  Bell,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Send,
  type LucideIcon,
} from "lucide-react";

export type ActionKind = "email" | "sms" | "call" | "task" | "document";

export interface PipelineActionTemplate {
  id: string;
  label: string;
  kind: ActionKind;
  icon: LucideIcon;
  taskTitle: string;        // Titre de la tâche créée
  taskDescription: string;  // Description (peut contenir {{vars}})
  priority?: "urgent" | "high" | "normal" | "low";
}

export const PIPELINE_ACTION_TEMPLATES: Record<PipelineStage, PipelineActionTemplate[]> = {
  prospect: [
    {
      id: "first_contact_email",
      label: "Email premier contact",
      kind: "email",
      icon: Mail,
      taskTitle: "Envoyer email premier contact",
      taskDescription: "Présenter le cabinet et proposer un RDV pour le produit {{expected_product}} chez {{expected_company}}.",
      priority: "normal",
    },
    {
      id: "phone_call",
      label: "Appel téléphonique",
      kind: "call",
      icon: Phone,
      taskTitle: "Appeler le prospect",
      taskDescription: "Premier appel pour qualifier le besoin et proposer un RDV.",
      priority: "high",
    },
    {
      id: "sms_relance",
      label: "SMS de relance",
      kind: "sms",
      icon: MessageSquare,
      taskTitle: "Envoyer SMS de relance",
      taskDescription: "Court message pour proposer un échange rapide.",
    },
  ],

  rdv_fixe: [
    {
      id: "confirmation_24h",
      label: "Confirmation 24h avant",
      kind: "email",
      icon: Bell,
      taskTitle: "Envoyer email de confirmation RDV (J-1)",
      taskDescription: "Confirmer date/heure/lieu du RDV. Joindre éventuellement un lien Maps + parking.",
      priority: "high",
    },
    {
      id: "sms_reminder",
      label: "SMS rappel matin du RDV",
      kind: "sms",
      icon: MessageSquare,
      taskTitle: "Envoyer SMS de rappel le matin du RDV",
      taskDescription: "Court message le matin du RDV pour confirmer la présence.",
    },
    {
      id: "demande_docs",
      label: "Demande documents préparation",
      kind: "email",
      icon: FileText,
      taskTitle: "Demander documents pour préparation RDV",
      taskDescription: "Police actuelle, dernière déclaration, etc. selon le produit espéré.",
    },
  ],

  rdv_passe: [
    {
      id: "thanks_email",
      label: "Email de remerciement",
      kind: "email",
      icon: Mail,
      taskTitle: "Envoyer email de remerciement post-RDV",
      taskDescription: "Remercier le client pour le temps accordé et résumer les prochaines étapes.",
    },
    {
      id: "send_proposal",
      label: "Envoi de proposition",
      kind: "email",
      icon: Send,
      taskTitle: "Préparer et envoyer proposition commerciale",
      taskDescription: "Proposition détaillée pour {{expected_product}} chez {{expected_company}}.",
      priority: "high",
    },
    {
      id: "summary_rdv",
      label: "Récap écrit du RDV",
      kind: "email",
      icon: FileText,
      taskTitle: "Envoyer le récap écrit du RDV",
      taskDescription: "Points abordés, besoins identifiés, prochaines actions.",
    },
  ],

  // Colonne fusionnée "Signé · En attente" : templates signature + suivi compagnie
  signe: [
    {
      id: "request_supporting_docs",
      label: "Demande pièces complémentaires",
      kind: "email",
      icon: FileText,
      taskTitle: "Demander pièces complémentaires au client",
      taskDescription: "Selon le contrat à souscrire : CIN, dernière police, IBAN, etc.",
      priority: "high",
    },
    {
      id: "send_to_company",
      label: "Envoi à la compagnie",
      kind: "task",
      icon: Send,
      taskTitle: "Transmettre le mandat à {{expected_company}}",
      taskDescription: "Envoyer le mandat signé + pièces du client à la compagnie.",
      priority: "urgent",
    },
    {
      id: "internal_handoff",
      label: "Passage backoffice",
      kind: "task",
      icon: CheckCircle2,
      taskTitle: "Handoff backoffice pour saisie contrat",
      taskDescription: "Brief backoffice : produit, options, conditions spécifiques.",
      priority: "high",
    },
    {
      id: "follow_up_company",
      label: "Relance compagnie",
      kind: "email",
      icon: AlertTriangle,
      taskTitle: "Relancer {{expected_company}} pour le contrat",
      taskDescription: "Délai dépassé, demander point sur la souscription.",
      priority: "high",
    },
    {
      id: "client_status_update",
      label: "Statut au client",
      kind: "email",
      icon: Mail,
      taskTitle: "Informer le client du statut",
      taskDescription: "En attente de la compagnie, délai estimé.",
    },
  ],

  // Garde les templates 'attente_contrat' au cas où une opp y serait
  // mappée par erreur — mais en pratique on regroupe dans 'signe'.
  attente_contrat: [
    {
      id: "follow_up_company_legacy",
      label: "Relance compagnie",
      kind: "email",
      icon: AlertTriangle,
      taskTitle: "Relancer {{expected_company}} pour le contrat",
      taskDescription: "Délai dépassé, demander point sur la souscription.",
      priority: "high",
    },
  ],

  contrat_recu: [
    {
      id: "review_contract",
      label: "Vérifier le contrat reçu",
      kind: "task",
      icon: CheckCircle2,
      taskTitle: "Contrôler le contrat reçu de {{expected_company}}",
      taskDescription: "Vérifier conditions, primes, options, dates par rapport à ce qui a été convenu.",
      priority: "urgent",
    },
    {
      id: "send_to_client",
      label: "Envoi du contrat au client",
      kind: "email",
      icon: Send,
      taskTitle: "Envoyer le contrat reçu au client",
      taskDescription: "Joindre le contrat + explication des points importants.",
      priority: "high",
    },
  ],

  contrat_police: [
    {
      id: "welcome_email",
      label: "Email de bienvenue",
      kind: "email",
      icon: Mail,
      taskTitle: "Envoyer email de bienvenue post-souscription",
      taskDescription: "Confirmation contrat actif + récap des garanties + contact en cas de besoin.",
    },
    {
      id: "set_renewal_reminder",
      label: "Rappel renouvellement (11 mois)",
      kind: "task",
      icon: Calendar,
      taskTitle: "Rappel : préparer renouvellement",
      taskDescription: "11 mois après policiation : revoir le contrat avant échéance.",
    },
    {
      id: "request_review",
      label: "Demander avis Google",
      kind: "email",
      icon: CheckCircle2,
      taskTitle: "Demander un avis Google au client",
      taskDescription: "Email avec lien direct pour laisser un avis sur la fiche Google du cabinet.",
    },
  ],

  commission_recue: [
    {
      id: "internal_accounting_note",
      label: "Note comptabilité",
      kind: "task",
      icon: DollarSign,
      taskTitle: "Note compta : commission reçue",
      taskDescription: "Saisir la commission dans la compta + ventilation agent/cabinet.",
      priority: "high",
    },
    {
      id: "thank_client",
      label: "Email de fin de cycle",
      kind: "email",
      icon: Mail,
      taskTitle: "Email post-commission au client",
      taskDescription: "Merci pour la confiance, rappel des contacts disponibles.",
    },
  ],

  perdu: [
    {
      id: "post_mortem_email",
      label: "Email post-mortem",
      kind: "email",
      icon: Mail,
      taskTitle: "Email de courtoisie post-perte",
      taskDescription: "Remercier pour le temps accordé, rester disponible pour le futur.",
    },
    {
      id: "follow_up_3months",
      label: "Relance dans 3 mois",
      kind: "task",
      icon: Calendar,
      taskTitle: "Relancer le prospect dans 3 mois",
      taskDescription: "Reprendre contact pour voir si la situation a évolué.",
    },
  ],
};

/**
 * Remplace les variables {{xxx}} dans une string par les valeurs réelles
 * de l'opportunité.
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string | null | undefined>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key]?.toString() || `{{${key}}}`;
  });
}
