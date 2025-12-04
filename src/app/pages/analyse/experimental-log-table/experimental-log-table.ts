import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import type { AfterViewInit as AfterViewInitType } from '@angular/core';
import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { FileParseService } from '../../../core/services/file-parse.service';
import type { ParsedLogEntry } from '../../../core/types/file-parse.types';

@Component({
    selector: 'app-experimental-log-table',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatButtonModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        ScrollingModule,
    ],
    templateUrl: './experimental-log-table.html',
    styleUrl: './experimental-log-table.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExperimentalLogTable implements AfterViewInitType, OnDestroy {
    readonly search = new FormControl('');
    readonly displayedColumns = [
        'timestamp',
        'level',
        'environment',
        'kind',
        'message',
    ];
    readonly dataSource = new MatTableDataSource<ParsedLogEntry>([]);
    readonly VIRTUAL_THRESHOLD = 5000;
    private searchSub?: Subscription;
    @ViewChild(MatPaginator) private paginator?: MatPaginator;
    @ViewChild(MatSort) private sort?: MatSort;
    private readonly parse = inject(FileParseService);
    private readonly sanitizer = inject(DomSanitizer);

    get useVirtual(): boolean {
        return this.dataSource.filteredData.length > this.VIRTUAL_THRESHOLD;
    }

    get virtualRows(): ParsedLogEntry[] {
        return this.dataSource.filteredData;
    }

    constructor() {
        this.dataSource.filterPredicate = (entry: ParsedLogEntry, filter: string) => {
            const q = filter.trim().toLowerCase();
            if (!q) return true;
            const parts: string[] = [ entry.kind ];
            if (entry.kind === 'pino') {
                const p = entry.entry as any;
                parts.push(String(p.msg ?? ''));
                parts.push(String(p.hostname ?? ''));
                parts.push(String((p.meta as Record<string, unknown>)?.['environment'] ?? ''));
            } else if (entry.kind === 'winston') {
                const w = entry.entry as any;
                parts.push(String(w.message ?? ''));
                parts.push(String((w.meta as Record<string, unknown>)?.['requestId'] ?? ''));
            } else if (entry.kind === 'loki') {
                parts.push(String((entry.entry as any).line ?? ''));
            } else if (entry.kind === 'promtail') {
                parts.push(String((entry.entry as any).message ?? ''));
            } else if (entry.kind === 'docker') {
                parts.push(String((entry.entry as any).log ?? ''));
            } else if (entry.kind === 'text') {
                parts.push(String((entry.entry as any).line ?? ''));
            } else {
                try {
                    parts.push(JSON.stringify(entry.entry));
                } catch {
                }
            }
            return parts.join(' ').toLowerCase().includes(q);
        };

        effect(() => {
            const entries = this.parse.allEntries();
            this.dataSource.data = entries.slice();
        });

        this.searchSub = this.search.valueChanges
          .pipe(
            map((v) => (v ?? '').toString()),
            debounceTime(150),
            distinctUntilChanged(),
          )
          .subscribe((v) => {
              this.dataSource.filter = v.trim().toLowerCase();
              this.paginator?.firstPage?.();
          });
    }

    ngAfterViewInit(): void {
        if (this.paginator) this.dataSource.paginator = this.paginator;
        if (this.sort) this.dataSource.sort = this.sort;
    }

    ngOnDestroy(): void {
        this.searchSub?.unsubscribe();
    }

    formatTimestamp(entry: ParsedLogEntry): string {
        try {
            if (entry.kind === 'pino') {
                const t = (entry.entry as any).time;
                return typeof t === 'number' ? new Date(t).toISOString() : '';
            }
            if (entry.kind === 'winston') {
                return (entry.entry as any).timestamp ?? '';
            }
            if (entry.kind === 'loki' || entry.kind === 'promtail') {
                return (entry.entry as any).ts ?? '';
            }
            if (entry.kind === 'docker') {
                return (entry.entry as any).time ?? '';
            }
            return '';
        } catch {
            return '';
        }
    }

    formatLevel(entry: ParsedLogEntry): string {
        if (entry.kind === 'pino') return String((entry.entry as any).level ?? '');
        if (entry.kind === 'winston') return String((entry.entry as any).level ?? '');
        if (entry.kind === 'promtail') return String((entry.entry as any).level ?? '');
        if (entry.kind === 'text') return String((entry.entry as any).line ?? '').split(/\s+/, 1)[0];
        return '';
    }

    formatEnvironment(entry: ParsedLogEntry): string {
        if (entry.kind === 'loki') return String((entry.entry as any).labels?.environment ?? '');
        if (entry.kind === 'pino')
            return String(((entry.entry as any).meta as Record<string, unknown>)?.['environment'] ?? '');
        if (entry.kind === 'winston')
            return String(((entry.entry as any).meta as Record<string, unknown>)?.['environment'] ?? '');
        if (entry.kind === 'docker') {
            const log = String((entry.entry as any).log ?? '');
            const m = /env=(dev|staging|prod)\b/.exec(log);
            return m ? m[1] : '';
        }
        if (entry.kind === 'text') {
            const line = String((entry.entry as any).line ?? '');
            const m = /env=(dev|staging|prod)\b/.exec(line);
            return m ? m[1] : '';
        }
        return '';
    }

    getMessagePreview(entry: ParsedLogEntry): string {
        if (entry.kind === 'pino') return String((entry.entry as any).msg ?? '');
        if (entry.kind === 'winston') return String((entry.entry as any).message ?? '');
        if (entry.kind === 'loki') return String((entry.entry as any).line ?? '');
        if (entry.kind === 'promtail') return String((entry.entry as any).message ?? '');
        if (entry.kind === 'docker') return String((entry.entry as any).log ?? '');
        if (entry.kind === 'text') return String((entry.entry as any).line ?? '');
        try {
            return JSON.stringify(entry.entry);
        } catch {
            return '';
        }
    }

    getHighlightedMessage(entry: ParsedLogEntry): SafeHtml {
        const raw = this.getMessagePreview(entry);
        const q = (this.dataSource.filter ?? '').toString().trim();
        if (!q) return this.sanitizer.bypassSecurityTrustHtml(escapeHtml(raw));
        const esc = escapeForRegex(q);
        const re = new RegExp(esc, 'gi');
        const highlighted = escapeHtml(raw).replace(re, (m) => `<mark>${m}</mark>`);
        return this.sanitizer.bypassSecurityTrustHtml(highlighted);
    }

    trackByEntry(_: number, item: ParsedLogEntry): string {
        const ts = this.getTimestampMs(item) ?? Date.now();
        return `${item.kind}:${ts}:${this.getMessagePreview(item).slice(0, 40)}`;
    }

    private getTimestampMs(entry: ParsedLogEntry): number | null {
        try {
            if (entry.kind === 'pino') return (entry.entry as any).time ?? null;
            if (entry.kind === 'winston') return (entry.entry as any).timestamp ? Date.parse((entry.entry as any).timestamp) : null;
            if (entry.kind === 'loki' || entry.kind === 'promtail') return (entry.entry as any).ts ? Date.parse((entry.entry as any).ts) : null;
            if (entry.kind === 'docker') return (entry.entry as any).time ? Date.parse((entry.entry as any).time) : null;
        } catch {
            return null;
        }
        return null;
    }
}

function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
}

function escapeForRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
