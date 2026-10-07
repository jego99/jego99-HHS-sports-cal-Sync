import { useCallback, useEffect, useMemo, useState } from 'react';

export type GridCell = {
  row: number;
  column: number;
};

export type PlacementMap = Record<string, string>;

const STORAGE_KEY = 'hermiston-activities:card-placements';

function cellKey(cell: GridCell) {
  return `${cell.row}:${cell.column}`;
}

function readStoredPlacements(): PlacementMap {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored == null) return {};
    const parsed: unknown = JSON.parse(stored);
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.entries(parsed).reduce<PlacementMap>((result, [activityId, value]) => {
      if (typeof value === 'string') result[activityId] = value;
      return result;
    }, {});
  } catch {
    return {};
  }
}

export function useCardPlacement() {
  const [placements, setPlacements] = useState<PlacementMap>(() => readStoredPlacements());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(placements));
  }, [placements]);

  const occupantByCell = useMemo(() => {
    return Object.entries(placements).reduce<Record<string, string>>((result, [activityId, key]) => {
      result[key] = activityId;
      return result;
    }, {});
  }, [placements]);

  const selectCard = useCallback((activityId: string) => {
    setSelectedId((current) => current === activityId ? null : activityId);
  }, []);

  const placeSelected = useCallback((cell: GridCell) => {
    if (selectedId == null) return false;
    const targetKey = cellKey(cell);
    const sourceKey = placements[selectedId];
    const targetId = occupantByCell[targetKey];

    setPlacements((current) => {
      const next = { ...current };
      if (targetId != null && targetId !== selectedId && sourceKey != null) {
        next[targetId] = sourceKey;
      }
      next[selectedId] = targetKey;
      return next;
    });
    setSelectedId(null);
    return true;
  }, [occupantByCell, placements, selectedId]);

  const getCellForActivity = useCallback((activityId: string): GridCell | null => {
    const key = placements[activityId];
    if (key == null) return null;
    const [row, column] = key.split(':').map(Number);
    return Number.isFinite(row) && Number.isFinite(column) ? { row, column } : null;
  }, [placements]);

  return { placements, selectedId, occupantByCell, selectCard, placeSelected, getCellForActivity };
}

export function getGridCellKey(cell: GridCell) {
  return cellKey(cell);
}
