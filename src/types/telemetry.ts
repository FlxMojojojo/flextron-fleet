export interface CanTelemetry {
  vehicleno: string;
  ts: number;
  soc: number;
  soh: number;
  cycle_count: number;
  sum_voltage: number;
  max_v: number;
  min_v: number;
  cell_voltages: number[]; // 20 cells
  discharge_current: number;
  charging_status: number; // 0=not charging, 1=charging
  chg_mos: boolean;
  dischg_mos: boolean;
  remain_cap: number;
  dte: number;
  odometer: number;
  vehicle_speed: number;
  fast_charge_indicator: boolean;
  battery_temp_1: number;
  battery_temp_2: number;
  battery_temp_3: number;
  battery_temp_4: number;
  battery_high_temp_telltale: boolean;
  hv_critical_alert: boolean;
}

export interface GpsTelemetry {
  vehicleno: string;
  ts: number;
  latitude: number;
  longitude: number;
}

export type VehicleStatus = 'ok' | 'charging' | 'alert' | 'offline';

export type FaultSeverity = 'WARNING' | 'CRITICAL';

/** A decoded BMS fault from the Daly 0x040980 fault frame. */
export interface Fault {
  code: string;
  severity: FaultSeverity;
  description: string;
  byte: number;
  bit: number;
  escalate: boolean;
}

export type VehicleType = '2W' | '3W';

/** A bike owner / customer, manually mapped to one FLX IoT device. */
export interface Owner {
  id: string;
  name: string;
  mobile: string;
  purchase_date: string; // ISO date 'YYYY-MM-DD'
  vehicle_type: VehicleType;
  vehicleno: string;     // mapped FLX device id
  createdAt: number;
}

export interface VehicleState {
  vehicleno: string;
  can: CanTelemetry;
  gps: GpsTelemetry;
  status: VehicleStatus;
  cell_delta: number; // max_v - min_v
  last_seen: number;
  hours_since_charge: number | null; // hours since charging_status was last 1
  gps_distance_km: number;           // distance traveled, derived from GPS points only
  gps_speed_kmh: number;             // speed derived from GPS (lat/long over time)
  owner?: Owner | null;              // mapped owner, attached by the API layer
  faults: Fault[];                   // decoded active BMS faults (from fault_bytes)
  fault_bytes?: number[];            // raw 8-byte fault frame as received
}

export interface TimeSeriesPoint {
  ts: number;
  value: number;
}

export type HistoryMetric = 'soc' | 'sum_voltage' | 'battery_temp_1' | 'discharge_current';
