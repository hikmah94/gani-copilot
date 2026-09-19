import { Suspense } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SearchResults } from "@/components/search-results";

export default function SearchPage() {
  return <><Header /><Suspense><SearchResults /></Suspense><Footer /></>;
}
