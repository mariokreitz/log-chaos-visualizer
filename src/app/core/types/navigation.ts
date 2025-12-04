export interface NavItem {
  id: number;
  label: string;
  route: string;
  icon: string;
  ariaLabel?: string;
  exact?: boolean;
  visible?: boolean;
}

export type NavItems = readonly NavItem[];
