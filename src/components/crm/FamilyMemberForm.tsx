import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTranslation } from "react-i18next";
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

const getSchema = (t: (key: string) => string) => z.object({
  first_name: z.string().min(1, t("forms.familyMember.errors.firstNameRequired")),
  last_name: z.string().min(1, t("forms.familyMember.errors.lastNameRequired")),
  birth_date: z.string().optional().nullable(),
  relation_type: z.enum(["conjoint", "enfant", "autre"]),
  permit_type: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
});

type FamilyMemberFormData = z.infer<ReturnType<typeof getSchema>>;

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
  const { t } = useTranslation();
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
    resolver: zodResolver(getSchema(t)),
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
      try {
        // 1. Create a new client entry for this family member
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

        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert([newClientData])
          .select('id')
          .single();

        if (clientError) {
          console.error('Error creating client for family member:', clientError);
        toast({
          title: t("common.error"),
          description: t("forms.familyMember.errors.createClientError"),
          variant: "destructive"
        });
          setLoading(false);
          return;
        }

        // 2. Create family member entry (child linked to parent)
        const { error: familyError } = await createFamilyMember({
          client_id: clientId,
          ...data,
        } as any);

        if (familyError) {
          console.error('Error creating family member:', familyError);
        }

        // 3. Create reverse family member entry (parent linked to child)
        // So when viewing the child's profile, they see the parent
        const reverseRelationType = data.relation_type === 'conjoint' ? 'conjoint' : 'autre';
        const { error: reverseError } = await supabase
          .from('family_members')
          .insert([{
            client_id: newClient.id,
            first_name: parentClient?.first_name || '',
            last_name: parentClient?.last_name || '',
            birth_date: parentClient?.birthdate || null,
            relation_type: reverseRelationType,
            permit_type: parentClient?.permit_type || null,
            nationality: parentClient?.nationality || null,
          }]);

        if (reverseError) {
          console.error('Error creating reverse family member:', reverseError);
        }

        toast({
          title: t("forms.familyMember.success.added"),
          description: t("forms.familyMember.success.addedDescription", { name: `${data.first_name} ${data.last_name}` })
        });

        onOpenChange(false);
        form.reset();
      } catch (err) {
        console.error('Error:', err);
        toast({
          title: t("common.error"),
          description: t("forms.familyMember.errors.genericError"),
          variant: "destructive"
        });
      }
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {member ? t("forms.familyMember.editTitle") : t("forms.familyMember.addTitle")}
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
                    <FormLabel>{t("forms.familyMember.firstName")} *</FormLabel>
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
                    <FormLabel>{t("forms.familyMember.lastName")} *</FormLabel>
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
                    <FormLabel>{t("forms.familyMember.relationType")} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="conjoint">{t("forms.familyMember.relationTypes.spouse")}</SelectItem>
                        <SelectItem value="enfant">{t("forms.familyMember.relationTypes.child")}</SelectItem>
                        <SelectItem value="autre">{t("forms.familyMember.relationTypes.other")}</SelectItem>
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
                    <FormLabel>{t("forms.familyMember.birthDate")}</FormLabel>
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
                    <FormLabel>{t("forms.familyMember.permitType")}</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === "none" ? null : value)
                      }
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("common.select")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">{t("forms.familyMember.permits.none")}</SelectItem>
                        <SelectItem value="B">{t("forms.familyMember.permits.b")}</SelectItem>
                        <SelectItem value="C">{t("forms.familyMember.permits.c")}</SelectItem>
                        <SelectItem value="G">{t("forms.familyMember.permits.g")}</SelectItem>
                        <SelectItem value="L">{t("forms.familyMember.permits.l")}</SelectItem>
                        <SelectItem value="Autre">{t("forms.familyMember.permits.other")}</SelectItem>
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
                    <FormLabel>{t("forms.familyMember.nationality")}</FormLabel>
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
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
