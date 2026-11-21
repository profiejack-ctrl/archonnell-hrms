import { api } from './http';
import type { Department, OnboardingCharts, OnboardingRow, Position } from '../types';

export interface OnboardingPage {
    rows: OnboardingRow[];
    contract_statuses: string[];
    charts: OnboardingCharts;
    departments: Department[];
    positions: Position[];
}

export interface OnboardingUpdate {
    onboarding_id: number;
    full_name: string;
    contract_type: string;
    department: string;
    position: string;
    date_hired: string;
    status: string;
    progress: string | number;
}

export const onboardingService = {
    page: async (): Promise<OnboardingPage> => {
        const res = await api.get<Partial<OnboardingPage>>('page_onboarding');
        const charts: Partial<OnboardingCharts> = res.charts ?? {};
        return {
            rows: Array.isArray(res.rows) ? res.rows : [],
            contract_statuses: Array.isArray(res.contract_statuses) ? res.contract_statuses : [],
            departments: Array.isArray(res.departments) ? res.departments : [],
            positions: Array.isArray(res.positions) ? res.positions : [],
            charts: {
                department_hires: Array.isArray(charts.department_hires) ? charts.department_hires : [],
                hires_over_time: Array.isArray(charts.hires_over_time) ? charts.hires_over_time : [],
                total_new_hires: Number(charts.total_new_hires) || 0,
            },
        };
    },
    charts: () => api.get<{ data: OnboardingCharts }>('onboarding_charts'),
    update: (input: OnboardingUpdate) => api.post<{ message: string }>('update_onboarding', { ...input }),
};
