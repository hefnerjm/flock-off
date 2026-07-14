// Swapping providers is a one-file change: set `provider` and its config
// below. Left as "none" until a provider is chosen (see CLAUDE.md - this is
// an explicit "ask before choosing" decision, not one to make unilaterally).
export type EmailProvider = "none" | "buttondown" | "action-network";

export const emailConfig: {
  provider: EmailProvider;
  buttondown: { username: string };
  actionNetwork: { formActionUrl: string };
} = {
  provider: "none",
  buttondown: {
    username: "",
  },
  actionNetwork: {
    formActionUrl: "",
  },
};
