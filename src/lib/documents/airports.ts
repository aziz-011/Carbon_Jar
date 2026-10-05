/**
 * Aéroports courants (codes IATA) pour estimer la distance d'un vol à partir d'un billet.
 * Distance orthodromique majorée de 8 % (détours et attentes), pratique usuelle (DEFRA / ADEME).
 */
const AIRPORTS: Record<string, [number, number]> = {
  TUN: [36.851, 10.227], DJE: [33.875, 10.776], MIR: [35.758, 10.755], NBE: [36.076, 10.438], SFA: [34.718, 10.691], TOE: [33.94, 8.11], TBJ: [36.978, 8.877],
  CDG: [49.01, 2.55], ORY: [48.723, 2.379], MRS: [43.436, 5.215], LYS: [45.726, 5.091], NCE: [43.658, 7.216], TLS: [43.629, 1.364], BOD: [44.828, -0.715], NTE: [47.157, -1.608], LIL: [50.563, 3.087],
  FRA: [50.033, 8.571], MUC: [48.354, 11.786], BER: [52.366, 13.503], DUS: [51.289, 6.767], FCO: [41.8, 12.239], MXP: [45.63, 8.723], NAP: [40.884, 14.291], PMO: [38.176, 13.091],
  MAD: [40.472, -3.561], BCN: [41.297, 2.078], LIS: [38.774, -9.134], LHR: [51.47, -0.454], LGW: [51.153, -0.182], AMS: [52.308, 4.764], BRU: [50.901, 4.484], GVA: [46.238, 6.109], ZRH: [47.465, 8.549],
  VIE: [48.11, 16.57], IST: [41.275, 28.752], ATH: [37.936, 23.947], CMN: [33.367, -7.59], RAK: [31.607, -8.036], ALG: [36.691, 3.215], TIP: [32.663, 13.159], CAI: [30.122, 31.406],
  JED: [21.679, 39.157], RUH: [24.958, 46.699], DXB: [25.253, 55.364], DOH: [25.273, 51.608], AUH: [24.433, 54.651], DSS: [14.67, -17.073], ABJ: [5.261, -3.926],
  JFK: [40.64, -73.779], YUL: [45.47, -73.741], PEK: [40.08, 116.585], PVG: [31.143, 121.805], CAN: [23.392, 113.299],
};

export function routeDistanceKm(from: string, to: string): number | undefined {
  const a = AIRPORTS[from.toUpperCase()];
  const b = AIRPORTS[to.toUpperCase()];
  if (!a || !b || from === to) return undefined;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h)) * 1.08;
}

/** Facteur d'émission aérien selon la distance (court, moyen, long-courrier). */
export function flightFactorForDistance(km: number): string {
  return km < 1000 ? 'flight_short' : km <= 3500 ? 'flight_medium' : 'flight_long';
}

export const AIRPORT_CODES = Object.keys(AIRPORTS);
