import { PlaylistDetail } from "@/components/screens/playlist-detail";

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlaylistDetail id={id} />;
}
