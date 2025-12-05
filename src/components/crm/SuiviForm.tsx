import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useSuivis, Suivi, SuiviType, SuiviStatus, suiviTypeLabels, suiviStatusLabels } from "@/hooks/useSuivis";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  type: z.enum(["activation", "annulation", "retour", "resiliation", "sinistre", "autre"]).optional(),
  status: z.enum(["ouvert", "en_cours", "ferme"]).default("ouvert"),
  description: z.string().optional(),
  reminder_date: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface SuiviFormProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editMode?: boolean;
  suivi?: Suivi | null;
}

export default function SuiviForm({
  clientId,
  open,
  onOpenChange,
  onSuccess,
  editMode = false,
  suivi,
}: SuiviFormProps) {
  const { createSuivi, updateSuivi } = useSuivis(clientId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      type: undefined,
      status: "ouvert",
      description: "",
      reminder_date: "",
    },
  });

  useEffect(() => {
    if (open && editMode && suivi) {
      form.reset({
        title: suivi.title,
        type: suivi.type as SuiviType | undefined,
        status: suivi.status as SuiviStatus,
        description: suivi.description || "",
        reminder_date: suivi.reminder_date ? suivi.reminder_date.split("T")[0] : "",
      });
    } else if (open && !editMode) {
      form.reset({
        title: "",
        type: undefined,
        status: "ouvert",
        description: "",
        reminder_date: "",
      });
    }
  }, [open, editMode, suivi, form]);

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      if (editMode && suivi) {
        await updateSuivi(suivi.id, {
          title: values.title,
          type: values.type as SuiviType | undefined,
          status: values.status as SuiviStatus,
          description: values.description,
          reminder_date: values.reminder_date || null,
        });
      } else {
        await createSuivi({
          client_id: clientId,
          title: values.title,
          type: values.type as SuiviType | undefined,
          status: values.status as SuiviStatus,
          description: values.description,
          reminder_date: values.reminder_date || undefined,
        });
      }
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error submitting suivi:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editMode ? "Modifier le suivi" : "Nouveau suivi"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titre *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Demande de résiliation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type / Thème</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(suiviTypeLabels) as SuiviType[]).map((type) => (
                          <SelectItem key={type} value={type}>
                            {suiviTypeLabels[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un statut" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(suiviStatusLabels) as SuiviStatus[]).map((status) => (
                          <SelectItem key={status} value={status}>
                            {suiviStatusLabels[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reminder_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date de rappel</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description / Commentaires</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Détails du suivi, notes, commentaires..."
                      rows={4}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editMode ? "Mettre à jour" : "Créer le suivi"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
