import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFamilyMembers, FamilyMember } from "@/hooks/useFamilyMembers";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const familyMemberSchema = z.object({
  first_name: z.string().min(1, "Prénom requis"),
  last_name: z.string().min(1, "Nom requis"),
  birth_date: z.string().optional().nullable(),
  relation_type: z.enum(["conjoint", "enfant", "autre"]),
  permit_type: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
});

type FamilyMemberFormData = z.infer<typeof familyMemberSchema>;

interface FamilyMemberFormProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: FamilyMember;
}

export default function FamilyMemberForm({
  clientId,
  open,
  onOpenChange,
  member,
}: FamilyMemberFormProps) {
  const { createFamilyMember, updateFamilyMember } = useFamilyMembers(clientId);
  const [loading, setLoading] = useState(false);
  const [parentClient, setParentClient] = useState<any>(null);
  const { toast } = useToast();

  // Fetch parent client data to copy address info
  useEffect(() => {
    const fetchParentClient = async () => {
      if (clientId && open) {
        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .maybeSingle();
        setParentClient(data);
      }
    };
    fetchParentClient();
  }, [clientId, open]);

  const form = useForm<FamilyMemberFormData>({
    resolver: zodResolver(familyMemberSchema),
    defaultValues: member
      ? {
          first_name: member.first_name,
          last_name: member.last_name,
          birth_date: member.birth_date,
          relation_type: member.relation_type,
          permit_type: member.permit_type,
          nationality: member.nationality,
        }
      : {
          first_name: "",
          last_name: "",
          birth_date: null,
          relation_type: "enfant" as const,
          permit_type: null,
          nationality: null,
        },
  });

  const onSubmit = async (data: FamilyMemberFormData) => {
    setLoading(true);

    if (member) {
      const { error } = await updateFamilyMember(member.id, data);
      if (!error) {
        onOpenChange(false);
        form.reset();
      }
    } else {
      // Create family member
      const { error } = await createFamilyMember({
        client_id: clientId,
        ...data,
      } as any);
      
      if (!error) {
        // Also create a new client entry for this family member
        try {
          const newClientData = {
            first_name: data.first_name,
            last_name: data.last_name,
            birthdate: data.birth_date || null,
            permit_type: data.permit_type || null,
            nationality: data.nationality || null,
            type_adresse: 'client',
            status: 'prospect',
            // Copy address from parent client
            address: parentClient?.address || null,
            zip_code: parentClient?.zip_code || null,
            city: parentClient?.city || null,
            country: parentClient?.country || 'Suisse',
          };

          const { error: clientError } = await supabase
            .from('clients')
            .insert([newClientData]);

          if (clientError) {
            console.error('Error creating client for family member:', clientError);
          } else {
            toast({
              title: "Adresse créée",
              description: `${data.first_name} ${data.last_name} a été ajouté(e) à la liste des adresses`
            });
          }
        } catch (err) {
          console.error('Error creating client:', err);
        }
        
        onOpenChange(false);
        form.reset();
      }
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {member ? "Modifier le membre" : "Ajouter un membre de la famille"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="relation_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de relation *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="conjoint">Conjoint(e)</SelectItem>
                        <SelectItem value="enfant">Enfant</SelectItem>
                        <SelectItem value="autre">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="birth_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de naissance</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="permit_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de permis</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === "none" ? null : value)
                      }
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        <SelectItem value="B">Permis B</SelectItem>
                        <SelectItem value="C">Permis C</SelectItem>
                        <SelectItem value="G">Permis G</SelectItem>
                        <SelectItem value="L">Permis L</SelectItem>
                        <SelectItem value="Autre">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nationality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nationalité</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-4 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  form.reset();
                }}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
