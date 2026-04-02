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
import { Plus, Pencil, Trash2, FileText, Eye, Copy, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
];

export const EmailTemplatesList = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  const resetForm = () => {
    setFormData({
      name: "",
      subject: "",
      body_html: "",
      body_text: "",
      category: "transactional",
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Templates d'emails</h2>
          <p className="text-sm text-muted-foreground">
            Gérez vos modèles d'emails personnalisés
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer un template</DialogTitle>
              <DialogDescription>
                Créez un nouveau modèle d'email réutilisable
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
                <Label htmlFor="subject">Sujet de l'email</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="ex: Confirmation de votre rendez-vous"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body_html">Contenu HTML</Label>
                <Textarea
                  id="body_html"
                  value={formData.body_html}
                  onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                  placeholder="<h1>Bonjour {{client_name}}</h1>..."
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Variables disponibles: {"{{client_name}}"}, {"{{client_email}}"}, {"{{company_name}}"}, {"{{agent_name}}"}
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
                {t('common.cancel')}
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates?.map((template) => (
          <Card key={template.id} className="group relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{getTemplateDisplayName(template)}</CardTitle>
                </div>
                {template.is_system && (
                  <Badge variant="outline" className="gap-1 border-primary/50 text-primary">
                    <Lock className="h-3 w-3" />
                    {t('collaborators.system')}
                  </Badge>
                )}
              </div>
              <CardDescription className="line-clamp-1">
                {template.subject}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={template.is_active ? "default" : "secondary"}>
                    {template.is_active ? t('collaborators.activeCount') : t('collaborators.inactiveCount')}
                  </Badge>
                  {template.category && (
                    <Badge variant="outline">
                      {CATEGORIES.find((c) => c.value === template.category)?.label || template.category}
                    </Badge>
                  )}
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
              <Label>Contenu HTML</Label>
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
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => selectedTemplate && updateMutation.mutate({ id: selectedTemplate.id, data: formData })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? t('templates.updating') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aperçu: {getTemplateDisplayName(selectedTemplate)}</DialogTitle>
            <DialogDescription>Sujet: {selectedTemplate?.subject}</DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg p-4 bg-white dark:bg-muted">
            <div
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedTemplate?.body_html || "") }}
              className="prose dark:prose-invert max-w-none"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
