export interface CashflowItem {
    financeItem: string;
    monthlyAmount: number[]; // Array of numbers (Index 0 = Jan, 11 = Dec)
    yearlyTotal: number;
}

export interface CashflowCategory {
    itemCategory: string;
    items: CashflowItem[];
    monthlyTotal: number[]; // Array of numbers (Index 0 = Jan, 11 = Dec)
    yearlyTotal: number;
}