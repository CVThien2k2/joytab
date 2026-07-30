"use client";

import { useQuery } from "@tanstack/react-query";
import { MIN_SEARCH_LENGTH, searchPlaces } from "@/api/geocode";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { PlaceResult } from "@/types/geo";

/** Chờ người dùng ngừng gõ trước khi gọi Nominatim (policy của họ: ≤1 req/s). */
const DEBOUNCE_MS = 500;

/** Cùng một từ khoá trong 5 phút thì dùng lại kết quả cũ, không gọi lại. */
const STALE_TIME_MS = 5 * 60 * 1000;

type UsePlaceSearchResult = {
  results: PlaceResult[];
  isSearching: boolean;
  error: Error | null;
  /** Đã tìm xong và Nominatim trả về 0 kết quả. */
  isEmpty: boolean;
};

/**
 * Input: Từ khoá thô (giá trị input, đổi theo từng ký tự).
 * Output: Kết quả tìm địa điểm — tự debounce, tự bỏ qua từ khoá quá ngắn, tự huỷ
 *         request cũ khi từ khoá đổi (AbortSignal của TanStack Query).
 */
export function usePlaceSearch(term: string): UsePlaceSearchResult {
  const debouncedTerm = useDebouncedValue(term.trim(), DEBOUNCE_MS);
  const enabled = debouncedTerm.length >= MIN_SEARCH_LENGTH;

  const query = useQuery({
    queryKey: ["place-search", debouncedTerm],
    queryFn: ({ signal }) => searchPlaces(debouncedTerm, signal),
    enabled,
    staleTime: STALE_TIME_MS,
  });

  return {
    results: query.data ?? [],
    // Chỉ tính là đang tìm khi thật sự có request bay: term ngắn thì query bị disable.
    isSearching: enabled && query.isFetching,
    error: query.error,
    isEmpty: enabled && query.isSuccess && query.data.length === 0,
  };
}
