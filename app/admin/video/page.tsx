"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SiteVideo = {
  id: number;
  video_url: string;
  created_at: string;
};

export default function AdminVideoPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [video, setVideo] = useState<SiteVideo | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success"
  );

  useEffect(() => {
    checkAdminAndLoadVideo();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function checkAdminAndLoadVideo() {
    setLoading(true);

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      router.push("/");
      return;
    }

    await loadVideo();

    setLoading(false);
  }

  async function loadVideo() {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("site_video")
      .select("id, video_url, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      showMessage("حدث خطأ أثناء تحميل الفيديو.", "error");
      return;
    }

    setVideo(data ?? null);
  }

  function showMessage(
    text: string,
    type: "success" | "error"
  ) {
    setMessage(text);
    setMessageType(type);
  }

  function openFilePicker() {
    setMessage("");
    fileInputRef.current?.click();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setMessage("");

    if (!file.type.startsWith("video/")) {
      showMessage("الملف المحدد ليس فيديو.", "error");
      event.target.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const videoElement = document.createElement("video");

    videoElement.preload = "metadata";

    videoElement.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);

      const duration = videoElement.duration;

      if (!Number.isFinite(duration)) {
        showMessage("تعذر قراءة مدة الفيديو.", "error");
        event.target.value = "";
        return;
      }

      if (duration > 50) {
        showMessage(
          `الفيديو مدته ${Math.ceil(
            duration
          )} ثانية، والحد الأقصى هو 50 ثانية.`,
          "error"
        );
        event.target.value = "";
        setSelectedFile(null);
        setPreviewUrl(null);
        return;
      }

      setSelectedFile(file);

      const newPreviewUrl = URL.createObjectURL(file);

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      setPreviewUrl(newPreviewUrl);

      showMessage(
        `تم اختيار الفيديو بنجاح — المدة ${Math.ceil(duration)} ثانية.`,
        "success"
      );
    };

    videoElement.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      showMessage("تعذر قراءة هذا الفيديو.", "error");
      event.target.value = "";
    };

    videoElement.src = objectUrl;
  }

  async function saveVideo() {
    if (!selectedFile) {
      showMessage("اختر فيديو أولًا.", "error");
      return;
    }

    setSaving(true);
    setMessage("");

    const supabase = createClient();

    const fileExtension =
      selectedFile.name.split(".").pop()?.toLowerCase() || "mp4";

    const filePath = `site-video/video-${Date.now()}.${fileExtension}`;

    const { error: uploadError } = await supabase.storage
      .from("manga-pages")
      .upload(filePath, selectedFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: selectedFile.type,
      });

    if (uploadError) {
      showMessage(
        "فشل رفع الفيديو: " + uploadError.message,
        "error"
      );
      setSaving(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from("manga-pages")
      .getPublicUrl(filePath);

    if (video) {
      await supabase
        .from("site_video")
        .delete()
        .eq("id", video.id);
    }

    const { error: insertError } = await supabase
      .from("site_video")
      .insert({
        video_url: publicUrl,
      });

    if (insertError) {
      await supabase.storage
        .from("manga-pages")
        .remove([filePath]);

      showMessage(
        "فشل حفظ الفيديو: " + insertError.message,
        "error"
      );

      setSaving(false);
      return;
    }

    setSelectedFile(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    await loadVideo();

    showMessage("تم حفظ فيديو الموقع بنجاح ✅", "success");

    setSaving(false);
  }

  async function deleteVideo() {
    if (!video) {
      return;
    }

    const confirmed = window.confirm(
      "هل أنت متأكد من حذف فيديو الموقع؟"
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("site_video")
      .delete()
      .eq("id", video.id);

    if (error) {
      showMessage(
        "فشل حذف الفيديو: " + error.message,
        "error"
      );
      setDeleting(false);
      return;
    }

    setVideo(null);

    showMessage("تم حذف فيديو الموقع بنجاح ✅", "success");

    setDeleting(false);
  }

  function cancelSelection() {
    setSelectedFile(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setMessage("");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
            <p className="mt-4 text-sm font-bold text-gray-500">
              جاري تحميل صفحة الفيديو...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 text-3xl">🎬</div>

              <h1 className="text-2xl font-black text-gray-900">
                إدارة فيديو الموقع
              </h1>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                اختر فيديو قصير ليظهر في أعلى صفحات الموقع للمستخدمين.
              </p>
            </div>

            <button
              onClick={() => router.push("/admin")}
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 transition hover:border-black hover:text-black"
            >
              ← العودة للإدارة
            </button>
          </div>
        </div>

        {/* Current video */}
        <div className="mb-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-black text-gray-900">
              الفيديو الحالي
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              الفيديو الموجود حاليًا على الموقع.
            </p>
          </div>

          {video ? (
            <div>
              <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-black">
                <video
                  src={video.video_url}
                  controls
                  playsInline
                  preload="metadata"
                  className="block max-h-[400px] w-full object-contain"
                />
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={openFilePicker}
                  className="flex-1 rounded-xl bg-black px-5 py-3.5 font-bold text-white transition hover:bg-gray-800"
                >
                  🔄 تغيير الفيديو
                </button>

                <button
                  onClick={deleteVideo}
                  disabled={deleting}
                  className="flex-1 rounded-xl border border-red-200 bg-white px-5 py-3.5 font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  {deleting
                    ? "جاري الحذف..."
                    : "🗑️ حذف الفيديو"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
              <div className="text-5xl">🎬</div>

              <p className="mt-4 font-black text-gray-700">
                لا يوجد فيديو حاليًا
              </p>

              <p className="mt-2 text-sm text-gray-400">
                اختر فيديو لإضافته إلى الموقع.
              </p>

              <button
                onClick={openFilePicker}
                className="mt-6 rounded-xl bg-black px-7 py-3.5 font-bold text-white transition hover:bg-gray-800"
              >
                📁 اختيار فيديو
              </button>
            </div>
          )}
        </div>

        {/* Selected video */}
        {selectedFile && previewUrl && (
          <div className="mb-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-black text-gray-900">
                معاينة الفيديو الجديد
              </h2>

              <p className="mt-1 text-sm text-gray-400">
                تأكد من الفيديو قبل حفظه.
              </p>
            </div>

            <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-black">
              <video
                src={previewUrl}
                controls
                playsInline
                className="block max-h-[400px] w-full object-contain"
              />
            </div>

            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
              <p className="break-all text-sm font-bold text-gray-700">
                📄 {selectedFile.name}
              </p>

              <p className="mt-2 text-xs text-gray-400">
                الحجم:{" "}
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={saveVideo}
                disabled={saving}
                className="flex-1 rounded-xl bg-black px-5 py-3.5 font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "جاري رفع وحفظ الفيديو..."
                  : "💾 حفظ الفيديو"}
              </button>

              <button
                onClick={cancelSelection}
                disabled={saving}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-5 py-3.5 font-bold text-gray-700 transition hover:border-black hover:text-black disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Info */}
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-gray-900">
            📌 شروط الفيديو
          </h2>

          <div className="mt-4 space-y-3 text-sm leading-7 text-gray-600">
            <p>• يجب أن يكون الملف فيديو.</p>
            <p>• مدة الفيديو يجب ألا تتجاوز 50 ثانية.</p>
            <p>• سيتم تشغيل الفيديو تلقائيًا بدون صوت للمستخدمين.</p>
            <p>• الفيديو سيظهر في أعلى صفحات الموقع.</p>
          </div>
        </div>

        {/* Status */}
        {message && (
          <div
            className={`fixed bottom-5 left-1/2 z-50 w-[calc(100%-32px)] max-w-lg -translate-x-1/2 rounded-2xl border px-5 py-4 text-center text-sm font-bold shadow-xl ${
              messageType === "success"
                ? "border-gray-200 bg-white text-gray-700"
                : "border-red-200 bg-red-50 text-red-600"
            }`}
          >
            {message}
          </div>
        )}
      </div>
    </main>
  );
}