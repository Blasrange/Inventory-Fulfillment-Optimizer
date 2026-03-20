import type { ExitoLabelData } from "@/ai/flows/schemas";

function clean(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\^~]/g, " ")
    .trim();
}

export function generateExitoLabelZpl(label: ExitoLabelData): string {
  const nc = clean(label.nc);
  const ct = clean(label.ct);
  const codigoBarra = clean(label.codigoBarra);
  const tienda = clean(label.tienda);
  const depto = clean(label.depto);
  const ciudad = clean(label.ciudad);
  const orden = clean(label.orden);
  const direccion = clean(label.direccion);
  const numeroCaja = String(label.numeroCaja || 1);
  const totalCajas = String(label.totalCajas || 1);
  const cedi = clean(label.cedi);
  const desc = clean(label.desc);

  const z: string[] = [];
  z.push("^XA");
  z.push("^CF0,27");
  z.push(`^FO200,20^FD${nc}^FS`);
  z.push("^FO50,45^GB700,3,3^FS");
  z.push("^FX Seccion De Codigo De Barras");
  z.push(`^FO270,60^BY4,2,190^BCN,140,N,N,N^FD>;${ct}^FS`);
  z.push(`^CF0,40^FO340,210^FD${ct}^FS`);
  z.push("^FO50,246^GB700,3,3^FS");
  z.push(`^CF0,25^FO50,255^FDTIENDA:^FS^FO140,255^FD${tienda}^FS`);
  z.push(
    `^FO50,315^FDDEPARTAMENTO:^FS^FO230,315^FD${depto}^FS^FO435,315^FDCIUDAD:^FS^FO530,315^FD${ciudad}^FS`,
  );
  z.push(`^CF0,25^FO210,345^FDORD COMPRA:^FS^FO370,345^FD${orden}^FS`);
  z.push(`^CF0,25^FO50,285^FDDIRECCION:^FS^FO175,285^FD${direccion}^FS`);
  z.push("^FO50,369^GB700,3,3^FS");
  z.push(
    `^CF0,25^FO50,345^FDCAJAS:^FS^FO130,345^FD${numeroCaja} de ${totalCajas}^FS`,
  );
  z.push("^CF0,25^FO540,345^FDALMACENES EXITO^FS");
//   z.push(`^CF0,25^FO620,220^FD${cedi}^FS`);
  z.push(`^CF0,25^FO50,378^FD${desc}^FS`);
  z.push(`^CF0,22^FO50,408^FDCOD BARRA:^FS^FO200,408^FD${codigoBarra}^FS`);
  z.push("^CF0,25^FO540,400^FDCEDI VEGAS^FS");
  z.push("^XZ");

  return z.join("\n");
}

export function generateExitoBatchZpl(labels: ExitoLabelData[]): string {
  return labels.map((label) => generateExitoLabelZpl(label)).join("\n");
}
