import { api } from './http';
import type { Department, DirectoryUser, Employee, Position, Role } from '../types';

export interface DirectoryCards {
    total_users: number;
    active_accounts: number;
    deactivated_accounts: number;
    active_departments: number;
}

export interface UserDirectoryPage {
    cards: DirectoryCards;
    users: DirectoryUser[];
    departments: Department[];
    positions: Position[];
    roles: Role[];
}

export interface RegisterUserPage {
    employees: Employee[];
    departments: Department[];
    positions: Position[];
    roles: Role[];
}

export interface UserInput {
    first_name: string;
    last_name: string;
    middle_name: string;
    email: string;
    mobile_number: string;
    department: string;
    position: string;
    role_id: string | number;
}

export interface RoleMatrix {
    roles: { id: number; role_name: string; description: string | null; user_count: number }[];
    permissions: { id: number; permission_name: string; description: string | null }[];
    grants: [number, number][];
}

/** User Management, Roles and Permissions (Administration). */
export const userService = {
    directoryPage: async (): Promise<UserDirectoryPage> => {
        const res = await api.get<Partial<UserDirectoryPage>>('page_user_directory');
        const cards: Partial<DirectoryCards> = res.cards ?? {};
        return {
            cards: {
                total_users: Number(cards.total_users) || 0,
                active_accounts: Number(cards.active_accounts) || 0,
                deactivated_accounts: Number(cards.deactivated_accounts) || 0,
                active_departments: Number(cards.active_departments) || 0,
            },
            users: Array.isArray(res.users) ? res.users : [],
            departments: Array.isArray(res.departments) ? res.departments : [],
            positions: Array.isArray(res.positions) ? res.positions : [],
            roles: Array.isArray(res.roles) ? res.roles : [],
        };
    },
    directoryCards: () => api.get<{ cards: DirectoryCards }>('user_directory'),
    view: (id: number) => api.get<{ user: DirectoryUser & { full_name: string | null; employment_status: string | null } }>('view_user', { id }),
    registerPage: async (): Promise<RegisterUserPage> => {
        const res = await api.get<Partial<RegisterUserPage>>('page_register_user');
        return {
            employees: Array.isArray(res.employees) ? res.employees : [],
            departments: Array.isArray(res.departments) ? res.departments : [],
            positions: Array.isArray(res.positions) ? res.positions : [],
            roles: Array.isArray(res.roles) ? res.roles : [],
        };
    },
    register: (input: UserInput & { employee_id: string | number }) =>
        api.post<{ message: string; username: string; default_password: string; employee_no: string; email_sent: boolean; email_error: string | null }>(
            'register_system_user', { ...input },
        ),
    update: (userId: number, input: UserInput) => api.post<{ message: string }>('update_system_user', { ...input, user_id: userId }),
    toggleStatus: (userId: number) => api.post<{ message: string; status: string }>('toggle_user_status', { user_id: userId }),
    archive: (userId: number) => api.post<{ message: string }>('archive_user', { user_id: userId }),

    rolesPage: async (): Promise<RoleMatrix> => {
        const res = await api.get<Partial<RoleMatrix>>('page_roles');
        return {
            roles: Array.isArray(res.roles) ? res.roles : [],
            permissions: Array.isArray(res.permissions) ? res.permissions : [],
            grants: Array.isArray(res.grants) ? res.grants : [],
        };
    },
    saveRoleMatrix: (checked: string[]) => api.post<{ message: string }>('save_role_matrix', { perm: checked }),
    permissionsPage: async () => {
        const res = await api.get<{ permissions?: { id: number; permission_name: string; description: string | null; role_count: number }[] }>('page_permissions');
        return { permissions: Array.isArray(res.permissions) ? res.permissions : [] };
    },
    createPermission: (name: string, description: string) =>
        api.post<{ message: string }>('create_permission', { permission_name: name, description }),
};
