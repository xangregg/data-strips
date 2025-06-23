import SI from './shortestIntervals.js';
import hdr from './hdr.js';
import Data from './sampleData.js';

const svg = d3.select('#plot');
const width = +svg.attr('width');
const rowLabelWidth = 150;

const xDomain = [-3, 13];
const xScale = d3.scaleLinear().domain(xDomain).range([rowLabelWidth + 10, width - 10]);

function getControlValues() {
    return {
        groupA: {
            dist: document.getElementById('distA').value,
            mean: +document.getElementById('meanA').value,
            std: +document.getElementById('stdA').value,
            count: +document.getElementById('countA').value,
        },
        groupB: {
            dist: document.getElementById('distB').value,
            mean: +document.getElementById('meanB').value,
            std: +document.getElementById('stdB').value,
            count: +document.getElementById('countB').value,
        },
        splitPenalty: +document.getElementById('splitPenalty').value,
        randomSeed: +document.getElementById('randomSeed').value,
    };
}

const rowPlotTop = 10;
const rowPlotHeight = 30;
const rowPlotGap = 15;

// dark orange #d86a18
const rowPlots = [
    {
        label: 'Heatmap', height: 1.0, draw: drawHeatmapPlot, color: '#2171b5',
        levels: [15], // number of intervals
        description: `Heatmap of fixed-sized intervals colored by relative count.
         When grouped, one must decide if the count scale is the same for all of them.
         Intervals with few values (2 or less) also show those values as dots.`
    },
    {
        label: 'KDE', height: 1.4, draw: drawKDEs, color: '#999',
        levels: [0.25, 1.0],   // bandwidth multipliers
        description: `Kernel Density Estimation using a gaussian kernel and multiple bandwidths.`
    },
    {
        label: 'Rug', height: 0.4, draw: drawRug, color: '#333',
        levels: [],
        description: `Rug plot with a vertical line at each data point, up to 2000 points.`
    },
    {
        label: 'Density Strip', height: 1.0, draw: drawStripPlot, color: '#444',
        levels: [0.5],  // kde bandwidth multiplier
        description: `Kernel Density Estimation using color and a bandwidth multiplier of 50%.`
    },
    {
        label: 'HDR', height: 1.0, draw: drawDensityBands, color: '#2171b5',
        levels: [0.0, 0.5, 0.95, 0.99],
        description: `Highest Density Regions plot with cut-off points at 0.0, 0.5, 0.95, and 0.99.
        Values beyond the widest region are shown as outlier dots.`
    },
    {
        label: 'Adaptive HDR', height: 1.0, draw: drawDensityBands, color: '#238b45',
        levels: [0.0, 0.5, 1.0],
        description: `Highest Density Regions plot with cut-off points at 0.0, 0.5,
         and an adaptive outlier threshold based on a gaussian extrapolation of the middle region.
         Values beyond the outlier threshold are shown as dots.`
    },
    // {
    //     label: 'Shortest Half', height: 1.0, draw: drawDensityBands, color: '#238b45',
    //     levels: [0.5, 1],
    //     description: 'The shortest contiguous half that contains at least 50% of the data.'
    // },
    {
        label: 'Shortest Halves', height: 1.0, draw: drawDensityBands, color: '#238b45',
        levels: [0, 0.0625, 0.125, 0.25, 0.5, 1],
        description: `The shortest contiguous half that contains at least 50% of the data, applied iteratively to show 1/2, 1/4, 1/8, 1/16 and the shortest half mode.
         The widest interval shows an adaptive outlier threshold based on a gaussian extrapolation of the 50% region.
         Values beyond the outlier threshold are shown as dots.`
    },
    // {
    //     label: 'Shortest 25/50/95', height: 1.0, draw: drawDensityBands, color: '#238b45',
    //     levels: [0.25, 0.5, 0.95],
    //     description: 'Shortest regions of 25%, 50%, and 95% of the data, allowing for split regions penalized according to the Split Penalty.'
    // },
    {
        label: 'Equal Gaussian', height: 1.0, draw: drawDensityBands, color: '#238b45',
        levels: [0.5, 1.5, 2.5],
        description: `Quantile regions at percentiles that correspond to equal intervals if the data is Gaussian. Each region would be one standard deviation wide.
         Values beyond an adaptive outlier threshold based on a gaussian extrapolation of the middle region are shown as dots. Remaining non-empty data regions (quasi-outliers) are shown as reduced-height filled regions.`
    },
    {
        label: 'Density Rug', height: 1.0, draw: drawDensityBands, color: '#238b45',
        levels: [0.2, 0.5, 0.8],
        description: `Shortest regions of 20%, 50%, and 80% of the data, allowing for split regions penalized according to the Split Penalty.
         Other values are shown as a rug plot, except touching values are connected as a single region to avoid looking more dense than the shortest regions.`
    },
    {
        label: 'Shorth and Mode', height: 1.0, draw: drawDensityBands, color: '#238b45',
        levels: [0, 0.5, 1],
        description: `Shortest half of the data as one or two contiguous intervals; any split is penalized according to the Split Penalty.
         A vertical line shows the "half sample mode" which is the iteratively applied shortest half.
         The outer interval extends to an adaptive outlier threshold based on a gaussian extrapolation of the 50% region.
         Values beyond the outer interval are shown as dots.`
    },
    {
        label: 'IQR and Median', height: 1.0, draw: drawDensityBands, color: '#238b45',
        levels: [0, 0.5, 0.993], //  only used for coloring, box plot quantiles are used instead
        description: `Inner region shows Interquartile Range (IQR) of the data with a line at the median.
         The outer interval extends to an adaptive outlier threshold based on a gaussian extrapolation of the IQR region.
         Values beyond the outer interval are shown as dots.`
    },
    {
        label: 'Adaptive Box', height: 0.8, draw: drawBoxPlot, color: '#238b45', // light green '#D6E8D8'
        levels: [0, 0.5, 0.993], //  only used for coloring, box plot quantiles are used instead
        description: `Inner region shows Interquartile Range (IQR) of the data with a line at the median.
         The outer interval extends to an adaptive outlier threshold based on a gaussian extrapolation of the IQR region.
         When the outer region extends beyond the common box plot whiskers (1.5 IQR), the endcaps are shown as arcs.
         Values beyond the outer interval are shown as dots.`
    },
    {
        label: 'Tukey Box', height: 0.8, draw: drawBoxPlot, color: '#444',
        levels: [0, 0.5, 0.993], //  only used for coloring, box plot quantiles are used instead
        description: `Inner region shows Interquartile Range (IQR) of the data with a line at the median.
         The outer interval extends to the farthest point within 1.5 IQR of the inner region.
         Values beyond the outer interval are shown as dots.`
    },
];

