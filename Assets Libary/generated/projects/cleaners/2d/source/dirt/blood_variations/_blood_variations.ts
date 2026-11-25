import { BAYER_4X4, createNoise2D, defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as color } from '../../_theme';

type Point = readonly [x: number, y: number];
type Field = (x: number, y: number) => number;
type Decal = {
  size: Point;
  shape: Field;
  vertical?: boolean;
};

// Distâncias negativas ficam dentro da mancha. O contorno é rasterizado uma única vez.
function blot(cx: number, cy: number, radiusX: number, radiusY: number, angle: number, phase: number, lobes = 0.13): Field {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const radius = Math.min(radiusX, radiusY);
  return (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const u = (dx * cos + dy * sin) / radiusX;
    const v = (dy * cos - dx * sin) / radiusY;
    const direction = Math.atan2(v, u);
    const edge = 1 + lobes * Math.sin(3 * direction + phase)
      + 0.052 * Math.cos(5 * direction - phase)
      + 0.024 * Math.sin(9 * direction + phase);
    return (Math.hypot(u, v) - edge) * radius;
  };
}

// Uma curva quadrática com raio variável forma arrastos e escorridos contínuos.
function stroke(start: Point, turn: Point, end: Point, startRadius: number, endRadius: number): Field {
  const length = Math.hypot(turn[0] - start[0], turn[1] - start[1])
    + Math.hypot(end[0] - turn[0], end[1] - turn[1]);
  const steps = Math.max(2, Math.ceil(length / 7));
  const sample = (t: number): Point => {
    const s = 1 - t;
    return [
      s * s * start[0] + 2 * s * t * turn[0] + t * t * end[0],
      s * s * start[1] + 2 * s * t * turn[1] + t * t * end[1],
    ];
  };
  const segments = Array.from({ length: steps }, (_, i) => {
    const [x, y] = sample(i / steps);
    const [endX, endY] = sample((i + 1) / steps);
    const dx = endX - x;
    const dy = endY - y;
    return { x, y, dx, dy, squaredLength: Math.max(0.001, dx * dx + dy * dy) };
  });
  return (x, y) => {
    let distance = Infinity;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const u = x - segment.x;
      const v = y - segment.y;
      const t = Math.max(0, Math.min(1, (u * segment.dx + v * segment.dy) / segment.squaredLength));
      const radius = startRadius + (endRadius - startRadius) * ((i + t) / steps);
      distance = Math.min(distance, Math.hypot(u - t * segment.dx, v - t * segment.dy) - radius);
    }
    return distance;
  };
}

function merge(...parts: Field[]): Field {
  return (x, y) => {
    let distance = Infinity;
    for (const part of parts) distance = Math.min(distance, part(x, y));
    return distance;
  };
}

function cuts(shape: Field, ...channels: Field[]): Field {
  const channel = merge(...channels);
  return (x, y) => Math.max(shape(x, y), -channel(x, y));
}

// Gotas nascem em arcos diferentes, com escala decrescente e giro na direção da marca.
function drops(cx: number, cy: number, direction: number, aperture: number, inner: number, outer: number,
  count: number, size: number, seed: string): Field {
  const random = createNoise2D(seed);
  const pieces = Array.from({ length: count }, (_, i) => {
    const placement = (i + 0.5) / count;
    const angle = direction + (placement - 0.5 + random(i * 1.17, 13) * 0.26) * aperture;
    const reach = inner + (outer - inner) * (0.5 + random(i * 2.7, 5.6) * 0.48);
    const radius = Math.max(1.15, size * (1.16 - 0.62 * placement + random(i * 1.8, 3.7) * 0.22));
    return blot(cx + Math.cos(angle) * reach, cy + Math.sin(angle) * reach, radius * 1.32, radius,
      angle, random(i * 1.35, 1.8) * 3, 0.085);
  });
  return merge(...pieces);
}

