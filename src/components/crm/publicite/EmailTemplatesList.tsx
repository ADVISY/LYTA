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

  const getCategoryLabel = (value: string) => {
    const key = `templates.categories.${value}`;
    const translated = t(key);
    return translated === key ? value : translated;
  };

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
      toast({ title: t('templates.templateCreated') });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: t('templates.creationError'), variant: "destructive" });
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
      toast({ title: t('templates.templateUpdated') });
      setIsEditOpen(false);
      setSelectedTemplate(null);
    },
    onError: () => {
      toast({ title: t('templates.updateError'), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast({ title: t('templates.templateDeleted') });
    },
    onError: () => {
      toast({ title: t('templates.deleteError'), variant: "destructive" });
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
    toast({ title: `${templatesToImport.length} ${t('templates.templatesImported')}` });
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
      name: `${getTemplateDisplayName(template)} (${t('templates.duplicated')})`,
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
          <h2 className="text-xl font-semibold">{t('templates.title')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('templates.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={importDefaultTemplates}>
            {t('templates.importModels')}
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                {t('templates.new')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('templates.createTemplate')}</DialogTitle>
                <DialogDescription>
                  {t('templates.createTemplateDesc')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('templates.templateName')}</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t('templates.templateNamePlaceholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">{t('templates.category')}</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transactional">{getCategoryLabel('transactional')}</SelectItem>
                        <SelectItem value="marketing">{getCategoryLabel('marketing')}</SelectItem>
                        <SelectItem value="notification">{getCategoryLabel('notification')}</SelectItem>
                        <SelectItem value="reminder">{getCategoryLabel('reminder')}</SelectItem>
                        <SelectItem value="onboarding">{getCategoryLabel('onboarding')}</SelectItem>
                        <SelectItem value="sms">{getCategoryLabel('sms')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">{t('templates.subject')}</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder={t('templates.subjectPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body_html">{t('templates.content')}</Label>
                  <Textarea
                    id="body_html"
                    value={formData.body_html}
                    onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                    placeholder={templateType === "sms" ? t('templates.contentPlaceholderSms') : t('templates.contentPlaceholderEmail')}
                    rows={templateType === "sms" ? 4 : 10}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('templates.variablesHint')}: {"{{client_name}}"}, {"{{client_email}}"}, {"{{company_name}}"}, {"{{agent_name}}"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">{t('templates.activeTemplate')}</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  {t('templates.cancel')}
                </Button>
                <Button
                  onClick={() => createMutation.mutate(formData)}
                  disabled={createMutation.isPending || !formData.name || !formData.subject}
                >
                  {createMutation.isPending ? t('templates.creating') : t('templates.create')}
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
                      <FileText className="h-5 w-5 text-primary" />
                    )}
                    <div>
                      <CardTitle className="text-base">{getTemplateDisplayName(template)}</CardTitle>
                      <CardDescription className="text-xs">{template.subject}</CardDescription>
                    </div>
                  </div>
                  {template.is_system && (
                    <Badge variant="outline" className="gap-1">
                      <Lock className="h-3 w-3" />
                      {t('templates.system')}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary">{getCategoryLabel(template.category || '')}</Badge>
                  <Badge variant={template.is_active ? "default" : "outline"}>
                    {template.is_active ? t('templates.active') : t('templates.inactive')}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setIsPreviewOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicate(template)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {!template.is_system && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(template)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border rounded-lg border-dashed">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-2">{t('templates.noTemplates')}</p>
          <p className="text-sm text-muted-foreground">{t('templates.noTemplatesDesc')}</p>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('templates.editTemplate')}</DialogTitle>
            <DialogDescription>
              {t('templates.editTemplateDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name">{t('templates.templateName')}</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">{t('templates.category')}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transactional">{getCategoryLabel('transactional')}</SelectItem>
                    <SelectItem value="marketing">{getCategoryLabel('marketing')}</SelectItem>
                    <SelectItem value="notification">{getCategoryLabel('notification')}</SelectItem>
                    <SelectItem value="reminder">{getCategoryLabel('reminder')}</SelectItem>
                    <SelectItem value="onboarding">{getCategoryLabel('onboarding')}</SelectItem>
                    <SelectItem value="sms">{getCategoryLabel('sms')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-subject">{t('templates.subject')}</Label>
              <Input
                id="edit-subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-body">{t('templates.content')}</Label>
              <Textarea
                id="edit-body"
                value={formData.body_html}
                onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                rows={10}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="edit-is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="edit-is_active">{t('templates.activeTemplate')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              {t('templates.cancel')}
            </Button>
            <Button
              onClick={() => selectedTemplate && updateMutation.mutate({ id: selectedTemplate.id, data: formData })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? t('templates.updating') : t('templates.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('templates.preview')}</DialogTitle>
            <DialogDescription>{selectedTemplate?.subject}</DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg p-4 bg-white">
            {selectedTemplate?.category === "sms" ? (
              <div className="max-w-xs mx-auto">
                <div className="bg-blue-500 text-white rounded-2xl rounded-br-sm p-4">
                  <p className="text-sm whitespace-pre-wrap">{selectedTemplate?.body_html}</p>
                </div>
              </div>
            ) : (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedTemplate?.body_html || "") }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};