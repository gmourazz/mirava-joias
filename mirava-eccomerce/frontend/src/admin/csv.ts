// Exportação de planilha do painel.

/** CSV com ";" e BOM — abre certo no Excel em português. */
export function baixarCSV(nome: string, linhas: (string | number)[][]) {
  const csv = "\uFEFF" + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

/** 12345 → "123,45" — valor sem "R$" para a planilha somar. */
export const reaisCSV = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
