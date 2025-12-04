import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
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
    ],
    templateUrl: './experimental-log-table.html',
    styleUrl: './experimental-log-table.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExperimentalLogTable {
    readonly search = new FormControl('');
    readonly columns = [
        'timestamp',
        'level',
        'environment',
        'kind',
        'message',
    ];
    readonly matchedCount = computed(() => this.filteredEntries().length);
    private readonly parse = inject(FileParseService);
    // Expose entries signal from service
    readonly entries = computed(() => this.parse.allEntries());
    // computed filtered entries based on search
    readonly filteredEntries = computed(() => {
        const q = (this.search.value ?? '').toString().trim().toLowerCase();
        if (!q) return this.entries();
        return this.entries().filter((e) => {
            // lightweight full-text search across a few representative fields
            const parts: string[] = [];
            parts.push(e.kind);
            if (e.kind === 'pino') {
                const p = e.entry as unknown as Record<string, unknown>;
                parts.push(String(p['msg'] ?? ''));
                parts.push(String(p['hostname'] ?? ''));
                parts.push(String((p['meta'] as Record<string, unknown>)?.['environment'] ?? ''));
            } else if (e.kind === 'winston') {
                const w = e.entry as unknown as Record<string, unknown>;
                parts.push(String(w['message'] ?? ''));
                parts.push(String((w['meta'] as Record<string, unknown>)?.['requestId'] ?? ''));
            } else if (e.kind === 'loki' || e.kind === 'promtail') {
                const l = e.entry as unknown as Record<string, unknown>;
                parts.push(String((l as any)['line'] ?? ''));
            } else if (e.kind === 'docker') {
                const d = e.entry as unknown as Record<string, unknown>;
                parts.push(String(d['log'] ?? ''));
            } else if (e.kind === 'text') {
                parts.push(String((e.entry as any)['line'] ?? ''));
            } else {
                parts.push(String(JSON.stringify((e.entry as unknown) || {})));
            }

            return parts.join(' ').toLowerCase().includes(q);
        });
    });
    // small UX signal for counts
    readonly totalCount = computed(() => this.entries().length);

    formatTimestamp(entry: ParsedLogEntry): string {
        // best-effort formatting without importing date libs
        try {
            if (entry.kind === 'pino') {
                const t = (entry.entry as any)['time'];
                return typeof t === 'number' ? new Date(t).toISOString() : '';
            }
            if (entry.kind === 'winston') {
                const ts = (entry.entry as any)['timestamp'];
                return ts ? new Date(ts).toISOString() : '';
            }
            if (entry.kind === 'loki' || entry.kind === 'promtail') {
                const ts = (entry.entry as any)['ts'];
                return ts ? new Date(ts).toISOString() : '';
            }
            if (entry.kind === 'docker') {
                const ts = (entry.entry as any)['time'];
                return ts ? new Date(ts).toISOString() : '';
            }
            return '';
        } catch {
            return '';
        }
    }

    formatLevel(entry: ParsedLogEntry): string {
        if (entry.kind === 'pino') {
            const lvl = (entry.entry as any)['level'];
            return lvl !== undefined ? String(lvl) : '';
        }
        if (entry.kind === 'winston') {
            return String((entry.entry as any)['level'] ?? '');
        }
        if (entry.kind === 'promtail') {
            return String((entry.entry as any)['level'] ?? '');
        }
        if (entry.kind === 'text') {
            return String((entry.entry as any)['line'] ?? '').split(/\s+/, 1)[0];
        }
        return '';
    }

    formatEnvironment(entry: ParsedLogEntry): string {
        if (entry.kind === 'loki') {
            return String((entry.entry as any)['labels']?.['environment'] ?? '');
        }
        if (entry.kind === 'pino') {
            return String((entry.entry as any)['meta']?.['environment'] ?? '');
        }
        if (entry.kind === 'winston') {
            return String((entry.entry as any)['meta']?.['environment'] ?? '');
        }
        if (entry.kind === 'docker') {
            const log = String((entry.entry as any)['log'] ?? '');
            const m = /env=(dev|staging|prod)\b/.exec(log);
            return m ? m[1] : '';
        }
        if (entry.kind === 'text') {
            const line = String((entry.entry as any)['line'] ?? '');
            const m = /env=(dev|staging|prod)\b/.exec(line);
            return m ? m[1] : '';
        }
        return '';
    }

    getMessagePreview(entry: ParsedLogEntry): string {
        if (entry.kind === 'pino') return String((entry.entry as any)['msg'] ?? '');
        if (entry.kind === 'winston') return String((entry.entry as any)['message'] ?? '');
        if (entry.kind === 'loki' || entry.kind === 'promtail') return String((entry.entry as any)['line'] ?? '');
        if (entry.kind === 'docker') return String((entry.entry as any)['log'] ?? '');
        if (entry.kind === 'text') return String((entry.entry as any)['line'] ?? '');
        try {
            return JSON.stringify(entry.entry);
        } catch {
            return '';
        }
    }
}
