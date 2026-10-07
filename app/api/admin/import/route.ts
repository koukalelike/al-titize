import {
  importChaptersWithProgress,
  type ChapterToImport,
  type ImportProgress,
} from "@/app/admin/import/importer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const mangaDexId = body?.mangaDexId;
    const chapters = body?.chapters;

    if (
      typeof mangaDexId !== "string" ||
      !mangaDexId.trim()
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "MangaDex ID غير صحيح.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type":
              "application/json; charset=utf-8",
          },
        }
      );
    }

    if (!Array.isArray(chapters)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "قائمة الفصول غير صحيحة.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type":
              "application/json; charset=utf-8",
          },
        }
      );
    }

    if (chapters.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "لم يتم إرسال أي فصول للاستيراد.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type":
              "application/json; charset=utf-8",
          },
        }
      );
    }

    if (chapters.length > 100) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "الحد الأقصى للدفعة الواحدة هو 100 فصل.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type":
              "application/json; charset=utf-8",
          },
        }
      );
    }

    const encoder = new TextEncoder();

    const stream =
      new ReadableStream<Uint8Array>({
        async start(controller) {
          let closed = false;

          function send(data: unknown) {
            if (closed) {
              return;
            }

            try {
              controller.enqueue(
                encoder.encode(
                  `${JSON.stringify(data)}\n`
                )
              );
            } catch {
              closed = true;
            }
          }

          try {
            send({
              event: "connection",
              message:
                "✅ تم الاتصال بخدمة الاستيراد.",
              timestamp: Date.now(),
            });

            const normalizedChapters =
              chapters.map(
                (
                  chapter: any
                ): ChapterToImport => ({
                  id: String(
                    chapter.id
                  ),
                  chapter:
                    chapter.chapter ??
                    null,
                  title: String(
                    chapter.title ??
                      ""
                  ),
                  language: String(
                    chapter.language ??
                      ""
                  ),
                  pages: Number(
                    chapter.pages ??
                      0
                  ),
                  volume:
                    chapter.volume ??
                    null,
                })
              );

            const onProgress =
              async (
                progress: ImportProgress
              ) => {
                send({
                  event: "progress",
                  ...progress,
                  timestamp:
                    Date.now(),
                });
              };

            const result =
              await importChaptersWithProgress(
                mangaDexId,
                normalizedChapters,
                onProgress
              );

            send({
              event: "result",
              success:
                result.success,
              result,
              timestamp:
                Date.now(),
            });

            send({
              event: "complete",
              success:
                result.success,
              message:
                result.success
                  ? "🎉 اكتمل الاستيراد."
                  : "⚠️ انتهى الاستيراد مع وجود أخطاء.",
              timestamp:
                Date.now(),
            });
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "حدث خطأ أثناء الاستيراد.";

            send({
              event: "error",
              success: false,
              error: message,
              timestamp:
                Date.now(),
            });
          } finally {
            if (!closed) {
              closed = true;

              try {
                controller.close();
              } catch {
                // تجاهل خطأ إغلاق stream
              }
            }
          }
        },
      });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type":
          "application/x-ndjson; charset=utf-8",
        "Cache-Control":
          "no-cache, no-store, must-revalidate",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "تعذر بدء عملية الاستيراد.";

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type":
            "application/json; charset=utf-8",
        },
      }
    );
  }
}