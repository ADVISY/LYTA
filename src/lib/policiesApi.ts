import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorTranslations";

type PolicyMutationAction = "create" | "update";

interface SavePolicyInput {
  action: PolicyMutationAction;
  tenantId: string;
  policyId?: string;
  policyData: Record<string, unknown>;
}

interface SavePolicyResponse {
  id: string;
}

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json() as { error?: string; message?: string };
      return payload.error || payload.message || error.message;
    } catch {
      return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Erreur inconnue";
}

export async function savePolicy(input: SavePolicyInput): Promise<SavePolicyResponse> {
  const { data, error } = await supabase.functions.invoke("save-policy", {
    body: input,
  });

  if (error) {
    throw new Error(translateError(await getFunctionErrorMessage(error)));
  }

  if (data?.error) {
    throw new Error(translateError(data.error));
  }

  if (!data?.policy?.id) {
    throw new Error("Reponse invalide lors de l'enregistrement du contrat");
  }

  return data.policy as SavePolicyResponse;
}
