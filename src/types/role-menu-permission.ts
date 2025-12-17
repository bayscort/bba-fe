export interface Permission {
  id: number;
  operation: string;
}

export interface MenuPermission {
  menuId: number;
  permissionIds: number[];
}

export interface Menu {
  id: number;
  name: string;
  permissionList: Permission[];
}

export interface AllMenu {
  id: number;
  name: string;
}

export interface AllPermission {
  id: number;
  operation: string;
  name: string;
  description?: string;
}

export interface Role {
  id: number;
  name: string;
}

export interface RoleWithMenus {
  role: Role;
  menuList: Menu[];
}

export interface RoleUpdatePayload {
  roleId: number;
  menuPermissions: MenuPermission[];
}