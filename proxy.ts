const maintenancePage = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>AL TITIZE — صيانة مؤقتة</title>
    <style>
      * { box-sizing: border-box; }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 24px;
        background: #0a0a0d;
        color: #f5f3f1;
        font-family: Arial, Helvetica, sans-serif;
        text-align: center;
      }
      main { max-width: 620px; }
      .icon { margin-bottom: 22px; font-size: 54px; }
      h1 { margin: 0 0 18px; font-size: clamp(28px, 6vw, 42px); }
      p { margin: 10px 0; color: #c9c7cf; font-size: clamp(17px, 3vw, 20px); line-height: 1.9; }
      p:last-child { color: #a1a0aa; font-size: 16px; }
    </style>
  </head>
  <body>
    <main role="status" aria-live="polite">
      <div class="icon" aria-hidden="true">🛠️</div>
      <h1>نعمل على تحديث النظام</h1>
      <p>الموقع متوقف مؤقتًا لإجراء تحديثات وتطويرات.</p>
      <p>نعتذر عن الإزعاج، وشكرًا لصبركم.</p>
    </main>
  </body>
</html>`;

export function proxy() {
  return new Response(maintenancePage, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
