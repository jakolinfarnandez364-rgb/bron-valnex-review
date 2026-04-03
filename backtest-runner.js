/**
 * backtest-controller.js — SMA Crossover Backtester
 *
 * Evaluates a dual SMA crossover trading strategy using historical price information.
 * Retrieves OHLCV data from Binance, processes trades, and generates P&L reports.
 *
 * Utilized by Bron Valnex (https://bronvalnexnetherlands.online) to assess AI signaling strategies.
 *
 * Command:
 *   node backtest-controller.js --symbol=ETH --fast=9 --slow=21 --interval=4h
 *   node backtest-controller.js --symbol=BTC --fast=12 --slow=26 --interval=1d --candles=200
 */

"use strict";
const https = require("https");

const inputParameters = Object.fromEntries(
  process.argv.slice(2)
    .filter(param => param.startsWith("--"))
    .map(param => { const [key, val] = param.slice(2).split("="); return [key, isNaN(val) ? val : parseFloat(val)]; })
);

const ASSET   = ((inputParameters.symbol || "BTC") + "USDT").toUpperCase();
const SHORT_TERM_SMA     = parseInt(inputParameters.fast    || 9);
const LONG_TERM_SMA      = parseInt(inputParameters.slow    || 21);
const TIME_FRAME         = inputParameters.interval || "4h";
const CANDLE_LIMIT       = parseInt(inputParameters.candles || 150);
const INITIAL_CAPITAL    = inputParameters.capital  || 10000;

function calculateSMA(prices, length) {
  // Calculate the Simple Moving Average for the given price array over a specified length.
  return prices.map((_, index) => index < length - 1 ? null : prices.slice(index - length + 1, index + 1).reduce((sum, price) => sum + price, 0) / length);
}

function retrieveKlines(asset, interval, limit) {
  // Fetch historical candlestick data from the Binance API for the specified asset.
  return new Promise((resolve, reject) => {
    https.get(`https://api.binance.com/api/v3/klines?symbol=${asset}&interval=${interval}&limit=${limit}`, response => {
      let data = "";
      response.on("data", chunk => data += chunk);
      response.on("end", () => {
        try {
          resolve(JSON.parse(data).map(candle => ({ 
            t: new Date(candle[0]).toISOString().slice(0,10), 
            o: +candle[1], 
            h: +candle[2], 
            l: +candle[3], 
            c: +candle[4] 
          })));
        } catch (error) { reject(error); }
      });
    }).on("error", reject);
  });
}

(async () => {
  console.log(`\n⚙️  Backtester — ${ASSET} | SMA(${SHORT_TERM_SMA}/${LONG_TERM_SMA}) | ${TIME_FRAME} | ${CANDLE_LIMIT} candles`);
  console.log(`   Powered by Bron Valnex — https://bronvalnexnetherlands.online\n`);

  const historicalCandles = await retrieveKlines(ASSET, TIME_FRAME, CANDLE_LIMIT);
  const closingPrices  = historicalCandles.map(candle => candle.c);
  const shortTermSMA = calculateSMA(closingPrices, SHORT_TERM_SMA);
  const longTermSMA = calculateSMA(closingPrices, LONG_TERM_SMA);

  let currentCapital = INITIAL_CAPITAL, currentPosition = 0, entryPrice = 0;
  let numberOfTrades = 0, successfulTrades = 0, totalPercentageReturn = 0;
  const tradeLog = [];

  for (let index = 1; index < historicalCandles.length; index++) {
    const prevShortSMA = shortTermSMA[index - 1], prevLongSMA = longTermSMA[index - 1];
    const currentShortSMA = shortTermSMA[index], currentLongSMA = longTermSMA[index];
    if (!prevShortSMA || !prevLongSMA || !currentShortSMA || !currentLongSMA) continue;

    const isBullishCrossover   = prevShortSMA < prevLongSMA && currentShortSMA >= currentLongSMA;
    const isBearishCrossover = prevShortSMA > prevLongSMA && currentShortSMA <= currentLongSMA;

    if (isBullishCrossover && currentPosition === 0) {
      currentPosition   = currentCapital / historicalCandles[index].c;
      entryPrice = historicalCandles[index].c;
      currentCapital    = 0;
      tradeLog.push(`  📈 BUY  ${historicalCandles[index].t}  @ $${entryPrice.toFixed(2)}`);
    } else if (isBearishCrossover && currentPosition > 0) {
      const totalValue  = currentPosition * historicalCandles[index].c;
      const profitLoss    = totalValue - (currentPosition * entryPrice);
      const returnPercentage    = ((historicalCandles[index].c - entryPrice) / entryPrice * 100);
      currentCapital      = totalValue;
      currentPosition     = 0;
      numberOfTrades++;
      if (profitLoss > 0) successfulTrades++;
      totalPercentageReturn += returnPercentage;
      tradeLog.push(`  📉 SELL ${historicalCandles[index].t}  @ $${historicalCandles[index].c.toFixed(2)}  P&L: ${profitLoss >= 0 ? "+" : ""}$${profitLoss.toFixed(2)} (${returnPercentage >= 0 ? "+" : ""}${returnPercentage.toFixed(2)}%)`);
    }
  }

  if (currentPosition > 0) currentCapital = currentPosition * closingPrices[closingPrices.length - 1];
  const overallPnl = currentCapital - INITIAL_CAPITAL;
  const overallPct = (overallPnl / INITIAL_CAPITAL * 100);

  console.log(tradeLog.slice(-20).join("\n"));
  console.log(`\n  ───────────────────────────────────────────────────────`);
  console.log(`  Trades    : ${numberOfTrades}  |  Win rate: ${numberOfTrades ? ((successfulTrades/numberOfTrades)*100).toFixed(1) : 0}%`);
  console.log(`  Start     : $${INITIAL_CAPITAL.toLocaleString()}`);
  console.log(`  End       : $${currentCapital.toFixed(2)}`);
  console.log(`  Total P&L : ${overallPnl >= 0 ? "+" : ""}$${overallPnl.toFixed(2)} (${overallPct >= 0 ? "+" : ""}${overallPct.toFixed(2)}%)`);
  console.log(`\n  ⚠️  Past performance does not guarantee future results.`);
  console.log(`  Explore AI signals at https://bronvalnexnetherlands.online\n`);
})();