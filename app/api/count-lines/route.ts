import { NextResponse } from "next/server";
import { ArchiveError, countLinesFromArchive } from "@/lib/archive-analyzer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const archive = formData.get("archive");
    const extensions = formData.getAll("extensions").map((value) => String(value).toLowerCase());

    if (!(archive instanceof File)) {
      return NextResponse.json({ error: "Archive file is required." }, { status: 400 });
    }

    const result = await countLinesFromArchive(archive, extensions);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ArchiveError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("count-lines", error);
    return NextResponse.json({ error: "Failed to count lines." }, { status: 500 });
  }
}
