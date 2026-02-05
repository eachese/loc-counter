import { NextResponse } from "next/server";
import { ArchiveError, scanExtensionsFromArchive } from "@/lib/archive-analyzer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const archive = formData.get("archive");

    if (!(archive instanceof File)) {
      return NextResponse.json({ error: "Archive file is required." }, { status: 400 });
    }

    const extensions = await scanExtensionsFromArchive(archive);
    return NextResponse.json({ extensions });
  } catch (error) {
    if (error instanceof ArchiveError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("scan-extensions", error);
    return NextResponse.json({ error: "Failed to scan extensions." }, { status: 500 });
  }
}