function getStdPercentiles(data, levels) {
    const df = data.length - 1;
    return levels.map(k => {
        const upper = jStat.studentt.cdf(k, df);
        const lower = jStat.studentt.cdf(-k, df);
        return upper - lower;
    });
}

function getPercentiles(data, plotInfo) {
    if (plotInfo.label.includes('Gaussian'))
        return getStdPercentiles(data, plotInfo.levels);
    return plotInfo.levels;
}

function getPercentileColors(percentiles, dark) {
    const light = '#fff';
    const colorRamp = d3.interpolateLab(dark, light);
    // darkest to lightest
    if (percentiles.length === 2)
        return [colorRamp(0.333), colorRamp(0.8)];
    if (percentiles.length === 3)
        return [colorRamp(0), colorRamp(0.333), colorRamp(0.8)];
    if (percentiles.length === 4)
        return [colorRamp(0), colorRamp(0.3), colorRamp(0.6), colorRamp(0.8)];
    if (percentiles.length === 5)
        return [colorRamp(0), colorRamp(0.2), colorRamp(0.4), colorRamp(0.6), colorRamp(0.8)];
    return [colorRamp(0), colorRamp(0.2), colorRamp(0.35), colorRamp(0.50), colorRamp(0.65), colorRamp(0.8)];
}

function drawRowLabel(label, y, height) {
    svg.append('text')
        .attr('class', 'row-label')
        .attr('x', rowLabelWidth)
        .attr('y', y + (height / 2))
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '16px')
        .attr('fill', '#222')
        .text(label);
}

function draw(controlPanelParams) {
    svg.selectAll('*').remove();
    const sortedData = generateCompositeData(controlPanelParams);

    let y = rowPlotTop;
    for (const rowPlotInfo of rowPlots) {
        if (rowPlotInfo.label === 'Rug')
            y -= rowPlotGap;  // no gap between KDE and rug
        const rh = rowPlotHeight * rowPlotInfo.height;
        rowPlotInfo.draw(sortedData, y, rh, rowPlotInfo);
        drawRowLabel(rowPlotInfo.label, y, rh);
        y += rh + rowPlotGap;
    }
}

function drawRug(sorted, y, height, plotInfo) {
    if (sorted.length > 2000) {
        sorted = sorted.slice(0, 200).concat(sorted.slice(-200)); // for drawing performance
    }
    svg.selectAll('line.rug')
        .data(sorted)
        .join('line')
        .attr('x1', d => xScale(d))
        .attr('x2', d => xScale(d))
        .attr('y1', y)
        .attr('y2', y + height)
        .attr('stroke', plotInfo.color)
        .attr('stroke-width', 1);
}

