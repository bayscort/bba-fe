import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { AccountResp } from '../types/account';
import { CashflowCategory } from '../types/cashflow';
import { accountService, fetchCashflow, fetchCombineCashflow } from '../services/api';
import SectionHeader from '../components/report/SectionHeader';
import { FileDown } from 'lucide-react';
import * as XLSX from "xlsx-js-style";

const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

interface Option {
    value: string;
    label: string;
}

export default function ReceiptCashflow() {
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [accounts, setAccounts] = useState<AccountResp[]>([]);
    const [selectedAccounts, setSelectedAccounts] = useState<Option[]>([]);
    const [reports, setReports] = useState<{ title: string; data: CashflowCategory[] }[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Generate year options (e.g., current year - 5 to current year + 1)
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i).map(year => ({
        value: year,
        label: year.toString()
    }));

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const fetchedAccounts = await accountService.getAllAccounts();
                setAccounts(fetchedAccounts);
            } catch (err) {
                console.error("Gagal mengambil data akun:", err);
                setError("Tidak dapat memuat daftar akun.");
            }
        };
        fetchAccounts();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (selectedAccounts.length === 0) {
                setReports([]);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const newReports: { title: string; data: CashflowCategory[] }[] = [];

                // 1. Fetch individual reports for each selected account
                if (selectedAccounts.length > 1) {
                    for (const account of selectedAccounts) {
                        const data = await fetchCashflow('receipt', account.value, selectedYear);
                        newReports.push({
                            title: `Cashflow - ${account.label}`,
                            data: data
                        });
                    }
                }

                // 2. Fetch combined/single report
                if (selectedAccounts.length === 1) {
                    const data = await fetchCashflow('receipt', selectedAccounts[0].value, selectedYear);
                    newReports.push({
                        title: `Cashflow - ${selectedAccounts[0].label}`,
                        data: data
                    });
                } else {
                    const accountIds = selectedAccounts.map(opt => opt.value);
                    const data = await fetchCombineCashflow('receipt', accountIds, selectedYear);
                    newReports.push({
                        title: 'Total Gabungan (Combined)',
                        data: data
                    });
                }

                setReports(newReports);
            } catch (err) {
                console.error("Failed to fetch cashflow data:", err);
                setError("Gagal mengambil data cashflow.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedYear, selectedAccounts]);

    const accountOptions: Option[] = accounts
        .filter(acc => acc.id !== undefined)
        .map(acc => ({
            value: String(acc.id),
            label: acc.name
        }));

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const onExport = () => {
        if (!reports || reports.length === 0) return;

        const workbook = XLSX.utils.book_new();

        reports.forEach((report, index) => {
            const worksheet: { [key: string]: any } = {};
            // Ensure unique sheet name by appending index if needed or just using index if name is too similar
            let sheetName = report.title.replace(/[:\/\\?*[\]]/g, "").substring(0, 25);
            // Add index to ensure uniqueness if titles are same
            if (reports.filter(r => r.title.replace(/[:\/\\?*[\]]/g, "").substring(0, 25) === sheetName).length > 1) {
                sheetName = `${sheetName} ${index + 1}`;
            }

            // Styles
            const titleStyle = { font: { bold: true, size: 16, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2F5597" } }, alignment: { horizontal: "center", vertical: "center" } };
            const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4472C4" } }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
            const categoryStyle = { font: { bold: true }, fill: { fgColor: { rgb: "D9D9D9" } }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
            const itemStyle = { font: { color: { rgb: "333333" } }, fill: { fgColor: { rgb: "FEFEFE" } }, border: { top: { style: "hair" }, bottom: { style: "hair" }, left: { style: "hair" }, right: { style: "hair" } } };
            const numberStyle = { numFmt: '#,##0', alignment: { horizontal: "right" } };

            let currentRow = 1;

            // Title
            worksheet['A1'] = { v: report.title.toUpperCase(), s: titleStyle };
            worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 13 } }]; // Merge A1:N1

            currentRow = 3;
            worksheet[`A${currentRow}`] = { v: `Tahun: ${selectedYear}`, s: { font: { bold: true } } };
            currentRow++;
            // Show accounts for this specific report if possible, or just all selected. 
            // Ideally we'd know which account this report is for, but title works.
            worksheet[`A${currentRow}`] = { v: `Keterangan: ${report.title}`, s: { font: { bold: true } } };
            currentRow += 2;

            // Headers
            const headers = ['KATEGORI', ...MONTHS, 'TOTAL'];
            headers.forEach((header, index) => {
                const cellRef = XLSX.utils.encode_cell({ r: currentRow - 1, c: index });
                worksheet[cellRef] = { v: header, s: headerStyle };
            });
            currentRow++;

            // Data
            const setCell = (r: number, c: number, val: any, style: any) => {
                const cellRef = XLSX.utils.encode_cell({ r, c });
                worksheet[cellRef] = { v: val, s: { ...style, ...(typeof val === 'number' ? numberStyle : {}) } };
            };

            let grandTotalMonthly = Array(12).fill(0);
            let grandTotalYearly = 0;

            report.data.forEach(category => {
                // Category Row
                setCell(currentRow - 1, 0, category.itemCategory, categoryStyle);
                category.monthlyTotal.forEach((amount, idx) => {
                    setCell(currentRow - 1, idx + 1, amount, categoryStyle);
                    grandTotalMonthly[idx] += amount;
                });
                setCell(currentRow - 1, 13, category.yearlyTotal, categoryStyle);
                grandTotalYearly += category.yearlyTotal;
                currentRow++;

                // Items
                category.items.forEach(item => {
                    setCell(currentRow - 1, 0, `   ${item.financeItem}`, itemStyle);
                    item.monthlyAmount.forEach((amount, idx) => {
                        setCell(currentRow - 1, idx + 1, amount, itemStyle);
                    });
                    setCell(currentRow - 1, 13, item.yearlyTotal, itemStyle);
                    currentRow++;
                });
            });

            // Grand Total Row
            const totalStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "E74C3C" } }, border: { top: { style: "thick" }, bottom: { style: "thick" } } };
            setCell(currentRow - 1, 0, 'TOTAL KESELURUHAN', totalStyle);
            grandTotalMonthly.forEach((amount, idx) => {
                setCell(currentRow - 1, idx + 1, amount, totalStyle);
            });
            setCell(currentRow - 1, 13, grandTotalYearly, totalStyle);

            // Column Widths
            worksheet['!cols'] = [
                { width: 30 }, // Category
                ...Array(12).fill({ width: 15 }), // Months
                { width: 20 } // Total
            ];

            worksheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: currentRow, c: 13 } });

            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        });

        XLSX.writeFile(workbook, `Cashflow_Receipt_${selectedYear}.xlsx`);
    };

    return (
        <div className="flex flex-col min-h-screen bg-white p-8 space-y-6">
            <div className="sticky top-0 z-30 flex flex-col md:flex-row gap-4 items-start md:items-end justify-between bg-white p-4 rounded-lg border border-gray-100 shadow-sm shadow-md">
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                    <div className="w-full md:w-48">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tahun</label>
                        <Select
                            options={yearOptions}
                            value={yearOptions.find(opt => opt.value === selectedYear)}
                            onChange={(opt) => opt && setSelectedYear(opt.value)}
                            className="text-sm"
                            placeholder="Pilih Tahun"
                        />
                    </div>
                    <div className="w-full md:w-96">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Finance Account</label>
                        <Select
                            isMulti
                            options={accountOptions}
                            value={selectedAccounts}
                            onChange={(opts) => setSelectedAccounts(opts as Option[])}
                            className="text-sm"
                            placeholder="Pilih Akun..."
                            noOptionsMessage={() => "Tidak ada akun ditemukan"}
                        />
                    </div>
                </div>

                {reports.length > 0 && (
                    <button
                        onClick={onExport}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm font-medium h-[38px]"
                    >
                        <FileDown size={16} />
                        Export Excel
                    </button>
                )}
            </div>

            <main className="space-y-6">
                <SectionHeader
                    title="Laporan Cashflow Penerimaan"
                    description="Tampilan cashflow per bulan berdasarkan akun dan tahun yang dipilih."
                />

                {error && (
                    <div className="mt-4 p-4 bg-[#FBF3F2] text-[#9F3A38] rounded-md border border-[#F1CFCB] text-sm">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center items-center py-16">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent border-gray-400"></div>
                    </div>
                ) : reports.length > 0 ? (
                    <div className="space-y-10">
                        {reports.map((report, reportIdx) => (
                            <div
                                key={reportIdx}
                                className="rounded-xl border border-[#E5E5E3] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                            >
                                {/* Report Header */}
                                <div className="px-5 py-4 border-b border-[#E5E5E3] bg-[#FAFAF9] text-[15px] font-medium text-[#37352F]">
                                    {report.title}
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm border-separate border-spacing-0">
                                        {/* TABLE HEAD */}
                                        <thead className="bg-[#F7F7F5] text-[#37352F]">
                                            <tr>
                                                <th
                                                    className="
                                            px-4 py-2.5 text-left font-medium
                                            sticky left-0 z-20 w-64
                                            bg-[#F7F7F5]
                                            border-r border-[#E5E5E3]
                                        "
                                                >
                                                    Kategori / Item
                                                </th>

                                                {MONTHS.map(month => (
                                                    <th
                                                        key={month}
                                                        className="px-4 py-2.5 text-right font-medium text-[#6B6F76] min-w-[120px]"
                                                    >
                                                        {month}
                                                    </th>
                                                ))}

                                                <th className="px-4 py-2.5 text-right font-medium min-w-[140px] bg-[#F0F0EE]">
                                                    Total
                                                </th>
                                            </tr>
                                        </thead>

                                        {/* TABLE BODY */}
                                        <tbody>
                                            {report.data.map((category, catIdx) => (
                                                <React.Fragment key={catIdx}>
                                                    {/* CATEGORY ROW */}
                                                    <tr className="bg-[#F7F7F5]">
                                                        <td
                                                            className="
                                                    px-4 py-2.5 font-medium
                                                    sticky left-0 z-10
                                                    bg-[#F7F7F5]
                                                    border-r border-[#E5E5E3]
                                                    text-[#37352F]
                                                "
                                                        >
                                                            {category.itemCategory}
                                                        </td>

                                                        {category.monthlyTotal.map((amount, idx) => (
                                                            <td key={idx} className="px-4 py-2.5 text-right text-[#37352F]">
                                                                {formatCurrency(amount)}
                                                            </td>
                                                        ))}

                                                        <td className="px-4 py-2.5 text-right font-medium bg-[#F0F0EE]">
                                                            {formatCurrency(category.yearlyTotal)}
                                                        </td>
                                                    </tr>

                                                    {/* ITEM ROWS */}
                                                    {category.items.map((item, itemIdx) => (
                                                        <tr
                                                            key={`${catIdx}-${itemIdx}`}
                                                            className="group hover:bg-[#F5F7FA] transition-colors"
                                                        >
                                                            <td
                                                                className="
    px-4 py-2 pl-8
    sticky left-0 z-10
    bg-white group-hover:bg-[#F5F7FA]
    border-r border-[#F0F0EE]
    text-[#6B6F76]
  "
                                                            >
                                                                <div className="relative group/item max-w-[220px]">
                                                                    {/* Truncated Text */}
                                                                    <div className="truncate text-sm cursor-default">
                                                                        {item.financeItem}
                                                                    </div>

                                                                    {/* Hover Tooltip */}
                                                                    {item.financeItem.length > 30 && (
                                                                        <div
                                                                            className="
                    absolute left-0 top-full mt-1
                    hidden group-hover/item:block
                    z-30
                    max-w-sm
                    px-3 py-2
                    rounded-md
                    border border-[#E5E5E3]
                    bg-white
                    text-[#37352F] text-sm
                    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
                    whitespace-normal
                "
                                                                        >
                                                                            {item.financeItem}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>


                                                            {item.monthlyAmount.map((amount, idx) => (
                                                                <td
                                                                    key={idx}
                                                                    className="px-4 py-2 text-right text-[#6B6F76]"
                                                                >
                                                                    {amount === 0 ? '–' : formatCurrency(amount)}
                                                                </td>
                                                            ))}

                                                            <td className="px-4 py-2 text-right font-medium bg-[#FAFAF9] text-[#37352F]">
                                                                {formatCurrency(item.yearlyTotal)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            ))}

                                            {/* GRAND TOTAL */}
                                            <tr className="border-t-2 border-[#D0D7E2] bg-[#FAFAF9] font-semibold">
                                                <td
                                                    className="
                                            px-4 py-3
                                            sticky left-0 z-10
                                            bg-[#FAFAF9]
                                            border-r border-[#E5E5E3]
                                            text-[#1F2937]
                                        "
                                                >
                                                    TOTAL PENERIMAAN
                                                </td>

                                                {Array.from({ length: 12 }).map((_, monthIdx) => {
                                                    const totalMonth = report.data.reduce(
                                                        (acc, cat) => acc + cat.monthlyTotal[monthIdx],
                                                        0
                                                    );
                                                    return (
                                                        <td key={monthIdx} className="px-4 py-3 text-right">
                                                            {formatCurrency(totalMonth)}
                                                        </td>
                                                    );
                                                })}

                                                <td className="px-4 py-3 text-right">
                                                    {formatCurrency(
                                                        report.data.reduce((acc, cat) => acc + cat.yearlyTotal, 0)
                                                    )}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : selectedAccounts.length > 0 ? (
                    <div className="text-center py-14 text-[#6B6F76] bg-[#FAFAF9] rounded-lg mt-6 border border-dashed border-[#E5E5E3] text-sm">
                        Tidak ada data cashflow untuk periode dan akun yang dipilih.
                    </div>
                ) : (
                    <div className="text-center py-14 text-[#6B6F76] bg-[#FAFAF9] rounded-lg mt-6 border border-dashed border-[#E5E5E3] text-sm">
                        Silakan pilih Akun terlebih dahulu untuk melihat data.
                    </div>
                )}
            </main>

        </div>
    );
}
