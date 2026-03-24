import Decimal from 'decimal.js';
import {
  calcDailyWork,
  calcRuralNightPremium,
  isHolidayOrSunday,
  calcInterjornada,
  calcMonthlyTotals,
} from './time-calculations.service';
import type { DailyWorkInput, DailyWorkResult } from './time-calculations.types';

// Helper to create DailyWorkInput
function makeInput(
  workedMinutes: number,
  scheduledMinutes: number,
  isDayOff: boolean,
  nightMinutes = 0,
): DailyWorkInput {
  return {
    workedMinutes: new Decimal(workedMinutes),
    scheduledMinutes: new Decimal(scheduledMinutes),
    isDayOff,
    nightMinutes: new Decimal(nightMinutes),
  };
}

describe('calcDailyWork', () => {
  // Test 1: Normal day, exact schedule
  it('Test 1: normal day 480/480 -> regularMinutes=480, no overtime', () => {
    const result = calcDailyWork(makeInput(480, 480, false));
    expect(result.regularMinutes.toNumber()).toBe(480);
    expect(result.overtime50Minutes.toNumber()).toBe(0);
    expect(result.overtime100Minutes.toNumber()).toBe(0);
  });

  // Test 2: Normal day, 60 extra minutes
  it('Test 2: normal day 540/480 -> regularMinutes=480, overtime50=60', () => {
    const result = calcDailyWork(makeInput(540, 480, false));
    expect(result.regularMinutes.toNumber()).toBe(480);
    expect(result.overtime50Minutes.toNumber()).toBe(60);
    expect(result.overtime100Minutes.toNumber()).toBe(0);
  });

  // Test 3: Sunday/holiday, 480 worked = all overtime100
  it('Test 3: Sunday/holiday 480/480 -> regularMinutes=0, overtime100=480', () => {
    const result = calcDailyWork(makeInput(480, 480, true));
    expect(result.regularMinutes.toNumber()).toBe(0);
    expect(result.overtime50Minutes.toNumber()).toBe(0);
    expect(result.overtime100Minutes.toNumber()).toBe(480);
  });

  // Test 4: Sunday/holiday, 600 worked = all overtime100
  it('Test 4: Sunday/holiday 600/480 -> regularMinutes=0, overtime100=600', () => {
    const result = calcDailyWork(makeInput(600, 480, true));
    expect(result.regularMinutes.toNumber()).toBe(0);
    expect(result.overtime50Minutes.toNumber()).toBe(0);
    expect(result.overtime100Minutes.toNumber()).toBe(600);
  });

  // Test 5: Absence (0 worked)
  it('Test 5: absence (0 worked) -> all zeros', () => {
    const result = calcDailyWork(makeInput(0, 480, false));
    expect(result.regularMinutes.toNumber()).toBe(0);
    expect(result.overtime50Minutes.toNumber()).toBe(0);
    expect(result.overtime100Minutes.toNumber()).toBe(0);
  });

  // Test 6: Interjornada alert - 9h gap (540 minutes) -> alert=true
  it('Test 6: previousClockOut 22:00, clockIn 07:00 next day (9h=540min gap) -> interjornadaAlert=true', () => {
    // 22:00 to 07:00 next day = 9 hours = 540 minutes
    const previousClockOut = new Date('2026-03-24T22:00:00Z');
    const clockIn = new Date('2026-03-25T07:00:00Z');
    const result = calcDailyWork(makeInput(480, 480, false), previousClockOut, clockIn);
    expect(result.interjornadaAlert).toBe(true);
    expect(result.interjornada?.toNumber()).toBe(540);
  });

  // Test 7: Interjornada OK - 15h gap -> alert=false
  it('Test 7: previousClockOut 17:00, clockIn 08:00 next day (15h=900min gap) -> interjornadaAlert=false', () => {
    const previousClockOut = new Date('2026-03-24T17:00:00Z');
    const clockIn = new Date('2026-03-25T08:00:00Z');
    const result = calcDailyWork(makeInput(480, 480, false), previousClockOut, clockIn);
    expect(result.interjornadaAlert).toBe(false);
    expect(result.interjornada?.toNumber()).toBe(900);
  });

  // Test: night premium minutes passed through
  it('night premium minutes are captured in result', () => {
    const result = calcDailyWork(makeInput(480, 480, false, 120));
    expect(result.nightPremiumMinutes.toNumber()).toBe(120);
  });

  // Test: no previousClockOut -> no interjornada
  it('no previousClockOut -> interjornada=null, alert=false', () => {
    const result = calcDailyWork(makeInput(480, 480, false));
    expect(result.interjornada).toBeNull();
    expect(result.interjornadaAlert).toBe(false);
  });
});

describe('calcRuralNightPremium', () => {
  const HORA_REDUZIDA_FATOR = new Decimal(60).div(new Decimal('52.5')); // ~1.142857

  // Test 8: 480 night minutes full shift
  it('Test 8: 480 night minutes -> nightHours ~9.142857 contractual', () => {
    const hourlyRate = new Decimal(10);
    const result = calcRuralNightPremium(new Decimal(480), hourlyRate);
    const expectedNightHours = new Decimal(480).div(60).mul(HORA_REDUZIDA_FATOR);
    expect(result.nightHours.toFixed(6)).toBe(expectedNightHours.toFixed(6));
    const expectedPremium = expectedNightHours.mul(hourlyRate).mul('0.25');
    expect(result.premium.toFixed(6)).toBe(expectedPremium.toFixed(6));
  });

  // Test 9: 0 night minutes
  it('Test 9: 0 night minutes -> premium=0, nightHours=0', () => {
    const result = calcRuralNightPremium(new Decimal(0), new Decimal(10));
    expect(result.premium.toNumber()).toBe(0);
    expect(result.nightHours.toNumber()).toBe(0);
  });

  // Test 10: 120 night minutes
  it('Test 10: 120 night minutes -> nightHours ~2.285714', () => {
    const hourlyRate = new Decimal(10);
    const result = calcRuralNightPremium(new Decimal(120), hourlyRate);
    const expectedNightHours = new Decimal(120).div(60).mul(HORA_REDUZIDA_FATOR);
    expect(result.nightHours.toFixed(6)).toBe(expectedNightHours.toFixed(6));
    const expectedPremium = expectedNightHours.mul(hourlyRate).mul('0.25');
    expect(result.premium.toFixed(6)).toBe(expectedPremium.toFixed(6));
  });
});

