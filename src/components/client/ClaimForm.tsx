import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Car, 
  Heart, 
  Home, 
  Scale, 
  Shield,
  Upload,
  X,
  FileText,
  Loader2
} from "lucide-react";

interface ClaimFormProps {
  clientId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface Policy {
  id: string;
  product_type: string;
  company_name: string;
  product?: {
    category: string;
  };
}

const claimTypes = [
  { value: 'auto', label: 'Automobile', icon: Car },
  { value: 'sante', label: 'Santé', icon: Heart },
  { value: 'menage', label: 'Ménage/RC', icon: Home },
  { value: 'juridique', label: 'Protection juridique', icon: Scale },
  { value: 'autre', label: 'Autre', icon: Shield },
];

export default function ClaimForm({ clientId, onSuccess, onCancel }: ClaimFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    claim_type: '',
    policy_id: '',
    incident_date: '',
    description: '',
  });

  useEffect(() => {
    fetchPolicies();
  }, [clientId]);

  const fetchPolicies = async () => {
    const { data } = await supabase
      .from('policies')
      .select(`
        id, product_type, company_name,
        product:insurance_products!policies_product_id_fkey (category)
      `)
      .eq('client_id', clientId)
      .eq('status', 'active');
    
    if (data) setPolicies(data);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newFiles = Array.from(files).filter(file => {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Fichier trop volumineux",
          description: `${file.name} dépasse 10 MB`,
          variant: "destructive"
        });
        return false;
      }
      return true;
    });
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.claim_type || !formData.incident_date || !formData.description) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Create the claim
      const { data: claim, error: claimError } = await supabase
        .from('claims')
        .insert({
          client_id: clientId,
          policy_id: formData.policy_id || null,
          claim_type: formData.claim_type,
          incident_date: formData.incident_date,
          description: formData.description,
          status: 'submitted'
        })
        .select()
        .single();
      
      if (claimError) throw claimError;
      
      // Upload files if any
      if (uploadedFiles.length > 0 && claim) {
        setUploading(true);
        
        for (const file of uploadedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${claim.id}/${Date.now()}-${file.name}`;
          
          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(fileName, file);
          
          if (uploadError) {
            console.error('Upload error:', uploadError);
            continue;
          }
          
          // Create document record
          const { data: doc } = await supabase
            .from('documents')
            .insert({
              owner_id: clientId,
              owner_type: 'client',
              file_name: file.name,
              file_key: fileName,
              mime_type: file.type,
              size_bytes: file.size,
              doc_kind: 'sinistre'
            })
            .select()
            .single();
          
          // Link document to claim
          if (doc) {
            await supabase
              .from('claim_documents')
              .insert({
                claim_id: claim.id,
                document_id: doc.id
              });
          }
        }
      }
      
      toast({
        title: "Sinistre déclaré",
        description: "Votre déclaration a été enregistrée. Notre équipe vous contactera rapidement."
      });
      
      onSuccess();
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Type de sinistre */}
      <div className="space-y-2">
        <Label>Type de sinistre *</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {claimTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = formData.claim_type === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, claim_type: type.value }))}
                className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                  isSelected 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-sm ${isSelected ? 'font-medium' : ''}`}>{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contrat associé */}
      <div className="space-y-2">
        <Label>Contrat associé (optionnel)</Label>
        <Select 
          value={formData.policy_id} 
          onValueChange={(value) => setFormData(prev => ({ ...prev, policy_id: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner un contrat" />
          </SelectTrigger>
          <SelectContent>
            {policies.map((policy) => (
              <SelectItem key={policy.id} value={policy.id}>
                {policy.company_name} - {policy.product_type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date du sinistre */}
      <div className="space-y-2">
        <Label htmlFor="incident_date">Date du sinistre *</Label>
        <Input
          id="incident_date"
          type="date"
          value={formData.incident_date}
          onChange={(e) => setFormData(prev => ({ ...prev, incident_date: e.target.value }))}
          max={new Date().toISOString().split('T')[0]}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description du sinistre *</Label>
        <Textarea
          id="description"
          placeholder="Décrivez ce qui s'est passé, les circonstances, les dommages..."
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={4}
          required
        />
      </div>

      {/* Documents */}
      <div className="space-y-2">
        <Label>Documents justificatifs (optionnel)</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Photos, factures, rapports de police, attestations médicales...
        </p>
        
        <div className="border-2 border-dashed rounded-lg p-4 text-center">
          <input
            type="file"
            id="file-upload"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer flex flex-col items-center gap-2"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Cliquez pour ajouter des fichiers
            </span>
            <span className="text-xs text-muted-foreground">
              PDF, images, documents (max 10 MB par fichier)
            </span>
          </label>
        </div>
        
        {/* Uploaded files list */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-2 mt-3">
            {uploadedFiles.map((file, index) => (
              <div 
                key={index}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
              >
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate flex-1">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Annuler
        </Button>
        <Button type="submit" disabled={loading || uploading} className="flex-1">
          {(loading || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {uploading ? 'Envoi des fichiers...' : 'Soumettre la déclaration'}
        </Button>
      </div>
    </form>
  );
}