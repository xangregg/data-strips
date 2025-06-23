
import SI, { __private__ } from './shortestIntervals.js';
import { expect } from 'chai';

describe('shortestIntervals', () => {
    it('returns full range for percentile = 1.0', () => {
        const data = [1, 2, 3, 4, 5];
        const result = SI.shortestIntervals([...data].sort((a,b) => a - b), 1.0);
        expect(result.length).to.be.greaterThan(0);
        const [start, end] = result[0];
        expect(start).to.equal(0);
        expect(end).to.equal(data.length - 1);
    });

    it('returns empty for empty input', () => {
        const result = SI.shortestIntervals([], 0.5);
        expect(result).to.deep.equal([]);
    });

    it('returns tighter interval for smaller percentile', () => {
        const data = [1, 2, 3, 4, 5, 6, 7, 8];
        const sorted = [...data];
        const full = SI.shortestIntervals(sorted, 1.0);
        const half = SI.shortestIntervals(sorted, 0.5);
        const fullWidth = sorted[full[0][1]] - sorted[full[0][0]];
        const halfWidth = sorted[half[0][1]] - sorted[half[0][0]];
        expect(halfWidth).to.be.lessThanOrEqual(fullWidth);

    });

    it('returns narrowest central range for bimodal data with splitting allowed', () => {
        const data = [1, 1, 2, 8, 9, 9];
        const sorted = [...data].sort((a,b) => a - b);
        const result = SI.shortestIntervals(sorted, 4 / 6, true);
        expect(result.length).to.equal(2); // split into two clusters

    });

    it('matches expected interval on known input', () => {
        const data = [1, 2, 2, 2, 3, 10];
        const sorted = [...data].sort((a,b) => a - b);
        const result = SI.shortestIntervals(sorted, 0.5);
        expect(result.length).to.equal(1);
        const [start, end] = result[0];
        expect(sorted.slice(start, end + 1)).to.contain(2);
    });
});


describe('interval helpers', () => {
    const sorted = [1, 2, 3, 5, 8];

    it('intervalWidth returns difference between endpoints', () => {
        const width = sorted[3] - sorted[1]; // 5 - 2 = 3
        expect(__private__.intervalWidth(sorted, [1, 3])).to.equal(width);
    });

    it('intervalCount returns inclusive count', () => {
        expect(__private__.intervalCount([1, 3])).to.equal(3); // 1, 2, 3
    });

    it('intervalsCount and intervalsWidth are additive', () => {
        const intervals = [[0, 1], [3, 4]]; // values [1,2] and [5,8]
        const count = __private__.intervalsCount(intervals);
        const width = __private__.intervalsWidth(sorted, intervals);
        expect(count).to.equal(4); // 2 + 2
        expect(width).to.equal((2 - 1) + (8 - 5)); // 1 + 3
    });

    it('removeSubInterval removes values properly', () => {
        const base = [[0, 4]];
        const sub = [1, 2];
        const result = __private__.removeSubInterval(base, sub);
        expect(result).to.deep.equal([[0, 0], [3, 4]]);
    });

    it('removeSubIntervals removes multiple ranges', () => {
        const base = [[0, 9]];
        const sub = [[2, 3], [6, 7]];
        const result = __private__.removeSubIntervals(base, sub);
        expect(result).to.deep.equal([[0, 1], [4, 5], [8, 9]]);
    });
});

describe('halfSampleModeInterval', () => {
    it('returns full range for identical values', () => {
        const data = Array(10).fill(5);
        const result = __private__.halfSampleModeInterval(data);
        expect(result).to.deep.equal([[0, 9]]);
    });

    it('returns tighter interval in multimodal data', () => {
        const data = [1, 1, 2, 3, 10, 10, 10, 11, 12];
        const sorted = [...data].sort((a, b) => a - b);
        const result = __private__.halfSampleModeInterval(sorted);
        expect(result[0][1] - result[0][0]).to.be.lessThan(sorted.length - 1);
    });
});
/*
*/