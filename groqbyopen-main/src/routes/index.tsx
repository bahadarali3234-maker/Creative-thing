import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

function SimpleLoader() {
  return <div className="simple-loader" role="status" aria-label="Loading"><span /></div>;
}

const LegacyApp = lazy(() => import("@/app/Root"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gemini — AI Workspace & Creative Intelligence" },
      { name: "description", content: "Next-generation AI Workspace showcasing multimodal reasoning, AI Projects, generative capabilities, and intelligent creative sessions." },
      { property: "og:title", content: "Gemini — AI Workspace & Creative Intelligence" },
      { property: "og:description", content: "Next-generation AI Workspace showcasing multimodal reasoning, AI Projects, generative capabilities, and intelligent creative sessions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<SimpleLoader />}>
      <Suspense fallback={<SimpleLoader />}>
        <LegacyApp />
      </Suspense>
    </ClientOnly>
  );
}
