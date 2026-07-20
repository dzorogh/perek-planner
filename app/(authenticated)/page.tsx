import { redirect } from "next/navigation";

type HomePageProps = {
  searchParams: Promise<{ create?: string }>;
};

/** Create-menu lives in a modal; home lands on history. */
export default async function HomePage({ searchParams }: HomePageProps) {
  const { create } = await searchParams;
  redirect(create === "1" ? "/history?create=1" : "/history");
}
