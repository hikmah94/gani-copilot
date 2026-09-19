import { Suspense } from "react";import { Header } from "@/components/header";import { Chat } from "@/components/chat";
export default function Ask(){return <><Header/><Suspense><Chat/></Suspense></>}
