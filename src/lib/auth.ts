export type AppSession = {
  userId: string;
  email: string;
  fullName: string;
};

export type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export function sessionFromUser(user: AuthUser | null): AppSession | null {
  if (!user) return null;

  const metadataName = user.user_metadata?.full_name;
  const fullName = typeof metadataName === "string" && metadataName.trim()
    ? metadataName.trim()
    : user.email || "Administrador";

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName,
  };
}

export async function restoreAppSession(
  load: () => Promise<{ data: { session: { user: AuthUser } | null }; error: unknown }>,
  onError: () => void,
): Promise<AppSession | null> {
  try {
    const { data, error } = await load();
    if (error) {
      onError();
      return null;
    }
    return sessionFromUser(data.session?.user ?? null);
  } catch {
    onError();
    return null;
  }
}

export async function signOutSupabaseSession(
  signOut: () => Promise<{ error: unknown }>,
): Promise<void> {
  const { error } = await signOut();
  if (error) throw error;
}

export function requireSupabaseAuth<T>(client: T | null): T {
  if (!client) {
    throw new Error(
      "Configure o Supabase para autenticar sua conta. O login local foi desativado por segurança.",
    );
  }

  return client;
}
