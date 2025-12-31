import SI from './shortestIntervals.js';
import hdr from './hdr.js';
import Data from './sampleData.js';

const svg = d3.select('#plot');
const width = +svg.attr('width');
const rowLabelWidth = 160;
const rowPlotTop = 5;
const rowPlotHeight = 30;
const rowPlotGap = 14;

const xDomain = [-3, 13];
const xScale = d3.scaleLinear().domain(xDomain).range([rowLabelWidth + 15, width - 10]);

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
        outlierAlpha: +document.getElementById('outlier-sensitivity-input').value,
        splitPenalty: +document.getElementById('splitPenalty').value,
        randomSeed: +document.getElementById('randomSeed').value,
    };
}


// dark orange #d86a18
const rowPlots = [
    {
        label: 'Heatmap', height: 1.0, draw: drawHeatmapPlot, color: '#2171b5',
        levels: [15], // number of intervals
        description: `Heatmap of 15 fixed-sized intervals colored by relative count,
        constrained to not use dark colors for uniform bin counts.
        When grouped, one must decide if the count scale is the same for all of them.
        Intervals with few values (2 or less) also show those values as dots.`
    },
    {
        label: 'KDE', height: 1.4, draw: drawKDEs, color: '#999',
        levels: [0.25, 0.5, 1.0],   // bandwidth multipliers
        description: `Kernel Density Estimation using a gaussian kernel and multiple bandwidths.
        Bandwidths are 0.25, 0.5, and 1.0 times the Silverman's rule bandwidth, which is based on
        the standard deviation and sample size of the data.`
    },
    {
        label: 'Rug', height: 0.4, draw: drawRug, color: '#333',
        levels: [],
        description: `Rug plot with a vertical line at each data point. Some data points may
        be hidden behind other data points due to overlap.`
    },
    {
        label: 'Density Strip', height: 1.0, draw: drawStripPlot, color: '#444',
        levels: [0.5],  // kde bandwidth multiplier
        description: `Kernel Density Estimation using color and a bandwidth of 0.5 times
         the Silverman's rule bandwidth, which is based on the standard deviation and sample size of the data.`
    },
    {
        label: 'HDR 50/95/99', height: 1.0, draw: drawDensityBands, color: '#2171b5',
        levels: [0.0, 0.5, 0.95, 0.99],
        description: `Highest Density Regions plot with cut-off points at mode, 0.5, 0.95, and 0.99.
        Values beyond the widest region are shown as outlier dots.
        Uses a KDE bandwidth of 0.5 times the Silverman's rule bandwidth.`
    },
    {
        label: 'HDR 5/50/90', height: 1.0, draw: drawDensityBands, color: '#238b45',
        levels: [0.05, 0.5, 0.90, 1.0],
        description: `Highest Density Regions plot with cut-off points at 0.05, 0.5, 0.9,
         and using Grubbs' outlier threshold after estimating the mean and SD from the 50% and 90% regions.
         Values beyond the outlier threshold are shown as dots.
         Uses a KDE bandwidth of 0.5 times the Silverman's rule bandwidth.`
    },
    {
        label: 'HDR 33/67', height: 1.0, draw: drawDensityBands, color: '#238b45',
        levels: [1 / 3, 2 / 3, 1.0],
        description: `Highest Density Regions plot with cut-off points at 1/3, 2/3,
         and using Grubbs' outlier threshold after estimating the mean and SD from the 1/3 and 2/3 region.
         Values beyond the outlier threshold are shown as dots.
         Uses a KDE bandwidth of 0.5 times the Silverman's rule bandwidth.`
    },
    {
        label: 'Shortest Thirds', height: 1.0, draw: drawDensityBands, color: '#238b45',
        levels: [1 / 3, 2 / 3, 1.0],
        description: `Shortest regions that contain 1/3 and 2/3 of the values.
         The widest interval shows Grubbs' outlier threshold after estimating the mean and SD from the shortest regions.
         Values beyond the outlier threshold are shown as dots.
         Remaining non-empty data regions (quasi-outliers) are shown as reduced-height filled regions.`
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
         The widest interval shows Grubbs' outlier threshold after estimating the mean and SD from the 25% and 50% regions.
         Values beyond the outlier threshold are shown as dots.`
    },
    // {
    //     label: 'Shortest 25/50/95', height: 1.0, draw: drawDensityBands, color: '#238b45',
    //     levels: [0.25, 0.5, 0.95],
    //     description: 'Shortest regions of 25%, 50%, and 95% of the data, allowing for split regions penalized according to the Split Penalty.'
    // },
    {
        label: 'Shortest Gaussian', height: 1.0, draw: drawDensityBands, color: '#238b45',
        levels: [0.5, 1.5, 2.5],
        description: `Shortest regions at percentiles that correspond to equal intervals if the data is Gaussian.
         For Gaussian data, each region would be one standard deviation wide.
         A Grubbs' outlier threshold after estimating the mean and SD from the shortest regions.
         Values beyond the outlier threshold are shown as dots.
         Remaining non-empty data regions (quasi-outliers) are shown as reduced-height filled regions.`
    },
    {
        label: '20/50/80 Rug', height: 1.0, draw: drawDensityBands, color: '#238b45',
        levels: [0.2, 0.5, 0.8],
        description: `Shortest regions of 20%, 50%, and 80% of the data, allowing for split regions penalized according to the Split Penalty.
         Other values are shown as a rug plot, except touching values are connected as a single region to avoid looking more dense than the shortest regions.`
    },
    {
        label: 'Shortest 0/50/95', height: 1.0, draw: drawDensityBands, color: '#238b45',
        levels: [0, 0.5, 0.95, 1],
        description: `Shortest half of the data as one or two contiguous intervals; any split is penalized according to the Split Penalty.
         A vertical line shows the "half sample mode" which is the iteratively applied shortest half.
         The widest interval shows Grubbs' outlier threshold after estimating the mean and SD from the mode and 50% regions.
         Values beyond the outlier threshold are shown as dots.`
    },
    // {
    //     label: 'IQR and Median', height: 1.0, draw: drawDensityBands, color: '#238b45',
    //     levels: [0, 0.5, 0.993], // only used for coloring, box plot quantiles are used instead
    //     description: `Inner region shows Interquartile Range (IQR) of the data with a line at the median.
    //      The outer interval extends to an adaptive outlier threshold based on a gaussian extrapolation of the IQR region.
    //      Values beyond the outer interval are shown as dots.`
    // },
    // {
    //     label: 'Quintile Box', height: 0.8, draw: drawQuintileBoxPlot, color: '#238b45', // light green '#D6E8D8'
    //     levels: [0, 0.5, 0.993], //  only used for coloring, quintiles are used instead
    //     description: `Five boxes each representing a quintile of the data.
    //      `
    // },
    {
        label: 'Quintile Area', height: 0.8, draw: drawQuantileAreaBoxPlot, color: '#238b45', // light green '#D6E8D8'
        levels: [5],
        description: `Five boxes, each representing a quintile of the data.
         Box heights are proportional to the number of data density in the quintile
         (clamped to upper and lower limits), making the box areas equal (except for clamped heights).`
    },
    {
        label: 'Quartile Area', height: 0.8, draw: drawQuantileAreaBoxPlot, color: '#238b45', // light green '#D6E8D8'
        levels: [4],
        description: `Five boxes, each representing a quartile of the data.
         Box heights are proportional to the number of data density in the quartile
         (clamped to upper and lower limits), making the box areas equal (except for clamped heights).`
    },
    {
        label: 'Grubbs Box', height: 0.8, draw: drawBoxPlot, color: '#238b45', // light green '#D6E8D8'
        levels: [0, 0.5, 0.993], //  only used for coloring, box plot quantiles are used instead
        description: `Inner region shows Interquartile Range (IQR) of the data with a line at the median.
         The whiskers extend to the last data point within a Grubbs' outlier threshold
         after estimating the mean and SD from the median and IQR regions.
         When the outer region extends beyond the Tukey box plot whiskers (1.5 IQR), the endcaps are shown as arcs.
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
    if (plotInfo.label.includes('Gaussian')) {
        let p = getStdPercentiles(data, plotInfo.levels);
        p.push(1.0);
        return p;
    }
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
    // if (sorted.length > 10,000) {
    //     sorted = sorted.slice(0, 200).concat(sorted.slice(-200)); // for drawing performance
    // }
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

function estimateSDFromShortest(n, p, w) {
    const df = n - 1;
    const tw = w / 2;   // assume a centered interval
    const t = jStat.studentt.inv(0.5 + p / 2, df);
    return tw / t;
}

// https://www.qualitydigest.com/inside/statistics-column/some-outlier-tests-part-2-011121.html
function grubbsG(n, alpha) {
    if (n <= 3)
        return 1;   // undefined, but show as 1 sd if asked
    const df = n - 2;
    const upperTailArea = alpha / (2 * n);
    const t = jStat.studentt.inv(1 - upperTailArea, df);
    const tt = t * t;
    const gg = (n - 1) * (n - 1) * tt / (n * (n - 2 + tt));
    return Math.sqrt(gg);
}

function grubbsLower(m, sd, n, alpha) {
    return m - sd * grubbsG(n, alpha);
}

function grubbsUpper(m, sd, n, alpha) {
    return m + sd * grubbsG(n, alpha);
}

function grubbsHalfWidth(nHalf, pHalf, wHalf, alpha) {
    // pretend this is one half of a symmetric t distribution
    const sd = estimateSDFromShortest(nHalf * 2, pHalf * 2, 2 * wHalf);
    return sd * grubbsG(nHalf * 2, alpha);
}

function grubbsRangeFromIntervals(sorted, centralInterval, spreadInterval, alpha) {
    const n = sorted.length;
    if (n === 0 || spreadInterval == null)
        return null;
    if (n === 1)
        return [sorted[0], sorted[0]];
    const nSpread = SI.intervalCount(spreadInterval);
    if (nSpread <= 2) {
        // tiny intervals (even count==1) can happen from HDR
        return [sorted[spreadInterval[0]], sorted[spreadInterval[1]]];
    }
    if (nSpread === n) {
        return [sorted[spreadInterval[0]], sorted[spreadInterval[1]]];
    }

    if (centralInterval === null) {
        const spreadMiddle = (spreadInterval[0] + spreadInterval[1]) / 2;
        let [lo, hi] = [Math.floor(spreadMiddle), Math.ceil(spreadMiddle)];
        while (lo > spreadInterval[0] && sorted[lo] === sorted[lo - 1]) {
            lo--;
        }
        while (hi < spreadInterval[1] && sorted[hi] === sorted[hi + 1]) {
            hi++;
        }
        centralInterval = [lo, hi];
    }

    const spreadP = nSpread / n;
    // const spreadWidth = SI.intervalWidth(sorted, spreadInterval);
    // use midrange: expecting central interval to be narrow,
    // and expecting midrange to be more stable than mean or median for tiny n
    // let centralEstimate = (sorted[centralInterval[0]] + sorted[centralInterval[1]])/2;
    // console.log(trimean, centralEstimate, sorted[spreadInterval[0]], sorted[spreadInterval[1]]);
    // // constrain central estimate is to somewhat central within the spread region;
    // // half-sample mode, in particular, can be at the edge
    // let minCentralEstimate = sorted[spreadInterval[0]] + spreadWidth * 0.1;
    // let maxCentralEstimate = sorted[spreadInterval[0]] + spreadWidth * 0.9;
    // centralEstimate = Math.min(centralEstimate, maxCentralEstimate);
    // centralEstimate = Math.max(centralEstimate, minCentralEstimate);

    // use Tukey trimean as centralEstimate; avoids edge cases with extreme skew
    const trimean = (sorted[spreadInterval[0]] + sorted[centralInterval[0]] + sorted[centralInterval[1]] + sorted[spreadInterval[1]]) / 4; // Tukey's trimean
    const centralEstimate = trimean;
    const nCentral = SI.intervalCount(centralInterval);
    // possibly these should account for new centralEstimate
    const nLower = nCentral / 2 + centralInterval[0];
    const nUpper = nCentral / 2 + n - 1 - centralInterval[1];

    const [xLower, xUpper] = [sorted[spreadInterval[0]], sorted[spreadInterval[1]]];
    const grubbsLowerFromInterval = centralEstimate - grubbsHalfWidth(nLower, spreadP / 2, centralEstimate - xLower, alpha);
    const grubbsUpperFromInterval = centralEstimate + grubbsHalfWidth(nUpper, spreadP / 2, xUpper - centralEstimate, alpha);
    return [grubbsLowerFromInterval, grubbsUpperFromInterval];
}


function grubbsRangeFromQuartiles(sorted, median, q1, q3, alpha) {
    const n = sorted.length;
    if (n === 0)
        return null;
    if (n === 1)
        return [[sorted[0], sorted[0]]];
    // const nSpread = n / 2;    // in theory
    // if (nSpread <= 2) {
    //     // tiny intervals (even count==1) can happen from HDR
    //     return [sorted[spreadInterval[0]], sorted[spreadInterval[1]]];
    // }

    const spreadP = 0.5;
    // const spreadWidth = q3 - q1;
    // Tukey: "Another thing that box-and-whisker plots convey to us is an impression of
    // location or centering that combines both median and hinges. The arithmetic
    // that comes closest to matching this impression is probably the trimean"
    const trimean = (q1 + 2 * median + q3) / 4; //
    const centralEstimate = trimean;
    const nLower = n / 4;
    const nUpper = n / 4;

    const [xLower, xUpper] = [q1, q3];
    const grubbsLowerFromInterval = Math.min(q1, centralEstimate - grubbsHalfWidth(nLower, spreadP / 2, centralEstimate - xLower, alpha));
    const grubbsUpperFromInterval = Math.max(q3, centralEstimate + grubbsHalfWidth(nUpper, spreadP / 2, xUpper - centralEstimate, alpha));
    return [Math.max(grubbsLowerFromInterval, sorted[0]), Math.min(grubbsUpperFromInterval, sorted[n - 1])];
}

function offsetInterval(interval, offset) {
    if (!interval) {
        return interval;
    }
    return interval.map(i => i + offset);
}

function sliceSorted(sorted, centralInterval, spreadInterval, first, last) {
    if (first === 0 && last === sorted.length - 1) {
        // nothing to do
    }
    else {
        sorted = sorted.slice(first, last + 1);
        if (first > 0) {
            centralInterval = offsetInterval(centralInterval, -first);
            spreadInterval = offsetInterval(spreadInterval, -first);
        }
    }
    return [sorted, centralInterval, spreadInterval];
}

// returns a one or more interval of data values [[xlo, xhi]+] which define the Grubbs' outlier range.
// The mean and SD used for the Grubbs calculation are inferred from assuming
// the intervals come from a Student's T distribution.
// The range is snapped to the most extreme included points.
function grubbsRangesFromShortest(sorted, centralIntervals, spreadIntervals, alpha = 0.5) {
    const n = sorted.length;
    if (n === 0)
        return [];
    if (n === 1)
        return [[sorted[0], sorted[0]]];

    let outlierBands = [];
    let splits = [0, n];
    for (let i = 1; i < spreadIntervals.length; i++) {
        // enforce a min count in the weighted mean to avoid extreme lopsided cases (from tiny HDR regions)
        const n0 = Math.max(5, SI.intervalCount(spreadIntervals[i - 1]));
        const n1 = Math.max(5, SI.intervalCount(spreadIntervals[i]));
        const breakIndex = Math.ceil((spreadIntervals[i - 1][1] * n1 + spreadIntervals[i][0] * n0) / (n0 + n1));
        splits.splice(i, 0, breakIndex);
    }
    for (const [is, spreadInterval] of spreadIntervals.entries()) {
        let localCentralInterval = null;
        let localSorted = sorted;
        let localSpreadInterval = spreadInterval;
        for (const centralInterval of centralIntervals) {
            if (centralInterval[0] >= spreadInterval[0] && centralInterval[1] <= spreadInterval[1]) {
                localCentralInterval = centralInterval;
                break;
            }
        }
        [localSorted, localCentralInterval, localSpreadInterval] = sliceSorted(localSorted, localCentralInterval, localSpreadInterval,
            splits[is], splits[is + 1] - 1);
        const band = grubbsRangeFromIntervals(localSorted, localCentralInterval, localSpreadInterval, alpha);
        outlierBands = SI.unionInterval(outlierBands, band);
    }
    const outlierIntervals = outlierBands.map(band => bandToInterval(sorted, band));
    const outlierDataBands = outlierIntervals.map(band => [sorted[band[0]], sorted[band[1]]]);
    return outlierDataBands;
}

function grubbsRangeFromShortest(sorted, centralIntervals, spreadIntervals, alpha = 0.5) {
    const bands = grubbsRangesFromShortest(sorted, centralIntervals, spreadIntervals, alpha);
    return [bands[0][0], bands[bands.length - 1][1]];
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
    const centerPadding = spread * 0.25;  // avoid singularities for center is at an edge
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
    // const medianInterval = [Math.floor((sorted.length - 1) / 2), Math.ceil((sorted.length - 1) / 2)];
    // const iqrInterval = [d3.bisectLeft(sorted, boxPlotStats.q1), d3.bisectRight(sorted, boxPlotStats.q3) - 1];
    let outlierBand = null;
    if (!plotInfo.label.includes('Tukey')) {
        outlierBand = grubbsRangeFromQuartiles(sorted, boxPlotStats.median, boxPlotStats.q1, boxPlotStats.q3, getControlValues().outlierAlpha);
        //outlierBand = extrapolatedGaussianRange(sorted, 0.5, [[boxPlotStats.q1, boxPlotStats.q3]], boxPlotStats.median, expectedOutlierCount);
        // snap to data value
        outlierBand = [sorted[d3.bisectLeft(sorted, outlierBand[0])], sorted[d3.bisectRight(sorted, outlierBand[1]) - 1]];
    }

    const extendLower = outlierBand && outlierBand[0] < boxPlotStats.lowerWhisker;
    const extendUpper = outlierBand && outlierBand[1] > boxPlotStats.upperWhisker;
    const loWhisker = extendLower ? outlierBand[0] : boxPlotStats.lowerWhisker;
    const upWhisker = extendUpper ? outlierBand[1] : boxPlotStats.upperWhisker;
    if (extendLower) {
        // Curved adaptive outlier caps
        const cw = capHeight / 4;
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
    }
    else {
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
        const cw = capHeight / 4;
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
    }
    else {
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

function computeQuantileIntervals(sorted, pLo, pHi) {
    const qLo = d3.quantileSorted(sorted, pLo);
    const qHi = d3.quantileSorted(sorted, pHi);
    const qLoIndex = d3.bisectLeft(sorted, qLo);
    const qHiIndex = d3.bisectRight(sorted, qHi) - 1;
    return [qLoIndex, qHiIndex];
    // return [sorted[qLoIndex], sorted[qHiIndex]];
}

function computeQuantileBoxPlotStats(sorted, nQuantiles) {
    const quantileIntervals = Array.from({length: nQuantiles},
        (_, i) => computeQuantileIntervals(sorted, (i)/ nQuantiles, (i + 1)/ nQuantiles));

    // let quantileIntervals = quantiles.map(level => computeQuantileIntervals(sorted, level - 0.2, level));
    return quantileIntervals;
}

function drawQuintileBoxPlot(sorted, y, height, plotInfo) {
    const ym = y + height / 2;
    const xWidthMin = 3;
    let yHeight = height * 0.95; // leave room for a median line to extend outside of box
    const xGapMax = (xScale.range()[1] - xScale.range()[0]) * 0.1;
    const pQuintiles = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
    let xQuintiles = pQuintiles.map(p => xScale(d3.quantileSorted(sorted, p)));

    let xLoPrev = 0;
    let xHiPrev = 0;
    let order = [2, 1, 3, 0, 4];
    for (const i of order) {
        let xLo = xQuintiles[i];
        let xHi = xQuintiles[i + 1];
        let qWidthMin = xLo === xHi ? 1 : xWidthMin;
        // possibly xLo > xHi for the moment
        if (i === 2) {
            // middle interval
            let xMid = (xLo + xHi) / 2;
            xLo = Math.min(xLo, xMid - qWidthMin / 2);
            xHi = Math.max(xHi, xMid + qWidthMin / 2);
            xLoPrev = xLo;
            xHiPrev = xHi;
        }
        else if (i < 2) {
            // a lower interval
            xHi = Math.min(xHi, xLoPrev);
            xLo = Math.min(xLo, xHi - qWidthMin);
            xLoPrev = xLo;
        }
        else {
            // an upper interval
            xLo = Math.max(xLo, xHiPrev);
            xHi = Math.max(xHi, xLo + qWidthMin);
            xHiPrev = xHi;
        }
        xQuintiles[i] = xLo;
        xQuintiles[i + 1] = xHi;
    }
    svg.append('rect')
        .attr('x', xLoPrev)
        .attr('y', ym - yHeight/2)
        .attr('width', xHiPrev - xLoPrev)
        .attr('height', yHeight)
        .attr('fill', d3.interpolateLab('white', plotInfo.color)(0.1))
        .attr('stroke', plotInfo.color);
    for (let i = 1; i < 5; i++) {
        // todo: can we drawn lines and rect as one stoked path so joins are cleaner?
        svg.append('line')
            .attr('x1', xQuintiles[i])
            .attr('x2', xQuintiles[i])
            .attr('y1', ym - yHeight/2)
            .attr('y2', ym + yHeight/2)
            .attr('stroke', plotInfo.color);
    }
}

function middleOutIndex(i, n) {
    const m = Math.floor(n / 2);
    const d = Math.ceil(i / 2);
    return m + (i % 2 === 0 ? -d : d);
}

function drawQuantileAreaBoxPlot(sorted, y, height, plotInfo) {
    const ym = y + height / 2;
    const xGapMin = 0;
    const xWidthMin = 3;
    const heightMin = 2;
    const denMaxScale = 3;
    let xLoPrev = 0;
    let xHiPrev = 0;
    const nQuantiles = plotInfo.levels[0];
    let quantileIntervals = computeQuantileBoxPlotStats(sorted, nQuantiles);
    for (let io = 0; io < nQuantiles; io++) {
        const iq = middleOutIndex(io, nQuantiles - 1);
        let [lo, hi] = quantileIntervals[iq];
        let dLo = sorted[lo];
        let dHi = sorted[hi];
        let nq = hi - lo + 1;
        if (nq === 0)
            continue;
        let globalDen = sorted[sorted.length - 1] === sorted[0] ? 1000 : sorted.length / (sorted[sorted.length - 1] - sorted[0]);
        let den = dHi === dLo ? globalDen * 1000 : nq / (dHi - dLo);
        let maxDen = globalDen * denMaxScale;
        let boxDen = Math.min(maxDen, den);
        let xLo = xScale(dLo);
        let xHi = xScale(dHi);
        let yHeight = Math.max(heightMin, height * boxDen / maxDen);
        let xMid = (xLo + xHi) / 2;
        xLo += xGapMin / 2;
        xHi -= xGapMin / 2;
        // possibly xLo > xHi for the moment
        if (io === 0) {
            // middle interval
            xLo = Math.min(xLo, xMid - xWidthMin / 2);
            xHi = Math.max(xHi, xMid + xWidthMin / 2);
            xLoPrev = xLo;
            xHiPrev = xHi;
        }
        else if (iq < nQuantiles/2) {
            // a lower interval
            xHi = xGapMin === 0 ? xLoPrev : Math.min(xHi, xLoPrev - xGapMin);
            xLo = Math.min(xLo, xHi - xWidthMin);
            xLoPrev = xLo;
        }
        else {
            // an upper interval
            xLo = xGapMin === 0 ? xHiPrev : Math.max(xLo, xHiPrev + xGapMin);
            xHi = Math.max(xHi, xLo + xWidthMin);
            xHiPrev = xHi;
        }
        svg.append('rect')
            .attr('x', xLo)
            .attr('y', ym - yHeight/2)
            .attr('width', xHi - xLo)
            .attr('height', yHeight)
            .attr('fill', d3.interpolateLab('white', plotInfo.color)(0.1))
            .attr('stroke', plotInfo.color);
    }
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
    const n = data.length;
    if (n <= 1)
        return 1;
    const stdDev = d3.deviation(data);
    return 1.06 * stdDev * Math.pow(n, -1 / 5);
}

function dataDensity(sorted, bandwidthScale = 1.0, nSubIntervals = 100, pad = 0.05) {
    // Estimate density, can use a smaller bandwidth than default for diagnostic use
    const [dataMin, dataMax] = d3.extent(sorted);
    let dataWidth = dataMax - dataMin;
    if (dataWidth === 0)
        dataWidth = 0.5;
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

    let maxCount = d3.max(bins, d => d.length);
    let nNonEmpty = d3.sum(bins, d => (d.length !== 0));
    if (nNonEmpty > 1)
        maxCount = Math.max(maxCount, sorted.length / (nNonEmpty/2));
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
        }
        else if (option === "zig") {
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
        }
        else if (option === "vert") {
            for (let x = xScale(band[0]); x < xScale(band[1]); x += 4) {
                svg.append("line")
                    .attr("x1", x)
                    .attr("y1", y)
                    .attr("x2", x)
                    .attr("y2", y + height)
                    .attr("stroke", color)
                    .attr("stroke-width", 2);
            }
        }
        else if (option === "medium") {
            svg.append("rect")
                .attr("x", xScale(band[0]))
                .attr("y", y + height * 0.2)
                .attr("width", xScale(band[1]) - xScale(band[0]))
                .attr("height", height - height * 0.2 * 2)
                .style("fill", color)
        }
        else if (option === "thin") {
            svg.append("rect")
                .attr("x", xScale(band[0]))
                .attr("y", y + height * 0.3)
                .attr("width", xScale(band[1]) - xScale(band[0]))
                .attr("height", height - height * 0.3 * 2)
                .style("fill", color)
        }
    }
}

// force in the sense that an empty band will be expanded to include the two surrounding points
function bandToInterval(sorted, band, forceNonEmpty = true) {
    let lo = d3.bisectLeft(sorted, band[0]);
    let hi = d3.bisectRight(sorted, band[1]) - 1;
    if (forceNonEmpty && lo === hi + 1) {
        // force the empty region to include surrounding points
        lo--;
        hi++;
    }
    if (lo > hi) {
        throw "unexpected";
    }
    return [lo, hi];
}

function bandsToIntervals(sorted, bands, forceNonEmpty = true) {
    return bands.map(band => bandToInterval(sorted, band, forceNonEmpty));
}

function drawDensityBands(sorted, y, height, plotInfo) {
    const percentiles = [...getPercentiles(sorted, plotInfo)].sort(d3.descending);
    const colors = getPercentileColors(percentiles, plotInfo.color);
    // "intervals" use indices into sorted; "bands" use values (possibly not present in sorted)
    const bandsMap = new Map();
    // console.log(label, percentiles);
    let withinIntervals = [[0, sorted.length - 1]];
    const useOutlierThreshold = !plotInfo.label.includes('Rug') &&
        !(plotInfo.label.includes('HDR') && !plotInfo.label.includes('Grubb') && !plotInfo.description.includes('Grubb'));
    const hdrThresholds = plotInfo.label.includes('HDR') ? hdr.computeHDRRegions(hdrKDE, percentiles) : null;

    let outlierBands = [];

    function getAllowSplit(p) {
        return !plotInfo.label.includes('Shortest Hal') && p >= 0.25 && p * sorted.length >= 5;
    }

    if (plotInfo.label.includes('IQR and Median')) {
        // use quantiles instead of shortest intervals
        const medianInterval = [Math.floor(sorted.length / 2), Math.ceil(sorted.length / 2)];
        const iqrInterval = bandToInterval(sorted, [boxPlotStats.q1, boxPlotStats.q3]);
        outlierBands = grubbsRangesFromShortest(sorted, [medianInterval], [iqrInterval], getControlValues().outlierAlpha);
        bandsMap.set(percentiles[0], [outlierBands[0]]);
        bandsMap.set(percentiles[1], [[boxPlotStats.q1, boxPlotStats.q3]]);
        bandsMap.set(percentiles[2], [[boxPlotStats.median, boxPlotStats.median]]);
    }
    else {
        if (useOutlierThreshold) {
            // for Grubbs' outliers, the spread interval is the widest interval <= 95%
            // and the central interval is the next narrower one
            let ips = 0;
            while (percentiles[ips] > 0.95) {
                ips++;
            }
            let pSpread = percentiles[ips];
            let pCentral = ips + 1 < percentiles.length ? percentiles[ips + 1] : pSpread / 2;
            if (plotInfo.label.includes('HDR')) {
                // use KDE thresholds instead of shortest regions
                const hdrSpreadBands = hdr.extractHDRBands(hdrKDE, hdrThresholds[ips].threshold);
                const hdrCentralBands = hdr.extractHDRBands(hdrKDE, hdrThresholds[ips + 1].threshold);
                const hdrSpreadIntervals = hdrSpreadBands.map(b => bandToInterval(sorted, b));
                const hdrCentralIntervals = hdrCentralBands.map(b => bandToInterval(sorted, b));
                outlierBands = grubbsRangesFromShortest(sorted, hdrCentralIntervals, hdrSpreadIntervals, getControlValues().outlierAlpha);
            }
            else {
                // prep for shortest percentiles
                const spreadIntervals = SI.shortestIntervals(sorted, pSpread, getAllowSplit(pSpread), getControlValues().splitPenalty);
                const centralIntervals = SI.shortestIntervalsWithin(sorted, spreadIntervals, pCentral, getAllowSplit(pCentral), getControlValues().splitPenalty);
                outlierBands = grubbsRangesFromShortest(sorted, centralIntervals, spreadIntervals, getControlValues().outlierAlpha);
                if (useOutlierThreshold && percentiles[0] === 1) {
                    withinIntervals = bandsToIntervals(sorted, outlierBands);
                }
            }
        }
        for (const [i, p] of percentiles.entries()) {
            let bands = [];
            if (plotInfo.label.includes('HDR')) {
                // use KDE thresholds instead of shortest regions
                const hdrBands = hdr.extractHDRBands(hdrKDE, hdrThresholds[i].threshold);
                if (useOutlierThreshold) {
                    bands = SI.intersectIntervals(hdrBands, outlierBands);
                }
                else {
                    bands = hdrBands;
                }
            }
            else {
                const allowSplit = getAllowSplit(p);
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
        if (p <= 0.02 && i === percentiles.length - 1)
            pcolor = d3.color(pcolor).darker(1);
        else if (p <= 0.1 && i === percentiles.length - 1)
            pcolor = d3.color(pcolor).darker(0.5);

        for (const [x0, x1] of bands) {
            drawBandOrSliver(x0, x1, y + inset, height - inset * 2, pcolor);
        }
    }

    let widestBands = bandsMap.get(percentiles[0]);
    if (useOutlierThreshold) {
        // draw a quasi-outlier band (region between the widest specified band and outliers), which will likely be covered up
        widestBands = outlierBands;
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
                }
                else if (curRugBand) {
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
    //     drawQuasiOutlierBands(outlierBands, y + height/2, 2, 'red');
    // drawBandOrSliver(outlierBand[0], outlierBand[0], y - 2, height + 4, 'red');
    // drawBandOrSliver(outlierBand[1], outlierBand[1], y - 2, height + 4, 'red');
    // }
}

let hdrKDE = null;
let boxPlotStats = null;

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
            generator = d3.randomBinomial.source(rng)(mean * 25, (std) / 3);
            break;
        case 'poisson':
            generator = d3.randomPoisson.source(rng)(mean);
            break;
        default:
            generator = () => mean;
    }
    const raw = dist === 'old faithful' ? Data.oldFaithful
        : dist === 'volcano' ? Data.volcano
            : dist === 'counties' ? Data.michiganCounties
                : dist === 'bacteria a' ? Data.bacteriaPrecisionA
                    : dist === 'bacteria b' ? Data.bacteriaPrecisionB
                : d3.range(count).map(generator);

    // Normalize to fit xDomain
    const [min, max] = d3.extent(raw);
    let [xMin, xMax] = xDomain;
    const xRange = xMax - xMin;
    xMin += xRange * 0.05;
    xMax -= xRange * 0.05;

    const normalized = raw.map(d => xMin + ((d - min) / ((max - min) || 1)) * (xMax - xMin));

    const needsNormalization = min < xMin || max > xMax || (min >= 0 && max <= 1);
    //['cauchy', 'binomial', 'old faithful', 'volcano', 'counties'].includes(dist);
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

syncSliderAndInput('outlier-sensitivity-slider', 'outlier-sensitivity-input', update);
syncSliderAndInput('splitPenalty', 'splitPenaltyInput', update);
syncSliderAndInput('randomSeed', 'randomSeedInput', update);

function addChangeListener(id, callback) {
    document.getElementById(id).addEventListener('change', callback);
}

['distA', 'distB'].forEach(id => addChangeListener(id, update));

// Set up segment control buttons
// document.querySelectorAll('#outlier-mode-buttons .segment-button').forEach(btn => {
//     btn.addEventListener('click', () => {
//         selectedOutlierMode = btn.dataset.mode;
//         document.querySelectorAll('#outlier-mode-buttons .segment-button').forEach(b => b.classList.remove('active'));
//         btn.classList.add('active');
//         update();
//     });
// });

svg.on("mousemove", function (event) {
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
