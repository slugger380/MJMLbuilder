import { NextResponse } from "next/server";
import { validateBrandAssetFile } from "@/lib/brandStyleLearning";
import {
  addBrandStyleAsset,
  getBrandStyle
} from "@/lib/brandStyleStore";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const style = await getBrandStyle(id);

  if (!style) {
    return NextResponse.json(
      { ok: false, error: "Brand styl nebyl nalezen." },
      { status: 404 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request musi byt multipart formular." },
      { status: 400 }
    );
  }

  const uploadedFiles = formData
    .getAll("assets")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (!uploadedFiles.length) {
    const single = formData.get("asset");
    if (single instanceof File && single.size > 0) {
      uploadedFiles.push(single);
    }
  }

  if (!uploadedFiles.length) {
    return NextResponse.json(
      { ok: false, error: "Nahrajte alespon jeden soubor." },
      { status: 400 }
    );
  }

  if (uploadedFiles.length > 8) {
    return NextResponse.json(
      { ok: false, error: "Najednou lze nahrat maximalne 8 souboru." },
      { status: 400 }
    );
  }

  let updatedStyle = style;
  const assets = [];

  for (const file of uploadedFiles) {
    const validationError = validateBrandAssetFile(
      file.name,
      file.type,
      file.size
    );

    if (validationError) {
      return NextResponse.json(
        { ok: false, error: validationError },
        { status: 400 }
      );
    }

    const result = await addBrandStyleAsset({
      styleId: id,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      buffer: Buffer.from(await file.arrayBuffer())
    });

    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Brand styl nebyl nalezen." },
        { status: 404 }
      );
    }

    updatedStyle = result.style;
    assets.push(result.asset);
  }

  return NextResponse.json({ ok: true, style: updatedStyle, assets });
}
