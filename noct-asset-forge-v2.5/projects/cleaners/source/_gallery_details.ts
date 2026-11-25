import { BAYER_4X4, createNoise2D, defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from './_theme';

const maskOptions = { scale: 1, antialiasing: 'none' } as const;
const ash = [p.abismo0,p.abismo1,p.ferroSombra,p.pedraSombra,
  p.ferroEscuro,p.pedraEscuro,p.pedraBase,p.pedraLuz];
const clot = [p.abismo0,p.abismo1,p.couroSombra,p.sangueEscuro,
  p.couroEscuro,p.sangueBase,p.sangueLuz,p.couroBase];
const rock = [p.abismo1,p.pedraSombra,p.ferroEscuro,p.pedraEscuro,
  p.pedraBase,p.ferroLuz,p.pedraLuz,p.pedraBrilho];
const fire = [p.ferrugemBase,p.fogoEscuro,p.ferrugemLuz,p.fogoBase,
  p.ossoLuz,p.fogoLuz,p.fogoBrilho,p.ossoBrilho];

function shade(ramp: readonly string[], tone: number) {
  return ramp[Math.max(0,Math.min(ramp.length-1,Math.floor(tone)))];
}

function threshold(x: number, y: number) {
  return BAYER_4X4[y % 4][x % 4] / 16;
}

export function scorch(surface: 'floor' | 'wall') {
  const floor = surface === 'floor';
  const width = floor ? 192 : 128;
  const height = floor ? 192 : 160;
  const noise = createNoise2D(`gallery-soot-${surface}`);
  return defineAsset({
    ...maskOptions, width, height,
    render({ ctx }) {
      const pixels = new PixelCanvas(width, height);
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const dx = x - width / 2;
          const dy = floor ? (y - 96) : (151 - y);
          const angle = Math.atan2(dy, dx);
          const r = Math.hypot(dx, dy);
          const noiseLobe = noise(x / 21, y / 25) * .18;
          const streak = Math.sin(12 * angle + Math.sin(4 * angle)) * .10;
          const grain = noise(x / 5, y / 4);
          const body = floor
            ? (.97 + noiseLobe + streak - Math.hypot(dx / 87, dy / 81))
            : (.99 + noiseLobe - Math.hypot((dx - dy * .12) / (48 - dy * .16), dy / 145));
          const hollow = floor ? Math.min(1, Math.max(0, (r - 21 + noiseLobe * 20) / 13)) : 1;
          const coverage = body * hollow * 1.9 + grain * .11;
          if (hollow > 0 && body > -.035 && coverage > threshold(x,y)) {
            const core = coverage + grain * .65;
            pixels.set(x, y, shade(ash,7.45-core*5));
          }
        }
      }
      pixels.render(ctx);
    },
  });
}

export function dragStamp(variant: number) {
  const width = 64, height = 48;
  const noise = createNoise2D(`gallery-drag-${variant}`);
  const streaks = [[-9,-3.2,2.8,8.5],[-11,-5,2,11],[-8.5,-2.1,5,10],[-10,-1.5,3.1,7.5]][variant];
  return defineAsset({
    ...maskOptions, width, height,
    render({ ctx }) {
      const pixels = new PixelCanvas(width, height);
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const progress = x / (width - 1);
          const fade = Math.sin(progress * Math.PI) ** .55;
          const bend = 2.8 * Math.sin(progress * Math.PI * (1.1 + variant * .22) + variant);
          const localY = y - height / 2 - bend;
          let body = 0;
          for (const [index, track] of streaks.entries()) {
            const jag = noise(x / 11, index + .71) * (1.85 + index * .13);
            const widthAtX = (1.5 + ((index + variant) % 3) * .98) * fade + .55;
            body = Math.max(body, 1 - Math.abs(localY - track - jag) / widthAtX);
          }
          const noiseValue = noise(x / 6, y / 4);
          const fringe = Math.abs(localY) < 14 && noiseValue > .48;
          if (body < .07 && !fringe) continue;
          const coverage = (body + noiseValue * .22) * fade;
          if (coverage <= 0 || coverage < threshold(x,y) * .60) continue;
          const gloss = coverage > .78 && noiseValue > .24 && Math.sin((x + variant * 3) / 5) > .18;
          const tone = gloss ? 6.3 + 1.7*noiseValue : 1.20 + 5.7*coverage + 2.2*noiseValue;
          pixels.set(x,y,shade(clot,tone));
        }
      }
      pixels.render(ctx);
    },
  });
}

export const bladeBlood = defineAsset({
  ...maskOptions, width: 154, height: 64,
  render({ ctx }) {
    const pixels = new PixelCanvas(154,64);
    const noise = createNoise2D('gallery-pendulum-edge-blood');
    for (let y=1; y<63; y++) {
      for (let x=1; x<153; x++) {
        const base = noise(x/21,y/19);
        const ripple = noise(x/7,y/9);
        const line = Math.sin(x*.57 + base*1.5);
        const low = 40 + 7*base + 3*ripple + 4*line;
        const lobe = Math.abs(x-88) < 48 + 10*base || ripple > .61;
        const drip = line > .70 && x > 54 && x < 119 && y > 25 + base*8;
        if ((y > low && lobe) || drip) {
          const wet = ripple + .2 * Math.sin(x*.22 + y*.44);
          pixels.set(x,y,shade(clot,4.6+wet*3.6+.8*base));
        }
      }
    }
    pixels.render(ctx);
  },
});

