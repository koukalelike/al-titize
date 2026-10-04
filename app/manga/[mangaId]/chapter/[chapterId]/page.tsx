"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Page = {
  id: number;
  page_number: number;
  image_url: string;
};

type Chapter = {
  id: number;
  chapter_number: number;
  title: string | null;
  manga_id: number;
};

type Manga = {
  id: number;
  title: string;
};

type Comment = {
  id: number;
  chapter_id: number;
  user_id: string;
  content: string;
  created_at: string;
  username?: string | null;
};

export default function ChapterReader() {
  const params = useParams();

  const mangaId = Number(params.mangaId);
  const chapterId = Number(params.chapterId);

  const [manga, setManga] = useState<Manga | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);

  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(100);

  const [commentText, setCommentText] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentMessage, setCommentMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    async function loadChapter() {
      if (!mangaId || !chapterId) {
        setError("معرف المانجا أو الفصل غير صحيح.");
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();

        const currentUserId = user?.id ?? null;

        setUserId(currentUserId);

        const { data: mangaData, error: mangaError } =
          await supabase
            .from("manga")
            .select("id, title")
            .eq("id", mangaId)
            .single();

        if (mangaError) {
          throw new Error(
            `خطأ في تحميل المانجا: ${mangaError.message}`
          );
        }

        const { data: chapterData, error: chapterError } =
          await supabase
            .from("chapters")
            .select("id, chapter_number, title, manga_id")
            .eq("id", chapterId)
            .single();

        if (chapterError) {
          throw new Error(
            `خطأ في تحميل الفصل: ${chapterError.message}`
          );
        }

        const { data: pagesData, error: pagesError } =
          await supabase
            .from("pages")
            .select("id, page_number, image_url")
            .eq("chapter_id", chapterId)
            .order("page_number", {
              ascending: true,
            });

        if (pagesError) {
          throw new Error(
            `خطأ في تحميل الصفحات: ${pagesError.message}`
          );
        }

        const { data: commentsData, error: commentsError } =
          await supabase
            .from("comments")
            .select(
              "id, chapter_id, user_id, content, created_at"
            )
            .eq("chapter_id", chapterId)
            .order("created_at", {
              ascending: false,
            });

        if (commentsError) {
          throw new Error(
            `خطأ في تحميل التعليقات: ${commentsError.message}`
          );
        }

        const rawComments = commentsData ?? [];

        const userIds = [
          ...new Set(
            rawComments.map(
              (comment) => comment.user_id
            )
          ),
        ];

        let profiles: {
          id: string;
          username: string | null;
        }[] = [];

        if (userIds.length > 0) {
          const {
            data: profilesData,
            error: profilesError,
          } = await supabase
            .from("profiles")
            .select("id, username")
            .in("id", userIds);

          if (profilesError) {
            console.error(
              "PROFILES LOAD ERROR:",
              profilesError
            );
          }

          profiles = profilesData ?? [];
        }

        const commentsWithNames = rawComments.map(
          (comment) => {
            const profile = profiles.find(
              (item) => item.id === comment.user_id
            );

            return {
              ...comment,
              username:
                profile?.username ?? "مستخدم",
            };
          }
        );

        setManga(mangaData);
        setChapter(chapterData);
        setPages(pagesData ?? []);
        setComments(commentsWithNames);

        let savedPage = 0;

        if (currentUserId) {
          const {
            data: progressData,
            error: progressError,
          } = await supabase
            .from("reading_progress")
            .select("page_number")
            .eq("user_id", currentUserId)
            .eq("chapter_id", chapterId)
            .maybeSingle();

          if (progressError) {
            console.error(
              "READING PROGRESS LOAD ERROR:",
              progressError
            );
          }

          if (progressData?.page_number) {
            const savedPageIndex =
              progressData.page_number - 1;

            if (
              savedPageIndex >= 0 &&
              savedPageIndex <
                (pagesData?.length ?? 0)
            ) {
              savedPage = savedPageIndex;
            }
          }
        }

        setCurrentPage(savedPage);
      } catch (err) {
        console.error("READER ERROR:", err);

        setError(
          err instanceof Error
            ? err.message
            : "حدث خطأ أثناء تحميل الفصل."
        );
      } finally {
        setLoading(false);
      }
    }

    loadChapter();
  }, [mangaId, chapterId]);

  async function saveReadingProgress(
    pageIndex: number
  ) {
    if (!userId || !chapterId) return;

    const supabase = createClient();

    const { error } = await supabase
      .from("reading_progress")
      .upsert(
        {
          user_id: userId,
          chapter_id: chapterId,
          page_number: pageIndex + 1,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,chapter_id",
        }
      );

    if (error) {
      console.error(
        "READING PROGRESS SAVE ERROR:",
        error
      );
    }
  }

  function changePage(pageIndex: number) {
    if (pageIndex < 0 || pageIndex >= pages.length) {
      return;
    }

    setCurrentPage(pageIndex);
    saveReadingProgress(pageIndex);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function nextPage() {
    if (currentPage < pages.length - 1) {
      changePage(currentPage + 1);
    }
  }

  function previousPage() {
    if (currentPage > 0) {
      changePage(currentPage - 1);
    }
  }

  function increaseZoom() {
    setZoom((value) => Math.min(value + 10, 150));
  }

  function decreaseZoom() {
    setZoom((value) => Math.max(value - 10, 60));
  }

  function resetZoom() {
    setZoom(100);
  }

  function handleTouchStart(
    event: React.TouchEvent<HTMLDivElement>
  ) {
    touchStartX.current =
      event.touches[0]?.clientX ?? null;

    touchStartY.current =
      event.touches[0]?.clientY ?? null;
  }

  function handleTouchEnd(
    event: React.TouchEvent<HTMLDivElement>
  ) {
    if (
      touchStartX.current === null ||
      touchStartY.current === null
    ) {
      return;
    }

    const endX =
      event.changedTouches[0]?.clientX ?? 0;

    const endY =
      event.changedTouches[0]?.clientY ?? 0;

    const diffX = endX - touchStartX.current;
    const diffY = endY - touchStartY.current;

    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(diffX) < 60) {
      return;
    }

    if (Math.abs(diffX) < Math.abs(diffY)) {
      return;
    }

    if (diffX < 0) {
      nextPage();
    } else {
      previousPage();
    }
  }

  async function addComment() {
    const content = commentText.trim();

    if (!userId) {
      setCommentMessage(
        "يجب تسجيل الدخول لكتابة تعليق."
      );
      return;
    }

    if (!content) {
      setCommentMessage(
        "اكتب تعليقًا أولًا."
      );
      return;
    }

    setCommentLoading(true);
    setCommentMessage("");

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("comments")
        .insert({
          chapter_id: chapterId,
          user_id: userId,
          content,
        })
        .select(
          "id, chapter_id, user_id, content, created_at"
        )
        .single();

      if (error) {
        throw error;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .single();

      if (profileError) {
        console.error(
          "PROFILE LOAD ERROR:",
          profileError
        );
      }

      setComments((current) => [
        {
          ...data,
          username:
            profile?.username ?? "مستخدم",
        },
        ...current,
      ]);

      setCommentText("");

      setCommentMessage(
        "تم نشر تعليقك بنجاح ✅"
      );
    } catch (err) {
      console.error(
        "ADD COMMENT ERROR:",
        err
      );

      setCommentMessage(
        "حدث خطأ أثناء نشر التعليق."
      );
    } finally {
      setCommentLoading(false);
    }
  }

  async function deleteComment(commentId: number) {
    if (!userId) return;

    const supabase = createClient();

    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", userId);

    if (error) {
      console.error(
        "DELETE COMMENT ERROR:",
        error
      );
      return;
    }

    setComments((current) =>
      current.filter(
        (comment) => comment.id !== commentId
      )
    );
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-white px-5"
      >
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-t-black" />

          <p className="mt-5 text-sm font-medium text-gray-500">
            جاري تحميل الفصل...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-white px-5"
      >
        <div className="w-full max-w-xl text-center">
          <div className="text-5xl sm:text-6xl">
            ⚠️
          </div>

          <h1 className="mt-5 text-2xl font-black sm:text-3xl">
            حدث خطأ
          </h1>

          <p className="mt-4 rounded-2xl bg-gray-100 p-4 text-sm leading-7 text-gray-600">
            {error}
          </p>

          <a
            href="/manga"
            className="mt-6 inline-block rounded-2xl bg-black px-7 py-3 font-bold text-white transition hover:-translate-y-1"
          >
            العودة إلى المكتبة
          </a>
        </div>
      </main>
    );
  }

  if (!manga || !chapter) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-white px-5"
      >
        <div className="text-center">
          <div className="text-5xl">📖</div>

          <h1 className="mt-5 text-2xl font-black sm:text-3xl">
            الفصل غير موجود
          </h1>
        </div>
      </main>
    );
  }

  const currentImage =
    pages[currentPage]?.image_url ?? null;

  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-x-hidden bg-gray-50 text-gray-900"
    >
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-2 px-3 sm:px-5 md:px-6">
          <a
            href={`/manga/${manga.id}`}
            className="flex min-h-10 shrink-0 items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-bold transition active:scale-95 sm:px-4 sm:text-sm"
          >
            <span className="sm:hidden">←</span>
            <span className="hidden sm:inline">
              ← العودة
            </span>
          </a>

          <div className="min-w-0 flex-1 px-2 text-center">
            <p className="truncate text-[10px] font-bold text-gray-400 sm:text-xs">
              {manga.title}
            </p>

            <h1 className="truncate text-xs font-black sm:text-sm">
              الفصل {chapter.chapter_number}
              {chapter.title
                ? ` — ${chapter.title}`
                : ""}
            </h1>
          </div>

          <a
            href="/account"
            aria-label="الحساب"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-sm transition active:scale-90"
          >
            👤
          </a>
        </div>
      </header>

      {/* READER CONTROLS */}
      <section className="sticky top-[68px] z-40 border-b border-gray-200 bg-gray-50/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2 px-2 py-2.5 sm:px-4 sm:py-3">
          <button
            onClick={previousPage}
            disabled={currentPage === 0}
            aria-label="الصفحة السابقة"
            className="flex min-h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold shadow-sm transition active:scale-95 disabled:opacity-40 sm:px-4 sm:text-sm"
          >
            <span className="sm:hidden">→</span>
            <span className="hidden sm:inline">
              → السابق
            </span>
          </button>

          <div className="flex min-h-10 items-center rounded-xl bg-black px-3 text-xs font-bold text-white shadow-sm sm:px-4 sm:text-sm">
            {pages.length > 0
              ? `${currentPage + 1} / ${pages.length}`
              : "0 / 0"}
          </div>

          <button
            onClick={nextPage}
            disabled={
              currentPage >= pages.length - 1
            }
            aria-label="الصفحة التالية"
            className="flex min-h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold shadow-sm transition active:scale-95 disabled:opacity-40 sm:px-4 sm:text-sm"
          >
            <span className="sm:hidden">←</span>
            <span className="hidden sm:inline">
              التالي ←
            </span>
          </button>

          <div className="mx-1 hidden h-7 w-px bg-gray-200 sm:block" />

          <div className="flex items-center gap-1">
            <button
              onClick={decreaseZoom}
              aria-label="تصغير"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-lg font-bold shadow-sm transition active:scale-90"
            >
              −
            </button>

            <button
              onClick={resetZoom}
              className="flex h-10 min-w-[54px] items-center justify-center rounded-xl border border-gray-200 bg-white px-2 text-xs font-bold shadow-sm transition active:scale-95"
            >
              {zoom}%
            </button>

            <button
              onClick={increaseZoom}
              aria-label="تكبير"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-lg font-bold shadow-sm transition active:scale-90"
            >
              +
            </button>
          </div>
        </div>
      </section>

      {/* MANGA PAGE */}
      <section className="mx-auto max-w-5xl px-0 py-3 sm:px-4 sm:py-6 md:px-6 md:py-10">
        {currentImage ? (
          <div
            className="flex min-h-[55vh] w-full touch-pan-y justify-center overflow-x-auto overscroll-x-contain"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={currentImage}
              alt={`${manga.title} - الصفحة ${
                currentPage + 1
              }`}
              draggable={false}
              className="h-auto max-w-none select-none rounded-none shadow-lg sm:rounded-xl sm:shadow-xl"
              style={{
                width:
                  zoom === 100
                    ? "100%"
                    : `${zoom}%`,
                minWidth:
                  zoom < 100
                    ? "100%"
                    : undefined,
              }}
            />
          </div>
        ) : (
          <div className="mx-3 rounded-3xl border border-gray-200 bg-white p-10 text-center sm:mx-0 sm:p-16">
            <div className="text-5xl sm:text-6xl">
              📄
            </div>

            <h2 className="mt-5 text-xl font-black sm:text-2xl">
              لا توجد صفحات
            </h2>

            <p className="mt-3 text-sm text-gray-500">
              لم تتم إضافة صفحات لهذا الفصل بعد.
            </p>
          </div>
        )}
      </section>

      {/* BOTTOM NAVIGATION */}
      {pages.length > 0 && (
        <section className="border-t border-gray-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-3 py-5 sm:gap-4 sm:px-4 sm:py-8">
            <button
              onClick={previousPage}
              disabled={currentPage === 0}
              className="min-h-12 flex-1 rounded-2xl border border-gray-200 px-3 py-3 text-xs font-bold shadow-sm transition active:scale-[0.98] disabled:opacity-40 sm:flex-none sm:px-5 sm:text-sm"
            >
              ← السابقة
            </button>

            <strong className="shrink-0 text-xs sm:text-sm">
              {currentPage + 1} / {pages.length}
            </strong>

            <button
              onClick={nextPage}
              disabled={
                currentPage >= pages.length - 1
              }
              className="min-h-12 flex-1 rounded-2xl bg-black px-3 py-3 text-xs font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-40 sm:flex-none sm:px-5 sm:text-sm"
            >
              التالية →
            </button>
          </div>
        </section>
      )}

      {/* COMMENTS */}
      <section className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-5 sm:py-14">
          <div className="mb-7">
            <p className="text-[10px] font-bold tracking-[0.3em] text-gray-400 sm:text-xs">
              COMMENTS
            </p>

            <h2 className="mt-2 text-2xl font-black sm:mt-3 sm:text-3xl">
              💬 التعليقات
            </h2>

            <p className="mt-2 text-xs text-gray-500 sm:text-sm">
              شارك رأيك حول هذا الفصل.
            </p>
          </div>

          {userId ? (
            <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <textarea
                value={commentText}
                onChange={(event) =>
                  setCommentText(event.target.value)
                }
                placeholder="اكتب تعليقك هنا..."
                rows={4}
                maxLength={1000}
                className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 outline-none transition focus:border-black"
              />

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-gray-400">
                  {commentText.length}/1000
                </span>

                <button
                  onClick={addComment}
                  disabled={commentLoading}
                  className="min-h-11 w-full rounded-2xl bg-black px-7 py-3 text-sm font-bold text-white transition active:scale-[0.98] hover:bg-gray-800 disabled:opacity-50 sm:w-auto"
                >
                  {commentLoading
                    ? "جاري النشر..."
                    : "نشر التعليق"}
                </button>
              </div>

              {commentMessage && (
                <p className="mt-4 rounded-xl bg-gray-100 p-3 text-center text-xs text-gray-600 sm:text-sm">
                  {commentMessage}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-gray-200 bg-white p-7 text-center shadow-sm sm:p-8">
              <div className="text-4xl">🔐</div>

              <h3 className="mt-4 text-lg font-black sm:text-xl">
                سجل الدخول للمشاركة
              </h3>

              <p className="mt-2 text-xs text-gray-500 sm:text-sm">
                يجب تسجيل الدخول حتى تتمكن من كتابة تعليق.
              </p>

              <a
                href="/login"
                className="mt-5 inline-block rounded-2xl bg-black px-7 py-3 text-sm font-bold text-white transition active:scale-95"
              >
                تسجيل الدخول
              </a>
            </div>
          )}

          <div className="mt-6 space-y-3 sm:mt-8 sm:space-y-4">
            {comments.length === 0 ? (
              <div className="rounded-3xl border border-gray-200 bg-white p-9 text-center sm:p-12">
                <div className="text-4xl sm:text-5xl">
                  💭
                </div>

                <h3 className="mt-4 text-lg font-black sm:mt-5 sm:text-xl">
                  لا توجد تعليقات بعد
                </h3>

                <p className="mt-2 text-xs text-gray-500 sm:text-sm">
                  كن أول شخص يشارك رأيه في هذا الفصل.
                </p>
              </div>
            ) : (
              comments.map((comment) => (
                <article
                  key={comment.id}
                  className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white">
                        👤
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">
                          {comment.username ||
                            "مستخدم"}
                        </p>

                        <p className="mt-1 text-[10px] text-gray-400 sm:text-xs">
                          {new Date(
                            comment.created_at
                          ).toLocaleDateString("ar-MA")}
                        </p>
                      </div>
                    </div>

                    {userId === comment.user_id && (
                      <button
                        onClick={() =>
                          deleteComment(comment.id)
                        }
                        className="shrink-0 rounded-xl px-2 py-2 text-xs font-bold text-gray-400 transition active:scale-95 hover:bg-gray-100 hover:text-black"
                      >
                        🗑️
                        <span className="hidden sm:inline">
                          {" "}
                          حذف
                        </span>
                      </button>
                    )}
                  </div>

                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-gray-600">
                    {comment.content}
                  </p>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 bg-white px-4 py-7 text-center">
        <p className="text-sm font-black tracking-[0.25em]">
          AL TITIZE
        </p>

        <p className="mt-2 text-[10px] text-gray-400 sm:text-xs">
          Manga Reader
        </p>
      </footer>
    </main>
  );
}