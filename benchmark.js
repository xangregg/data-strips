import Benchmark from 'benchmark';
import { shortestIntervals } from './shortestIntervals.js';

/*
node benchmark.js
node benchmark.js > results.csv
 */

function generateUnimodalData(n) {
    return Array.from({ length: n }, () => Math.random() * 10).sort((a, b) => a - b);
}

function makeSortedNormalData(n) {
    const data = Array.from({ length: n }, () => Math.random());
    return data.sort((a, b) => a - b);
}

const suite = new Benchmark.Suite();
const results = [];

const sizes = [100, 200, 400, 800, 1600, 3200];
for (const n of sizes) {
    suite
        .add(`nonsplit`, () => {
            const data = makeSortedNormalData(n);
            shortestIntervals(data, 0.5, false);
        }, { id: `nonsplit-${n}` })

        .add(`split`, () => {
            const data = makeSortedNormalData(n);
            shortestIntervals(data, 0.5, true, 0.1);
        }, { id: `split-${n}` });
}

suite
    .on('cycle', event => {
        const bench = event.target;
        const [mode, sizeStr] = bench.id.split('-');
        const size = parseInt(sizeStr, 10);
        const hz = bench.hz;
        const rme = bench.stats.rme.toFixed(2);
        const mean = (1 / hz * 1000).toFixed(3);
        results.push({ mode, size, hz, mean, rme });
    })
    .on('complete', () => {
        console.log('mode,size,ops/sec,mean(ms),rme(%)');
        for (const r of results) {
            console.log(`${r.mode},${r.size},${r.hz.toFixed(2)},${r.mean},${r.rme}`);
        }
    })
    .run({ async: false });