export const rubbleDust = defineAsset({
  ...maskOptions, width: 192, height: 128,
  render({ ctx }) {
    const pixels = new PixelCanvas(192,128);
    const noise = createNoise2D('gallery-rubble-dust');
    for (let y = 1; y < 127; y++) {
      for (let x = 1; x < 191; x++) {
        const range = Math.hypot((x-96)/83, (y-64)/53);
        const coverage = .68 - range + noise(x/26, y/17) * .29;
        const grit = noise(x/4.3,y/4.3);
        if (coverage > threshold(x,y) * .83 && grit > -.43) {
          pixels.set(x,y,shade(rock,3.4+4.8*grit+coverage*1.7));
        }
      }
    }
    for (let i = 0; i < 37; i++) {
      const x = Math.round(93 + noise(i * 1.87,.11) * 86);
      const y = Math.round(66 + noise(i * .82,3.45) * 52);
      pixels.set(x,y,p.pedraLuz);
      if (i % 3 === 0) {
        pixels.set(x+1,y,p.pedraBase);
        pixels.set(x,y+1,i%2===0?p.abismo1:p.pedraSombra);
      }
    }
    pixels.render(ctx);
  },
});

export const wallCrack = defineAsset({
  ...maskOptions, width: 128, height: 192,
  render({ ctx }) {
    const pixels = new PixelCanvas(128,192);
    const noise = createNoise2D('gallery-wall-crack');
    const paths = [
      [[70,6],[66,22],[71,43],[60,65],[63,92],[51,110],[53,136],[40,163],[42,185]],
      [[62,91],[83,99],[94,117],[108,126]],
      [[57,116],[38,120],[26,136],[21,151]],
      [[69,42],[84,37],[97,23]],
    ];
    for (const [branch, path] of paths.entries()) {
      for (let j=0; j<path.length-1; j++) {
        const [x0,y0] = path[j];
        const [x1,y1] = path[j+1];
        const steps = Math.max(Math.abs(y1-y0),Math.abs(x1-x0));
        for (let k=0; k<=steps; k++) {
          const t=k/steps;
          const y=Math.round(y0+(y1-y0)*t);
          const x=Math.round(x0+(x1-x0)*t+noise(y/4,branch)*.82);
          pixels.set(x,y,shade(rock,1.35+noise(x/7,y/9)*2.5));
          if (!branch || k > steps*.18) pixels.set(x+1,y,shade(rock,3.65+noise(x/4,y/6)*2.1));
          if (noise(x/8,y/9) > .08) pixels.set(x+2,y,shade(rock,5.6+noise(y/3,x/5)*3.5));
        }
      }
    }
    pixels.render(ctx);
  },
});

export const bloodDrip = defineAsset({
  ...maskOptions, width: 8, height: 16, frames: 16, fps: 24,
  render({ ctx, frameIndex = 0 }) {
    const pixels = new PixelCanvas(8,16);
    if (frameIndex < 11) {
      const travel = Math.round((frameIndex / 10) ** 1.8 * 11);
      pixels.set(3,1+travel,clot[frameIndex%3]);
      pixels.set(3,2+travel,p.sangueBase);
      pixels.set(4,3+travel,clot[6+frameIndex%2]);
      pixels.set(3,3+travel,p.sangueBase);
      pixels.set(4,4+travel,clot[3+frameIndex%2]);
    } else {
      const spread = frameIndex - 10;
      for (let x=Math.max(0,3-spread); x<Math.min(8,4+spread); x++) {
        pixels.set(x,14,p.sangueEscuro);
        if (Math.abs(x-3) < spread-1 && frameIndex < 15) pixels.set(x,13,p.sangueBase);
      }
    }
    pixels.render(ctx);
  },
});

export const candleFlame = defineAsset({
  ...maskOptions, width: 8, height: 12, frames: 32, fps: 48,
  render({ ctx, frameIndex = 0 }) {
    const pixels = new PixelCanvas(8,12);
    const phase = frameIndex * Math.PI / 16;
    const flameHeight = 8.2 + Math.sin(phase) + .49 * Math.sin(3 * phase + .6);
    for (let y=1; y<11; y++) {
      const rise=(10-y)/flameHeight;
      if (rise>=1) continue;
      const center=3.6+rise*Math.sin(phase+rise*2.7);
      const radius=(1-rise)**.65*(1.4+1.25*Math.sin(rise*Math.PI));
      for (let x=1; x<7; x++) {
        const edge=Math.abs(x-center)/radius;
        if (edge>=1) continue;
        const tone=(1-edge)*7.4+(1-rise)*1.1;
        pixels.set(x,y,shade(fire,tone));
      }
    }
    pixels.render(ctx);
  },
});
