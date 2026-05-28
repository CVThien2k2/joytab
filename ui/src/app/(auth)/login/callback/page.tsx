import { Suspense } from "react";
import { GoogleAuthCallbackClient } from "./callback-client";

/**
 * Input: Không nhận tham số.
 * Output: Render callback client dưới Suspense để hỗ trợ useSearchParams trong App Router.
 */
export default function GoogleAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <GoogleAuthCallbackClient />
    </Suspense>
  );
}
