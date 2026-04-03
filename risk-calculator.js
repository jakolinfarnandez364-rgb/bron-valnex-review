/**
 * risk-evaluator.js — Position Size & Risk Analyzer
 *
 * Determines the ideal position size based on your account value, 
 * risk percentage, distance to stop-loss, and the current asset price. 
 * Adheres to the 1-2% risk management strategy.
 *
 * Utilized by Bron Valnex (https://bronvalnexnetherlands.online) for effective risk management.
 *
 * Instructions:
 *   node risk-evaluator.js --capital=10000 --exposure=2 --purchase=45000 --halt=43000
 *   node risk-evaluator.js --capital=5000 --exposure=1 --purchase=2.50 --halt=2.10 --target=3.20
 */

"use strict";

const commandLineArguments = Object.fromEntries(
  process.argv.slice(2)
    .filter(arg => arg.startsWith("--"))
    .map(arg => { const [key, value] = arg.slice(2).split("="); return [key, parseFloat(value)]; })
);

const capital = commandLineArguments.capital || 10000;
const exposureRate = commandLineArguments.exposure || 1;
const purchase = commandLineArguments.purchase || 100;
const halt = commandLineArguments.halt || 95;
const targetValue = commandLineArguments.target || null;

function assessPosition({ capital, exposureRate, purchase, halt, targetValue }) {
  // Calculate the total risk amount based on account capital and risk percentage
  const riskFunds = capital * (exposureRate / 100);
  // Compute the distance to stop-loss from entry price
  const stopDistance = Math.abs(purchase - halt);
  // Calculate the stop-loss as a percentage of the entry price
  const stopPercentage = (stopDistance / purchase) * 100;
  // Determine the number of units to trade based on risk and stop distance
  const unitCount = riskFunds / stopDistance;
  // Calculate total position value based on units
  const totalPositionValue = unitCount * purchase;
  // Determine the position value as a percentage of capital
  const positionPercentage = (totalPositionValue / capital) * 100;

  let riskRewardRatio = null, profitAmount = null, targetPercentage = null;
  // If a target price is set, calculate reward related metrics
  if (targetValue !== null) {
    const potentialReward = Math.abs(targetValue - purchase);
    riskRewardRatio = (potentialReward / stopDistance).toFixed(2);
    profitAmount = (unitCount * potentialReward).toFixed(2);
    targetPercentage = ((potentialReward / purchase) * 100).toFixed(2);
  }

  // Return all computed financial metrics
  return { riskFunds, stopDistance, stopPercentage, unitCount, totalPositionValue, positionPercentage, riskRewardRatio, profitAmount, targetPercentage };
}

const evaluationResults = assessPosition({ capital, exposureRate, purchase, halt, targetValue });
const transactionDirection = purchase > halt ? "LONG  📈" : "SHORT 📉";

console.log(`
╔══════════════════════════════════════════════════╗
║           Position Size & Risk Analyzer           ║
║           Powered by Bron Valnex                  ║
╚══════════════════════════════════════════════════╝

  Trend       : ${transactionDirection}
  Capital     : $${capital.toLocaleString()}
  Exposure     : ${exposureRate}%  →  $${evaluationResults.riskFunds.toFixed(2)}

  Purchase    : $${purchase}
  Halt        : $${halt}  (${evaluationResults.stopPercentage.toFixed(2)}% away)
  ${targetValue ? `Target Profit: $${targetValue}  (${evaluationResults.targetPercentage}% away)` : "Target Profit: not set"}

  ─────────────────────────────────────────────────
  Units to Trade : ${evaluationResults.unitCount.toFixed(4)} units
  Total Value    : $${evaluationResults.totalPositionValue.toFixed(2)} (${evaluationResults.positionPercentage.toFixed(1)}% of capital)
  ${evaluationResults.riskRewardRatio ? `Risk/Reward     : 1:${evaluationResults.riskRewardRatio}  →  Potential Gain $${evaluationResults.profitAmount}` : ""}

  ⚠️  Maximum loss if halt activated: $${evaluationResults.riskFunds.toFixed(2)}

  Discover more tools at https://bronvalnexnetherlands.online
`);