/** Side-by-side layout for overlapping calendar items (e.g. several instructors at once). */
export type Span = { id: string; startMin: number; endMin: number };

export function layoutOverlaps(items: Span[]): Map<string, { col: number; cols: number }> {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out = new Map<string, { col: number; cols: number }>();
  let cluster: Span[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const colEnds: number[] = [];
    const assigned = new Map<string, number>();
    for (const it of cluster) {
      let c = colEnds.findIndex((end) => end <= it.startMin);
      if (c === -1) {
        c = colEnds.length;
        colEnds.push(it.endMin);
      } else colEnds[c] = it.endMin;
      assigned.set(it.id, c);
    }
    for (const it of cluster) out.set(it.id, { col: assigned.get(it.id)!, cols: colEnds.length });
    cluster = [];
    clusterEnd = -1;
  };

  for (const it of sorted) {
    if (cluster.length && it.startMin >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  if (cluster.length) flush();
  return out;
}

/** Snap minutes to the grid step and keep the lesson inside the visible range. */
export function snapMinutes(min: number, durationMin: number, gridStart = 8 * 60, gridEnd = 20 * 60, step = 15) {
  const snapped = Math.round(min / step) * step;
  return Math.min(Math.max(snapped, gridStart), gridEnd - durationMin);
}
