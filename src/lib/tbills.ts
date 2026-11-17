// Treasury Bills — per-instrument calculations and portfolio consolidation.

import { TBill } from "./store";

const DAY = 86_400_000;

export interface TBCalc {
  tenorYears: number;
  daysToMaturity: number;
  status: "Active" | "Matured";
  discount: number;
  discountYield: number; // annualised simple yield on cost
  annualCoupon: number;
  accruedCoupon: number;
  accretedValue: number; // cost accreted toward face over life
  currentValue: number; // accreted + accrued coupon
  redemptionValue: number; // face + terminal coupon (if at maturity)
  nextCouponDate: string | null;
}

export function computeTB(tb: TBill, asOf: Date = new Date()): TBCalc {
  const issue = new Date(tb.issueDate);
  const maturity = new Date(tb.maturityDate);
  const tenorYears = Math.max(0.01, (maturity.getTime() - issue.getTime()) / (365.25 * DAY));
  const daysToMaturity = Math.round((maturity.getTime() - asOf.getTime()) / DAY);
  const status: TBCalc["status"] = daysToMaturity > 0 ? "Active" : "Matured";

  const discount = tb.faceValue - tb.purchasePrice;
  const discountYield = tb.purchasePrice > 0 ? discount / tb.purchasePrice / tenorYears : 0;

  const annualCoupon = (tb.faceValue * tb.couponRate) / 100;
  const elapsed = Math.max(0, Math.min(asOf.getTime(), maturity.getTime()) - issue.getTime()) / (365.25 * DAY);
  const accruedCoupon = annualCoupon * elapsed;
  const progress = Math.max(0, Math.min(1, elapsed / tenorYears));
  const accretedValue = tb.purchasePrice + discount * progress;
  const currentValue = accretedValue + accruedCoupon;
  const totalCoupon = annualCoupon * tenorYears;
  const redemptionValue = tb.faceValue + (tb.frequency === "At maturity" ? totalCoupon : 0);

  let nextCouponDate: string | null = null;
  if (tb.couponRate > 0 && status === "Active") {
    if (tb.frequency === "At maturity") nextCouponDate = tb.maturityDate;
    else {
      const stepMonths = tb.frequency === "Annual" ? 12 : tb.frequency === "Semi-annual" ? 6 : 3;
      const d = new Date(issue);
      while (d <= asOf) d.setMonth(d.getMonth() + stepMonths);
      nextCouponDate = d <= maturity ? d.toISOString().slice(0, 10) : tb.maturityDate;
    }
  }

  return { tenorYears, daysToMaturity, status, discount, discountYield, annualCoupon, accruedCoupon, accretedValue, currentValue, redemptionValue, nextCouponDate };
}

export interface Portfolio {
  count: number;
  active: number;
  totalFace: number;
  totalCost: number;
  totalValue: number;
  annualCouponIncome: number;
  weightedCoupon: number;
  weightedYield: number;
  nextMaturity: { ref: string; date: string; face: number } | null;
}

export function portfolio(tbills: TBill[], asOf: Date = new Date()): Portfolio {
  let totalFace = 0, totalCost = 0, totalValue = 0, annualCouponIncome = 0, active = 0;
  let couponWeighted = 0, yieldWeighted = 0;
  const upcoming: { ref: string; date: string; face: number; t: number }[] = [];
  for (const tb of tbills) {
    const c = computeTB(tb, asOf);
    totalFace += tb.faceValue;
    totalCost += tb.purchasePrice;
    totalValue += c.status === "Active" ? c.currentValue : c.redemptionValue;
    annualCouponIncome += c.annualCoupon;
    couponWeighted += tb.couponRate * tb.faceValue;
    yieldWeighted += (tb.couponRate / 100 + c.discountYield) * tb.faceValue;
    if (c.status === "Active") {
      active++;
      upcoming.push({ ref: tb.reference, date: tb.maturityDate, face: tb.faceValue, t: new Date(tb.maturityDate).getTime() });
    }
  }
  upcoming.sort((a, b) => a.t - b.t);
  return {
    count: tbills.length, active, totalFace, totalCost, totalValue, annualCouponIncome,
    weightedCoupon: totalFace ? couponWeighted / totalFace : 0,
    weightedYield: totalFace ? yieldWeighted / totalFace : 0,
    nextMaturity: upcoming[0] ? { ref: upcoming[0].ref, date: upcoming[0].date, face: upcoming[0].face } : null,
  };
}