function scaleFactorForPercentile(p, df) {
    const z = jStat.studentt.inv(0.5 + p / 2, df); // e.g., 0.5 ± 0.25 for p=0.5
    return 1 / z;
}

function extrapolatedGaussianRange1(sorted, centralP, centralBand, centralEstimate, nCentral, expectedCount = 0.5) {
    const n = sorted.length;
    if (n === 0 || centralP === 0) return null;
    if (n === 1) return [sorted[0], sorted[0]];

    const [x0, x1] = centralBand;
    const nExtrapolated = Math.round(nCentral / centralP);
    const spread = x1 - x0;
    if (spread === 0)
        return [x0, x1];
    const centerPadding = spread * 0.25;  // avoid singularities for center at edge
    const center = Math.max(x0 + centerPadding, Math.min(x1 - centerPadding, centralEstimate));
    const leftSpread = center - x0;
    const rightSpread = x1 - center;

    // Compute multiplier using t-distribution
    const alpha = expectedCount / nExtrapolated;
    const p = 1 - alpha / 2;
    const df = Math.max(nExtrapolated - 1, 1); // avoid 0 or negative degrees of freedom
    const k = jStat.studentt.inv(p, df);

    const scale = scaleFactorForPercentile(centralP, df);

    const lower = center - k * leftSpread * scale;
    const upper = center + k * rightSpread * scale;

    return [lower, upper];
}

// given central bands, assume each band is p% of some gaussian population
// and compute the expected range of the extrapolated sample
// if centralEstimate is not in the middle of the band, separate left and right extrapolation occurs
function extrapolatedGaussianRange(sorted, centralP, centralBands, centralEstimate, expectedCount = 0.5) {
    const n = sorted.length;
    if (n === 0) return null;
    if (n === 1) return [sorted[0], sorted[0]];

    let nCentral = centralBands.reduce((acc, cb) => acc + d3.bisectRight(sorted, cb[1]) - d3.bisectLeft(sorted, cb[0]), 0);
    let lo = sorted[n - 1];
    let hi = sorted[0];
    for (const cb of centralBands) {
        const ce = centralEstimate >= cb[0] && centralEstimate <= cb[1] ? centralEstimate : (cb[0] + cb[1]) / 2;
        const nb = d3.bisectRight(sorted, cb[1]) - d3.bisectLeft(sorted, cb[0]);
        if (nb > 0) {
            const [lo1, hi1] = extrapolatedGaussianRange1(sorted, centralP, cb, ce, nb, expectedCount * (nb / nCentral));
            lo = Math.min(lo, lo1);
            hi = Math.max(hi, hi1);
        }
    }
    // snap to data value
    lo = sorted[d3.bisectLeft(sorted, lo)];
    hi = sorted[d3.bisectRight(sorted, hi) - 1];
    return [lo, hi];
}


function computeBoxPlotStats(sorted) {
    const q1 = d3.quantileSorted(sorted, 0.25);
    const median = d3.quantileSorted(sorted, 0.5);
    const q3 = d3.quantileSorted(sorted, 0.75);
    const iqr = q3 - q1;

    const lowerLimit = q1 - 1.5 * iqr;
    const upperLimit = q3 + 1.5 * iqr;

    const lowerIndex = d3.bisectLeft(sorted, lowerLimit);
    const upperIndex = d3.bisectRight(sorted, upperLimit) - 1;

    const lowerWhisker = sorted[lowerIndex];
    const upperWhisker = sorted[upperIndex];

    return {q1, median, q3, iqr, lowerWhisker, upperWhisker};
}

