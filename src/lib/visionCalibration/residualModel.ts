export type ResidualVector6 = [number, number, number, number, number, number];

export interface ResidualTrainingSample {
  inputX: number;
  inputY: number;
  targetX: number;
  targetY: number;
  weight?: number;
}

export interface VisionResidualModel {
  version: 1;
  basis: 'poly2';
  coeffX: ResidualVector6;
  coeffY: ResidualVector6;
  lambda: number;
  sampleCount: number;
  mse: number;
  trainedAt: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const toVector6 = (value: unknown): ResidualVector6 | undefined => {
  if (!Array.isArray(value) || value.length !== 6) return undefined;
  if (value.some((item) => !isFiniteNumber(item))) return undefined;
  return [
    Number(value[0]),
    Number(value[1]),
    Number(value[2]),
    Number(value[3]),
    Number(value[4]),
    Number(value[5]),
  ];
};

const poly2Features = (x: number, y: number): ResidualVector6 => {
  return [1, x, y, x * y, x * x, y * y];
};

const dot = (a: ResidualVector6, b: ResidualVector6) =>
  a[0] * b[0] +
  a[1] * b[1] +
  a[2] * b[2] +
  a[3] * b[3] +
  a[4] * b[4] +
  a[5] * b[5];

const solveLinearSystem = (matrix: number[][], vector: number[]): number[] | null => {
  const n = matrix.length;
  if (n === 0 || vector.length !== n) return null;
  const a = matrix.map((row) => row.slice());
  const b = vector.slice();

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }

    [a[col], a[pivot]] = [a[pivot], a[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];

    const diag = a[col][col];
    if (!Number.isFinite(diag) || Math.abs(diag) < 1e-10) return null;

    for (let row = col + 1; row < n; row += 1) {
      const factor = a[row][col] / diag;
      if (!Number.isFinite(factor)) return null;
      for (let k = col; k < n; k += 1) {
        a[row][k] -= factor * a[col][k];
      }
      b[row] -= factor * b[col];
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) {
    let sum = b[i];
    for (let j = i + 1; j < n; j += 1) {
      sum -= a[i][j] * x[j];
    }
    x[i] = sum / a[i][i];
    if (!Number.isFinite(x[i])) return null;
  }
  return x;
};

const toResidualVector = (value: number[]): ResidualVector6 => {
  return [
    value[0] ?? 0,
    value[1] ?? 0,
    value[2] ?? 0,
    value[3] ?? 0,
    value[4] ?? 0,
    value[5] ?? 0,
  ];
};

export const applyResidualCompensation = (
  x: number,
  y: number,
  model?: VisionResidualModel
): { x: number; y: number } => {
  if (!model) return { x: clamp01(x), y: clamp01(y) };
  const features = poly2Features(x, y);
  const dx = dot(model.coeffX, features);
  const dy = dot(model.coeffY, features);
  return {
    x: clamp01(x + dx),
    y: clamp01(y + dy),
  };
};

export const normalizeResidualModel = (value: unknown): VisionResidualModel | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const model = value as VisionResidualModel;
  if (model.basis !== 'poly2') return undefined;
  const coeffX = toVector6(model.coeffX);
  const coeffY = toVector6(model.coeffY);
  if (!coeffX || !coeffY) return undefined;
  return {
    version: 1,
    basis: 'poly2',
    coeffX,
    coeffY,
    lambda: isFiniteNumber(model.lambda) ? Math.max(0.0001, Math.min(10, model.lambda)) : 0.05,
    sampleCount: isFiniteNumber(model.sampleCount) ? Math.max(0, Math.floor(model.sampleCount)) : 0,
    mse: isFiniteNumber(model.mse) ? Math.max(0, model.mse) : 0,
    trainedAt: isFiniteNumber(model.trainedAt) ? model.trainedAt : Date.now(),
  };
};

export const fitResidualModel = (
  samples: ResidualTrainingSample[],
  options?: { lambda?: number; minSamples?: number; now?: number }
): VisionResidualModel | undefined => {
  const lambda = options?.lambda ?? 0.05;
  const minSamples = options?.minSamples ?? 8;
  const usable = samples.filter((sample) => (
    isFiniteNumber(sample.inputX) &&
    isFiniteNumber(sample.inputY) &&
    isFiniteNumber(sample.targetX) &&
    isFiniteNumber(sample.targetY)
  ));

  if (usable.length < minSamples) return undefined;

  const n = 6;
  const A = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const bX = new Array<number>(n).fill(0);
  const bY = new Array<number>(n).fill(0);

  for (const sample of usable) {
    const features = poly2Features(sample.inputX, sample.inputY);
    const wRaw = isFiniteNumber(sample.weight) ? sample.weight : 1;
    const w = Math.max(0.01, Math.min(5, wRaw));
    const rX = sample.targetX - sample.inputX;
    const rY = sample.targetY - sample.inputY;

    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        A[i][j] += w * features[i] * features[j];
      }
      bX[i] += w * features[i] * rX;
      bY[i] += w * features[i] * rY;
    }
  }

  for (let i = 0; i < n; i += 1) {
    A[i][i] += lambda;
  }

  const coeffX = solveLinearSystem(A, bX);
  const coeffY = solveLinearSystem(A, bY);
  if (!coeffX || !coeffY) return undefined;

  const vecX = toResidualVector(coeffX);
  const vecY = toResidualVector(coeffY);

  let mseAcc = 0;
  let weightAcc = 0;
  for (const sample of usable) {
    const features = poly2Features(sample.inputX, sample.inputY);
    const wRaw = isFiniteNumber(sample.weight) ? sample.weight : 1;
    const w = Math.max(0.01, Math.min(5, wRaw));
    const predX = sample.inputX + dot(vecX, features);
    const predY = sample.inputY + dot(vecY, features);
    const err = Math.hypot(predX - sample.targetX, predY - sample.targetY);
    mseAcc += w * err * err;
    weightAcc += w;
  }
  const mse = weightAcc > 0 ? mseAcc / weightAcc : 0;

  return {
    version: 1,
    basis: 'poly2',
    coeffX: vecX,
    coeffY: vecY,
    lambda,
    sampleCount: usable.length,
    mse,
    trainedAt: options?.now ?? Date.now(),
  };
};

export const blendResidualModels = (
  current: VisionResidualModel | undefined,
  incoming: VisionResidualModel,
  alpha = 0.25
): VisionResidualModel => {
  if (!current) return incoming;
  const a = clamp01(alpha);
  const blend = (lhs: ResidualVector6, rhs: ResidualVector6): ResidualVector6 => ([
    lhs[0] * (1 - a) + rhs[0] * a,
    lhs[1] * (1 - a) + rhs[1] * a,
    lhs[2] * (1 - a) + rhs[2] * a,
    lhs[3] * (1 - a) + rhs[3] * a,
    lhs[4] * (1 - a) + rhs[4] * a,
    lhs[5] * (1 - a) + rhs[5] * a,
  ]);
  return {
    ...incoming,
    coeffX: blend(current.coeffX, incoming.coeffX),
    coeffY: blend(current.coeffY, incoming.coeffY),
    sampleCount: Math.max(current.sampleCount, incoming.sampleCount),
    mse: current.mse * (1 - a) + incoming.mse * a,
    trainedAt: incoming.trainedAt,
  };
};
