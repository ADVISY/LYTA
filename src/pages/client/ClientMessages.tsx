import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  MessageCircle, 
  Send, 
  Phone, 
  Mail, 
  Clock
} from "lucide-react";
import { MessageCircle as WhatsAppIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AdvisorData = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  photo_url: string | null;
};

export default function ClientMessages() {
  const { clientData, advisorData } = useOutletContext<{ 
    user: any; 
    clientData: any; 
    advisorData: AdvisorData | null;
  }>();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    setSending(true);
    
    // Simulate sending message
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Message envoyé",
      description: "Votre conseiller vous répondra dans les plus brefs délais",
    });
    
    setMessage("");
    setSending(false);
  };

  const getAdvisorName = () => {
    if (advisorData?.first_name || advisorData?.last_name) {
      return `${advisorData.first_name || ''} ${advisorData.last_name || ''}`.trim();
    }
    return "Équipe Advisy";
  };

  const getAdvisorInitials = () => {
    if (advisorData?.first_name || advisorData?.last_name) {
      return `${advisorData.first_name?.[0] || ''}${advisorData.last_name?.[0] || ''}`.toUpperCase();
    }
    return "A";
  };

  const getAdvisorEmail = () => advisorData?.email || "contact@advisy.ch";
  const getAdvisorPhone = () => advisorData?.mobile || advisorData?.phone || "+41 21 922 09 60";
  
  const getWhatsAppLink = () => {
    const phone = getAdvisorPhone().replace(/\s/g, '').replace('+', '');
    return `https://wa.me/${phone}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-muted-foreground">Contactez votre conseiller</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Form */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Envoyer un message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Écrivez votre message ici..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={!message.trim() || sending}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {sending ? "Envoi en cours..." : "Envoyer"}
              </Button>
            </CardContent>
          </Card>

          {/* Message History Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Historique des messages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucun message pour le moment</p>
                <p className="text-sm">Vos échanges avec votre conseiller apparaîtront ici</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contact Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Votre conseiller</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  {advisorData?.photo_url ? (
                    <AvatarImage 
                      src={advisorData.photo_url} 
                      alt={getAdvisorName()}
                      className="object-cover"
                    />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                    {getAdvisorInitials()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{getAdvisorName()}</p>
                  <p className="text-sm text-muted-foreground">Conseiller assurance</p>
                </div>
              </div>
              
              <div className="pt-4 border-t space-y-3">
                <a 
                  href={`mailto:${getAdvisorEmail()}`} 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{getAdvisorEmail()}</p>
                  </div>
                </a>
                
                <a 
                  href={`tel:${getAdvisorPhone().replace(/\s/g, '')}`} 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Téléphone</p>
                    <p className="text-sm text-muted-foreground">{getAdvisorPhone()}</p>
                  </div>
                </a>
                
                <a 
                  href={getWhatsAppLink()} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors border border-emerald-200 dark:border-emerald-800"
                >
                  <div className="h-5 w-5 text-emerald-600">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">WhatsApp</p>
                    <p className="text-sm text-muted-foreground">Discuter maintenant</p>
                  </div>
                </a>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Horaires</p>
                    <p className="text-sm text-muted-foreground">Lun-Ven: 9h-18h</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <p className="text-sm text-center">
                <span className="font-medium">Besoin d'aide urgente?</span>
                <br />
                <a href={`tel:${getAdvisorPhone().replace(/\s/g, '')}`} className="text-primary hover:underline">
                  Appelez-nous directement
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
