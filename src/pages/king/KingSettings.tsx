import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Globe, Mail, CreditCard, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";

export default function KingSettings() {
  const { settings, loading, getSetting, saveSettings, saving } = usePlatformSettings();

  const [senderEmail, setSenderEmail] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [notifyNewClient, setNotifyNewClient] = useState(true);
  const [notifySuspended, setNotifySuspended] = useState(true);

  // Initialize state from settings when loaded
  useEffect(() => {
    if (settings.length > 0) {
      const sender = getSetting("platform_sender_email", "noreply@lyta.ch");
      const support = getSetting("platform_support_email", "support@lyta.ch");
      const price = getSetting("platform_default_price", 299);
      const newClient = getSetting("notification_new_client", true);
      const suspended = getSetting("notification_suspended", true);

      setSenderEmail(typeof sender === "string" ? sender : String(sender ?? ""));
      setSupportEmail(typeof support === "string" ? support : String(support ?? ""));
      setDefaultPrice(String(price ?? "299"));
      setNotifyNewClient(newClient === true || newClient === "true");
      setNotifySuspended(suspended === true || suspended === "true");
    }
  }, [settings]);

  const handleSave = async () => {
    const changes: Record<string, unknown> = {};

    const currentSender = getSetting("platform_sender_email", "");
    const currentSupport = getSetting("platform_support_email", "");
    const currentPrice = getSetting("platform_default_price", 299);
    const currentNewClient = getSetting("notification_new_client", true);
    const currentSuspended = getSetting("notification_suspended", true);

    if (senderEmail !== currentSender) changes.platform_sender_email = senderEmail;
    if (supportEmail !== currentSupport) changes.platform_support_email = supportEmail;
    if (String(defaultPrice) !== String(currentPrice)) changes.platform_default_price = Number(defaultPrice);

    const currentNewClientBool = currentNewClient === true || currentNewClient === "true";
    const currentSuspendedBool = currentSuspended === true || currentSuspended === "true";
    if (notifyNewClient !== currentNewClientBool) changes.notification_new_client = notifyNewClient;
    if (notifySuspended !== currentSuspendedBool) changes.notification_suspended = notifySuspended;

    if (Object.keys(changes).length === 0) return;
    await saveSettings(changes);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Paramètres Plateforme</h1>
        <p className="text-muted-foreground">Configuration globale de LYTA</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5 text-amber-500" />
              Domaine
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Domaine principal</Label>
              <Input value="lyta.ch" disabled />
            </div>
            <div className="space-y-2">
              <Label>Format sous-domaine</Label>
              <Input value="{slug}.lyta.ch" disabled />
            </div>
            <p className="text-xs text-muted-foreground">
              Configuration DNS gérée par l'équipe technique
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-amber-500" />
              Emails
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email expéditeur</Label>
              <Input
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="noreply@lyta.ch"
              />
            </div>
            <div className="space-y-2">
              <Label>Email support</Label>
              <Input
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@lyta.ch"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-amber-500" />
              Facturation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Stripe connecté</p>
                <p className="text-sm text-muted-foreground">
                  Pour la facturation automatique
                </p>
              </div>
              <span className="text-xs px-2 py-1 bg-green-500/10 text-green-600 rounded-full">
                Actif
              </span>
            </div>
            <div className="space-y-2">
              <Label>Prix mensuel par défaut</Label>
              <Input
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(e.target.value)}
                placeholder="299"
                type="number"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5 text-amber-500" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Nouveau client</p>
                <p className="text-sm text-muted-foreground">
                  Notifier lors d'une inscription
                </p>
              </div>
              <Switch
                checked={notifyNewClient}
                onCheckedChange={setNotifyNewClient}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Client suspendu</p>
                <p className="text-sm text-muted-foreground">
                  Alerter en cas de suspension
                </p>
              </div>
              <Switch
                checked={notifySuspended}
                onCheckedChange={setNotifySuspended}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          className="bg-amber-500 hover:bg-amber-600"
          onClick={handleSave}
          disabled={saving}
        >
          <Settings className="h-4 w-4 mr-2" />
          {saving ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
      </div>
    </div>
  );
}
