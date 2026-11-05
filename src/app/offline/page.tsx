import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return <main className="not-found"><WifiOff /><h1>You’re offline</h1><p>Local files already stored in this browser remain available after you return to the app.</p><Link href="/home">Try again</Link></main>;
}
