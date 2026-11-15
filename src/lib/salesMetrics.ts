export function percent(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round(numerator / denominator * 1000) / 10 : null;
}
export function salesIndicators(uniqueCalls: number, accepted: number, sold: number, workedDays: number) {
  return {
    acceptanceConversion: percent(accepted, uniqueCalls),
    salesFromAccepted: percent(sold, accepted),
    salesFromUnique: percent(sold, uniqueCalls),
    unsoldAccepted: Math.max(0, accepted - sold),
    dailyAverageCalls: workedDays > 0 ? Math.round(uniqueCalls / workedDays * 10) / 10 : null,
    dailyAverageSales: workedDays > 0 ? Math.round(sold / workedDays * 10) / 10 : null,
  };
}
