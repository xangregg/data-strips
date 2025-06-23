/*
This module handles operations with intervals in sorted arrays:
- An 'interval' represents a single continuous range in a sorted array, defined by [startIndex, endIndex], inclusive
- 'intervals' plural represents an array of one or more such ranges: [[start1,end1], [start2,end2], ...]

Intervals are used to identify and manipulate ranges of values in sorted data, particularly for finding
modes and density regions in distributions.
 */

function approxEqual(a, b) {
    return a === b || (Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) < 1e-10);
}

function intervalWidth(sorted, firstLast) {
    if (firstLast !== null && sorted[firstLast[1]] < sorted[firstLast[0]]) {
        // console.log('negative ' + firstLast);
        return 0;
    }
    return firstLast === null ? 0 : sorted[firstLast[1]] - sorted[firstLast[0]];
}

function intervalCount(firstLast) {
    return firstLast === null ? 0 : firstLast[1] - firstLast[0] + 1;
}

function intervalsWidth(sorted, intervals) {
    return intervals.reduce((sum, interval) => sum + intervalWidth(sorted, interval), 0);
}

function intervalsCount(intervals) {
    return intervals.reduce((sum, interval) => sum + intervalCount(interval), 0);
}

function isIntervalsEmpty(intervals) {
    return intervals.length === 0;
}

function removeSubInterval(intervals, subInterval) {
    if (subInterval === null)
        return intervals;

    let result = [];
    for (const interval of intervals) {
        if (interval[0] <= subInterval[0] && interval[1] >= subInterval[1]) {
            // fully overlapping
            if (interval[0] < subInterval[0]) {
                result.push([interval[0], subInterval[0] - 1]);
            }
            if (interval[1] > subInterval[1]) {
                result.push([subInterval[1] + 1, interval[1]]);
            }
        }
        else if (interval[0] <= subInterval[0] && interval[1] >= subInterval[0]) {
            // partially overlapping -- not expected
            if (interval[0] < subInterval[0]) {
                result.push([interval[0], subInterval[0] - 1]);
            }
        }
        else if (interval[0] <= subInterval[1] && interval[1] >= subInterval[1]) {
            // partially overlapping -- not expected
            if (interval[1] > subInterval[1]) {
                result.push([subInterval[1] + 1, interval[1]]);
            }
        }
        else {
            // not overlapping
            result.push(interval);
        }
    }
    return result;
}

function removeSubIntervals(intervals, subIntervals) {
    let result = intervals;
    for (const subInterval of subIntervals) {
        result = removeSubInterval(result, subInterval);
    }
    return result;
}

function contiguousShortestIntervals(sorted, within1, intervalTargetCount) {
    if (within1 === null)
        return [];
    let bests = [];
    let bestWidth = Infinity;
    const [iFirst, iLast] = within1;
    let first = iFirst;
    while (first <= iLast - intervalTargetCount + 1) {
        let last = first + intervalTargetCount - 1;

        // Extend last forward to include all ties at the upper edge
        while (last < iLast && sorted[last + 1] === sorted[last]) {
            last++;
        }

        const width = sorted[last] - sorted[first];

        if (approxEqual(width, bestWidth)) {
            bests.push([first, last]);
        }
        else if (width < bestWidth) {
            bests = [[first, last]];
            bestWidth = width;
        }

        // Advance first past all equal values
        const curFirst = sorted[first];
        while (first <= iLast && sorted[first] === curFirst) {
            first++;
        }
    }
    if (isIntervalsEmpty(bests))
        return [];
    const ibest = Math.floor((bests.length - 1) / 2);
    return [bests[ibest]];
}

function contiguousShortestIntervalsWithin(sorted, within, intervalTargetCount) {
    let best = [];
    let bestWidth = Infinity;
    for (const firstLast of within) {
        const intervals = contiguousShortestIntervals(sorted, firstLast, intervalTargetCount);
        if (!isIntervalsEmpty(intervals) && intervalsWidth(sorted, intervals) < bestWidth) {
            best = intervals;
            bestWidth = intervalsWidth(sorted, intervals);
        }
    }
    return best;
}

