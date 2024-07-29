function validateNumber(value, { min, max, step, }) {
    if (value == null || Number.isNaN(value)) {
        return false;
    }
    else if (value < min || value > max) {
        return `Value must be between ${min} and ${max}`;
    }
    else if (step !== 'any' && (value * Math.pow(10, 6)) % (step * Math.pow(10, 6))) {
    //else if (step !== 'any' && (value - (Number.isFinite(min) ? (min * Math.pow(10,6)): 0)) % (step * Math.pow(10,6)) !== 0) {
        return `Value must be a multiple of ${step}${Number.isFinite(min) ? ` starting from ${min}` : ''}`;
    }
    return true;
}

console.log(validateNumber(10.000001, {min: 1, max: 100, step: 0.0001}))