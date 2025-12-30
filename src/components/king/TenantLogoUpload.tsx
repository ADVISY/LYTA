import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TenantLogoUploadProps {
  currentLogoUrl?: string | null;
  onUploadComplete: (url: string) => void;
  tenantSlug?: string;
  className?: string;
}

export function TenantLogoUpload({ 
  currentLogoUrl, 
  onUploadComplete, 
  tenantSlug,
  className 
}: TenantLogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Format non supporté. Utilisez PNG, JPG, SVG ou WebP.");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Le fichier est trop volumineux. Maximum 2MB.");
      return;
    }

    setIsUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${tenantSlug || 'tenant'}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('tenant-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('tenant-logos')
        .getPublicUrl(filePath);

      setPreviewUrl(publicUrl);
      onUploadComplete(publicUrl);
      toast.success("Logo uploadé avec succès");

    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast.error("Erreur lors de l'upload: " + error.message);
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = () => {
    setPreviewUrl(null);
    onUploadComplete('');
  };

  return (
    <div className={cn("space-y-4", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {previewUrl ? (
        <div className="relative group">
          <div className="w-full h-32 bg-muted rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
            <img 
              src={previewUrl} 
              alt="Logo preview" 
              className="max-h-28 max-w-full object-contain"
            />
          </div>
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span className="ml-1">Changer</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleRemoveLogo}
              disabled={isUploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            "w-full h-32 bg-muted/50 rounded-lg border-2 border-dashed border-border",
            "hover:border-primary/50 hover:bg-muted transition-colors",
            "flex flex-col items-center justify-center gap-2 cursor-pointer",
            isUploading && "opacity-50 cursor-not-allowed"
          )}
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">
            {isUploading ? "Upload en cours..." : "Cliquez pour uploader un logo"}
          </span>
          <span className="text-xs text-muted-foreground/70">
            PNG, JPG, SVG ou WebP (max 2MB)
          </span>
        </button>
      )}
    </div>
  );
}
