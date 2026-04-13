import { invokeSupabaseFunction } from "@/lib/edgeFunctions";
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Erreur inconnue";
}

export async function savePolicy(input: SavePolicyInput): Promise<SavePolicyResponse> {
  let data: { policy?: SavePolicyResponse };

  try {
    data = await invokeSupabaseFunction<{ policy?: SavePolicyResponse }>("save-policy", {
      body: input,
    });
  } catch (error) {
    throw new Error(translateError(getErrorMessage(error)));
  }

  if (!data?.policy?.id) {
    throw new Error("Reponse invalide lors de l'enregistrement du contrat");
  }

  return data.policy as SavePolicyResponse;
}
