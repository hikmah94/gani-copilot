"use client";
import { useRouter } from "next/navigation";

export function ViewRecordButton() {
  const router = useRouter();
  return <button onClick={() => router.push("/budget")}>View record</button>;
}
