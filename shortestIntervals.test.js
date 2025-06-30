import SI, {__private__ as _private__, __private__} from './shortestIntervals.js';
import {expect} from 'chai';

describe('shortestIntervals', () => {
    it('returns full range for percentile = 1.0', () => {
        const data = [1, 2, 3, 4, 5];
        const result = SI.shortestIntervals(data, 1.0);
        expect(result).to.deep.equal([[0, 4]]);
    });

    it('returns empty for empty input', () => {
        const result = SI.shortestIntervals([], 0.5);
        expect(result).to.deep.equal([]);
    });

    it('returns tighter interval for smaller percentile', () => {
        const sorted = [1, 2, 3, 4, 5, 6, 7, 8];
        const full = SI.shortestIntervals(sorted, 1.0);
        const half = SI.shortestIntervals(sorted, 0.5);
        const fullWidth = SI.intervalsWidth(sorted, full);
        const halfWidth = SI.intervalsWidth(sorted, half);
        expect(halfWidth).to.be.lessThanOrEqual(fullWidth);

    });

    it('returns narrowest central range for bimodal data with splitting allowed', () => {
        const sorted = [1, 1, 12, 18, 29, 29, 40, 41];
        const result = SI.shortestIntervals(sorted, 0.5, true, 0.1);
        expect(result).to.deep.equal([[0, 1], [4, 5]]);

    });

    it('matches expected interval on known input', () => {
        const sorted = [1, 2, 2, 2, 3, 10];
        const result = SI.shortestIntervals(sorted, 0.5);
        expect(result).to.deep.equal([[1, 3]]);
    });

    it('middle of equals', () => {
        const sorted = [1, 1, 1, 1, 5, 5, 5, 5, 9, 9, 9, 9, 22, 23, 24, 25];
        const result = SI.shortestIntervals(sorted, 0.25, true);
        expect(result).to.deep.equal([[4, 7]]);
    });

});


describe('interval helpers', () => {
    const sorted = [1, 2, 3, 5, 8];

    it('intervalWidth returns difference between endpoints', () => {
        const width = sorted[3] - sorted[1]; // 5 - 2 = 3
        expect(SI.intervalWidth(sorted, [1, 3])).to.equal(width);
    });

    it('intervalCount returns inclusive count', () => {
        expect(SI.intervalCount([1, 3])).to.equal(3); // 1, 2, 3
    });

    it('intervalsCount and intervalsWidth are additive', () => {
        const intervals = [[0, 1], [3, 4]]; // values [1,2] and [5,8]
        const count = SI.intervalsCount(intervals);
        const width = SI.intervalsWidth(sorted, intervals);
        expect(count).to.equal(4); // 2 + 2
        expect(width).to.equal((2 - 1) + (8 - 5)); // 1 + 3
    });

    it('subtractInterval removes values properly', () => {
        const base = [[0, 4]];
        const sub = [1, 2];
        const result = SI.subtractInterval(base, sub);
        expect(result).to.deep.equal([[0, 0], [3, 4]]);
    });

    it('subtractIntervals removes multiple ranges', () => {
        const base = [[0, 9]];
        const sub = [[2, 3], [6, 7]];
        const result = SI.subtractIntervals(base, sub);
        expect(result).to.deep.equal([[0, 1], [4, 5], [8, 9]]);
    });

    it('intersect empty', () => {
        const base = [[0, 1], [4, 5]];
        const sub = [[2, 3], [6, 7]];
        const result = SI.intersectIntervals(base, sub);
        expect(result).to.deep.equal([]);
    });

    it('intersect one', () => {
        const base = [[1, 9], [11, 15]];
        const sub = [[0, 3]];
        const result = SI.intersectIntervals(base, sub);
        expect(result).to.deep.equal([[1, 3]]);
    });

    it('intersect to singleton', () => {
        const base = [[1, 9], [11, 15]];
        const sub = [[9, 10]];
        const result = SI.intersectIntervals(base, sub);
        expect(result).to.deep.equal([[9, 9]]);
    });

    it('intersect singleton', () => {
        const base = [[1, 9], [11, 15]];
        const sub = [[9, 9]];
        const result = SI.intersectIntervals(base, sub);
        expect(result).to.deep.equal([[9, 9]]);
    });

    it('intersect many', () => {
        const base = [[1, 9], [11, 15]];
        const sub = [[0, 3], [6, 12], [13, 14], [19, 20]];
        const result = SI.intersectIntervals(base, sub);
        expect(result).to.deep.equal([[1, 3], [6, 9], [11, 12], [13, 14]]);
    });

    it('union many', () => {
        const base = [[1, 9], [11, 15]];
        const sub = [[0, 3], [6, 12], [13, 14], [19, 20]];
        const result = SI.unionIntervals(base, sub);
        expect(result).to.deep.equal([[0, 15], [19, 20]]);
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