function drawBoxPlot(sorted, y, height, plotInfo) {
    const capHeight = height * 2 / 3;
    const ym = y + height / 2;
    let outlierBand = plotInfo.label.includes('Adaptive') ? extrapolatedGaussianRange(sorted, 0.5, [[boxPlotStats.q1, boxPlotStats.q3]], boxPlotStats.median, expectedOutlierCount) : null;
    const extendLower = outlierBand && outlierBand[0] < boxPlotStats.lowerWhisker;
    const extendUpper = outlierBand && outlierBand[1] > boxPlotStats.upperWhisker;
    const loWhisker = extendLower ? outlierBand[0] : boxPlotStats.lowerWhisker;
    const upWhisker = extendUpper ? outlierBand[1] : boxPlotStats.upperWhisker;
    if (extendLower) {
        // Curved adaptive outlier caps
        const cw = capHeight / 5;
        const ch = capHeight / 2;
        const x = xScale(loWhisker);
        const leftCurve = `M${x + cw},${ym - ch} 
                     Q${x},${ym - ch / 2} ${x},${ym}
                     Q${x},${ym + ch / 2} ${x + cw},${ym + ch}`;
        svg.append("path")
            .attr("d", leftCurve)
            .attr("fill", "none")
            .attr("stroke", plotInfo.color)
            .attr("stroke-width", 1);
    } else {
        // IQR Caps
        svg.append('line')
            .attr('x1', xScale(boxPlotStats.lowerWhisker))
            .attr('x2', xScale(boxPlotStats.lowerWhisker))
            .attr('y1', ym - capHeight / 2)
            .attr('y2', ym + capHeight / 2)
            .attr('stroke', plotInfo.color);
    }
    if (extendUpper) {
        // Curved adaptive outlier caps
        const cw = capHeight / 5;
        const ch = capHeight / 2;
        const x = xScale(upWhisker);
        const curve = `M${x - cw},${ym - ch} 
                     Q${x},${ym - ch / 2} ${x},${ym}
                     Q${x},${ym + ch / 2} ${x - cw},${ym + ch}`;
        svg.append("path")
            .attr("d", curve)
            .attr("fill", "none")
            .attr("stroke", plotInfo.color)
            .attr("stroke-width", 1);
    } else {
        // IQR Caps
        svg.append('line')
            .attr('x1', xScale(boxPlotStats.upperWhisker))
            .attr('x2', xScale(boxPlotStats.upperWhisker))
            .attr('y1', ym - capHeight / 2)
            .attr('y2', ym + capHeight / 2)
            .attr('stroke', plotInfo.color);

    }
    // Whiskers
    svg.append('line')
        .attr('x1', xScale(loWhisker))
        .attr('x2', xScale(boxPlotStats.q1))
        .attr('y1', ym)
        .attr('y2', ym)
        .attr('stroke', plotInfo.color);
    svg.append('line')
        .attr('x1', xScale(boxPlotStats.q3))
        .attr('x2', xScale(upWhisker))
        .attr('y1', ym)
        .attr('y2', ym)
        .attr('stroke', plotInfo.color);

    // Box
    svg.append('rect')
        .attr('x', xScale(boxPlotStats.q1))
        .attr('y', y)
        .attr('width', xScale(boxPlotStats.q3) - xScale(boxPlotStats.q1))
        .attr('height', height)
        .attr('fill', d3.interpolateLab('white', plotInfo.color)(0.1))
        .attr('stroke', plotInfo.color);

    // Median line
    svg.append('line')
        .attr('x1', xScale(boxPlotStats.median))
        .attr('x2', xScale(boxPlotStats.median))
        .attr('y1', y)
        .attr('y2', y + height)
        .attr('stroke', plotInfo.color)
        .attr('stroke-width', 2);

    const lowerIndex = d3.bisectLeft(sorted, loWhisker);
    const upperIndex = d3.bisectRight(sorted, upWhisker) - 1;
    let outliers = d3.range(0, lowerIndex).concat(d3.range(upperIndex + 1, sorted.length));
    drawOutliers(outliers, sorted, y, height, plotInfo, d3.interpolateLab('white', plotInfo.color)(0.8));
}

function drawKDE(svg, xScale, yScale, yTop, yHeight, density, color) {
    const area = d3.area()
        .curve(d3.curveBasis)
        .x(d => xScale(d.x))
        .y0(yTop + yHeight) // bottom of area
        .y1(d => yScale(d.y));

    svg.append('path')
        .datum(density)
        .attr('d', area)
        .attr('fill', color)
        .attr('opacity', 0.333)
        .attr('stroke', '#666')
        .attr('stroke-width', 1);
}

function drawKDEs(sorted, y, height, plotInfo) {
    // Rescale y for visual plotting
    let yMaxAll = 0;
    let densities = plotInfo.levels.map(level => dataDensity(sorted, level, 200));
    densities.forEach((density) => {
        const yMax = d3.max(density, d => d.y) * 1.1;  // allow room for detailDensity
        yMaxAll = Math.max(yMax, yMaxAll);
    });
    const yScale = d3.scaleLinear().domain([0, yMaxAll]).range([y + height, y]); // top space
    densities.forEach((density) => {
        drawKDE(svg, xScale, yScale, y, height, density, plotInfo.color);
    });
}

function kernelDensityEstimator(kernel, xValues) {
    return function (sample) {
        return xValues.map(x => {
            const y = d3.mean(sample, v => kernel(x - v));
            return {x, y};
        });
    };
}

