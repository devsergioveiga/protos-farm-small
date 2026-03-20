describe('Depreciation Engine', () => {
  describe('daysInMonth', () => {
    it.todo('returns 29 for February 2024 (leap year)');
    it.todo('returns 28 for February 2025');
    it.todo('returns 31 for January');
    it.todo('returns 30 for April');
  });

  describe('getProRataDays', () => {
    it.todo('returns full month days when no acquisition in period');
    it.todo('returns partial days for mid-month acquisition (Jan 15 = 17 days)');
    it.todo('returns partial days for disposal on day 10');
  });

  describe('computeDepreciation', () => {
    it.todo('STRAIGHT_LINE with rate: 120000 value, 10% rate, full month = 1000.00');
    it.todo('STRAIGHT_LINE with usefulLifeMonths: 60000 / 120 months = 500.00');
    it.todo('STRAIGHT_LINE pro-rata: Jan 15 acquisition, 17/31 days = 548.39');
    it.todo('stops at residual: remaining 500, monthly would be 1000 = amount 500');
    it.todo('fully depreciated: openingBookValue equals residualValue = skipped');
    it.todo('ACCELERATED: 100000 book value, 10% rate, factor 2.0 = 1666.67');
    it.todo('HOURS_OF_USE without periodicHours = skipped');
    it.todo('HOURS_OF_USE with periodicHours: 100000 / 10000h * 150h = 1500.00');
    it.todo('UNITS_OF_PRODUCTION without periodicUnits = skipped');
  });
});
