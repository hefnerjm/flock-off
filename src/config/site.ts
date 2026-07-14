export const site = {
  name: "Flock Off",
  tagline: "Documenting Flock Safety camera abuse. Organizing to remove them.",
  domain: "https://flockoff.org",
  colors: {
    bg: "#0b0d10",
    fg: "#e8e8e8",
    accent: "#ff3b30",
  },
  social: {
    twitter: "",
    github: "",
  },
  // drives which map zoom preset loads by default
  regionDefault: "bexar" as "bexar" | "texas" | "national",
} as const;
