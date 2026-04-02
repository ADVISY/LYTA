import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { 
  Plus, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  CheckCircle2, 
  Edit2, 
  Trash2,
  Star,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCompanyContacts,
  CompanyContact,
  ContactType,
  ContactChannel,
  CONTACT_TYPE_LABELS,
  CHANNEL_LABELS,
} from "@/hooks/useCompanyContacts";

interface CompanyContactsPanelProps {
  companyId: string;
  companyName: string;
}

const CHANNEL_ICONS: Record<ContactChannel, React.ReactNode> = {
  EMAIL: <Mail className="h-4 w-4" />,
  TELEPHONE: <Phone className="h-4 w-4" />,
  FORMULAIRE: <Globe className="h-4 w-4" />,
  POSTAL: <MapPin className="h-4 w-4" />,
};

const CONTACT_TYPE_COLORS: Record<ContactType, string> = {
  BACK_OFFICE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  KEY_MANAGER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  SINISTRES: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  RECLAMATIONS: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  RESILIATION: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  SUPPORT_COURTIER: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  COMMERCIAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  GENERAL: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export function CompanyContactsPanel({ companyId, companyName }: CompanyContactsPanelProps) {
  const { contacts, loading, addContact, updateContact, deleteContact } = useCompanyContacts(companyId);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CompanyContact | null>(null);

  // Group contacts by type
  const contactsByType = contacts.reduce((acc, contact) => {
    if (!acc[contact.contact_type]) {
      acc[contact.contact_type] = [];
    }
    acc[contact.contact_type].push(contact);
    return acc;
  }, {} as Record<ContactType, CompanyContact[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Contacts ({contacts.length})
        </h3>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un contact - {companyName}</DialogTitle>
            </DialogHeader>
            <ContactForm
              companyId={companyId}
              onSubmit={async (data) => {
                await addContact(data);
                setIsAddOpen(false);
              }}
              onCancel={() => setIsAddOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aucun contact enregistré</p>
          <p className="text-xs">Ajoutez des contacts pour cette compagnie</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(Object.keys(CONTACT_TYPE_LABELS) as ContactType[]).map((type) => {
            const typeContacts = contactsByType[type];
            if (!typeContacts || typeContacts.length === 0) return null;

            return (
              <div key={type} className="space-y-2">
                <Badge variant="secondary" className={cn("text-xs", CONTACT_TYPE_COLORS[type])}>
                  {CONTACT_TYPE_LABELS[type]}
                </Badge>
                <div className="space-y-2">
                  {typeContacts.map((contact) => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      onEdit={() => setEditingContact(contact)}
                      onDelete={() => deleteContact(contact.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingContact} onOpenChange={(open) => !open && setEditingContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le contact</DialogTitle>
          </DialogHeader>
          {editingContact && (
            <ContactForm
              companyId={companyId}
              initialData={editingContact}
              onSubmit={async (data) => {
                await updateContact(editingContact.id, data);
                setEditingContact(null);
              }}
              onCancel={() => setEditingContact(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ContactCardProps {
  contact: CompanyContact;
  onEdit: () => void;
  onDelete: () => void;
}

function ContactCard({ contact, onEdit, onDelete }: ContactCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
      <div className="p-2 rounded-lg bg-background">
        {CHANNEL_ICONS[contact.channel]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{contact.value}</span>
          {contact.is_primary && (
            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
          )}
          {contact.is_verified && (
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{CHANNEL_LABELS[contact.channel]}</span>
          {contact.label && (
            <>
              <span>•</span>
              <span>{contact.label}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce contact ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

interface ContactFormProps {
  companyId: string;
  initialData?: CompanyContact;
  onSubmit: (data: Omit<CompanyContact, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onCancel: () => void;
}

function ContactForm({ companyId, initialData, onSubmit, onCancel }: ContactFormProps) {
  const [contactType, setContactType] = useState<ContactType>(initialData?.contact_type || 'GENERAL');
  const [channel, setChannel] = useState<ContactChannel>(initialData?.channel || 'EMAIL');
  const [value, setValue] = useState(initialData?.value || '');
  const [label, setLabel] = useState(initialData?.label || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [isPrimary, setIsPrimary] = useState(initialData?.is_primary || false);
  const [isVerified, setIsVerified] = useState(initialData?.is_verified || false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        company_id: companyId,
        contact_type: contactType,
        channel,
        value: value.trim(),
        label: label.trim() || null,
        notes: notes.trim() || null,
        is_primary: isPrimary,
        is_verified: isVerified,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Type de contact</Label>
          <Select value={contactType} onValueChange={(v) => setContactType(v as ContactType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CONTACT_TYPE_LABELS) as ContactType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {CONTACT_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Canal</Label>
          <Select value={channel} onValueChange={(v) => setChannel(v as ContactChannel)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CHANNEL_LABELS) as ContactChannel[]).map((ch) => (
                <SelectItem key={ch} value={ch}>
                  <div className="flex items-center gap-2">
                    {CHANNEL_ICONS[ch]}
                    {CHANNEL_LABELS[ch]}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>
          {channel === 'EMAIL' && 'Adresse email'}
          {channel === 'TELEPHONE' && 'Numéro de téléphone'}
          {channel === 'FORMULAIRE' && 'URL du formulaire'}
          {channel === 'POSTAL' && 'Adresse postale'}
        </Label>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            channel === 'EMAIL' ? 'contact@compagnie.ch' :
            channel === 'TELEPHONE' ? '+41 XX XXX XX XX' :
            channel === 'FORMULAIRE' ? 'https://...' :
            'Adresse complète'
          }
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Libellé (optionnel)</Label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: Département LPP, Mme Dupont..."
        />
      </div>

      <div className="space-y-2">
        <Label>Notes (optionnel)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Informations supplémentaires..."
          rows={2}
        />
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Checkbox
            id="is_primary"
            checked={isPrimary}
            onCheckedChange={(v) => setIsPrimary(!!v)}
          />
          <Label htmlFor="is_primary" className="text-sm cursor-pointer">
            Contact principal
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="is_verified"
            checked={isVerified}
            onCheckedChange={(v) => setIsVerified(!!v)}
          />
          <Label htmlFor="is_verified" className="text-sm cursor-pointer">
            Vérifié
          </Label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={isSubmitting || !value.trim()}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          {initialData ? 'Enregistrer' : 'Ajouter'}
        </Button>
      </div>
    </form>
  );
}
