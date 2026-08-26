/**
 * 栅格布局工具：4 列固定网格，支持拖动到任意位置、自动避让压实。
 * 单位：x = 列偏移（0..cols-1），y = 行偏移（>=0），cols/rows = 占用宽高（格）。
 */
export interface GridItem {
  id: number | string
  x: number
  y: number
  cols: number
  rows: number
}

export const GRID_COLS = 4

/** 两个矩形是否相交 */
function intersects(a: GridItem, b: GridItem): boolean {
  return !(a.x + a.cols <= b.x || b.x + b.cols <= a.x || a.y + a.rows <= b.y || b.y + b.rows <= a.y)
}

/** 压实算法：把所有 item 尽量往上推到不能再推为止，保持相对顺序。 */
export function compact(items: GridItem[]): GridItem[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  const result: GridItem[] = []
  for (const it of sorted) {
    let y = it.y
    let candidate: GridItem = { ...it, y }
    // 逐行向上尝试，直到发生碰撞或到顶
    while (y > 0) {
      const test: GridItem = { ...it, y: y - 1 }
      if (result.some((r) => intersects(test, r))) break
      candidate = test
      y = y - 1
    }
    result.push(candidate)
  }
  return result
}

/** 把某个 item 移动到 (x, y)，其它 item 自动避让压实。返回新的布局。 */
export function moveAndCompact(items: GridItem[], id: GridItem['id'], x: number, y: number): GridItem[] {
  const clampedX = Math.max(0, Math.min(x, GRID_COLS - 1))
  const target = items.find((i) => i.id === id)
  if (!target) return items
  const clampedX2 = Math.max(0, Math.min(clampedX, GRID_COLS - target.cols))
  // 先移除目标，把其它压实
  const others = compact(items.filter((i) => i.id !== id))
  // 放置目标到指定位置；如果与其它碰撞，则尝试下移到首个不碰撞位置
  let placed: GridItem = { ...target, x: clampedX2, y: Math.max(0, y) }
  while (others.some((o) => intersects(placed, o))) {
    placed = { ...placed, y: placed.y + 1 }
  }
  return compact([...others, placed])
}

/** 改变某 item 尺寸，自动避让压实。 */
export function resizeAndCompact(items: GridItem[], id: GridItem['id'], cols: number, rows: number): GridItem[] {
  const target = items.find((i) => i.id === id)
  if (!target) return items
  const newCols = Math.max(1, Math.min(cols, GRID_COLS))
  const clampedX = Math.min(target.x, GRID_COLS - newCols)
  return moveAndCompact(
    items.map((i) => (i.id === id ? { ...i, cols: newCols, rows: Math.max(1, rows), x: clampedX } : i)),
    id,
    clampedX,
    target.y,
  )
}

/** 计算布局所需总行数（高度） */
export function totalRows(items: GridItem[]): number {
  if (!items.length) return 0
  return Math.max(...items.map((i) => i.y + i.rows))
}

/** 从 Widget 数组构造 GridItem（兼容缺省 x/y，按顺序自然排列） */
export function buildLayout<T extends { id: number; x?: number; y?: number; cols: number; rows: number; sortOrder: number }>(
  widgets: T[],
): GridItem[] {
  // 有 x/y 的用持久化坐标；缺省的按 sortOrder 自然流排列
  const withPos = widgets.map((w) => ({
    id: w.id,
    x: w.x ?? 0,
    y: w.y ?? 0,
    cols: Math.min(w.cols || 1, GRID_COLS),
    rows: w.rows || 1,
  }))
  return compact(withPos)
}
