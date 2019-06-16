/*
 * moleculer
 * Copyright (c) 2019 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

"use strict";

const BaseReporter = require("./base");
const _ = require("lodash");
const dgram = require("dgram");
const METRIC = require("../constants");

/**
 * UDP (StatsD) reporter for Moleculer.
 *
 */
class StatsDReporter extends BaseReporter {

	/**
	 * Constructor of StatsDReporters
	 *
	 * @param {Object} opts
	 * @memberof StatsDReporter
	 */
	constructor(opts) {
		super(opts);

		this.opts = _.defaultsDeep(this.opts, {
			protocol: "udp",
			host: "localhost",
			port: 8125,

			maxPayloadSize: 1300,

			interval: 5 * 1000
		});
	}

	/**
	 * Initialize reporter.
	 *
	 * @param {MetricRegistry} registry
	 * @memberof StatsDReporter
	 */
	init(registry) {
		super.init(registry);

		if (this.opts.interval > 0) {
			this.timer = setInterval(() => this.flush(), this.opts.interval);
			this.timer.unref();
		}
	}

	/**
	 * Flush metric data
	 *
	 * @memberof StatsDReporter
	 */
	flush() {
		const series = this.generateStatsDSeries();

		if (series.length == 0) return;

		this.sendChunks(series);
	}

	/**
	 * Create & send chunks.
	 *
	 * @param {Array<Object>} series
	 */
	sendChunks(series) {
		let len = 0;

		const chunks = [];

		while (series.length > 0 && (!this.opts.maxPayloadSize || len < this.opts.maxPayloadSize)) {
			const item = series.shift();
			chunks.push(item);
			len += item.length;
		}

		if (chunks.length > 0) {
			this.send(Buffer.from(chunks.join("\n")));
		}

		if (series.length > 0) {
			setTimeout(() => this.sendChunks(series), 100);
		}
	}

	/**
	 * Send concatenated data to StatsD server via UDP
	 *
	 * @param {Buffer} buf
	 */
	send(buf) {
		//this.logger.info("Buffer\n" + buf.toString());
		const sock = dgram.createSocket("udp4");
		sock.send(buf, 0, buf.length, this.opts.port, this.opts.host, (err, bytes) => {
			if (err) {
				this.logger.warn("Unable to send metrics to StatsD server. Error:" + err.message, err);
			} else {
				this.logger.debug("Metrics are uploaded to StatsD. Sent bytes:", bytes);
			}

			sock.close();
		});
	}

	/**
	 * Generate metric data.
	 *
	 * @returns {Array<Object>}
	 * @memberof StatsDReporter
	 */
	generateStatsDSeries() {
		const series = [];

		const list = this.registry.list({
			types: this.opts.types,
			includes: this.opts.includes,
			excludes: this.opts.excludes,
		});

		list.forEach(metric => {
			if (metric.values.size == 0)
				return;

			metric.values.forEach(item => {
				if (item.value == null) return;

				const metricName = this.formatMetricName(metric.name);

				switch(metric.type) {
					case METRIC.TYPE_COUNTER: {
						let line = `${metricName}:${item.value}|c`;
						if (metric.labelNames.length > 0)
							line += "|#" + this.labelsToTags(item.labels);
						series.push(line);

						break;
					}
					case METRIC.TYPE_GAUGE: {
						let line = `${metricName}:${item.value}|g`;
						if (metric.labelNames.length > 0)
							line += "|#" + this.labelsToTags(item.labels);
						series.push(line);

						break;
					}
					case METRIC.TYPE_INFO: {
						let line = `${metricName}:${_.isNumber(item.value) ? item.value : "\"" + item.value + "\""}|s`;
						if (metric.labelNames.length > 0)
							line += "|#" + this.labelsToTags(item.labels);
						series.push(line);

						break;
					}
					case METRIC.TYPE_HISTOGRAM: {
						/*
						if (item.buckets) {
							Object.keys(item.buckets).forEach(le => {
								series.push({
									metric: this.formatMetricName(metric.name + ".bucket_" + le),
									type: "rate",
									points: [[now, item.buckets[le]]],
									tags: this.labelsToTags(item.labels),
									host: this.opts.host
								});
							});
							// +Inf
							series.push({
								metric: this.formatMetricName(metric.name + ".bucket_inf"),
								type: "rate",
								points: [[now, item.count]],
								tags: this.labelsToTags(item.labels),
								host: this.opts.host
							});
						}

						if (item.quantiles) {

							Object.keys(item.quantiles).forEach(key => {
								series.push({
									metric: this.formatMetricName(metric.name + ".q" + key),
									type: "rate",
									points: [[now, item.quantiles[key]]],
									tags: this.labelsToTags(item.labels),
									host: this.opts.host
								});
							});

							// Add other calculated values
							series.push({
								metric: this.formatMetricName(metric.name + ".sum"),
								type: "rate",
								points: [[now, item.sum]],
								tags: this.labelsToTags(item.labels),
								host: this.opts.host
							});

							series.push({
								metric: this.formatMetricName(metric.name + ".count"),
								type: "rate",
								points: [[now, item.count]],
								tags: this.labelsToTags(item.labels),
								host: this.opts.host
							});

							series.push({
								metric: this.formatMetricName(metric.name + ".min"),
								type: "rate",
								points: [[now, item.min]],
								tags: this.labelsToTags(item.labels),
								host: this.opts.host
							});

							series.push({
								metric: this.formatMetricName(metric.name + ".mean"),
								type: "rate",
								points: [[now, item.mean]],
								tags: this.labelsToTags(item.labels),
								host: this.opts.host
							});

							series.push({
								metric: this.formatMetricName(metric.name + ".variance"),
								type: "rate",
								points: [[now, item.variance]],
								tags: this.labelsToTags(item.labels),
								host: this.opts.host
							});

							series.push({
								metric: this.formatMetricName(metric.name + ".stddev"),
								type: "rate",
								points: [[now, item.stdDev]],
								tags: this.labelsToTags(item.labels),
								host: this.opts.host
							});

							series.push({
								metric: this.formatMetricName(metric.name + ".max"),
								type: "rate",
								points: [[now, item.max]],
								tags: this.labelsToTags(item.labels),
								host: this.opts.host
							});

						}
*/
						break;
					}
				}
			});
		});

		return series;
	}

	/**
	 * Escape label value characters.
	 * @param {String} str
	 * @returns {String}
	 * @memberof DatadogReporter
	 */
	escapeLabelValue(str) {
		if (typeof str == "string")
			return str.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
		return str;
	}

	/**
	 * Convert labels to Prometheus label string
	 *
	 * @param {Object} itemLabels
	 * @returns {Array<String>}
	 *
	 * @memberof StatsDReporter
	 */
	labelsToTags(itemLabels) {
		const labels = Object.assign({}, this.defaultLabels || {}, itemLabels || {});
		const keys = Object.keys(labels);
		if (keys.length == 0)
			return [];

		return keys.map(key => `${this.formatLabelName(key)}:${this.escapeLabelValue(labels[key])}`).join(",");
	}

}

module.exports = StatsDReporter;
