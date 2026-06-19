/**
 * Daly BMS fault decoder — CAN frame 0x040980 ("Hardware & battery failure").
 * 8 bytes (Data0..Data7) = 64 bits; each bit is one fault (0 = OK, 1 = active).
 * The device forwards the raw bytes in `fault_bytes`; we decode here so the map
 * can be fixed server-side without reflashing bikes.
 *
 * Transcribed from the Battery Fault Capture spec (KVMS CAN protocol).
 */

export type FaultSeverity = 'WARNING' | 'CRITICAL';

export interface FaultDef {
  code: string;
  severity: FaultSeverity;
  description: string;
}

export interface ActiveFault extends FaultDef {
  byte: number;
  bit: number;
  escalate: boolean;
}

const W: FaultSeverity = 'WARNING';
const C: FaultSeverity = 'CRITICAL';

// FAULT_MAP[byte][bit] — null = reserved.
const FAULT_MAP: (FaultDef | null)[][] = [
  // Data0 — Cell & Pack Voltage
  [
    { code: 'CELL_OVERVOLT_L1', severity: W, description: 'Cell voltage too high (L1)' },
    { code: 'CELL_OVERVOLT_L2', severity: C, description: 'Cell voltage too high (L2)' },
    { code: 'CELL_UNDERVOLT_L1', severity: W, description: 'Cell voltage too low (L1)' },
    { code: 'CELL_UNDERVOLT_L2', severity: C, description: 'Cell voltage too low (L2)' },
    { code: 'PACK_OVERVOLT_L1', severity: W, description: 'Total pack voltage too high (L1)' },
    { code: 'PACK_OVERVOLT_L2', severity: C, description: 'Total pack voltage too high (L2)' },
    { code: 'PACK_UNDERVOLT_L1', severity: W, description: 'Total pack voltage too low (L1)' },
    { code: 'PACK_UNDERVOLT_L2', severity: C, description: 'Total pack voltage too low (L2)' },
  ],
  // Data1 — Temperature
  [
    { code: 'CHG_TEMP_HIGH_L1', severity: W, description: 'Charging temperature too high (L1)' },
    { code: 'CHG_TEMP_HIGH_L2', severity: C, description: 'Charging temperature too high (L2)' },
    { code: 'CHG_TEMP_LOW_L1', severity: W, description: 'Charging temperature too low (L1)' },
    { code: 'CHG_TEMP_LOW_L2', severity: C, description: 'Charging temperature too low (L2)' },
    { code: 'DSG_TEMP_HIGH_L1', severity: W, description: 'Discharge temperature too high (L1)' },
    { code: 'DSG_TEMP_HIGH_L2', severity: C, description: 'Discharge temperature too high (L2)' },
    { code: 'DSG_TEMP_LOW_L1', severity: W, description: 'Discharge temperature too low (L1)' },
    { code: 'DSG_TEMP_LOW_L2', severity: C, description: 'Discharge temperature too low (L2)' },
  ],
  // Data2 — Current & SOC
  [
    { code: 'CHG_OVERCURRENT_L1', severity: W, description: 'Charging overcurrent (L1)' },
    { code: 'CHG_OVERCURRENT_L2', severity: C, description: 'Charging overcurrent (L2)' },
    { code: 'DSG_OVERCURRENT_L1', severity: W, description: 'Discharge overcurrent (L1)' },
    { code: 'DSG_OVERCURRENT_L2', severity: C, description: 'Discharge overcurrent (L2)' },
    { code: 'SOC_HIGH_L1', severity: W, description: 'SOC too high (L1)' },
    { code: 'SOC_HIGH_L2', severity: C, description: 'SOC too high (L2)' },
    { code: 'SOC_LOW_L1', severity: W, description: 'SOC too low (L1)' },
    { code: 'SOC_LOW_L2', severity: C, description: 'SOC too low (L2)' },
  ],
  // Data3 — Differences & MOS / Ambient
  [
    { code: 'VOLT_DIFF_L1', severity: W, description: 'Cell voltage difference too large (L1)' },
    { code: 'VOLT_DIFF_L2', severity: C, description: 'Cell voltage difference too large (L2)' },
    { code: 'TEMP_DIFF_L1', severity: W, description: 'Temperature difference too large (L1)' },
    { code: 'TEMP_DIFF_L2', severity: C, description: 'Temperature difference too large (L2)' },
    { code: 'MOS_TEMP_HIGH_L1', severity: W, description: 'MOS temperature too high (L1)' },
    { code: 'MOS_TEMP_HIGH_L2', severity: C, description: 'MOS temperature too high (L2)' },
    { code: 'AMBIENT_TEMP_HIGH_L1', severity: W, description: 'Ambient temperature too high (L1)' },
    { code: 'AMBIENT_TEMP_HIGH_L2', severity: C, description: 'Ambient temperature too high (L2)' },
  ],
  // Data4 — MOS Health
  [
    { code: 'CHG_MOS_OVERTEMP', severity: W, description: 'Charging MOS over-temperature warning' },
    { code: 'DSG_MOS_OVERTEMP', severity: W, description: 'Discharge MOS over-temperature warning' },
    { code: 'CHG_MOS_TSENSOR_FAIL', severity: C, description: 'Charging MOS temp sensor failure' },
    { code: 'DSG_MOS_TSENSOR_FAIL', severity: C, description: 'Discharge MOS temp sensor failure' },
    { code: 'CHG_MOS_STUCK', severity: C, description: 'Charging MOS adhesion (stuck) failure' },
    { code: 'DSG_MOS_STUCK', severity: C, description: 'Discharge MOS adhesion (stuck) failure' },
    { code: 'CHG_MOS_OPEN', severity: C, description: 'Charging MOS open-circuit fault' },
    { code: 'DSG_MOS_OPEN', severity: C, description: 'Discharge MOS open-circuit fault' },
  ],
  // Data5 — Hardware
  [
    { code: 'AFE_CHIP_FAIL', severity: C, description: 'AFE acquisition chip failure' },
    { code: 'CELL_SENSE_DISCONNECT', severity: C, description: 'Cell voltage acquisition disconnected' },
    { code: 'TEMP_SENSOR_FAIL', severity: C, description: 'Temperature sensor failure' },
    { code: 'EEPROM_FAIL', severity: C, description: 'EEPROM storage failure' },
    { code: 'RTC_FAIL', severity: W, description: 'RTC clock failure' },
    { code: 'PRECHARGE_FAIL', severity: C, description: 'Precharge failed' },
    { code: 'VEHICLE_COMM_FAIL', severity: W, description: 'Vehicle communication failure' },
    { code: 'INTERNAL_COMM_FAIL', severity: C, description: 'Internal network comm module failure' },
  ],
  // Data6 — System & Safety
  [
    { code: 'CURRENT_MODULE_FAIL', severity: C, description: 'Current module failure' },
    { code: 'PACK_VOLT_DETECT_FAIL', severity: C, description: 'Internal total-voltage detection failure' },
    { code: 'SHORT_CIRCUIT_FAIL', severity: C, description: 'Short-circuit protection failure' },
    { code: 'LOW_VOLT_CHG_INHIBIT', severity: W, description: 'Low-voltage charging prohibition fault' },
    { code: 'GPS_SOFTSW_MOS_OFF', severity: W, description: 'GPS / soft-switch MOS disconnected' },
    { code: 'CHARGER_REMOVED', severity: W, description: 'Charger removed from cabinet' },
    { code: 'THERMAL_RUNAWAY', severity: C, description: 'Thermal runaway failure' },
    { code: 'HEATING_FAIL', severity: W, description: 'Heating failure' },
  ],
  // Data7 — Balancing
  [
    { code: 'BALANCE_COMM_FAIL', severity: W, description: 'Balance module communication failure' },
    { code: 'BALANCE_COND_UNMET', severity: W, description: 'Equalization opening conditions not met' },
    null, null, null, null, null, null,
  ],
];

