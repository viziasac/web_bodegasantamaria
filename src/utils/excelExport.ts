export interface ExcelSheet {
  name: string;
  rows: Record<string, string | number | null | undefined>[];
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/*?:[\]]/g, '-').slice(0, 31);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '-');
}

export async function downloadExcelWorkbook(sheets: ExcelSheet[], filename: string): Promise<void> {
  if (sheets.length === 0) {
    throw new Error('No hay datos para exportar.');
  }
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const rows = sheet.rows.length > 0
      ? sheet.rows
      : [{ Mensaje: 'Sin registros en el periodo seleccionado' }];
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sheet.name));
  }
  XLSX.writeFile(wb, sanitizeFilename(filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`));
}

export async function downloadExcelSheet(name: string, rows: ExcelSheet['rows'], filename: string): Promise<void> {
  await downloadExcelWorkbook([{ name, rows }], filename);
}
