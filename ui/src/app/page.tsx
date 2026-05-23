"use client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/**
 * Input: Không nhận input trực tiếp, dùng môi trường browser để lấy origin hiện tại.
 * Output: Chuyển hướng người dùng sang endpoint OAuth Google của BE kèm redirectTo để callback quay lại FE.
 */
function handleGoogleLogin(): void {
  const authUrl = new URL("/auth/google", API_BASE_URL);
  authUrl.searchParams.set("redirectTo", window.location.origin);
  window.location.href = authUrl.toString();
}

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Joytab Login</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Đăng nhập bằng Google để tiếp tục.
        </p>
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
        >
          Đăng nhập với Google
        </button>
      </div>
    </main>
  );
}
