import { useState } from "react";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, FileText, Eye, Copy, Lock, Mail, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  category: string | null;
  variables: string[] | null;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
}

const CATEGORIES = [
  { value: "transactional", label: "Transactionnel" },
  { value: "marketing", label: "Marketing" },
  { value: "notification", label: "Notification" },
  { value: "reminder", label: "Rappel" },
  { value: "onboarding", label: "Onboarding" },
  { value: "sms", label: "SMS" },
];

// Pre-built templates
const DEFAULT_TEMPLATES = {
  email: [
    {
      name: "Bienvenue Client",
      subject: "Bienvenue chez {{company_name}} !",
      body_html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #0EA5E9;">Bienvenue {{client_name}} !</h1>
  <p>Nous sommes ravis de vous compter parmi nos clients.</p>
  <p>Notre équipe est à votre disposition pour répondre à toutes vos questions concernant vos assurances.</p>
  <p style="margin-top: 30px;">
    <a href="{{login_url}}" style="background: #0EA5E9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Accéder à mon espace</a>
  </p>
  <p style="margin-top: 30px; color: #666;">À bientôt,<br>L'équipe {{company_name}}</p>
</div>`,
      category: "onboarding",
    },
    {
      name: "Confirmation Contrat",
      subject: "Votre contrat {{contract_type}} est confirmé",
      body_html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #10B981;">✓ Contrat confirmé</h1>
  <p>Bonjour {{client_name}},</p>
  <p>Nous vous confirmons la souscription de votre contrat <strong>{{contract_type}}</strong>.</p>
  <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p><strong>Détails du contrat:</strong></p>
    <ul>
      <li>Type: {{contract_type}}</li>
      <li>Compagnie: {{company_name}}</li>
      <li>Date d'effet: {{start_date}}</li>
    </ul>
  </div>
  <p>Vous pouvez consulter tous vos documents dans votre espace client.</p>
</div>`,
      category: "transactional",
    },
    {
      name: "Rappel Renouvellement",
      subject: "Votre contrat arrive à échéance dans {{days}} jours",
      body_html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #F59E0B;">⏰ Rappel de renouvellement</h1>
  <p>Bonjour {{client_name}},</p>
  <p>Votre contrat <strong>{{contract_type}}</strong> arrive à échéance le <strong>{{end_date}}</strong>.</p>
  <p>Contactez-nous dès maintenant pour discuter de votre renouvellement et bénéficier des meilleures conditions.</p>
  <p style="margin-top: 30px;">
    <a href="tel:{{agent_phone}}" style="background: #F59E0B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Nous appeler</a>
  </p>
</div>`,
      category: "reminder",
    },
    {
      name: "Offre Spéciale",
      subject: "🎁 Offre exclusive pour vous {{client_name}}",
      body_html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); padding: 40px; border-radius: 12px; text-align: center; color: white;">
    <h1>🎁 Offre Exclusive</h1>
    <p style="font-size: 18px;">Profitez de -20% sur votre nouvelle assurance</p>
  </div>
  <div style="padding: 30px;">
    <p>Bonjour {{client_name}},</p>
    <p>En tant que client fidèle, nous vous proposons une offre exclusive sur nos produits d'assurance.</p>
    <p><strong>Cette offre est valable jusqu'au {{end_date}}</strong></p>
    <p style="text-align: center; margin-top: 30px;">
      <a href="{{offer_url}}" style="background: #6366F1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">Découvrir l'offre</a>
    </p>
  </div>
</div>`,
      category: "marketing",
    },
    {
      name: "Anniversaire Client",
      subject: "🎂 Joyeux anniversaire {{client_name}} !",
      body_html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; text-align: center;">
  <div style="font-size: 60px; margin: 30px 0;">🎂</div>
  <h1 style="color: #EC4899;">Joyeux Anniversaire !</h1>
  <p style="font-size: 18px;">Cher(e) {{client_name}},</p>
  <p>Toute l'équipe {{company_name}} vous souhaite un merveilleux anniversaire !</p>
  <p style="color: #666; margin-top: 30px;">Que cette nouvelle année vous apporte bonheur et sérénité.</p>
</div>`,
      category: "notification",
    },
  ],
  sms: [
    {
      name: "Rappel RDV",
      subject: "SMS - Rappel RDV",
      body_html: "Rappel: Votre RDV avec {{agent_name}} est prévu demain à {{time}}. Confirmez au {{phone}}",
      category: "sms",
    },
    {
      name: "Confirmation Signature",
      subject: "SMS - Signature confirmée",
      body_html: "{{client_name}}, votre contrat a été signé avec succès ! Consultez votre espace client pour les détails.",
      category: "sms",
    },
    {
      name: "Rappel Paiement",
      subject: "SMS - Rappel paiement",
      body_html: "Rappel: Votre prime d'assurance de {{amount}} CHF est due le {{due_date}}. Merci de régulariser.",
      category: "sms",
    },
  ],
};

export const EmailTemplatesList = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [templateType, setTemplateType] = useState<"email" | "sms">("email");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    body_html: "",
    body_text: "",
    category: "transactional",
    is_active: true,
  });

  const humanizeIdentifier = (raw: string) => {
    const spaced = raw
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!spaced) return raw;
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  };

  const getTemplateDisplayName = (template?: EmailTemplate | null) => {
    if (!template) return "";
    if (!template.is_system) return template.name;
    return t(`templates.system.${template.name}`, {
      defaultValue: humanizeIdentifier(template.name),
    });
  };

  const { data: templates, isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("is_system", { ascending: false })
        .order("name");
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("email_templates").insert({
        name: data.name,
        subject: data.subject,
        body_html: data.body_html,
        body_text: data.body_text || null,
        category: data.category,
        is_active: data.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast({ title: "Template créé avec succès" });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("email_templates")
        .update({
          name: data.name,
          subject: data.subject,
          body_html: data.body_html,
          body_text: data.body_text || null,
          category: data.category,
          is_active: data.is_active,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast({ title: "Template mis à jour" });
      setIsEditOpen(false);
      setSelectedTemplate(null);
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast({ title: "Template supprimé" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  const importDefaultTemplates = async () => {
    const templatesToImport = templateType === "email" ? DEFAULT_TEMPLATES.email : DEFAULT_TEMPLATES.sms;
    
    for (const template of templatesToImport) {
      await supabase.from("email_templates").insert({
        name: template.name,
        subject: template.subject,
        body_html: template.body_html,
        category: template.category,
        is_active: true,
        is_system: false,
      });
    }
    
    queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    toast({ title: `${templatesToImport.length} templates importés` });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      subject: "",
      body_html: "",
      body_text: "",
      category: templateType === "sms" ? "sms" : "transactional",
      is_active: true,
    });
  };

  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body_html: template.body_html,
      body_text: template.body_text || "",
      category: template.category || "transactional",
      is_active: template.is_active,
    });
    setIsEditOpen(true);
  };

  const handleDuplicate = (template: EmailTemplate) => {
    setFormData({
      name: `${getTemplateDisplayName(template)} (copie)`,
      subject: template.subject,
      body_html: template.body_html,
      body_text: template.body_text || "",
      category: template.category || "transactional",
      is_active: true,
    });
    setIsCreateOpen(true);
  };

  const filteredTemplates = templates?.filter(t => 
    templateType === "sms" ? t.category === "sms" : t.category !== "sms"
  );

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Templates de messages</h2>
          <p className="text-sm text-muted-foreground">
            Gérez vos modèles d'emails et SMS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={importDefaultTemplates}>
            Importer des modèles
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Créer un template</DialogTitle>
                <DialogDescription>
                  Créez un nouveau modèle réutilisable
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom du template</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="ex: Confirmation de rendez-vous"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Catégorie</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Sujet</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Sujet de l'email ou titre du SMS"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body_html">Contenu</Label>
                  <Textarea
                    id="body_html"
                    value={formData.body_html}
                    onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                    placeholder={templateType === "sms" ? "Contenu du SMS (160 caractères max recommandé)" : "<h1>Bonjour {{client_name}}</h1>..."}
                    rows={templateType === "sms" ? 4 : 10}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Variables: {"{{client_name}}"}, {"{{client_email}}"}, {"{{company_name}}"}, {"{{agent_name}}"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Template actif</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={() => createMutation.mutate(formData)}
                  disabled={createMutation.isPending || !formData.name || !formData.subject}
                >
                  {createMutation.isPending ? "Création..." : "Créer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Template Type Tabs */}
      <Tabs value={templateType} onValueChange={(v) => setTemplateType(v as "email" | "sms")}>
        <TabsList>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Templates Grid */}
      {filteredTemplates && filteredTemplates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="group relative hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {template.category === "sms" ? (
                      <MessageSquare className="h-5 w-5 text-blue-500" />
                    ) : (
                      <Mail className="h-5 w-5 text-primary" />
                    )}
                    <CardTitle className="text-base line-clamp-1">{getTemplateDisplayName(template)}</CardTitle>
                  </div>
                  {template.is_system && (
                    <Badge variant="outline" className="gap-1 shrink-0 border-primary/50 text-primary">
                      <Lock className="h-3 w-3" />
                      {t('collaborators.system')}
                    </Badge>
                  )}
                </div>
                <CardDescription className="line-clamp-2">
                  {template.subject}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={template.is_active ? "default" : "secondary"}>
                      {template.is_active ? t('collaborators.activeCount') : t('collaborators.inactiveCount')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setIsPreviewOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDuplicate(template)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    {!template.is_system && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(template)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(template.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">
              Aucun template {templateType === "sms" ? "SMS" : "email"} trouvé
            </p>
            <Button variant="outline" onClick={importDefaultTemplates}>
              Importer des modèles par défaut
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nom du template</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sujet</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Contenu</Label>
              <Textarea
                value={formData.body_html}
                onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                rows={8}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Template actif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => selectedTemplate && updateMutation.mutate({ id: selectedTemplate.id, data: formData })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Mise à jour..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTemplate?.category === "sms" ? (
                <MessageSquare className="h-5 w-5 text-blue-500" />
              ) : (
                <Mail className="h-5 w-5 text-primary" />
              )}
              {getTemplateDisplayName(selectedTemplate)}
            </DialogTitle>
            <DialogDescription>Sujet: {selectedTemplate?.subject}</DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg p-4 bg-white dark:bg-muted">
            {selectedTemplate?.category === "sms" ? (
              <div className="max-w-xs mx-auto">
                <div className="bg-blue-500 text-white rounded-2xl rounded-br-sm p-4">
                  <p className="text-sm">{selectedTemplate?.body_html}</p>
                </div>
                <p className="text-xs text-muted-foreground text-right mt-2">
                  {selectedTemplate?.body_html?.length || 0} caractères
                </p>
              </div>
            ) : (
              <div
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedTemplate?.body_html || "") }}
                className="prose dark:prose-invert max-w-none"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