const decals = {
  pool_small: {
    size: [48, 40],
    shape: merge(
      blot(21, 21, 14.3, 9.8, -0.26, 0.82, 0.18),
      blot(38.1, 15.2, 2.6, 2.0, -0.6, 2.3),
      blot(42.1, 21.8, 1.5, 1.25, 0.12, 1.9),
    ),
  },
  pool_large: {
    size: [224, 160],
    shape: merge(
      blot(83, 89, 67, 41, 0.21, 0.23, 0.17),
      blot(146, 67, 55, 33, -0.68, 1.4, 0.18),
      stroke([75, 87], [121, 55], [174, 72], 19, 19),
    ),
  },
  pools_joined: {
    size: [160, 96],
    shape: merge(
      blot(42, 44, 27, 22, -0.27, 1.8),
      stroke([57, 50], [75, 73], [105, 51], 7.5, 8.6),
      blot(114, 48, 30, 17.5, 0.48, 2.7),
    ),
  },
  pool_splashed: {
    size: [192, 160],
    shape: merge(
      blot(65, 96, 42, 28, 0.31, 2.4, 0.18),
      stroke([66, 87], [80, 80], [100, 74], 12.5, 3.5),
      drops(66, 94, -0.58, 1.64, 38, 113, 16, 4.15, 'floor splash'),
    ),
  },
  pool_dragged: {
    size: [320, 96],
    shape: merge(
      cuts(
        merge(
          blot(59, 50, 42, 31, 0.31, 0.35, 0.17),
          stroke([66, 49], [171, 74], [299, 37], 23, 2.4),
        ),
        stroke([112, 47], [195, 67], [304, 34], 1.8, 0.6),
        stroke([146, 67], [207, 76], [256, 54], 2.7, 0.7),
        stroke([165, 82], [179, 65], [186, 57], 2.1, 0.6),
        stroke([243, 28], [245, 38], [244, 47], 1.5, 1.1),
      ),
      blot(286, 53, 3.5, 1.4, -0.33, 1.6),
      blot(306, 40, 2.9, 1.45, -0.28, 0.7),
    ),
  },
  drop_trail: {
    size: [192, 48],
    shape: merge(
      blot(24, 31, 11, 8.2, 0.18, 1.25),
      blot(45, 21.8, 6.8, 4.75, -0.26, 0.7),
      blot(58, 32.4, 3.4, 2.3, 0.12, 1.7),
      blot(77, 21.1, 7.3, 4.0, -0.35, 2.1),
      blot(101, 29.6, 4.2, 3.0, 0.20, 0.15),
      blot(125, 18.1, 5.5, 3.4, -0.21, 2.8),
      blot(149, 24.3, 4.1, 2.5, -0.14, 2.4),
      blot(168, 14.4, 2.5, 1.65, -0.36, 1.5),
      blot(179, 19.0, 1.55, 1.35, -0.23, 0.45),
    ),
  },
  wall_splatter: {
    size: [96, 96],
    vertical: true,
    shape: merge(
      blot(44, 47, 18.5, 15.8, -0.46, 0.42, 0.26),
      stroke([42, 47], [33, 38], [25, 25], 7.2, 1.2),
      stroke([45, 46], [50, 43], [69, 36], 6.7, 1.6),
      stroke([43, 50], [37, 57], [29, 67], 6.6, 1.4),
      stroke([45, 52], [52, 59], [57, 73], 5.3, 1.1),
      drops(44, 47, 0, 6.283, 25, 40, 16, 3.3, 'wall ring'),
    ),
  },
  wall_side_splatter: {
    size: [128, 80],
    vertical: true,
    shape: merge(
      blot(31, 54, 19.0, 11.1, -0.36, 2.5, 0.18),
      stroke([33, 50], [57, 39], [81, 35], 9.5, 1.4),
      stroke([32, 52], [52, 51], [75, 53], 5.7, 1.3),
      stroke([29, 49], [45, 33], [54, 26], 6.0, 1.2),
      drops(29, 55, -0.46, 0.92, 43, 92, 16, 3.35, 'side wedge'),
    ),
  },
  wall_impact_drip: {
    size: [96, 160],
    vertical: true,
    shape: merge(
      blot(45, 40, 28, 14.0, 0.12, 1.69, 0.20),
      stroke([29, 42], [33, 65], [31, 108], 6.7, 1.55),
      stroke([45, 44], [48, 86], [45, 138], 7.2, 1.3),
      stroke([61, 47], [58, 70], [62, 98], 5.5, 1.1),
      blot(45, 138, 2.0, 3.9, 0, 1.1),
      blot(31, 109, 2.25, 3.4, -0.13, 2.15),
      blot(15, 33, 2.6, 1.9, 0.3, 1.8),
    ),
  },
  wall_contact_smear: {
    size: [160, 80],
    vertical: true,
    shape: merge(
      cuts(
        merge(
          blot(40, 29, 24, 14, 0.24, 2.4, 0.15),
          stroke([32, 29], [77, 28], [137, 56], 14.2, 1.5),
        ),
        stroke([58, 28], [107, 30], [147, 51], 1.0, 2.2),
        stroke([75, 43], [110, 49], [146, 66], 1.1, 2.4),
      ),
      stroke([47, 38], [49, 48], [47, 59], 3.0, 1.4),
      stroke([71, 42], [70, 52], [73, 57], 2.3, 1.2),
      stroke([109, 41], [124, 47], [148, 55], 1.7, 0.85),
    ),
  },
  wall_base_drip: {
    size: [80, 112],
    vertical: true,
    shape: merge(
      blot(36, 25, 19, 11, 0.2, 2.18, 0.16),
      stroke([24, 29], [29, 65], [35, 115], 4.6, 2.7),
      stroke([38, 30], [37, 65], [40, 115], 5.2, 3.75),
      stroke([50, 31], [49, 70], [46, 115], 3.5, 2.9),
    ),
  },
  wall_base_pool: {
    size: [96, 64],
    shape: merge(
      stroke([48, -5], [49, 17], [48, 34], 9.4, 11.6),
      blot(49, 29, 31.0, 15.6, 0.09, 2.68, 0.17),
      stroke([38, 18], [30, 30], [23, 34], 7.2, 3.8),
      stroke([56, 17], [68, 26], [77, 37], 7, 3.0),
    ),
  },
} satisfies Record<string, Decal>;

