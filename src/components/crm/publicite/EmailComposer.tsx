import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useCrmEmails } from "@/hooks/useCrmEmails";
import { Send, Users, User, FileText, Search, X, Loader2, Mail } from "lucide-react";

interface Client {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company_name: string | null;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  category: string | null;
}

export const EmailComposer = () => {
  const { toast } = useToast();
  const { sendEmail } = useCrmEmails();
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [selectedClients, setSelectedClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [singleEmail, setSingleEmail] = useState("");
  const [singleName, setSingleName] = useState("");

  const { data: clients } = useQuery({
    queryKey: ["clients-for-email"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, company_name")
        .not("email", "is", null)
        .order("last_name");
      if (error) throw error;
      return data as Client[];
    },
  });

  const { data: templates } = useQuery({
    queryKey: ["email-templates-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("id, name, subject, body_html, category")
        .eq("is_active", true)
        .neq("category", "sms")
        .order("name");
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  const filteredClients = clients?.filter((client) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    const fullName = `${client.first_name || ""} ${client.last_name || ""}`.toLowerCase();
    return (
      fullName.includes(search) ||
      client.email?.toLowerCase().includes(search) ||
      client.company_name?.toLowerCase().includes(search)
    );
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (templateId === "none") {
      return;
    }
    const template = templates?.find((t) => t.id === templateId);
    if (template) {
      setSubject(template.subject);
      setBody(template.body_html);
    }
  };

  const toggleClient = (client: Client) => {
    setSelectedClients((prev) => {
      const exists = prev.find((c) => c.id === client.id);
      if (exists) {
        return prev.filter((c) => c.id !== client.id);
      }
      return [...prev, client];
    });
  };

  const selectAllFiltered = () => {
    if (filteredClients) {
      setSelectedClients(filteredClients.filter((c) => c.email));
    }
  };

  const clearSelection = () => {
    setSelectedClients([]);
  };

  const getClientDisplayName = (client: Client) => {
    if (client.first_name || client.last_name) {
      return `${client.first_name || ""} ${client.last_name || ""}`.trim();
    }
    return client.company_name || client.email || "Client";
  };

  const handleSend = async () => {
    if (mode === "single") {
      if (!singleEmail || !subject) {
        toast({ title: "Email et sujet requis", variant: "destructive" });
        return;
      }
    } else {
      if (selectedClients.length === 0 || !subject) {
        toast({ title: "Sélectionnez au moins un client et un sujet", variant: "destructive" });
        return;
      }
    }

    setIsSending(true);

    try {
      if (mode === "single") {
        await sendEmail({
          type: "relation_client",
          clientEmail: singleEmail,
          clientName: singleName || "Client",
          data: { contractDetails: body },
        });
        toast({ title: "Email envoyé avec succès" });
      } else {
        let successCount = 0;
        let errorCount = 0;

        for (const client of selectedClients) {
          if (!client.email) continue;
          try {
            await sendEmail({
              type: "relation_client",
              clientEmail: client.email,
              clientName: getClientDisplayName(client),
              data: { contractDetails: body },
            });
            successCount++;
          } catch {
            errorCount++;
          }
        }

        toast({
          title: "Envoi terminé",
          description: `${successCount} emails envoyés, ${errorCount} erreurs`,
        });
      }

      setSelectedClients([]);
      setSingleEmail("");
      setSingleName("");
      if (!selectedTemplate || selectedTemplate === "none") {
        setSubject("");
        setBody("");
      }
    } catch (error) {
      toast({ title: "Erreur lors de l'envoi", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Composer Panel */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Composer un email
            </CardTitle>
            <CardDescription>
              Envoyez un email personnalisé à un ou plusieurs clients
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex gap-2">
              <Button
                variant={mode === "single" ? "default" : "outline"}
                onClick={() => setMode("single")}
                className="flex-1"
              >
                <User className="h-4 w-4 mr-2" />
                Email unique
              </Button>
              <Button
                variant={mode === "bulk" ? "default" : "outline"}
                onClick={() => setMode("bulk")}
                className="flex-1"
              >
                <Users className="h-4 w-4 mr-2" />
                Envoi groupé
              </Button>
            </div>

            {mode === "single" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="single-email">Email du destinataire</Label>
                  <Input
                    id="single-email"
                    type="email"
                    value={singleEmail}
                    onChange={(e) => setSingleEmail(e.target.value)}
                    placeholder="email@exemple.ch"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="single-name">Nom du destinataire</Label>
                  <Input
                    id="single-name"
                    value={singleName}
                    onChange={(e) => setSingleName(e.target.value)}
                    placeholder="Jean Dupont"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Destinataires sélectionnés ({selectedClients.length})</Label>
                {selectedClients.length > 0 ? (
                  <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/50 max-h-32 overflow-y-auto">
                    {selectedClients.map((client) => (
                      <Badge key={client.id} variant="secondary" className="gap-1">
                        {getClientDisplayName(client)}
                        <button
                          onClick={() => toggleClient(client)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground p-3 border rounded-lg border-dashed">
                    Utilisez le panneau de droite pour sélectionner des clients
                  </p>
                )}
              </div>
            )}

            {/* Template Selection */}
            <div className="space-y-2">
              <Label>Template (optionnel)</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun template</SelectItem>
                  {templates?.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {template.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Sujet</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Sujet de l'email"
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Contenu de l'email..."
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Variables: {"{{client_name}}"}, {"{{client_email}}"}, {"{{company_name}}"}, {"{{agent_name}}"}
              </p>
            </div>

            {/* Send Button */}
            <Button
              onClick={handleSend}
              disabled={isSending || (mode === "single" ? !singleEmail : selectedClients.length === 0) || !subject}
              className="w-full"
              size="lg"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {mode === "single"
                    ? "Envoyer l'email"
                    : `Envoyer à ${selectedClients.length} destinataire${selectedClients.length > 1 ? "s" : ""}`}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Client Selection Panel */}
      {mode === "bulk" ? (
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sélectionner les clients</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-2 mb-3">
              <Button variant="outline" size="sm" onClick={selectAllFiltered} className="flex-1">
                Tout sélectionner
              </Button>
              <Button variant="outline" size="sm" onClick={clearSelection} className="flex-1">
                Effacer
              </Button>
            </div>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredClients?.map((client) => {
                  if (!client.email) return null;
                  const isSelected = selectedClients.some((c) => c.id === client.id);
                  return (
                    <div
                      key={client.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
                      }`}
                      onClick={() => toggleClient(client)}
                    >
                      <Checkbox checked={isSelected} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {getClientDisplayName(client)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {client.email}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : (
        body && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Aperçu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-white dark:bg-muted overflow-hidden">
                <p className="font-medium mb-2 text-sm">{subject || "Sans sujet"}</p>
                <div
                  dangerouslySetInnerHTML={{ __html: body }}
                  className="prose dark:prose-invert prose-sm max-w-none"
                />
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
};
