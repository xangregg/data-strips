
// largely written by ChatGPT

export function computeHDRRegions(kde, levels = [0.1, 0.25, 0.5, 0.9]) {
    // Approximate total area under curve using rectangle rule
    const totalArea = kde.reduce((sum, d) => sum + d.y, 0);

    // Sort by density descending
    const sorted = [...kde].sort((a, b) => b.y - a.y);

    let cumulative = 0;
    const regions = levels.map(level => ({ level, threshold: level === 1 ? 0 : null }));

    for (let i = 0; i < sorted.length; i++) {
        cumulative += sorted[i].y;
        const currentMass = cumulative / totalArea;

        for (const region of regions) {
            if (region.threshold === null && currentMass >= region.level) {
                region.threshold = sorted[i].y;
            }
        }
    }

    return regions;
}

export function extractHDRBands(kde, threshold) {
    const bands = [];
    let start = null;
    for (let i = 0; i < kde.length; i++) {
        if (kde[i].y >= threshold) {
            if (start === null)
                start = i;
        }
        else if (start !== null) {
            bands.push([kde[start].x, kde[i - 1].x]);
            start = null;
        }
    }
    if (start !== null) {
        bands.push([kde[start].x, kde[kde.length - 1].x]);
    }
    if (bands.length === 0) {
        bands.push([kde[0].x, kde[kde.length - 1].x]);
    }
    return bands;
}

export default {
    computeHDRRegions,
    extractHDRBands
};
