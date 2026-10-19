import { createFileRoute } from "@tanstack/react-router";
import cover from "@/assets/cover.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ki Legends — Już wkrótce" },
      { name: "description", content: "Ki Legends — nowa gra fantasy. Już wkrótce." },
      { property: "og:title", content: "Ki Legends — Już wkrótce" },
      { property: "og:description", content: "Ki Legends — nowa gra fantasy. Już wkrótce." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <h1 className="sr-only">Ki Legends — Już wkrótce</h1>
      <img
        src={cover.url}
        alt="Ki Legends — Już wkrótce"
        className="h-screen w-full object-contain"
      />
    </main>
  );
}
