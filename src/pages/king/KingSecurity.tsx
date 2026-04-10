import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Key, Lock, Eye, Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useToast } from "@/hooks/use-toast";

interface IpWhitelistEntry {
  id: string;
  ip_address: string;
  label: string | null;
  created_at: string;
  created_by: string | null;
}

interface AuditNotification {
  id: string;
  title: string;
  message: string | null;
  kind: string;
  created_at: string;
}

export default function KingSecurity() {
  const { settings, loading: settingsLoading, getSetting, saveSettings, saving } = usePlatformSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for settings
  const [twoFaRequired, setTwoFaRequired] = useState(false);
  const [ipWhitelistEnabled, setIpWhitelistEnabled] = useState(false);
  const [auditTrailEnabled, setAuditTrailEnabled] = useState(true);

  // State for IP form
  const [newIp, setNewIp] = useState("");
  const [newIpLabel, setNewIpLabel] = useState("");
  const [addingIp, setAddingIp] = useState(false);

  // Initialize from settings
  useEffect(() => {
    if (settings.length > 0) {
      const twoFa = getSetting("king_2fa_required", false);
      const ipEnabled = getSetting("king_ip_whitelist_enabled", false);
      const audit = getSetting("king_audit_trail_enabled", true);

      setTwoFaRequired(twoFa === true || twoFa === "true");
      setIpWhitelistEnabled(ipEnabled === true || ipEnabled === "true");
      setAuditTrailEnabled(audit === true || audit === "true");
    }
  }, [settings]);

  // Fetch IP whitelist
  const { data: ipList, isLoading: ipLoading } = useQuery({
    queryKey: ["king-ip-whitelist"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("king_ip_whitelist")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching IP whitelist:", error);
        throw error;
      }
      return (data || []) as IpWhitelistEntry[];
    },
    staleTime: 30000,
  });

  // Fetch audit trail from king_notifications
  const { data: auditLog, isLoading: auditLoading } = useQuery({
    queryKey: ["king-security-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("king_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching audit log:", error);
        throw error;
      }
      return (data || []) as AuditNotification[];
    },
    staleTime: 30000,
  });

  // Save security settings
  const handleSaveSettings = async () => {
    const changes: Record<string, unknown> = {};

    const current2fa = getSetting("king_2fa_required", false);
    const currentIpEnabled = getSetting("king_ip_whitelist_enabled", false);
    const currentAudit = getSetting("king_audit_trail_enabled", true);

    if (twoFaRequired !== (current2fa === true || current2fa === "true"))
      changes.king_2fa_required = twoFaRequired;
    if (ipWhitelistEnabled !== (currentIpEnabled === true || currentIpEnabled === "true"))
      changes.king_ip_whitelist_enabled = ipWhitelistEnabled;
    if (auditTrailEnabled !== (currentAudit === true || currentAudit === "true"))
      changes.king_audit_trail_enabled = auditTrailEnabled;

    if (Object.keys(changes).length === 0) return;
    await saveSettings(changes);
  };

  // Add IP to whitelist
  const handleAddIp = async () => {
    if (!newIp.trim()) return;
    setAddingIp(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const { error } = await (supabase.from as any)("king_ip_whitelist").insert({
        ip_address: newIp.trim(),
        label: newIpLabel.trim() || null,
        created_by: session.session?.user?.id || null,
      });

      if (error) throw error;

      setNewIp("");
      setNewIpLabel("");
      queryClient.invalidateQueries({ queryKey: ["king-ip-whitelist"] });
      toast({ title: "IP ajoutÃ©e", description: `${newIp} a Ã©tÃ© ajoutÃ©e Ã  la whitelist.` });
    } catch (error: any) {
      console.error("Error adding IP:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'ajouter l'adresse IP.",
        variant: "destructive",
      });
    } finally {
      setAddingIp(false);
    }
  };

  // Delete IP from whitelist
  const handleDeleteIp = async (id: string) => {
    try {
      const { error } = await (supabase.from as any)("king_ip_whitelist")
        .delete()
        .eq("id", id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["king-ip-whitelist"] });
      toast({ title: "IP supprimÃ©e", description: "L'adresse IP a Ã©tÃ© retirÃ©e de la whitelist." });
    } catch (error: any) {
      console.error("Error deleting IP:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer l'adresse IP.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("fr-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (settingsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-56" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">SÃ©curitÃ© Plateforme</h1>
        <p className="text-muted-foreground">ParamÃ¨tres de sÃ©curitÃ© globaux de LYTA</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Key className="h-5 w-5 text-amber-500" />
              Authentification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">2FA obligatoire KING</p>
                <p className="text-sm text-muted-foreground">
                  Imposer 2FA pour tous les super admins
                </p>
              </div>
              <Switch
                checked={twoFaRequired}
                onCheckedChange={setTwoFaRequired}
              />
            </div>
            <div className="space-y-2">
              <Label>Deconnexion forcee</Label>
              <p className="text-xs text-muted-foreground">
                Tous les utilisateurs sont automatiquement deconnectes 60 minutes apres leur connexion.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Access */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-5 w-5 text-amber-500" />
              AccÃ¨s
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">IP Whitelist</p>
                <p className="text-sm text-muted-foreground">
                  Limiter accÃ¨s par adresses IP
                </p>
              </div>
              <Switch
                checked={ipWhitelistEnabled}
                onCheckedChange={setIpWhitelistEnabled}
              />
            </div>

            {/* IP add form */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="192.168.1.0/24"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Label"
                  value={newIpLabel}
                  onChange={(e) => setNewIpLabel(e.target.value)}
                  className="w-32"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleAddIp}
                  disabled={addingIp || !newIp.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* IP list */}
              {ipLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(ipList || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Aucune IP dans la whitelist
                    </p>
                  ) : (
                    (ipList || []).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between text-sm px-3 py-2 bg-muted rounded-md"
                      >
                        <div>
                          <span className="font-mono">{entry.ip_address}</span>
                          {entry.label && (
                            <span className="text-muted-foreground ml-2">
                              ({entry.label})
                            </span>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteIp(entry.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Audit Trail */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="h-5 w-5 text-amber-500" />
              Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !auditLog || auditLog.length === 0 ? (
              <div className="text-center py-8">
                <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Aucune entrÃ©e d'audit pour le moment
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between px-4 py-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {entry.title}
                      </p>
                      {entry.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {entry.message}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {formatDate(entry.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          className="bg-amber-500 hover:bg-amber-600"
          onClick={handleSaveSettings}
          disabled={saving}
        >
          <Shield className="h-4 w-4 mr-2" />
          {saving ? "Sauvegarde..." : "Sauvegarder la sÃ©curitÃ©"}
        </Button>
      </div>
    </div>
  );
}
