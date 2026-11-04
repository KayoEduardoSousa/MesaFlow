import { describe, expect, it, vi } from "vitest";
import { requireSupabaseAuth, restoreAppSession, sessionFromUser, signOutSupabaseSession } from "./auth";

describe("requireSupabaseAuth", () => {
  it("rejects authentication when Supabase is not configured", () => {
    expect(() => requireSupabaseAuth(null)).toThrow(
      "Configure o Supabase para autenticar sua conta. O login local foi desativado por segurança.",
    );
  });

  it("returns the configured Supabase client unchanged", () => {
    const client = { auth: { signInWithPassword: () => undefined } };
    expect(requireSupabaseAuth(client)).toBe(client);
  });

  it("maps only the authenticated user's display identity into app state", () => {
    expect(sessionFromUser({
      id: "user-1",
      email: "owner@example.com",
      user_metadata: { full_name: "Ana Silva" },
    })).toEqual({
      userId: "user-1",
      email: "owner@example.com",
      fullName: "Ana Silva",
    });
  });

  it("does not create an app session without an authenticated user", () => {
    expect(sessionFromUser(null)).toBeNull();
  });

  it("reports a rejected session restore instead of leaving an unhandled promise", async () => {
    const onError = vi.fn();
    const load = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(restoreAppSession(load, onError)).resolves.toBeNull();
    expect(onError).toHaveBeenCalledOnce();
  });

  it("does not report sign-out success when Supabase returns an error", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: new Error("offline") });

    await expect(signOutSupabaseSession(signOut)).rejects.toThrow("offline");
  });
});
