import { NextRequest, NextResponse } from "next/server";

const MANGADEX_API = "https://api.mangadex.org";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    let path = searchParams.get("path");

    if (!path) {
      return NextResponse.json(
        {
          error: "مسار MangaDex غير موجود.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * أحيانًا يصل path بترميز مزدوج.
     * نفك الترميز حتى نعيده إلى شكله الطبيعي.
     */
    try {
      path = decodeURIComponent(path);
    } catch {
      // إذا كان الترميز غير صالح نستخدم القيمة الأصلية
    }

    if (!path.startsWith("/")) {
      return NextResponse.json(
        {
          error: "مسار MangaDex غير صحيح.",
        },
        {
          status: 400,
        }
      );
    }

    const mangaDexUrl =
      `${MANGADEX_API}${path}`;

    let response: Response | null = null;
    let lastError: unknown = null;

    /*
     * إعادة المحاولة حتى 3 مرات
     * في حال حدوث انقطاع اتصال مؤقت مع MangaDex.
     */
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await fetch(
          mangaDexUrl,
          {
            cache: "no-store",
          }
        );

        break;
      } catch (error) {
        lastError = error;

        console.error(
          `MangaDex proxy attempt ${attempt}/3 failed:`,
          error
        );

        if (attempt < 3) {
          await new Promise((resolve) =>
            setTimeout(resolve, 500)
          );
        }
      }
    }

    if (!response) {
      throw (
        lastError ||
        new Error(
          "تعذر الاتصال بخادم MangaDex."
        )
      );
    }

    const text =
      await response.text();

    return new NextResponse(
      text,
      {
        status: response.status,

        headers: {
          "Content-Type":
            response.headers.get(
              "content-type"
            ) ||
            "application/json",
        },
      }
    );
  } catch (error) {
    console.error(
      "MangaDex proxy error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء الاتصال بـ MangaDex.",
      },
      {
        status: 500,
      }
    );
  }
}