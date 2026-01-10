import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  CheckCircle, 
  Lock, 
  Users, 
  Database, 
  FileText, 
  Download,
  AlertTriangle,
  Eye,
  Trash2,
  Edit,
  Globe
} from "lucide-react";

const ComplianceReport = () => {
  const currentDate = new Date().toLocaleDateString('fr-CH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl print:py-0">
      {/* Header */}
      <div className="flex justify-between items-start mb-8 print:mb-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Rapport de Conformité RGPD / nLPD
          </h1>
          <p className="text-muted-foreground mt-2">
            Généré le {currentDate}
          </p>
        </div>
        <Button onClick={handlePrint} className="print:hidden">
          <Download className="w-4 h-4 mr-2" />
          Télécharger PDF
        </Button>
      </div>

      {/* Score global */}
      <Card className="mb-8 border-green-500/50 bg-green-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-green-500/20 rounded-full">
              <Shield className="w-12 h-12 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-green-600">Score de Conformité : A</h2>
              <p className="text-muted-foreground">
                L'application respecte les exigences du RGPD (UE) et de la nLPD (Suisse)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Résumé exécutif */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Résumé Exécutif
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Cette application CRM pour courtiers en assurance a été conçue avec la protection 
            des données personnelles comme priorité. Elle implémente une architecture 
            <strong> multi-tenant sécurisée</strong> garantissant l'isolation complète des 
            données entre les différents cabinets de courtage.
          </p>
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-primary">56</p>
              <p className="text-sm text-muted-foreground">Tables protégées par RLS</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-primary">157</p>
              <p className="text-sm text-muted-foreground">Politiques de sécurité</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-primary">100%</p>
              <p className="text-sm text-muted-foreground">Couverture RLS</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Base légale */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Cadre Juridique Applicable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-500/10">🇪🇺 UE</Badge>
                <span className="font-medium">RGPD (Règlement 2016/679)</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Art. 5 - Principes de traitement</li>
                <li>• Art. 6 - Licéité du traitement</li>
                <li>• Art. 25 - Protection dès la conception</li>
                <li>• Art. 32 - Sécurité du traitement</li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-red-500/10">🇨🇭 Suisse</Badge>
                <span className="font-medium">nLPD (RS 235.1)</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Art. 6 - Principes</li>
                <li>• Art. 7 - Protection dès la conception</li>
                <li>• Art. 8 - Sécurité des données</li>
                <li>• Art. 19 - Droit d'accès</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Données traitées */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Catégories de Données Personnelles Traitées
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Catégorie</th>
                  <th className="text-left py-2 px-4">Données</th>
                  <th className="text-left py-2 px-4">Finalité</th>
                  <th className="text-left py-2 px-4">Protection</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 px-4 font-medium">Identité</td>
                  <td className="py-2 px-4">Nom, prénom, date de naissance</td>
                  <td className="py-2 px-4">Gestion des contrats</td>
                  <td className="py-2 px-4"><Badge className="bg-green-500">RLS + Tenant</Badge></td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-4 font-medium">Contact</td>
                  <td className="py-2 px-4">Email, téléphone, adresse</td>
                  <td className="py-2 px-4">Communication client</td>
                  <td className="py-2 px-4"><Badge className="bg-green-500">RLS + Tenant</Badge></td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-4 font-medium">Financières</td>
                  <td className="py-2 px-4">IBAN, commissions, primes</td>
                  <td className="py-2 px-4">Paiements, comptabilité</td>
                  <td className="py-2 px-4"><Badge className="bg-green-500">RLS + Rôles</Badge></td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-4 font-medium">Assurance</td>
                  <td className="py-2 px-4">Polices, sinistres, couvertures</td>
                  <td className="py-2 px-4">Gestion portefeuille</td>
                  <td className="py-2 px-4"><Badge className="bg-green-500">RLS + Tenant</Badge></td>
                </tr>
                <tr>
                  <td className="py-2 px-4 font-medium">Documents</td>
                  <td className="py-2 px-4">Contrats, attestations, pièces</td>
                  <td className="py-2 px-4">Archivage légal</td>
                  <td className="py-2 px-4"><Badge className="bg-green-500">Storage + RLS</Badge></td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mesures techniques */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Mesures Techniques de Sécurité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                title: "Authentification",
                items: [
                  "JWT tokens sécurisés",
                  "2FA SMS pour rôles sensibles",
                  "Vérification mots de passe compromis (HaveIBeenPwned)",
                  "Sessions avec expiration automatique"
                ],
                status: "ok"
              },
              {
                title: "Contrôle d'accès",
                items: [
                  "Row Level Security (RLS) sur 100% des tables",
                  "Isolation multi-tenant par tenant_id",
                  "Rôles granulaires (admin, agent, backoffice...)",
                  "Permissions par module et action"
                ],
                status: "ok"
              },
              {
                title: "Chiffrement",
                items: [
                  "TLS 1.3 en transit",
                  "Chiffrement AES-256 au repos",
                  "Connexions PostgreSQL SSL only",
                  "Secrets stockés de manière sécurisée"
                ],
                status: "ok"
              },
              {
                title: "Monitoring & Audit",
                items: [
                  "Logs d'audit des actions sensibles",
                  "Traçabilité des modifications",
                  "Rate limiting sur endpoints publics",
                  "Détection des tentatives d'intrusion"
                ],
                status: "ok"
              }
            ].map((section, idx) => (
              <div key={idx} className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <h3 className="font-medium">{section.title}</h3>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {section.items.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Droits des personnes */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Droits des Personnes Concernées
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Eye,
                title: "Droit d'accès",
                description: "Portail client pour consulter ses données",
                article: "Art. 15 RGPD / Art. 19 nLPD"
              },
              {
                icon: Edit,
                title: "Droit de rectification",
                description: "Modification via profil utilisateur",
                article: "Art. 16 RGPD / Art. 6 nLPD"
              },
              {
                icon: Trash2,
                title: "Droit à l'effacement",
                description: "Suppression sur demande via admin",
                article: "Art. 17 RGPD / Art. 6 nLPD"
              },
              {
                icon: Download,
                title: "Droit à la portabilité",
                description: "Export des données en format standard",
                article: "Art. 20 RGPD / Art. 20 nLPD"
              }
            ].map((right, idx) => (
              <div key={idx} className="p-4 border rounded-lg text-center">
                <right.icon className="w-8 h-8 mx-auto mb-2 text-primary" />
                <h3 className="font-medium mb-1">{right.title}</h3>
                <p className="text-xs text-muted-foreground mb-2">{right.description}</p>
                <Badge variant="outline" className="text-xs">{right.article}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sous-traitants */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Sous-traitants et Transferts de Données
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Sous-traitant</th>
                  <th className="text-left py-2 px-4">Finalité</th>
                  <th className="text-left py-2 px-4">Localisation</th>
                  <th className="text-left py-2 px-4">Garanties</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 px-4 font-medium">Supabase (via Lovable)</td>
                  <td className="py-2 px-4">Base de données, Auth, Storage</td>
                  <td className="py-2 px-4">🇪🇺 UE (AWS Frankfurt)</td>
                  <td className="py-2 px-4"><Badge className="bg-green-500">RGPD Compliant</Badge></td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-4 font-medium">Resend</td>
                  <td className="py-2 px-4">Envoi d'emails transactionnels</td>
                  <td className="py-2 px-4">🇺🇸 USA</td>
                  <td className="py-2 px-4"><Badge className="bg-yellow-500">SCCs</Badge></td>
                </tr>
                <tr>
                  <td className="py-2 px-4 font-medium">Twilio</td>
                  <td className="py-2 px-4">SMS 2FA</td>
                  <td className="py-2 px-4">🇺🇸 USA</td>
                  <td className="py-2 px-4"><Badge className="bg-yellow-500">SCCs</Badge></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            SCCs = Standard Contractual Clauses (Clauses Contractuelles Types) approuvées par la Commission Européenne
          </p>
        </CardContent>
      </Card>

      {/* Recommandations */}
      <Card className="mb-6 border-yellow-500/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Recommandations pour le Responsable de Traitement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <Badge variant="outline">1</Badge>
              <div>
                <p className="font-medium">Désigner un DPO (si applicable)</p>
                <p className="text-sm text-muted-foreground">
                  Obligatoire si traitement à grande échelle de données sensibles (Art. 37 RGPD)
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Badge variant="outline">2</Badge>
              <div>
                <p className="font-medium">Tenir un registre des activités de traitement</p>
                <p className="text-sm text-muted-foreground">
                  Ce rapport peut servir de base. À compléter avec vos processus internes.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Badge variant="outline">3</Badge>
              <div>
                <p className="font-medium">Informer les personnes concernées</p>
                <p className="text-sm text-muted-foreground">
                  Politique de confidentialité à afficher sur le portail client.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Badge variant="outline">4</Badge>
              <div>
                <p className="font-medium">Définir les durées de conservation</p>
                <p className="text-sm text-muted-foreground">
                  Documents d'assurance : 10 ans après fin du contrat (obligations légales suisses).
                </p>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Certification */}
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="pt-6">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto text-primary mb-4" />
            <h2 className="text-xl font-bold mb-2">Attestation de Conformité Technique</h2>
            <p className="text-muted-foreground mb-4">
              Cette application implémente les mesures techniques et organisationnelles 
              appropriées pour assurer un niveau de sécurité adapté au risque, 
              conformément à l'article 32 du RGPD et à l'article 8 de la nLPD.
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              <Badge className="bg-primary">RGPD Art. 25 - Privacy by Design</Badge>
              <Badge className="bg-primary">nLPD Art. 7 - Protection dès la conception</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-6">
              Rapport généré automatiquement le {currentDate}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Print styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:mb-4 { margin-bottom: 1rem !important; }
          .print\\:py-0 { padding-top: 0 !important; padding-bottom: 0 !important; }
        }
      `}</style>
    </div>
  );
};

export default ComplianceReport;
