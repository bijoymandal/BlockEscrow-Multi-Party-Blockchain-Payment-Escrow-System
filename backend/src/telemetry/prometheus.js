/**
 * Prometheus Telemetry & Metrics Exporter (OPS-603)
 * Provides standardized OpenMetrics / Prometheus scrape endpoints without heavy external agent dependencies.
 */

class PrometheusRegistry {
  constructor() {
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();

    // Default Invariant Metrics
    this.registerGauge("blockescrow_indexer_canonical_block", "Latest canonical block number observed on blockchain");
    this.registerGauge("blockescrow_indexer_last_indexed_block", "Last block number indexed into BlockEscrow database");
    this.registerGauge("blockescrow_indexer_block_lag", "Difference between canonical and indexed block height");
    this.registerGauge("blockescrow_disputes_active_gauge", "Current number of open disputes in arbitration");
    this.registerGauge("blockescrow_escrows_total_active", "Current number of active funded escrows");

    this.registerCounter("blockescrow_http_requests_total", "Total HTTP requests handled by BlockEscrow backend");
    this.registerCounter("blockescrow_rpc_failovers_total", "Total RPC provider failover events triggered");
    this.registerCounter("blockescrow_disputes_resolved_total", "Total disputes resolved by arbitrators");
    this.registerCounter("blockescrow_platform_fees_collected_total", "Total platform fees collected in basis points / wei");
  }

  registerGauge(name, help) {
    this.gauges.set(name, { help, values: new Map() });
  }

  registerCounter(name, help) {
    this.counters.set(name, { help, values: new Map() });
  }

  setGauge(name, value, labels = {}) {
    const gauge = this.gauges.get(name);
    if (!gauge) return;
    const labelKey = this._serializeLabels(labels);
    gauge.values.set(labelKey, Number(value));
  }

  incCounter(name, inc = 1, labels = {}) {
    const counter = this.counters.get(name);
    if (!counter) return;
    const labelKey = this._serializeLabels(labels);
    const curr = counter.values.get(labelKey) || 0;
    counter.values.set(labelKey, curr + Number(inc));
  }

  getGauge(name, labels = {}) {
    const gauge = this.gauges.get(name);
    if (!gauge) return undefined;
    const labelKey = this._serializeLabels(labels);
    return gauge.values.get(labelKey);
  }

  getCounter(name, labels = {}) {
    const counter = this.counters.get(name);
    if (!counter) return 0;
    const labelKey = this._serializeLabels(labels);
    return counter.values.get(labelKey) || 0;
  }

  updateIndexerLag(canonicalBlock, indexedBlock) {
    this.setGauge("blockescrow_indexer_canonical_block", canonicalBlock);
    this.setGauge("blockescrow_indexer_last_indexed_block", indexedBlock);
    const lag = Math.max(0, Number(canonicalBlock) - Number(indexedBlock));
    this.setGauge("blockescrow_indexer_block_lag", lag);
    return lag;
  }

  _serializeLabels(labels) {
    const keys = Object.keys(labels).sort();
    if (keys.length === 0) return "";
    return keys.map((k) => `${k}="${labels[k]}"`).join(",");
  }

  /**
   * Generates standard Prometheus text format output.
   */
  metrics() {
    const lines = [];

    // Render Gauges
    for (const [name, meta] of this.gauges) {
      lines.push(`# HELP ${name} ${meta.help}`);
      lines.push(`# TYPE ${name} gauge`);
      if (meta.values.size === 0) {
        lines.push(`${name} 0`);
      } else {
        for (const [labelStr, val] of meta.values) {
          const formatted = labelStr ? `${name}{${labelStr}}` : name;
          lines.push(`${formatted} ${val}`);
        }
      }
    }

    // Render Counters
    for (const [name, meta] of this.counters) {
      lines.push(`# HELP ${name} ${meta.help}`);
      lines.push(`# TYPE ${name} counter`);
      if (meta.values.size === 0) {
        lines.push(`${name} 0`);
      } else {
        for (const [labelStr, val] of meta.values) {
          const formatted = labelStr ? `${name}{${labelStr}}` : name;
          lines.push(`${formatted} ${val}`);
        }
      }
    }

    return lines.join("\n") + "\n";
  }

  reset() {
    for (const gauge of this.gauges.values()) {
      gauge.values.clear();
    }
    for (const counter of this.counters.values()) {
      counter.values.clear();
    }
  }
}

const defaultRegistry = new PrometheusRegistry();

module.exports = {
  PrometheusRegistry,
  metricsRegistry: defaultRegistry,
};