function shortestIntervalsWithinUsingCost(sorted, within, intervalTargetCount, allowSplit, splitCost) {
    const n = intervalsCount(within);
    if (n <= 0 || n < intervalTargetCount)
        return [];
    let best = contiguousShortestIntervalsWithin(sorted, within, intervalTargetCount);

    const minPartCount = Math.max(1, Math.max(Math.round(intervalTargetCount / 8), Math.min(5, Math.round(intervalTargetCount / 4))));
    if (!allowSplit || intervalTargetCount < minPartCount * 2) {
        return best;
    }

    let bestWidth = isIntervalsEmpty(best) ? Infinity : intervalsWidth(sorted, best);

    function shortestIntervalPair(targetPartCount) {
        let firstIntervals = shortestIntervalsWithinUsingCost(sorted, within, targetPartCount, false, 0);
        if (isIntervalsEmpty(firstIntervals))
            return; // no subinterval is big enough
        let totalWidth = intervalsWidth(sorted, firstIntervals) + splitCost;
        if (totalWidth >= bestWidth)
            return; // already bigger than best
        const firstPartCount = intervalsCount(firstIntervals);
        if (firstPartCount >= intervalTargetCount)
            return; // nothing left for second part (overflow because of ties)
        const secondPartTargetCount = Math.max(minPartCount, intervalTargetCount - firstPartCount);
        const remainingWithin = removeSubIntervals(within, firstIntervals);
        const secondIntervals = shortestIntervalsWithinUsingCost(sorted, remainingWithin, secondPartTargetCount, false, 0);

        if (firstPartCount + intervalsCount(secondIntervals) >= intervalTargetCount) {
            // success, now see if it's an improvement
            totalWidth += intervalsWidth(sorted, secondIntervals);
            if (totalWidth < bestWidth) {
                best = firstIntervals.concat(secondIntervals).sort((a, b) => a[0] - b[0]);
                bestWidth = totalWidth;
            }
        }
    }

    // Try all split pairs, but skipping for large n (algo is current O(n^2))
    const incr = Math.max(1, Math.round(intervalTargetCount / 200));
    for (let targetPartCount = minPartCount; targetPartCount < intervalTargetCount - minPartCount; targetPartCount+= incr) {
        shortestIntervalPair(targetPartCount);
    }
    if (incr > 1 && best.length > 1) {
        // also try nearby sizes that were skipped
        const bestCountFound = intervalCount(best[0]);
        for (let targetPartCount = Math.max(minPartCount, bestCountFound - 10); targetPartCount < Math.min(intervalTargetCount - minPartCount, bestCountFound + 10); targetPartCount++) {
            if ((targetPartCount - minPartCount) % incr !== 0 || targetPartCount === bestCountFound)
                continue; // already did this one
            shortestIntervalPair(targetPartCount);
        }
    }
    return best;
}

function halfSampleModeInterval(sorted) {
    // https://stats.stackexchange.com/questions/176112/how-to-find-the-mode-of-a-probability-density-function
    // https://arxiv.org/pdf/math/0505419
    const n = sorted.length;
    if (n <= 0)
        return [];
    const width = sorted[sorted.length - 1] - sorted[0];
    if (width === 0)
        return [[0, n - 1]]; // all values are equal
    let targetCount = n;
    let modeInterval = [0, n - 1];
    let modeCount = n;
    let modeWidth = width;
    const modeCountTarget = 3;
    while (intervalCount(modeInterval) > modeCountTarget && modeWidth > 0) {
        targetCount = Math.min(Math.floor(targetCount * 0.8), Math.ceil(modeCount * 0.5)); // must decrease eaxch iteration, even in case of ties
        const modeIntervals = contiguousShortestIntervals(sorted, modeInterval, targetCount);
        if (isIntervalsEmpty(modeIntervals))
            return [];
        modeInterval = modeIntervals[0];
        modeCount = intervalCount(modeInterval);
        modeWidth = intervalWidth(sorted, modeInterval);
        // console.log(modeInterval);
    }
    // preserving the middle-of-three logic of the Bickel paper, but we
    // don't need to compute midrange since we're returning an interval
    if (modeWidth > 0 && modeCount === 3) {
        const a = sorted[modeInterval[0]];
        const b = sorted[modeInterval[0] + 1];
        const c = sorted[modeInterval[0] + 2];
        if (approxEqual(b - a, c - b)) {
            modeInterval = [modeInterval[0] + 1, modeInterval[0] + 1];  // the middle value
        }
        else if (b - a < c - b) {
            modeInterval = [modeInterval[0], modeInterval[0] + 1];  // first 2 of 3
        }
        else {
            modeInterval = [modeInterval[0] + 1, modeInterval[0] + 2];  // last 2 of 3
        }
    }
    return [modeInterval];
}

function shortestIntervalsWithin(sorted, within, percentile = 0.5, allowSplit = false, splitPenaltyRatio = 0.1) {
    if (percentile === 0)
        return halfSampleModeInterval(sorted);
    const n = sorted.length;
    const targetCount = Math.ceil(n * percentile);
    if (targetCount <= 0)
        return [];
    if (targetCount >= intervalsCount(within))
        return within;

    // shortestRange is a robust measure for the splitting cost
    const shortestRange = contiguousShortestIntervalsWithin(sorted, [[0, n - 1]], Math.ceil(n * 0.9), false, 0);
    const splitCost = splitPenaltyRatio * intervalsWidth(sorted, shortestRange);// * Math.min(percentile / 0.5, 1.0);

    const best = shortestIntervalsWithinUsingCost(sorted, within, targetCount, allowSplit, splitCost);
    // console.log('shortest from ' + within + '  ' + targetCount + '#  => ' + best);
    return best;
}

export function shortestIntervals(sorted, percentile = 0.5, allowSplit = false, splitPenaltyRatio = 0.1) {
    return shortestIntervalsWithin(sorted, [[0, sorted.length - 1]], percentile, allowSplit, splitPenaltyRatio);
}


export const __private__ = {
    intervalWidth,
    intervalCount,
    intervalsWidth,
    intervalsCount,
    removeSubInterval,
    removeSubIntervals,
    halfSampleModeInterval
};

export default {
    // contiguousShortestInterval,
    shortestIntervalsWithin,
    shortestIntervals,
};
