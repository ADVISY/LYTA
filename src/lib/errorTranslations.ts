/**
 * Translates common Supabase/PostgreSQL error messages to French
 */
export function translateError(errorMessage: string): string {
  const translations: Record<string, string> = {
    // RLS errors
    'new row violates row-level security policy': 
      'Accès refusé : vous n\'avez pas les permissions pour effectuer cette action',
    'new row violates row-level security policy for table "commissions"': 
      'Accès refusé : vous n\'avez pas les permissions pour créer une commission',
    'new row violates row-level security policy for table "clients"': 
      'Accès refusé : vous n\'avez pas les permissions pour créer un client',
    'new row violates row-level security policy for table "policies"': 
      'Accès refusé : vous n\'avez pas les permissions pour créer un contrat',
    
    // Auth errors
    'Invalid login credentials': 
      'Identifiants incorrects',
    'Email not confirmed': 
      'Veuillez confirmer votre adresse email',
    'User already registered': 
      'Un compte existe déjà avec cet email',
    'Password should be at least 6 characters': 
      'Le mot de passe doit contenir au moins 6 caractères',
    'JWT expired': 
      'Votre session a expiré, veuillez vous reconnecter',
    
    // Database errors
    'duplicate key value violates unique constraint': 
      'Cette entrée existe déjà',
    'violates foreign key constraint': 
      'Impossible de supprimer : des éléments liés existent',
    'null value in column': 
      'Un champ obligatoire est manquant',
    'value too long for type': 
      'La valeur saisie est trop longue',
    
    // Network errors
    'Failed to fetch': 
      'Erreur de connexion au serveur',
    'Network request failed': 
      'Problème de connexion réseau',
    'TypeError: Failed to fetch': 
      'Impossible de contacter le serveur',
    
    // Permission errors
    'permission denied': 
      'Permission refusée',
    'insufficient_privilege': 
      'Droits insuffisants pour cette opération',
  };

  // Check for exact match first
  if (translations[errorMessage]) {
    return translations[errorMessage];
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(translations)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // Return original message if no translation found
  return errorMessage;
}
