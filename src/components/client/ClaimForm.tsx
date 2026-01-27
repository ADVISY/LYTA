import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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

const getClaimTypes = (t: (key: string) => string) => [
  { value: 'auto', label: t('claimForm.types.auto'), icon: Car },
  { value: 'sante', label: t('claimForm.types.health'), icon: Heart },
  { value: 'menage', label: t('claimForm.types.household'), icon: Home },
  { value: 'juridique', label: t('claimForm.types.legal'), icon: Scale },
  { value: 'autre', label: t('claimForm.types.other'), icon: Shield },
];

export default function ClaimForm({ clientId, onSuccess, onCancel }: ClaimFormProps) {
  const { t } = useTranslation();
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

  const claimTypes = getClaimTypes(t);

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
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: t('claimForm.fileTooLarge'),
          description: t('claimForm.fileExceedsLimit', { name: file.name }),
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
        title: t('claimForm.requiredFields'),
        description: t('claimForm.fillRequiredFields'),
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    
    try {
      const { data: clientData } = await supabase
        .from('clients')
        .select('tenant_id')
        .eq('id', clientId)
        .single();
      
      const { data: claim, error: claimError } = await supabase
        .from('claims')
        .insert({
          client_id: clientId,
          policy_id: formData.policy_id || null,
          claim_type: formData.claim_type,
          incident_date: formData.incident_date,
          description: formData.description,
          status: 'submitted',
          tenant_id: clientData?.tenant_id || null
        })
        .select()
        .single();
      
      if (claimError) throw claimError;
      
      if (uploadedFiles.length > 0 && claim) {
        setUploading(true);
        
        for (const file of uploadedFiles) {
          const fileName = `${claim.id}/${Date.now()}-${file.name}`;
          
          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(fileName, file);
          
          if (uploadError) {
            console.error('Upload error:', uploadError);
            continue;
          }
          
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
      
      if (claim) {
        try {
          await supabase.functions.invoke('send-claim-notification', {
            body: { 
              claimId: claim.id,
              tenantId: clientData?.tenant_id 
            }
          });
        } catch (notifError) {
          console.error('Failed to send claim notification:', notifError);
        }
      }
      
      toast({
        title: t('claimForm.claimDeclared'),
        description: t('claimForm.claimRegistered')
      });
      
      onSuccess();
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: t('claimForm.error'),
        description: error.message || t('claimForm.errorOccurred'),
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
        <Label>{t('claimForm.claimType')} *</Label>
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
        <Label>{t('claimForm.relatedContract')}</Label>
        <Select 
          value={formData.policy_id} 
          onValueChange={(value) => setFormData(prev => ({ ...prev, policy_id: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('claimForm.selectContract')} />
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
        <Label htmlFor="incident_date">{t('claimForm.incidentDate')} *</Label>
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
        <Label htmlFor="description">{t('claimForm.description')} *</Label>
        <Textarea
          id="description"
          placeholder={t('claimForm.descriptionPlaceholder')}
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={4}
          required
        />
      </div>

      {/* Documents */}
      <div className="space-y-2">
        <Label>{t('claimForm.supportingDocuments')}</Label>
        <p className="text-sm text-muted-foreground mb-2">
          {t('claimForm.documentsHint')}
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
              {t('claimForm.clickToAddFiles')}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('claimForm.fileTypes')}
            </span>
          </label>
        </div>
        
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
          {t('claimForm.cancel')}
        </Button>
        <Button type="submit" disabled={loading || uploading} className="flex-1">
          {(loading || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {uploading ? t('claimForm.uploadingFiles') : t('claimForm.submitDeclaration')}
        </Button>
      </div>
    </form>
  );
}
