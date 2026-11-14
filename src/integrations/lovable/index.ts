import { supabase } from "../supabase/client";

export type OAuthProvider = "google" | "github" | "apple";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: OAuthProvider, opts?: SignInOptions) => {
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: opts?.redirect_uri || window.location.origin,
            queryParams: opts?.extraParams,
          },
        });
        if (error) return { error };
        return { redirected: true, data };
      } catch (err: any) {
        return { error: err };
      }
    },
  },
};
