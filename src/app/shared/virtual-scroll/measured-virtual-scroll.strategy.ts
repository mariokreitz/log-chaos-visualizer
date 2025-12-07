import { ListRange } from '@angular/cdk/collections';
import { CdkVirtualScrollViewport, VirtualScrollStrategy } from '@angular/cdk/scrolling';
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * A simple measured virtual scroll strategy that tracks per-item heights by measuring
 * rendered DOM nodes and computes rendered range based on cumulative heights.
 *
 * This is a pragmatic implementation for variable-height lists.
 */
@Injectable()
export class MeasuredVirtualScrollStrategy implements VirtualScrollStrategy {
  // Observable required by VirtualScrollStrategy
  public readonly scrolledIndexChange = new Subject<number>();
  private viewport: CdkVirtualScrollViewport | null = null;
  private itemHeights: number[] = [];
  private readonly defaultItemHeight = 48;
  private readonly minBufferPx = 100;
  private readonly maxBufferPx = 300;

  // Debounce and rAF handles to avoid layout thrash during fast scroll updates
  private measureTimeoutId: number | null = null;
  private measureRafId: number | null = null;

  attach(viewport: CdkVirtualScrollViewport): void {
    this.viewport = viewport;
  }

  detach(): void {
    this.viewport = null;
    if (this.measureTimeoutId) {
      clearTimeout(this.measureTimeoutId);
      this.measureTimeoutId = null;
    }
    if (this.measureRafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.measureRafId);
      this.measureRafId = null;
    }
  }

  onContentScrolled(): void {
    // Measurements are expensive; only update rendered range computation here.
    this.updateRenderedRange();
  }

  onDataLengthChanged(): void {
    // reset heights when data length changes
    if (!this.viewport) return;
    const len = this.viewport.getDataLength() || 0;
    this.itemHeights = new Array(len).fill(this.defaultItemHeight);
    // schedule a measurement to refine heights rather than doing it synchronously
    this.scheduleMeasurement();
  }

  onContentRendered(): void {
    // Schedule a debounced measurement that runs inside requestAnimationFrame.
    this.scheduleMeasurement();
  }

  onRenderedOffsetChanged(): void {
    // called when the rendered offset changes; update range
    this.updateRenderedRange();
  }

  scrollToIndex(index: number, behavior: ScrollBehavior): void {
    if (!this.viewport) return;
    // compute offset to index using cumulative heights
    const offset = this.cumulativeHeightForIndex(index);
    this.viewport.scrollToOffset(offset, behavior);
  }

  // Schedule a measurement with a small debounce (50ms) and perform inside rAF
  private scheduleMeasurement(): void {
    try {
      if (this.measureTimeoutId) {
        clearTimeout(this.measureTimeoutId);
      }
      // Debounce a bit to avoid repeated measurements during fast scroll
      this.measureTimeoutId = window.setTimeout(() => {
        this.measureTimeoutId = null;
        // Use requestAnimationFrame for actual DOM reads to align with paint
        if (typeof requestAnimationFrame !== 'undefined') {
          if (this.measureRafId !== null && typeof cancelAnimationFrame !== 'undefined') {
            cancelAnimationFrame(this.measureRafId);
          }
          this.measureRafId = requestAnimationFrame(() => {
            this.measureRafId = null;
            this.performMeasurement();
          });
        } else {
          this.performMeasurement();
        }
      }, 50);
    } catch {
      // if timers aren't available, fall back to immediate measurement
      this.performMeasurement();
    }
  }

  // Actual DOM measurement performed inside rAF
  private performMeasurement(): void {
    try {
      if (!this.viewport) return;
      const el = this.viewport.elementRef.nativeElement as HTMLElement;
      const renderedEls = Array.from(el.querySelectorAll('[data-index]')) as HTMLElement[];
      for (const node of renderedEls) {
        const idxAttr = node.getAttribute('data-index');
        if (!idxAttr) continue;
        const idx = Number(idxAttr);
        if (Number.isNaN(idx)) continue;
        // read bounding rect once, round to integer pixel height
        this.itemHeights[idx] = Math.max(1, Math.round(node.getBoundingClientRect().height));
      }
      // After measurements, update the rendered range computation
      this.updateRenderedRange();
    } catch {
      // ignore - measurement could fail in some environments
    }
  }

  // Helpers
  private cumulativeHeightForIndex(index: number): number {
    let sum = 0;
    const limit = Math.min(index, this.itemHeights.length);
    for (let i = 0; i < limit; i++) {
      sum += this.itemHeights[i] ?? this.defaultItemHeight;
    }
    return sum;
  }

  private totalContentSize(): number {
    return this.itemHeights.reduce((s, h) => s + (h ?? this.defaultItemHeight), 0);
  }

  private updateRenderedRange(): void {
    if (!this.viewport) return;
    const viewSize = this.viewport.getViewportSize();
    const scrollOffset = this.viewport.measureScrollOffset();

    // find start index by walking cumulative heights
    let start = 0;
    let acc = 0;
    while (
      start < this.itemHeights.length &&
      acc + (this.itemHeights[start] ?? this.defaultItemHeight) < scrollOffset
    ) {
      acc += this.itemHeights[start] ?? this.defaultItemHeight;
      start++;
    }

    // include buffer pixels before/after
    const bufferPx = Math.max(this.minBufferPx, Math.min(this.maxBufferPx, Math.floor(viewSize / 2)));
    let endAcc = acc;
    let end = start;
    while (end < this.itemHeights.length && endAcc - acc < viewSize + bufferPx) {
      endAcc += this.itemHeights[end] ?? this.defaultItemHeight;
      end++;
    }

    const range: ListRange = { start, end };
    try {
      // Use internal methods if available; fallback to public checkViewportSize
      const vpInternal = this.viewport as unknown as {
        setRenderedRange?: (r: ListRange) => void;
        setTotalContentSize?: (size: number) => void;
      };
      if (vpInternal.setRenderedRange && vpInternal.setTotalContentSize) {
        vpInternal.setRenderedRange(range);
        vpInternal.setTotalContentSize(this.totalContentSize());
      } else {
        this.viewport.checkViewportSize();
      }
    } catch {
      try {
        this.viewport.checkViewportSize();
      } catch {
        // ignore
      }
    }

    // Emit scrolled index change
    try {
      this.scrolledIndexChange.next(start);
    } catch {
      // ignore
    }
  }
}
