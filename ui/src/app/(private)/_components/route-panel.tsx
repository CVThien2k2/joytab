"use client";

import { AlertTriangle, ArrowUpDown, Loader2, MapPin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCoords, formatDistance, formatDuration } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type {
  GeoPoint,
  PlaceResult,
  RouteResult,
  RouteSlot,
  TravelMode,
} from "@/types/geo";
import { PlaceSearch } from "./place-search";
import { TravelModePicker } from "./travel-mode-picker";

const SLOT_LABEL: Record<RouteSlot, string> = {
  start: "Điểm A",
  end: "Điểm B",
};

type RoutePanelProps = {
  start: GeoPoint | null;
  end: GeoPoint | null;
  activeSlot: RouteSlot;
  /** Đường chim bay; null khi chưa đủ 2 điểm. */
  distanceKm: number | null;
  travelMode: TravelMode;
  /** Đường bộ từ Valhalla; null khi chưa có hoặc lỗi. */
  route: RouteResult | null;
  isRouteLoading: boolean;
  routeErrorMessage: string | null;
  onActivateSlot: (slot: RouteSlot) => void;
  onSelectPlace: (place: PlaceResult) => void;
  onChangeTravelMode: (mode: TravelMode) => void;
  onSwap: () => void;
  onClear: () => void;
};

/**
 * Input: Một slot + dữ liệu điểm của nó.
 * Output: Ô hiển thị điểm, bấm vào để chọn làm slot đang active.
 *
 * Slot active được viền primary để người dùng biết click lên bản đồ sẽ gán vào đâu.
 */
function SlotRow({
  slot,
  point,
  isActive,
  onActivate,
}: {
  slot: RouteSlot;
  point: GeoPoint | null;
  isActive: boolean;
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onActivate}
      aria-pressed={isActive}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
        isActive
          ? "border-primary bg-primary/5"
          : "hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-primary-foreground",
          slot === "start" ? "bg-primary" : "bg-chart-3",
        )}
        aria-hidden="true"
      >
        {slot === "start" ? "A" : "B"}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium">{SLOT_LABEL[slot]}</span>
        {point ? (
          <>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {point.label}
            </span>
            <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
              {formatCoords(point)}
            </span>
          </>
        ) : (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Chưa chọn — click bản đồ hoặc tìm kiếm
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * Input: Trạng thái tuyến đường + các callback thao tác.
 * Output: Panel điều khiển: tìm kiếm, 2 slot A/B, khoảng cách, đổi chỗ, xoá.
 */
export function RoutePanel({
  start,
  end,
  activeSlot,
  distanceKm,
  travelMode,
  route,
  isRouteLoading,
  routeErrorMessage,
  onActivateSlot,
  onSelectPlace,
  onChangeTravelMode,
  onSwap,
  onClear,
}: RoutePanelProps) {
  const hasAnyPoint = Boolean(start || end);
  const hasBothPoints = Boolean(start && end);

  return (
    <Card className="gap-5 py-5">
      <CardHeader className="gap-1 px-5">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-4 text-primary" aria-hidden="true" />
          Chọn hai điểm
        </CardTitle>
        <CardDescription className="text-xs">
          Click lên bản đồ để đặt điểm, kéo pin để chỉnh lại.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-5">
        <PlaceSearch
          targetLabel={SLOT_LABEL[activeSlot]}
          onSelect={onSelectPlace}
        />

        <div className="flex flex-col gap-2">
          <SlotRow
            slot="start"
            point={start}
            isActive={activeSlot === "start"}
            onActivate={() => onActivateSlot("start")}
          />
          <SlotRow
            slot="end"
            point={end}
            isActive={activeSlot === "end"}
            onActivate={() => onActivateSlot("end")}
          />
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onSwap}
            disabled={!start || !end}
          >
            <ArrowUpDown aria-hidden="true" />
            Đổi chỗ
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onClear}
            disabled={!hasAnyPoint}
          >
            <Trash2 aria-hidden="true" />
            Xoá hết
          </Button>
        </div>

        <Separator />

        <TravelModePicker
          value={travelMode}
          onChange={onChangeTravelMode}
          disabled={!hasBothPoints}
        />

        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">Quãng đường đi</span>
            <span className="flex items-center gap-2 text-xl font-bold tabular-nums">
              {isRouteLoading ? (
                <Loader2
                  className="size-4 animate-spin text-muted-foreground"
                  aria-hidden="true"
                />
              ) : null}
              {route ? formatDistance(route.distanceKm) : "—"}
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">Thời gian</span>
            <span className="text-sm font-medium tabular-nums">
              {route ? formatDuration(route.durationMinutes) : "—"}
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">Đường chim bay</span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {distanceKm === null ? "—" : formatDistance(distanceKm)}
            </span>
          </div>
        </div>

        {!hasBothPoints ? (
          <p className="text-[11px] text-muted-foreground">
            Cần đủ cả hai điểm để tính quãng đường.
          </p>
        ) : null}

        {routeErrorMessage ? (
          <p className="flex items-start gap-1.5 text-[11px] text-destructive">
            <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden="true" />
            {routeErrorMessage}
          </p>
        ) : null}

        <p className="text-[11px] text-muted-foreground">
          Tìm đường bởi{" "}
          <a
            href="https://valhalla1.openstreetmap.de/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            Valhalla
          </a>{" "}
          (FOSSGIS) trên dữ liệu OpenStreetMap
        </p>
      </CardContent>
    </Card>
  );
}
