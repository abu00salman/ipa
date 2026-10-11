"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="container-app flex min-h-[70dvh] flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-bold">حدث خطأ غير متوقع · Something went wrong</h1>
      <p className="muted mt-2">أعد المحاولة. Try again.</p>
      <button type="button" className="btn btn-primary mt-8" onClick={reset}>إعادة المحاولة · Retry</button>
    </main>
  );
}
