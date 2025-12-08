import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Send, Loader2 } from "lucide-react";
import { useCrmEmails } from "@/hooks/useCrmEmails";

interface SendEmailDialogProps {
  clientEmail: string;
  clientName: string;
  disabled?: boolean;
}

const emailTemplates = [
  {
    value: "welcome",
    label: "Message de bienvenue",
    description: "Email d'accueil pour les nouveaux clients",
    icon: "👋",
  },
  {
    value: "relation_client",
    label: "Message relation client",
    description: "Email de suivi et fidélisation client",
    icon: "💬",
  },
  {
    value: "offre_speciale",
    label: "Message d'offre spéciale",
    description: "Email promotionnel avec rabais et offres",
    icon: "🎁",
  },
];

export default function SendEmailDialog({ clientEmail, clientName, disabled }: SendEmailDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [sending, setSending] = useState(false);
  const { sendEmail } = useCrmEmails();

  const handleSend = async () => {
    if (!selectedTemplate || !clientEmail) return;
    
    setSending(true);
    try {
      const result = await sendEmail({
        type: selectedTemplate as any,
        clientEmail,
        clientName,
      });
      
      if (result.success) {
        setOpen(false);
        setSelectedTemplate("");
      }
    } finally {
      setSending(false);
    }
  };

  const selectedTemplateInfo = emailTemplates.find(t => t.value === selectedTemplate);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || !clientEmail}>
          <Mail className="h-4 w-4 mr-2" />
          Envoyer un email
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Envoyer un email
          </DialogTitle>
          <DialogDescription>
            Envoyez un email à <strong>{clientName}</strong> ({clientEmail})
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Choisir un modèle d'email</label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez un modèle..." />
              </SelectTrigger>
              <SelectContent>
                {emailTemplates.map((template) => (
                  <SelectItem key={template.value} value={template.value}>
                    <div className="flex items-center gap-2">
                      <span>{template.icon}</span>
                      <span>{template.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedTemplateInfo && (
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{selectedTemplateInfo.icon}</span>
                <span className="font-medium">{selectedTemplateInfo.label}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedTemplateInfo.description}
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={!selectedTemplate || sending}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Envoyer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