/** Safety-critical faults that warrant immediate escalation (push/SMS). */
export const ESCALATE_CODES = new Set<string>([
  'THERMAL_RUNAWAY',
  'SHORT_CIRCUIT_FAIL',
  'CHG_MOS_STUCK',
  'DSG_MOS_STUCK',
  'CHG_MOS_OPEN',
  'DSG_MOS_OPEN',
  'CELL_SENSE_DISCONNECT',
]);

/** Decode 8 raw fault bytes into the list of active faults. */
export function decodeFaults(faultBytes: number[] | undefined | null): ActiveFault[] {
  if (!Array.isArray(faultBytes) || faultBytes.length === 0) return [];
  const out: ActiveFault[] = [];
  for (let byte = 0; byte < Math.min(8, faultBytes.length); byte++) {
    const value = Number(faultBytes[byte]) || 0;
    for (let bit = 0; bit < 8; bit++) {
      if ((value >> bit) & 1) {
        const def = FAULT_MAP[byte]?.[bit];
        if (def) out.push({ ...def, byte, bit, escalate: ESCALATE_CODES.has(def.code) });
      }
    }
  }
  // Critical first, then by byte/bit order.
  return out.sort((a, b) =>
    (a.severity === 'CRITICAL' ? 0 : 1) - (b.severity === 'CRITICAL' ? 0 : 1)
    || a.byte - b.byte || a.bit - b.bit);
}
