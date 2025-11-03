# Polling Configuration Guide

## Current Configuration: Long-Period Randomized Polling

The system now supports two polling modes:

### 🔄 **Mode 1: Short-Period Randomized (Legacy)**
```json
"randomPolling": {
  "enabled": false
}
```
- **Interval**: 48-72 seconds (±20% of 60s base)
- **Use case**: Frequent monitoring, higher detection risk
- **Good for**: Testing or high-frequency strategies

### 🕐 **Mode 2: Long-Period Randomized (Current)**
```json
"randomPolling": {
  "enabled": true,
  "minInterval": 3600000,    // 1 hour minimum
  "maxInterval": 7200000,    // 2 hour maximum  
  "minGapBetweenChecks": 1800000  // 30 min minimum gap
}
```
- **Interval**: 1-2 hours apart, minimum 30min gap
- **Use case**: Human-like behavior, very low detection risk
- **Good for**: Long-term automated trading

## 🎯 **Customization Examples:**

### Conservative (2-4 hours):
```json
"minInterval": 7200000,     // 2 hours
"maxInterval": 14400000,    // 4 hours
"minGapBetweenChecks": 3600000  // 1 hour gap
```

### Moderate (30min-2hours):
```json
"minInterval": 1800000,     // 30 minutes
"maxInterval": 7200000,     // 2 hours
"minGapBetweenChecks": 900000   // 15 min gap
```

### Active (15min-1hour):
```json
"minInterval": 900000,      // 15 minutes
"maxInterval": 3600000,     // 1 hour
"minGapBetweenChecks": 600000   // 10 min gap
```

## 🛡️ **Anti-Detection Benefits:**

- **Unpredictable timing**: No fixed patterns
- **Human-like gaps**: Natural spacing between checks
- **Configurable intensity**: Adjust for your risk tolerance
- **Prevents clustering**: Minimum gap enforcement