function bloodColor(depth: number, field: number, bayer: number) {
  if (depth < 0.95) return bayer < 0.4 ? color.abismo1 : color.couroSombra;
  if (depth < 2.55 + field * 0.45) return field + bayer * 0.24 > 0.14 ? color.couroEscuro : color.sangueEscuro;
  if (depth < 6.6 && field > 0.02 && bayer < 0.52) {
    if (field > 0.13 && bayer < 0.18) return color.couroLuz;
    return color.sangueLuz;
  }
  if (field + bayer * 0.18 > 0.21) return field > 0.16 && bayer < 0.38 ? color.couroBase : color.sangueLuz;
  if (field < -0.28 && bayer < 0.51) return color.sangueEscuro;
  return color.sangueBase;
}

export function defineBloodDecal(name: keyof typeof decals) {
  const { size, shape, vertical }: Decal = decals[name];
  const [width, height] = size;
  const noise = createNoise2D('cleaners-blood-' + name);
  return defineAsset({
    width,
    height,
    scale: 1,
    antialiasing: 'none',
    render({ ctx }) {
      const pixels = new PixelCanvas(width, height);
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const x = px + 0.5;
          const y = py + 0.5;
          const mottle = 0.69 * noise(x / (vertical ? 15 : 19), y / (vertical ? 23 : 15))
            + 0.31 * noise(x / 5.4, y / 7.7);
          const roughness = 1.04 * noise(x / 7, y / 9) + 0.46 * noise(x / 2.7, y / 3.1);
          const depth = -(shape(x, y) + roughness);
          if (depth > 0) {
            const bayer = BAYER_4X4[py % 4][px % 4];
            pixels.set(px, py, bloodColor(depth, mottle, bayer));
          }
        }
      }
      pixels.render(ctx);
    },
  });
}
