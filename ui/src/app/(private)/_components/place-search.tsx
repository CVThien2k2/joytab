"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { MIN_SEARCH_LENGTH } from "@/api/geocode";
import { Input } from "@/components/ui/input";
import { usePlaceSearch } from "@/hooks/use-place-search";
import type { PlaceResult } from "@/types/geo";

type PlaceSearchProps = {
  /** Nhãn slot đang nhận kết quả, hiện trong placeholder để người dùng biết chọn vào đâu. */
  targetLabel: string;
  onSelect: (place: PlaceResult) => void;
};

/**
 * Input: Nhãn slot đích + callback khi chọn một kết quả.
 * Output: Ô tìm địa điểm với dropdown kết quả từ Nominatim.
 *
 * Không tự gọi API theo từng ký tự — usePlaceSearch lo debounce và ngưỡng ký tự.
 * Chọn một kết quả thì xoá từ khoá để dropdown đóng lại.
 */
export function PlaceSearch({ targetLabel, onSelect }: PlaceSearchProps) {
  const [term, setTerm] = useState("");
  const { results, isSearching, error, isEmpty } = usePlaceSearch(term);

  useEffect(() => {
    if (error) {
      toast.error("Không tìm được địa điểm", {
        description: "Nominatim đang không phản hồi, thử lại sau ít giây.",
      });
    }
  }, [error]);

  /**
   * Input: Kết quả người dùng chọn.
   * Output: Đẩy lên parent và dọn ô tìm kiếm.
   */
  const handleSelect = (place: PlaceResult) => {
    onSelect(place);
    setTerm("");
  };

  const showDropdown = term.trim().length >= MIN_SEARCH_LENGTH;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={`Tìm địa điểm cho ${targetLabel}…`}
          aria-label={`Tìm địa điểm cho ${targetLabel}`}
          className="pr-9 pl-9"
        />
        {isSearching ? (
          <Loader2
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        ) : null}
      </div>

      {showDropdown ? (
        <div className="max-h-64 overflow-y-auto rounded-md border bg-popover">
          {results.length > 0 ? (
            <ul className="divide-y">
              {results.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(place)}
                    className="w-full px-3 py-2 text-left text-xs leading-snug transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
                  >
                    {place.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">
              {isSearching
                ? "Đang tìm…"
                : isEmpty
                  ? "Không tìm thấy địa điểm nào."
                  : error
                    ? "Tìm kiếm lỗi, thử lại sau."
                    : "Đang chờ…"}
            </p>
          )}
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        Tìm kiếm bởi{" "}
        <a
          href="https://nominatim.openstreetmap.org/"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          Nominatim
        </a>{" "}
        / OpenStreetMap
      </p>
    </div>
  );
}
