import Link from "next/link";
import { Radio } from "lucide-react";
import { APP_NAME } from "@/lib/brand";

export default function NotFound() {
  return <main className="not-found"><Radio /><h1>Signal lost</h1><p>That {APP_NAME} page does not exist.</p><Link href="/home">Return home</Link></main>;
}