function gaussianKernel(scale) {
    return function (u) {
        return (1 / (scale * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * (u / scale) ** 2);
    };
}

function epanechnikov(bandwidth) {
    return x => Math.abs(x /= bandwidth) <= 1 ? 0.75 * (1 - x * x) / bandwidth : 0;
}

function silvermanBandwidth(data) {
    const stdDev = d3.deviation(data);
    const n = data.length;
    return 1.06 * stdDev * Math.pow(n, -1 / 5);
}

function dataDensity(sorted, bandwidthScale = 1.0, nSubIntervals = 100, pad = 0.01) {
    // Estimate density, can use a smaller bandwidth that default for diagnostic use
    const [dataMin, dataMax] = d3.extent(sorted);
    const dataWidth = dataMax - dataMin;
    const kernelMin = dataMin - dataWidth * pad;
    const kernelMax = dataMax + dataWidth * pad;
    const bandwidth = silvermanBandwidth(sorted) * bandwidthScale;
    const xVals = [...d3.range(kernelMin, kernelMax, (kernelMax - kernelMin) / nSubIntervals), kernelMax];
    const kde = kernelDensityEstimator(gaussianKernel(bandwidth), xVals);
    return kde(sorted);
}

function drawStripPlot(sorted, y, height, plotInfo) {
    const density = dataDensity(sorted, plotInfo.levels[0], 200);
    const maxDensity = d3.max(density, d => d.y);
    const colorRamp = d3.interpolateLab('white', plotInfo.color);

    for (const {x: xVal, y: dVal} of density) {
        const x0 = xScale(xVal);
        const x1 = xScale(xVal + (xScale.domain()[1] - xScale.domain()[0]) / 200);
        svg.append('rect')
            .attr('x', x0)
            .attr('y', y)
            .attr('width', (x1 - x0) + 0.5)  // a little extra to avoid cracks
            .attr('height', height)
            .attr('fill', colorRamp(dVal / maxDensity));
    }
}

function drawHeatmapPlot(sorted, y, height, plotInfo) {
    // function drawHeatmap(svg, x, rowY, heatmapHeight, sorted, numBins, darkColor) {
    const numBins = plotInfo.levels[0];
    const bins = d3.bin()
        .domain(xScale.domain())
        .thresholds(numBins)(sorted);

    const maxCount = d3.max(bins, d => d.length);
    const colorRamp = d3.interpolateLab('white', plotInfo.color);

    bins.forEach(bin => {
        svg.append('rect')
            .attr('x', xScale(bin.x0))
            .attr('y', y)
            .attr('width', xScale(bin.x1) - xScale(bin.x0))
            .attr('height', height)
            .attr('fill', colorRamp(bin.length / maxCount));
    });

    bins.forEach(bin => {
        if (bin.length < 3) {
            for (const d of bin) {
                svg.append('circle')
                    .attr('cx', xScale(d))
                    .attr('cy', y + height / 2) // vertically center in band
                    .attr('r', 3)
                    .attr('fill', colorRamp(0.5));
            }
        }
    });

}

function drawOutliers(outliers, sorted, y, height, plotInfo, color) {
    const jitter = Math.min(height * 0.4, Math.sqrt(Math.max(0, outliers.length - 10)));
    // console.log(label, jitter);
    for (const i of outliers) {
        if (plotInfo.label.includes('Rug'))
            svg.append('line')
                .attr('x1', xScale(sorted[i]))
                .attr('x2', xScale(sorted[i]))
                .attr('y1', y)
                .attr('y2', y + height)
                .attr('opacity', 0.3)
                .attr('stroke', color)
                .attr('stroke-width', 2);
        else
            svg.append('circle')
                .attr('cx', xScale(sorted[i]))
                .attr('cy', y + height / 2 + (jitter > 0 ? d3.randomUniform(-jitter, jitter)() : 0)) // vertically center in band
                .attr('r', 3)
                .attr('opacity', 0.5)
                .attr('fill', color);
    }
}

function drawBandOrSliver(x0, x1, y, height, color) {
    if (x0 > x1) {
        throw new Error('x0 > x1');
    }
    let x0p = xScale(x0);
    let xw = xScale(x1) - x0p;
    const minPixelWidth = 3;
    if (xw < minPixelWidth) {
        x0p = (xScale(x0) + xScale(x1)) / 2 - minPixelWidth / 2;
        xw = minPixelWidth;
    }
    if (isNaN(xw))
        throw new Error('x0 > x1');
    svg.append('rect')
        .attr('x', x0p)
        .attr('y', y)
        .attr('width', xw)
        .attr('height', height)
        .attr('fill', color);
}

// Function to draw rectangles with a specific stripe color
function drawQuasiOutlierBands(bands, y, height, color) {
    const option = "medium";
    for (const band of bands) {
        if (option === "hor3") {
            for (const yy of [y + height * 0.25, y + height / 2, y + height * 0.75]) {
                svg.append("line")
                    .attr("x1", xScale(band[0]))
                    .attr("y1", yy)
                    .attr("x2", xScale(band[1]))
                    .attr("y2", yy)
                    .attr("stroke", color)
                    .attr("stroke-width", 4);
            }
        } else if (option === "zig") {
            let y1 = y;
            let y2 = y + height;
            let g = svg.append("g");
            for (let x = xScale(band[0]); x < xScale(band[1]); x += 4) {
                g.append("line")
                    .attr("x1", x)
                    .attr("y1", y1)
                    .attr("x2", x + 4)
                    .attr("y2", y2)
                    .attr("stroke", color)
                    .attr("stroke-width", 2);
                [y1, y2] = [y2, y1];
            }
        } else if (option === "vert") {
            for (let x = xScale(band[0]); x < xScale(band[1]); x += 4) {
                svg.append("line")
                    .attr("x1", x)
                    .attr("y1", y)
                    .attr("x2", x)
                    .attr("y2", y + height)
                    .attr("stroke", color)
                    .attr("stroke-width", 2);
            }
        } else if (option === "medium") {
            svg.append("rect")
                .attr("x", xScale(band[0]))
                .attr("y", y + height * 0.2)
                .attr("width", xScale(band[1]) - xScale(band[0]))
                .attr("height", height - height * 0.2 * 2)
                .style("fill", color)
        } else if (option === "thin") {
            svg.append("rect")
                .attr("x", xScale(band[0]))
                .attr("y", y + height * 0.3)
                .attr("width", xScale(band[1]) - xScale(band[0]))
                .attr("height", height - height * 0.3 * 2)
                .style("fill", color)
        }
    }
}

function drawDensityBands(sorted, y, height, plotInfo) {
    const percentiles = [...getPercentiles(sorted, plotInfo)].sort(d3.descending);
    const colors = getPercentileColors(percentiles, plotInfo.color);
    // "intervals" use indices into sorted; "bands" use values (possibly not present in sorted)
    const bandsMap = new Map();
    // console.log(label, percentiles);
    let withinIntervals = [[0, sorted.length - 1]];
    const useOutlierThreshold = !plotInfo.label.includes('Rug') && plotInfo.label !== 'HDR';
    const hdrThresholds = plotInfo.label.includes('HDR') ? hdr.computeHDRRegions(hdrKDE, percentiles) : null;

    let outlierBand = null;
    if (plotInfo.label.includes('IQR and Median')) {
        // use quantiles instead of shortest intervals
        outlierBand = extrapolatedGaussianRange(sorted, 0.5, [[boxPlotStats.q1, boxPlotStats.q3]], boxPlotStats.median, expectedOutlierCount);
        //bandsMap.set(percentiles[0], [[boxPlotStats.lowerWhisker, boxPlotStats.upperWhisker]]);
        bandsMap.set(percentiles[0], [[outlierBand[0], outlierBand[1]]]);
        bandsMap.set(percentiles[1], [[boxPlotStats.q1, boxPlotStats.q3]]);
        bandsMap.set(percentiles[2], [[boxPlotStats.median, boxPlotStats.median]]);
    } else {
        if (!plotInfo.label.includes('HDR')) {
            // prep for shortest percentiles
            const pCentral = d3.scaleLinear().domain([50, 100]).range([0.7, 0.5]).clamp(true)(sorted.length);
            const centralInterval = SI.shortestIntervals(sorted, pCentral)[0];
            const centralBand = [sorted[centralInterval[0]], sorted[centralInterval[1]]];
            const modeInterval = SI.shortestIntervals(sorted, 0)[0];
            const modeBand = [sorted[modeInterval[0]], sorted[modeInterval[1]]];
            const centralEstimate = d3.mean(modeBand);
            outlierBand = extrapolatedGaussianRange(sorted, 0.5, [centralBand], centralEstimate, expectedOutlierCount);
            if (useOutlierThreshold && percentiles[0] === 1) {
                withinIntervals = [[d3.bisectLeft(sorted, outlierBand[0]), d3.bisectRight(sorted, outlierBand[1]) - 1]];
            }
        }
        for (const [i, p] of percentiles.entries()) {
            let bands = [];
            if (plotInfo.label.includes('HDR')) {
                const hdrBands = hdr.extractHDRBands(hdrKDE, hdrThresholds[i].threshold);
                if (i === 0) {
                    // peek ahead for central region (p == 0.5)
                    const hdrBandsCentral = hdr.extractHDRBands(hdrKDE, hdrThresholds[1].threshold);
                    outlierBand = extrapolatedGaussianRange(sorted, 0.5, hdrBandsCentral, hdrBands[0][0], expectedOutlierCount);
                    if (isNaN(outlierBand[0]) || isNaN(outlierBand[1]))
                        outlierBand = extrapolatedGaussianRange(sorted, 0.5, hdrBandsCentral, hdrBands[0][0], expectedOutlierCount);
                }
                for (let [x0, x1] of hdrBands) {
                    if (useOutlierThreshold) {
                        // constrain HDR bands to outlierBand
                        x0 = Math.min(Math.max(x0, outlierBand[0]), outlierBand[1]);
                        x1 = Math.min(Math.max(x1, outlierBand[0]), outlierBand[1]);
                    }
                    bands.push([x0, x1]);
                }
            } else {
                const allowSplit = !plotInfo.label.includes('Shortest Hal') && p >= 0.25 && p * sorted.length >= 10;
                // const effectiveP = useOutlierThreshold && p > 0.9 ? 1.0 : p;
                const intervals = SI.shortestIntervalsWithin(sorted, withinIntervals, p, allowSplit, getControlValues().splitPenalty);
                for (const [first, last] of intervals) {
                    bands.push([sorted[first], sorted[last]]);
                }
                withinIntervals = intervals;
            }
            bandsMap.set(p, bands);
        }
    }

    function drawBands(i, p, bands, inset = 0) {
        let pcolor = colors[percentiles.length - i - 1];
        if (p <= 0.02)
            pcolor = d3.color(pcolor).darker(1);
        for (const [x0, x1] of bands) {
            drawBandOrSliver(x0, x1, y + inset, height - inset * 2, pcolor);
        }
    }

    let widestBands = bandsMap.get(percentiles[0]);
    if (useOutlierThreshold) {
        // draw a quasi-outlier band (region between the widest specified band and outliers), which will likely be covered up
        const xlo = Math.min(widestBands[0][0], outlierBand[0]);
        const xhi = Math.max(widestBands[widestBands.length - 1][1], outlierBand[1]);
        widestBands = [[xlo, xhi]];
        drawQuasiOutlierBands(widestBands, y, height, colors[percentiles.length - 1]);
    }
    for (const [i, p] of percentiles.entries()) {
        drawBands(i, p, bandsMap.get(p));
    }

    // density rug could have many slivers, so combine adjacent ones, otherwise they will appear denser than the actual dense regions
    let outliers = [];
    const rugLimit = plotInfo.label.includes('Rug') ? 3 : 0; // in pixels
    let rugBands = [];
    let curRugBand = null;
    for (const [i, x] of sorted.entries()) {
        let covered = false;
        for (const [x0, x1] of widestBands) {
            covered = covered || (x >= x0 && x <= x1);
        }
        if (!covered) {
            if (rugLimit > 0) {
                if (curRugBand && xScale(x) - xScale(curRugBand[1]) <= rugLimit) {
                    // extend current band
                    curRugBand[1] = x;
                    continue;
                } else if (curRugBand) {
                    // commit band and start a new one
                    rugBands.push(curRugBand);
                    curRugBand = null;
                }
                if (outliers.length > 0 && xScale(x) - xScale(sorted[outliers[outliers.length - 1]]) <= rugLimit) {
                    // remove last outlier and create a new band with it
                    curRugBand = [sorted[outliers.pop()], x];
                    continue;
                }
            }
            outliers.push(i);
        }
    }
    if (curRugBand)
        rugBands.push(curRugBand);
    drawBands(0, 1, rugBands, 0);
    drawOutliers(outliers, sorted, y, height, plotInfo, colors[0]);
    // if (useOutlierThreshold) {
    //     drawBandOrSliver(outlierBand[0], outlierBand[0], y - 2, height + 4, 'red');
    //     drawBandOrSliver(outlierBand[1], outlierBand[1], y - 2, height + 4, 'red');
    // }
}

let hdrKDE = null;
let boxPlotStats = null;
let smoothShortestHalf = null;
let selectedOutlierMode = 'IQR';
let expectedOutlierCount = 1;

function update() {
    const params = getControlValues();
    draw(params);
}

function generateCompositeData(params) {
    const {groupA, groupB} = params;

    const dataA = generateGroupData(groupA, params.randomSeed * params.groupA.count);
    const dataB = generateGroupData(groupB, params.randomSeed * params.groupB.count * 31);
    const sortedData = [...dataA, ...dataB].sort(d3.ascending);
    hdrKDE = dataDensity(sortedData, 0.5, 200);
    smoothShortestHalf = SI.shortestIntervals(sortedData, 0.5, false, 0)[0];
    boxPlotStats = computeBoxPlotStats(sortedData);

    return sortedData;
}

function generateGroupData({dist, mean, std, count}, seed) {
    let generator;
    const rng = d3.randomLcg(seed);

    switch (dist) {
        case 'normal':
            generator = d3.randomNormal.source(rng)(mean, std);
            break;
        case 'uniform':
            generator = d3.randomUniform.source(rng)(mean - std, mean + std);
            break;
        case 'lognormal':
            generator = d3.randomLogNormal.source(rng)(Math.log(mean), std / mean); // Rough fit
            break;
        case 'bates':
            generator = d3.randomBates.source(rng)(10); // Mean ≈ 0.5
            break;
        case 'exponential':
            generator = d3.randomExponential.source(rng)(1 / mean); // Rate = 1/mean
            break;
        case 'pareto':
            generator = d3.randomPareto.source(rng)(std);
            break;
        case 'cauchy':
            generator = d3.randomCauchy.source(rng)(mean, std);
            break;
        case 'binomial':
            generator = d3.randomBinomial.source(rng)(25, (mean + std) / 20);
            break;
        default:
            generator = () => mean;
    }
    const raw = dist === 'old faithful'
        ? Data.oldFaithful
        : d3.range(count).map(generator);

    // Normalize to fit xDomain
    const [min, max] = d3.extent(raw);
    const [xMin, xMax] = xDomain;

    const normalized = raw.map(d => xMin + ((d - min) / ((max - min) || 1)) * (xMax - xMin));

    const needsNormalization = ['cauchy', 'binomial', 'old faithful'].includes(dist);
    return needsNormalization ? normalized : raw;
}

function syncSliderAndInput(sliderId, inputId, onChange = () => {
}, transform = '') {
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(inputId);

    // Update input when slider changes
    slider.addEventListener('input', () => {
        if (transform === 'sqrt')
            input.value = slider.value * slider.value;
        else if (transform === 'log')
            input.value = slider.value < 0 ? 0 : Math.round(Math.pow(10, slider.value));
        else
            input.value = slider.value;
        onChange();
    });

    // Update slider when input changes
    input.addEventListener('input', () => {
        if (transform === 'sqrt')
            slider.value = Math.sqrt(input.value);
        else if (transform === 'log')
            slider.value = input.value === 0 ? -0.1 : Math.log10(input.value);
        else
            slider.value = input.value;
        onChange();
    });
}

const triggerUpdate = () => update();

syncSliderAndInput('meanA-slider', 'meanA', triggerUpdate);
syncSliderAndInput('stdA-slider', 'stdA', triggerUpdate);
syncSliderAndInput('countA-slider', 'countA', triggerUpdate, 'log');

syncSliderAndInput('meanB-slider', 'meanB', triggerUpdate);
syncSliderAndInput('stdB-slider', 'stdB', triggerUpdate);
syncSliderAndInput('countB-slider', 'countB', triggerUpdate, 'log');

syncSliderAndInput('splitPenalty', 'splitPenaltyInput', update);
syncSliderAndInput('randomSeed', 'randomSeedInput', update);

function addChangeListener(id, callback) {
    document.getElementById(id).addEventListener('change', callback);
}

['distA', 'distB'].forEach(id => addChangeListener(id, update));

// Set up segment control buttons
document.querySelectorAll('#outlier-mode-buttons .segment-button').forEach(btn => {
    btn.addEventListener('click', () => {
        selectedOutlierMode = btn.dataset.mode;
        document.querySelectorAll('#outlier-mode-buttons .segment-button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        update();
    });
});

// Sync number input and slider
const countInput = document.getElementById('expected-count-input');
const countSlider = document.getElementById('expected-count-slider');

countInput.addEventListener('input', () => {
    expectedOutlierCount = countInput.value;
    countSlider.value = expectedOutlierCount;
    update();
});

countSlider.addEventListener('input', () => {
    expectedOutlierCount = countSlider.value;
    countInput.value = expectedOutlierCount;
    update();
});

svg.on("mousemove", function(event) {
    const descriptionBox = d3.select("#description");
    const mouseY = d3.pointer(event)[1]; // Get the vertical mouse position
    let rowTop = rowPlotTop;
    for (const rowPlotInfo of rowPlots) {
        if (rowPlotInfo.label !== 'KDE')
            rowTop += rowPlotGap;  // no gap between KDE and rug
        const rowBottom = rowTop + rowPlotHeight * rowPlotInfo.height;

        if (mouseY < rowBottom) {
            descriptionBox.text(rowPlotInfo.description);
            return;
        }
        rowTop = rowBottom;
    }
    descriptionBox.text(`Each row shows a summary graph for the same data set.
     An ideal summary graph shows the extent and centrality of the data set, possibly identifying outliers and a central estimate.
     Plots in green are new. Mouse-over a row plot for details.`);
});

update();
