import { useState } from "react";
import { useTranslation } from "react-i18next";
import { 
  Globe, 
  Mail, 
  Palette, 
  Users, 
  CheckCircle2, 
  Circle,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  title: string;
  description: string;
  details: string[];
  links?: { label: string; url: string }[];
  commands?: { label: string; command: string }[];
}

interface Section {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  steps: Step[];
}

export default function TenantOnboarding() {
  const { t } = useTranslation();
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["subdomain"]));

  const sections: Section[] = [
    {
      id: "subdomain",
      icon: Globe,
      title: "Configuration du sous-domaine",
      description: "Création et configuration du sous-domaine personnalisé pour le tenant",
      steps: [
        {
          id: "subdomain-1",
          title: "1. Choisir le nom du sous-domaine",
          description: "Le sous-domaine sera au format: [nom-tenant].advisy.ch",
          details: [
            "Vérifier que le nom est disponible",
            "Utiliser uniquement des caractères alphanumériques et tirets",
            "Éviter les noms trop longs (max 20 caractères recommandé)",
            "Confirmer avec le client avant création"
          ]
        },
        {
          id: "subdomain-2",
          title: "2. Configurer les DNS",
          description: "Ajouter les enregistrements DNS chez le registrar",
          details: [
            "Créer un enregistrement A pointant vers l'IP du serveur",
            "Ajouter un enregistrement CNAME pour www si nécessaire",
            "Attendre la propagation DNS (jusqu'à 48h)",
            "Vérifier avec un outil comme dnschecker.org"
          ],
          commands: [
            { label: "Enregistrement A", command: "A    [tenant].advisy.ch    →    185.158.133.1" },
            { label: "Enregistrement CNAME", command: "CNAME    www.[tenant].advisy.ch    →    [tenant].advisy.ch" }
          ]
        },
        {
          id: "subdomain-3",
          title: "3. Activer SSL/HTTPS",
          description: "Certificat SSL automatique via Let's Encrypt",
          details: [
            "Le certificat est provisionné automatiquement après configuration DNS",
            "Vérifier que le site est accessible en HTTPS",
            "Configurer la redirection HTTP → HTTPS si nécessaire"
          ]
        },
        {
          id: "subdomain-4",
          title: "4. Configurer dans Lovable",
          description: "Ajouter le domaine personnalisé dans les paramètres Lovable",
          details: [
            "Aller dans Settings → Domains",
            "Cliquer sur 'Connect Domain'",
            "Entrer le sous-domaine complet",
            "Suivre les instructions de vérification"
          ],
          links: [
            { label: "Documentation domaines", url: "https://docs.lovable.dev/features/custom-domain" }
          ]
        }
      ]
    },
    {
      id: "emails",
      icon: Mail,
      title: "Configuration des emails",
      description: "Paramétrage des automatisations email et des redirections",
      steps: [
        {
          id: "email-1",
          title: "1. Configurer Resend pour le tenant",
          description: "Chaque tenant peut avoir son propre domaine d'envoi",
          details: [
            "Créer un compte Resend si non existant",
            "Valider le domaine d'envoi du tenant",
            "Configurer les enregistrements SPF, DKIM et DMARC",
            "Tester l'envoi avec un email de test"
          ],
          links: [
            { label: "Resend - Domaines", url: "https://resend.com/domains" },
            { label: "Resend - Clés API", url: "https://resend.com/api-keys" }
          ]
        },
        {
          id: "email-2",
          title: "2. Configurer les templates email",
          description: "Personnaliser les templates avec la marque du tenant",
          details: [
            "Dupliquer les templates par défaut",
            "Modifier le logo et les couleurs",
            "Adapter le contenu textuel",
            "Configurer l'adresse d'expéditeur (from)",
            "Ajouter les liens de désinscription légaux"
          ]
        },
        {
          id: "email-3",
          title: "3. Configurer les automatisations",
          description: "Activer et personnaliser les emails automatiques",
          details: [
            "Email de bienvenue nouveau client",
            "Rappel de renouvellement contrat",
            "Notification expiration document",
            "Confirmation de signature",
            "Résumé hebdomadaire (si activé)"
          ]
        },
        {
          id: "email-4",
          title: "4. Configurer les redirections",
          description: "S'assurer que les réponses arrivent au bon endroit",
          details: [
            "Configurer l'adresse de réponse (reply-to)",
            "Mettre en place un alias email si nécessaire",
            "Configurer le forwarding vers l'équipe du tenant",
            "Tester le flux complet de réponse"
          ]
        }
      ]
    },
    {
      id: "branding",
      icon: Palette,
      title: "Personnalisation visuelle",
      description: "Configuration de l'identité visuelle du tenant",
      steps: [
        {
          id: "branding-1",
          title: "1. Collecter les assets",
          description: "Récupérer tous les éléments visuels du client",
          details: [
            "Logo principal (format SVG ou PNG haute résolution)",
            "Logo secondaire / favicon",
            "Codes couleurs officiels (HEX/RGB)",
            "Police de caractères si spécifique",
            "Charte graphique complète si disponible"
          ]
        },
        {
          id: "branding-2",
          title: "2. Configurer le logo",
          description: "Uploader et configurer le logo du tenant",
          details: [
            "Aller dans les paramètres du tenant",
            "Uploader le logo principal",
            "Uploader le favicon",
            "Vérifier l'affichage en mode clair et sombre"
          ]
        },
        {
          id: "branding-3",
          title: "3. Configurer les couleurs",
          description: "Appliquer la palette de couleurs du tenant",
          details: [
            "Définir la couleur primaire",
            "Définir la couleur secondaire",
            "Configurer les couleurs d'accent",
            "Tester le contraste et l'accessibilité",
            "Vérifier la cohérence en mode sombre"
          ]
        },
        {
          id: "branding-4",
          title: "4. Configurer les informations",
          description: "Renseigner les informations légales et de contact",
          details: [
            "Nom complet de l'entreprise",
            "Adresse postale",
            "Numéro de téléphone principal",
            "Email de contact général",
            "Numéro FINMA/LEA si applicable"
          ]
        }
      ]
    },
    {
      id: "users",
      icon: Users,
      title: "Configuration des utilisateurs",
      description: "Création des comptes et attribution des rôles",
      steps: [
        {
          id: "users-1",
          title: "1. Créer le compte administrateur",
          description: "Premier utilisateur avec tous les droits",
          details: [
            "Utiliser la fonction 'Créer admin tenant' dans King",
            "Renseigner l'email professionnel de l'admin",
            "Définir un mot de passe temporaire sécurisé",
            "Envoyer l'email d'activation",
            "Vérifier que l'admin peut se connecter"
          ]
        },
        {
          id: "users-2",
          title: "2. Configurer les sièges",
          description: "Définir le nombre d'utilisateurs autorisés",
          details: [
            "Vérifier le plan souscrit (nombre de sièges inclus)",
            "Configurer la limite de sièges dans les paramètres",
            "Activer les notifications de quota si proche de la limite"
          ]
        },
        {
          id: "users-3",
          title: "3. Créer les rôles personnalisés",
          description: "Configurer les permissions spécifiques au tenant",
          details: [
            "Vérifier les rôles par défaut (Admin, Agent, Assistant)",
            "Créer des rôles personnalisés si nécessaire",
            "Définir les permissions par module",
            "Documenter les rôles créés"
          ]
        },
        {
          id: "users-4",
          title: "4. Former l'administrateur",
          description: "S'assurer que l'admin peut gérer son équipe",
          details: [
            "Expliquer comment ajouter des utilisateurs",
            "Montrer la gestion des permissions",
            "Présenter les rapports d'activité",
            "Fournir la documentation utilisateur"
          ],
          links: [
            { label: "Guide utilisateur", url: "/docs/user-guide" }
          ]
        }
      ]
    }
  ];

  const toggleStep = (stepId: string) => {
    const newCompleted = new Set(completedSteps);
    if (newCompleted.has(stepId)) {
      newCompleted.delete(stepId);
    } else {
      newCompleted.add(stepId);
    }
    setCompletedSteps(newCompleted);
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié dans le presse-papiers");
  };

  const getSectionProgress = (section: Section) => {
    const completed = section.steps.filter(step => completedSteps.has(step.id)).length;
    return { completed, total: section.steps.length };
  };

  const totalProgress = {
    completed: Array.from(completedSteps).length,
    total: sections.reduce((acc, section) => acc + section.steps.length, 0)
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Guide d'intégration Tenant</h1>
          <p className="text-muted-foreground mt-1">
            Checklist complète pour l'onboarding d'un nouveau tenant
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {totalProgress.completed} / {totalProgress.total} étapes
        </Badge>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {sections.map((section) => {
          const progress = getSectionProgress(section);
          const isComplete = progress.completed === progress.total;
          const Icon = section.icon;
          
          return (
            <Card 
              key={section.id} 
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                isComplete && "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
              )}
              onClick={() => toggleSection(section.id)}
            >
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    isComplete ? "bg-emerald-100 dark:bg-emerald-900" : "bg-muted"
                  )}>
                    <Icon className={cn(
                      "h-5 w-5",
                      isComplete ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{section.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {progress.completed} / {progress.total}
                    </p>
                  </div>
                  {isComplete && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sections Detail */}
      <div className="space-y-4">
        {sections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSections.has(section.id);
          const progress = getSectionProgress(section);
          
          return (
            <Card key={section.id}>
              <Collapsible open={isExpanded} onOpenChange={() => toggleSection(section.id)}>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <CardTitle className="flex items-center gap-2">
                        {section.title}
                        <Badge variant="secondary" className="ml-2">
                          {progress.completed}/{progress.total}
                        </Badge>
                      </CardTitle>
                      <CardDescription>{section.description}</CardDescription>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {section.steps.map((step) => {
                        const isCompleted = completedSteps.has(step.id);
                        
                        return (
                          <div 
                            key={step.id}
                            className={cn(
                              "p-4 rounded-lg border transition-all",
                              isCompleted 
                                ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" 
                                : "bg-muted/30 hover:bg-muted/50"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => toggleStep(step.id)}
                                className="mt-0.5 flex-shrink-0"
                              >
                                {isCompleted ? (
                                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                ) : (
                                  <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                                )}
                              </button>
                              
                              <div className="flex-1 space-y-2">
                                <div>
                                  <h4 className={cn(
                                    "font-medium",
                                    isCompleted && "line-through text-muted-foreground"
                                  )}>
                                    {step.title}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {step.description}
                                  </p>
                                </div>
                                
                                <ul className="text-sm space-y-1 ml-4">
                                  {step.details.map((detail, idx) => (
                                    <li key={idx} className="text-muted-foreground flex items-start gap-2">
                                      <span className="text-primary mt-1">•</span>
                                      {detail}
                                    </li>
                                  ))}
                                </ul>

                                {step.commands && step.commands.length > 0 && (
                                  <div className="space-y-2 mt-3">
                                    {step.commands.map((cmd, idx) => (
                                      <div key={idx} className="flex items-center gap-2">
                                        <code className="flex-1 bg-muted px-3 py-1.5 rounded text-xs font-mono">
                                          {cmd.command}
                                        </code>
                                        <Button 
                                          variant="ghost" 
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => copyToClipboard(cmd.command)}
                                        >
                                          <Copy className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {step.links && step.links.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-3">
                                    {step.links.map((link, idx) => (
                                      <Button
                                        key={idx}
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => window.open(link.url, '_blank')}
                                      >
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        {link.label}
                                      </Button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
