import { VisualizerClient } from "@/components/visualizer/visualizer-client";

export default async function VisualizerPage(props: PageProps<"/visualizer">) {
  const searchParams = await props.searchParams;
  const exampleId =
    typeof searchParams.example === "string" ? searchParams.example : undefined;

  return <VisualizerClient initialExampleId={exampleId} />;
}
