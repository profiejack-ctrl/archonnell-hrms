import { api } from './http';
import type { Department, JobPosting, JobPostingApplicant, Position, VacancyRequest } from '../types';
import type { JobPostingPublic } from '../types/portal';

export interface JobPostingsPage {
    postings: JobPosting[];
    departments: Department[];
    positions: Position[];
    employment_types: string[];
    work_setups: string[];
    default_location: string;
    /** Approved vacancy requests that still need their job posting. */
    approved_requests: VacancyRequest[];
}

/** The Create / Edit form (names match config/job_postings.php jp_input). */
export interface JobPostingForm {
    title: string;
    department: string;
    position: string;
    employment_type: string;
    work_setup: string;
    location: string;
    vacancies: string;
    description: string;
    responsibilities: string;
    qualifications: string;
    experience_required: string;
    required_skills: string;
    preferred_skills: string;
    salary_min: string;
    salary_max: string;
    benefits: string;
    opening_date: string;
    deadline: string;
}

/** draft: save as Draft; publish: save and publish; save: edit a Published posting. */
export type SaveIntent = 'draft' | 'publish' | 'save';

type Saved = { posting: JobPosting; message: string };

/** Recruitment Management > Job Posting. */
export const jobPostingService = {
    page: async (): Promise<JobPostingsPage> => {
        const res = await api.get<Partial<JobPostingsPage>>('page_job_postings');
        // Keep optional or omitted lookup collections safe for pages/forms that map them.
        return {
            postings: (Array.isArray(res.postings) ? res.postings : []).map(posting => ({
                ...posting,
                status: ['Draft', 'Published', 'Closed', 'Archived'].includes(String(posting.status)) ? posting.status : 'Draft',
                applicant_count: Number(posting.applicant_count) || 0,
            })),
            departments: Array.isArray(res.departments) ? res.departments : [],
            positions: Array.isArray(res.positions) ? res.positions : [],
            employment_types: Array.isArray(res.employment_types) ? res.employment_types : [],
            work_setups: Array.isArray(res.work_setups) ? res.work_setups : [],
            default_location: res.default_location ?? '',
            approved_requests: Array.isArray(res.approved_requests) ? res.approved_requests : [],
        };
    },
    detail: (id: number) => api.get<{ posting: JobPosting; applicants: JobPostingApplicant[]; vacancy_request: VacancyRequest | null }>('job_posting_detail', { id }),
    /** The form rendered exactly as the public job page will show it. */
    preview: (form: JobPostingForm, postingNo = '') =>
        api.post<{ preview: JobPostingPublic }>('preview_job_posting', { ...form, posting_no: postingNo }),
    /** A new posting is created from an approved vacancy request (vacancyRequestId). */
    save: (id: number, form: JobPostingForm, intent: SaveIntent, vacancyRequestId: number | null = null) =>
        api.post<Saved>('save_job_posting', { ...form, id, intent, vacancy_request_id: vacancyRequestId ?? '' }),
    publish: (id: number) => api.post<Saved>('publish_job_posting', { id }),
    close: (id: number) => api.post<Saved>('close_job_posting', { id }),
    archive: (id: number) => api.post<Saved>('archive_job_posting', { id }),
    restore: (id: number) => api.post<Saved>('restore_job_posting', { id }),
    remove: (id: number) => api.post<{ message: string }>('delete_job_posting', { id }),
};