describe('isHolidayOrSunday', () => {
  // Test 11: Christmas 2026
  it('Test 11: 2026-12-25 (Christmas) -> true', () => {
    expect(isHolidayOrSunday(new Date('2026-12-25T12:00:00-03:00'))).toBe(true);
  });

  // Test 12: New Year 2026
  it('Test 12: 2026-01-01 (New Year) -> true', () => {
    expect(isHolidayOrSunday(new Date('2026-01-01T12:00:00-03:00'))).toBe(true);
  });

  // Test 13: Normal Tuesday 2026-03-24
  it('Test 13: 2026-03-24 (normal Tuesday) -> false', () => {
    expect(isHolidayOrSunday(new Date('2026-03-24T12:00:00-03:00'))).toBe(false);
  });

  // Test 14: Sunday 2026-03-29
  it('Test 14: 2026-03-29 (Sunday) -> true', () => {
    expect(isHolidayOrSunday(new Date('2026-03-29T12:00:00-03:00'))).toBe(true);
  });

  // Additional: Tiradentes 2026-04-21 (national holiday)
  it('2026-04-21 (Tiradentes) -> true', () => {
    expect(isHolidayOrSunday(new Date('2026-04-21T12:00:00-03:00'))).toBe(true);
  });
});

describe('calcInterjornada', () => {
  // Test 15: 660 minutes (11h) gap -> alert=false
  it('Test 15: 660 minutes (11h) gap -> alert=false', () => {
    const previousClockOut = new Date('2026-03-24T20:00:00Z');
    const currentClockIn = new Date('2026-03-25T07:00:00Z');
    const result = calcInterjornada(previousClockOut, currentClockIn);
    expect(result.gapMinutes?.toNumber()).toBe(660);
    expect(result.alert).toBe(false);
  });

  // Test 16: 600 minutes (10h) gap -> alert=true
  it('Test 16: 600 minutes (10h) gap -> alert=true', () => {
    const previousClockOut = new Date('2026-03-24T21:00:00Z');
    const currentClockIn = new Date('2026-03-25T07:00:00Z');
    const result = calcInterjornada(previousClockOut, currentClockIn);
    expect(result.gapMinutes?.toNumber()).toBe(600);
    expect(result.alert).toBe(true);
  });

  // Test 17: null previousClockOut -> gapMinutes=null, alert=false
  it('Test 17: null previousClockOut -> gapMinutes=null, alert=false', () => {
    const result = calcInterjornada(null, new Date('2026-03-25T07:00:00Z'));
    expect(result.gapMinutes).toBeNull();
    expect(result.alert).toBe(false);
  });
});

describe('calcMonthlyTotals', () => {
  function makeDailyResult(
    regular: number,
    ot50: number,
    ot100: number,
    nightPremium: number,
    isAbsence = false,
  ): DailyWorkResult {
    return {
      regularMinutes: new Decimal(regular),
      overtime50Minutes: new Decimal(ot50),
      overtime100Minutes: new Decimal(ot100),
      nightPremiumMinutes: new Decimal(nightPremium),
      interjornada: null,
      interjornadaAlert: false,
    };
  }

  // Test 18: Aggregate 30 days
  it('Test 18: aggregate 30 days with mixed data', () => {
    const days: DailyWorkResult[] = [
      makeDailyResult(480, 60, 0, 120),   // day 1: normal + overtime + night
      makeDailyResult(480, 0, 0, 0),       // day 2: normal
      makeDailyResult(0, 0, 480, 0),       // day 3: sunday all overtime100
      makeDailyResult(0, 0, 0, 0),         // day 4: absence
    ];
    const result = calcMonthlyTotals(days);
    expect(result.totalWorked.toNumber()).toBe(480 + 60 + 480 + 480);
    expect(result.totalOvertime50.toNumber()).toBe(60);
    expect(result.totalOvertime100.toNumber()).toBe(480);
    expect(result.totalNightMinutes.toNumber()).toBe(120);
    expect(result.totalAbsences).toBe(1);
  });

  // Test 19: Empty array -> all zeros
  it('Test 19: empty array -> all zeros', () => {
    const result = calcMonthlyTotals([]);
    expect(result.totalWorked.toNumber()).toBe(0);
    expect(result.totalOvertime50.toNumber()).toBe(0);
    expect(result.totalOvertime100.toNumber()).toBe(0);
    expect(result.totalNightMinutes.toNumber()).toBe(0);
    expect(result.totalAbsences).toBe(0);
  });

  // Test: 30 days all normal shifts
  it('30 days all 480 min regular -> totalWorked=14400', () => {
    const days = Array.from({ length: 30 }, () => makeDailyResult(480, 0, 0, 0));
    const result = calcMonthlyTotals(days);
    expect(result.totalWorked.toNumber()).toBe(14400);
    expect(result.totalAbsences).toBe(0);
  });
});
