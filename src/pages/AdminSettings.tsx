import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Database, Bell, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettings() {
  const { toast } = useToast();

  const settingsSections = [
    {
      title: "Base de données",
      icon: <Database className="h-5 w-5" />,
      description: "Gérer les compagnies d'assurance et les produits",
      action: () => toast({ title: "Base de données", description: "Configuration en développement" })
    },
    {
      title: "Notifications",
      icon: <Bell className="h-5 w-5" />,
      description: "Configurer les notifications système",
      action: () => toast({ title: "Notifications", description: "Configuration en développement" })
    },
    {
      title: "Email & SMS",
      icon: <Mail className="h-5 w-5" />,
      description: "Configurer les intégrations SendGrid et Twilio",
      action: () => toast({ title: "Email & SMS", description: "Configuration en développement" })
    },
    {
      title: "Sécurité",
      icon: <Shield className="h-5 w-5" />,
      description: "Gérer les permissions et les politiques RLS",
      action: () => toast({ title: "Sécurité", description: "Configuration en développement" })
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
          Paramètres
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Configurer le système et les intégrations
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {settingsSections.map((section) => (
          <Card key={section.title} className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  {section.icon}
                </div>
                <CardTitle className="text-slate-800 dark:text-slate-100">
                  {section.title}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                {section.description}
              </p>
              <Button onClick={section.action} variant="outline" className="w-full">
                Configurer
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
