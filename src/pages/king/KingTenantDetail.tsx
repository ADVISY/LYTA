import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, 
  ChevronLeft, 
  Save, 
  Palette, 
  Shield, 
  Users, 
  FileText,
  ExternalLink,
  Trash2,
  AlertCircle,
  Plus,
  X,
  Mail
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TenantLogoUpload } from "@/components/king/TenantLogoUpload";

export default function KingTenantDetail() {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form states
  const [tenantData, setTenantData] = useState({
    name: "",
    legal_name: "",
    email: "",
    phone: "",
    address: "",
    slug: "",
    status: "test",
    contract_notification_emails: [] as string[],
  });
  const [newNotificationEmail, setNewNotificationEmail] = useState("");

  const [brandingData, setBrandingData] = useState({
    logo_url: "",
    primary_color: "#0066FF",
    secondary_color: "#1a1a2e",
    display_name: "",
  });

  // Fetch tenant data
  const { data: tenant, isLoading } = useQuery({
    queryKey: ['king-tenant', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select(`
          *,
          tenant_branding (*),
          tenant_security_settings (*)
        `)
        .eq('id', tenantId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch tenant stats
  const { data: stats } = useQuery({
    queryKey: ['king-tenant-stats', tenantId],
    queryFn: async () => {
      const [usersResult, clientsResult, policiesResult] = await Promise.all([
        supabase
          .from('user_tenant_assignments')
          .select('id', { count: 'exact' })
          .eq('tenant_id', tenantId),
        supabase
          .from('clients')
          .select('id', { count: 'exact' })
          .eq('tenant_id', tenantId),
        supabase
          .from('policies')
          .select('id', { count: 'exact' })
          .eq('tenant_id', tenantId),
      ]);

      return {
        users: usersResult.count || 0,
        clients: clientsResult.count || 0,
        policies: policiesResult.count || 0,
      };
    },
    enabled: !!tenantId,
  });

  // Update form states when data loads
  useEffect(() => {
    if (tenant) {
      setTenantData({
        name: tenant.name || "",
        legal_name: tenant.legal_name || "",
        email: tenant.email || "",
        phone: tenant.phone || "",
        address: tenant.address || "",
        slug: tenant.slug || "",
        status: tenant.status || "test",
        contract_notification_emails: tenant.contract_notification_emails || [],
      });

      if (tenant.tenant_branding?.[0]) {
        setBrandingData({
          logo_url: tenant.tenant_branding[0].logo_url || "",
          primary_color: tenant.tenant_branding[0].primary_color || "#0066FF",
          secondary_color: tenant.tenant_branding[0].secondary_color || "#1a1a2e",
          display_name: tenant.tenant_branding[0].display_name || "",
        });
      }
    }
  }, [tenant]);

  // Update tenant mutation
  const updateTenant = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: tenantData.name,
          legal_name: tenantData.legal_name,
          email: tenantData.email,
          phone: tenantData.phone,
          address: tenantData.address,
          status: tenantData.status,
          contract_notification_emails: tenantData.contract_notification_emails,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['king-tenant', tenantId] });
      toast({
        title: "Tenant mis à jour",
        description: "Les informations ont été enregistrées.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le tenant.",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  // Update branding mutation
  const updateBranding = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('tenant_branding')
        .update({
          logo_url: brandingData.logo_url || null,
          primary_color: brandingData.primary_color,
          secondary_color: brandingData.secondary_color,
          display_name: brandingData.display_name || null,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['king-tenant', tenantId] });
      toast({
        title: "Branding mis à jour",
        description: "Les modifications de branding ont été enregistrées.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le branding.",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Tenant non trouvé</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/king/tenants')}>
          Retour à la liste
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/king/tenants')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-4">
            <div 
              className="w-14 h-14 rounded-xl flex items-center justify-center"
              style={{ 
                backgroundColor: brandingData.primary_color 
                  ? `${brandingData.primary_color}20` 
                  : 'hsl(var(--primary) / 0.1)' 
              }}
            >
              {brandingData.logo_url ? (
                <img 
                  src={brandingData.logo_url} 
                  alt={tenant.name}
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <Building2 
                  className="h-7 w-7" 
                  style={{ color: brandingData.primary_color || 'hsl(var(--primary))' }}
                />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{tenant.name}</h1>
              <p className="text-muted-foreground">{tenant.slug}.lyta.ch</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <a 
              href={`https://${tenant.slug}.lyta.ch`} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Voir le site
            </a>
          </Button>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            tenant.status === 'active' 
              ? 'bg-emerald-500/10 text-emerald-600'
              : tenant.status === 'test'
              ? 'bg-blue-500/10 text-blue-600'
              : 'bg-red-500/10 text-red-600'
          }`}>
            {tenant.status === 'active' ? 'Actif' : tenant.status === 'test' ? 'Test' : 'Suspendu'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.users || 0}</p>
                <p className="text-sm text-muted-foreground">Utilisateurs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-emerald-500/10">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.clients || 0}</p>
                <p className="text-sm text-muted-foreground">Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-violet-500/10">
                <FileText className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.policies || 0}</p>
                <p className="text-sm text-muted-foreground">Contrats</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Général
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Sécurité
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
              <CardDescription>
                Informations de base du cabinet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom du cabinet</Label>
                  <Input
                    id="name"
                    value={tenantData.name}
                    onChange={(e) => setTenantData({ ...tenantData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legal_name">Raison sociale</Label>
                  <Input
                    id="legal_name"
                    value={tenantData.legal_name}
                    onChange={(e) => setTenantData({ ...tenantData, legal_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={tenantData.email}
                    onChange={(e) => setTenantData({ ...tenantData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    value={tenantData.phone}
                    onChange={(e) => setTenantData({ ...tenantData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Input
                    id="address"
                    value={tenantData.address}
                    onChange={(e) => setTenantData({ ...tenantData, address: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Sous-domaine</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="slug"
                      value={tenantData.slug}
                      disabled
                      className="bg-muted"
                    />
                    <span className="text-sm text-muted-foreground">.lyta.ch</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Statut</Label>
                  <Select 
                    value={tenantData.status} 
                    onValueChange={(value) => setTenantData({ ...tenantData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="test">Test</SelectItem>
                      <SelectItem value="suspended">Suspendu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Email notifications for contract deposits */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label className="text-base font-medium">Emails de notification (dépôt de contrats)</Label>
                    <p className="text-sm text-muted-foreground">
                      Ces adresses recevront les notifications lors du dépôt de nouveaux contrats
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {tenantData.contract_notification_emails.map((email, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={email}
                        readOnly
                        className="flex-1 bg-muted"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          const newEmails = tenantData.contract_notification_emails.filter((_, i) => i !== index);
                          const { error } = await supabase
                            .from('tenants')
                            .update({ contract_notification_emails: newEmails, updated_at: new Date().toISOString() })
                            .eq('id', tenantId);
                          if (error) {
                            console.error('Error removing email:', error);
                            toast({ title: "Erreur", description: "Impossible de supprimer l'email: " + error.message, variant: "destructive" });
                          } else {
                            setTenantData({ ...tenantData, contract_notification_emails: newEmails });
                            toast({ title: "Email supprimé", description: "La liste a été mise à jour." });
                            queryClient.invalidateQueries({ queryKey: ['king-tenant', tenantId] });
                          }
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  <div className="flex items-center gap-2">
                    <Input
                      type="email"
                      placeholder="email@exemple.com"
                      value={newNotificationEmail}
                      onChange={(e) => setNewNotificationEmail(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && newNotificationEmail && newNotificationEmail.includes('@')) {
                          e.preventDefault();
                          const emailToAdd = newNotificationEmail.trim().toLowerCase();
                          const newEmails = [...tenantData.contract_notification_emails, emailToAdd];
                          const { error } = await supabase
                            .from('tenants')
                            .update({ contract_notification_emails: newEmails, updated_at: new Date().toISOString() })
                            .eq('id', tenantId);
                          if (error) {
                            console.error('Error adding email:', error);
                            toast({ title: "Erreur", description: "Impossible d'ajouter l'email: " + error.message, variant: "destructive" });
                          } else {
                            setTenantData({ ...tenantData, contract_notification_emails: newEmails });
                            setNewNotificationEmail('');
                            toast({ title: "Email ajouté", description: `${emailToAdd} a été ajouté à la liste.` });
                            queryClient.invalidateQueries({ queryKey: ['king-tenant', tenantId] });
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={async () => {
                        if (newNotificationEmail && newNotificationEmail.includes('@')) {
                          const emailToAdd = newNotificationEmail.trim().toLowerCase();
                          const newEmails = [...tenantData.contract_notification_emails, emailToAdd];
                          const { error } = await supabase
                            .from('tenants')
                            .update({ contract_notification_emails: newEmails, updated_at: new Date().toISOString() })
                            .eq('id', tenantId);
                          if (error) {
                            console.error('Error adding email:', error);
                            toast({ title: "Erreur", description: "Impossible d'ajouter l'email: " + error.message, variant: "destructive" });
                          } else {
                            setTenantData({ ...tenantData, contract_notification_emails: newEmails });
                            setNewNotificationEmail('');
                            toast({ title: "Email ajouté", description: `${emailToAdd} a été ajouté à la liste.` });
                            queryClient.invalidateQueries({ queryKey: ['king-tenant', tenantId] });
                          }
                        }
                      }}
                      disabled={!newNotificationEmail || !newNotificationEmail.includes('@')}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={() => updateTenant.mutate()}
                  disabled={updateTenant.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateTenant.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Personnalisation</CardTitle>
              <CardDescription>
                Logo et couleurs du cabinet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Logo du cabinet</Label>
                    <TenantLogoUpload
                      currentLogoUrl={brandingData.logo_url}
                      onUploadComplete={(url) => setBrandingData({ ...brandingData, logo_url: url })}
                      tenantSlug={tenant?.slug}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="display_name">Nom affiché</Label>
                    <Input
                      id="display_name"
                      placeholder="Nom à afficher sur l'interface"
                      value={brandingData.display_name}
                      onChange={(e) => setBrandingData({ ...brandingData, display_name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primary_color">Couleur principale</Label>
                      <div className="flex gap-2">
                        <Input
                          id="primary_color"
                          type="color"
                          value={brandingData.primary_color}
                          onChange={(e) => setBrandingData({ ...brandingData, primary_color: e.target.value })}
                          className="w-14 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={brandingData.primary_color}
                          onChange={(e) => setBrandingData({ ...brandingData, primary_color: e.target.value })}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secondary_color">Couleur secondaire</Label>
                      <div className="flex gap-2">
                        <Input
                          id="secondary_color"
                          type="color"
                          value={brandingData.secondary_color}
                          onChange={(e) => setBrandingData({ ...brandingData, secondary_color: e.target.value })}
                          className="w-14 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={brandingData.secondary_color}
                          onChange={(e) => setBrandingData({ ...brandingData, secondary_color: e.target.value })}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="space-y-4">
                  <Label>Aperçu</Label>
                  <div 
                    className="border rounded-xl p-6 space-y-4"
                    style={{ borderColor: brandingData.primary_color }}
                  >
                    <div className="flex items-center gap-4">
                      {brandingData.logo_url ? (
                        <img 
                          src={brandingData.logo_url} 
                          alt="Logo preview" 
                          className="h-12 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div 
                          className="w-12 h-12 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${brandingData.primary_color}20` }}
                        >
                          <Building2 
                            className="h-6 w-6" 
                            style={{ color: brandingData.primary_color }}
                          />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold" style={{ color: brandingData.primary_color }}>
                          {brandingData.display_name || tenantData.name || "Nom du cabinet"}
                        </p>
                        <p className="text-sm text-muted-foreground">{tenantData.slug}.lyta.ch</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div 
                        className="px-4 py-2 rounded-lg text-white text-sm"
                        style={{ backgroundColor: brandingData.primary_color }}
                      >
                        Bouton principal
                      </div>
                      <div 
                        className="px-4 py-2 rounded-lg text-white text-sm"
                        style={{ backgroundColor: brandingData.secondary_color }}
                      >
                        Bouton secondaire
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={() => updateBranding.mutate()}
                  disabled={updateBranding.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateBranding.isPending ? "Enregistrement..." : "Enregistrer le branding"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Paramètres de sécurité</CardTitle>
              <CardDescription>
                Configuration de sécurité du tenant
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Les paramètres de sécurité détaillés seront disponibles prochainement.
                  </p>
                </div>
                
                {tenant.tenant_security_settings?.[0] && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 border rounded-lg">
                      <p className="font-medium">2FA Connexion</p>
                      <p className="text-sm text-muted-foreground">
                        {tenant.tenant_security_settings[0].enable_2fa_login ? "Activé" : "Désactivé"}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="font-medium">2FA Contrats</p>
                      <p className="text-sm text-muted-foreground">
                        {tenant.tenant_security_settings[0].enable_2fa_contract ? "Activé" : "Désactivé"}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="font-medium">Longueur mot de passe</p>
                      <p className="text-sm text-muted-foreground">
                        Minimum {tenant.tenant_security_settings[0].password_min_length} caractères
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="mt-6 border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Zone de danger</CardTitle>
              <CardDescription>
                Actions irréversibles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer ce tenant
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Toutes les données associées à ce tenant 
                      seront définitivement supprimées (utilisateurs, clients, contrats, etc.).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction 
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        toast({
                          title: "Non implémenté",
                          description: "La suppression de tenant n'est pas encore disponible.",
                          variant: "destructive",
                        });
                      }}
                    >
                      Supprimer définitivement
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}