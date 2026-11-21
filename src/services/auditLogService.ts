import { api } from './http';
import type { AuditLog } from '../types';

export interface AuditLogPage {
    logs: AuditLog[];
    total: number;
    page: number;
    total_pages: number;
    actions: string[];
    modules: string[];
    statuses: string[];
}

/** Audit Logs filters + sort: applied by the database (the log is paged on the server). */
export interface AuditLogQuery {
    action: string;
    module: string;
    status: string;
    search: string;
    from: string;
    to: string;
    sort: string;
    dir: 'asc' | 'desc' | '';
}

export const auditLogService = {
    page: async (page: number, q: AuditLogQuery): Promise<AuditLogPage> => {
        const res = await api.get<Partial<AuditLogPage>>('page_audit_logs', {
            page, filter_action: q.action, module: q.module, status: q.status, search: q.search, from: q.from, to: q.to, sort: q.sort, dir: q.dir,
        });
        return {
            logs: Array.isArray(res.logs) ? res.logs : [],
            total: Number(res.total) || 0,
            page: Number(res.page) || page,
            total_pages: Math.max(1, Number(res.total_pages) || 1),
            actions: Array.isArray(res.actions) ? res.actions : [],
            modules: Array.isArray(res.modules) ? res.modules : [],
            statuses: Array.isArray(res.statuses) ? res.statuses : [],
        };
    },
};
