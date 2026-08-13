import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Creator Connect",
    short_name: "Creators",
    description: "A creator-focused social media platform with feed, messaging, marketplace, challenges, and analytics.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#080a13",
    theme_color: "#a855f7",
    orientation: "portrait-primary",
    categories: ["social", "entertainment", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }
    ],
    shortcuts: [
      { name: "Explore", short_name: "Explore", description: "Discover trending creators and posts", url: "/explore" },
      { name: "Messages", short_name: "Messages", description: "Open direct messages", url: "/messages" },
      { name: "Marketplace", short_name: "Market", description: "Browse creator listings", url: "/marketplace" },
      { name: "Challenges", short_name: "Challenges", description: "Join creator challenges", url: "/challenges" }
    ]
  };
}
