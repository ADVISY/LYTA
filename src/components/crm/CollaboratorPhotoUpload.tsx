import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollaboratorPhotoUploadProps {
  collaboratorId?: string;
  currentPhotoUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  onPhotoChange?: (url: string | null) => void;
  size?: "sm" | "md" | "lg" | "xl";
  editable?: boolean;
}

const sizeClasses = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-32 w-32",
  xl: "h-40 w-40",
};

export function CollaboratorPhotoUpload({
  collaboratorId,
  currentPhotoUrl,
  firstName,
  lastName,
  onPhotoChange,
  size = "lg",
  editable = true,
}: CollaboratorPhotoUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(currentPhotoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = () => {
    const first = firstName?.charAt(0)?.toUpperCase() || "";
    const last = lastName?.charAt(0)?.toUpperCase() || "";
    return first + last || "?";
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Type de fichier invalide",
        description: "Veuillez sélectionner une image (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "La taille maximum est de 5 Mo",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${collaboratorId || "temp"}-${Date.now()}.${fileExt}`;
      const filePath = `collaborators/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      const newPhotoUrl = urlData.publicUrl;
      setPhotoUrl(newPhotoUrl);
      onPhotoChange?.(newPhotoUrl);

      // If collaboratorId exists, update the database directly
      if (collaboratorId) {
        const { error: updateError } = await supabase
          .from("clients")
          .update({ photo_url: newPhotoUrl })
          .eq("id", collaboratorId);

        if (updateError) throw updateError;
      }

      toast({
        title: "Photo mise à jour",
        description: "La photo de profil a été enregistrée",
      });
    } catch (error: any) {
      toast({
        title: "Erreur d'upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setUploading(true);

    try {
      if (collaboratorId) {
        const { error } = await supabase
          .from("clients")
          .update({ photo_url: null })
          .eq("id", collaboratorId);

        if (error) throw error;
      }

      setPhotoUrl(null);
      onPhotoChange?.(null);

      toast({
        title: "Photo supprimée",
        description: "La photo de profil a été retirée",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        <Avatar className={cn(sizeClasses[size], "border-2 border-border")}>
          {photoUrl && <AvatarImage src={photoUrl} alt={`${firstName} ${lastName}`} />}
          <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
            {photoUrl ? getInitials() : <User className="h-10 w-10" />}
          </AvatarFallback>
        </Avatar>

        {editable && !uploading && (
          <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-white hover:text-white hover:bg-white/20"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-6 w-6" />
            </Button>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}
      </div>

      {editable && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="h-4 w-4 mr-2" />
            {photoUrl ? "Changer" : "Ajouter photo"}
          </Button>
          {photoUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemove}
              disabled={uploading}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}
