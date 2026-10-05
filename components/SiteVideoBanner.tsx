"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SiteVideoBanner() {
  const pathname = usePathname();

  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadVideo() {
      const supabase = createClient();

      const { data } = await supabase
        .from("site_video")
        .select("video_url")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setVideoUrl(data?.video_url ?? null);
    }

    loadVideo();
  }, []);

  // لا يظهر الفيديو في صفحات الإدارة
  if (pathname.startsWith("/admin")) {
    return null;
  }

  if (!videoUrl) {
    return null;
  }

  return (
    <div className="w-full border-b border-gray-200 bg-white px-3 py-3">
      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-black shadow-sm">
        <video
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="block h-auto max-h-[180px] w-full object-contain sm:max-h-[220px]"
        />
      </div>
    </div>
  );
}