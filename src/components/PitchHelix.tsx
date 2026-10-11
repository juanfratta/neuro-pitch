/**
 * Hélice de altura tonal en 3D (Three.js).
 *
 * El modelo clásico de la percepción de altura: el ángulo es el croma (la nota) y la
 * altura es la octava. Vista desde arriba es la rueda cromática. Es la distinción
 * central del paper: se entrena el ángulo, no la altura.
 *
 * - mode "map": las 36 notas del entrenamiento (C4 a B6). Las aprendidas se encienden
 *   en las tres octavas y se unen con una columna vertical.
 * - mode "shepard": espiral infinita que baja una octava cada 10 s, al ritmo del tono
 *   de Shepard. No representa ninguna nota en particular.
 *
 * Nunca se usa durante un trial: mostraría la octava de lo que suena.
 * Se carga con import dinámico para no sumar peso al resto de la app.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CHROMAS, displayNote, type Chroma } from '../protocol/notes';

const RADIUS = 2.1;
const RISE = 1.5; // altura por octava
const MAP_OCTAVES = 3;
const SHEPARD_SECONDS_PER_OCTAVE = 10; // igual que el tono de Shepard del motor de audio

export interface PitchHelixProps {
  mode: 'map' | 'shepard';
  learned?: Chroma[];
  next?: Chroma | null;
  /** 0 a 100 por nota, para la intensidad del brillo y la etiqueta. */
  accuracy?: Partial<Record<Chroma, number>>;
  height?: number;
  className?: string;
}

interface Palette {
  brass: THREE.Color;
  mist: THREE.Color;
  faint: THREE.Color;
  lavender: THREE.Color;
  room: THREE.Color;
  text: string;
}

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    brass: new THREE.Color(get('--np-brass', '#E3B35C')),
    mist: new THREE.Color(get('--np-mist', '#A9B6CF')),
    faint: new THREE.Color(get('--np-faint', '#3A4A6B')),
    lavender: new THREE.Color(get('--np-lavender', '#8E93D6')),
    room: new THREE.Color(get('--np-room', '#0F1B33')),
    text: get('--np-text', '#E6ECF5'),
  };
}

/** Punto de la hélice para un semitono (0 = C4). C queda al frente. */
function helixPoint(semitone: number, centerOctaves: number): THREE.Vector3 {
  const theta = (semitone / 12) * Math.PI * 2;
  return new THREE.Vector3(RADIUS * Math.sin(theta), (semitone / 12 - centerOctaves / 2) * RISE, RADIUS * Math.cos(theta));
}

function helixLine(from: number, to: number, centerOctaves: number, material: THREE.Material, thickness = 0.022): THREE.Mesh {
  const points: THREE.Vector3[] = [];
  for (let s = from; s <= to; s += 0.25) points.push(helixPoint(s, centerOctaves));
  const curve = new THREE.CatmullRomCurve3(points);
  const segments = Math.max(16, Math.round((to - from) * 6));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, segments, thickness, 8, false), material);
}

/** Textura de halo radial, para dar brillo a las notas aprendidas. */
function haloTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function isDarkTheme(): boolean {
  return document.documentElement.classList.contains('dark');
}

function labelSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 64px Fraunces, Georgia, serif';
  ctx.fillText(text, 128, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(1.1, 0.55, 1);
  return sprite;
}

function disposeTree(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    materials.forEach((m) => {
      (m as THREE.SpriteMaterial).map?.dispose();
      m.dispose();
    });
  });
}

function buildMap(group: THREE.Group, palette: Palette, learned: Chroma[], next: Chroma | null, accuracy: PitchHelixProps['accuracy']) {
  const total = MAP_OCTAVES * 12;
  group.add(helixLine(0, total - 1, MAP_OCTAVES, new THREE.MeshBasicMaterial({ color: palette.mist, transparent: true, opacity: 0.55 })));
  // la hélice sigue más allá del rango entrenado, apenas visible
  group.add(helixLine(-7, 0, MAP_OCTAVES, new THREE.MeshBasicMaterial({ color: palette.faint, transparent: true, opacity: 0.45 }), 0.014));
  group.add(helixLine(total - 1, total + 6, MAP_OCTAVES, new THREE.MeshBasicMaterial({ color: palette.faint, transparent: true, opacity: 0.45 }), 0.014));

  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const halo = haloTexture();
  const haloMaterial = new THREE.SpriteMaterial({
    map: halo,
    color: palette.brass,
    transparent: true,
    depthWrite: false,
    opacity: isDarkTheme() ? 0.55 : 0.35,
    blending: isDarkTheme() ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  CHROMAS.forEach((chroma, c) => {
    const isLearned = learned.includes(chroma);
    const isNext = chroma === next;
    const acc = accuracy?.[chroma];
    const glow = isLearned ? 0.35 + 0.65 * ((acc ?? 60) / 100) : 0;

    for (let o = 0; o < MAP_OCTAVES; o++) {
      const p = helixPoint(o * 12 + c, MAP_OCTAVES);
      const material = new THREE.MeshStandardMaterial({
        color: isLearned ? palette.brass : isNext ? palette.lavender : palette.faint,
        emissive: isLearned ? palette.brass : isNext ? palette.lavender : new THREE.Color(0x000000),
        emissiveIntensity: isLearned ? glow : isNext ? 0.35 : 0,
        roughness: 0.35,
        metalness: isLearned ? 0.3 : 0.1,
      });
      const mesh = new THREE.Mesh(sphere, material);
      mesh.position.copy(p);
      mesh.scale.setScalar(isLearned ? 0.2 : isNext ? 0.14 : 0.075);
      group.add(mesh);
      if (isLearned) {
        const glowSprite = new THREE.Sprite(haloMaterial);
        glowSprite.position.copy(p);
        glowSprite.scale.setScalar(0.75 + 0.5 * glow);
        group.add(glowSprite);
      }
    }

    if (isLearned || isNext) {
      // columna: la misma nota en las tres octavas
      const bottom = helixPoint(c, MAP_OCTAVES);
      const top = helixPoint((MAP_OCTAVES - 1) * 12 + c, MAP_OCTAVES);
      const column = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, top.y - bottom.y, 8),
        new THREE.MeshBasicMaterial({ color: isLearned ? palette.brass : palette.lavender, transparent: true, opacity: isLearned ? 0.85 : 0.4 })
      );
      column.position.set(bottom.x, (top.y + bottom.y) / 2, bottom.z);
      group.add(column);

      const label = labelSprite(isLearned && acc !== undefined ? `${displayNote(chroma)} ${Math.round(acc)}%` : displayNote(chroma), palette.text);
      label.position.copy(top).add(new THREE.Vector3(0, 0.5, 0));
      if (isLearned && acc !== undefined) label.scale.set(1.7, 0.55, 1);
      group.add(label);
    }
  });
}

/** Marca fija al frente: el punto de la espiral que está sonando. */
function shepardMarker(palette: Palette): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshStandardMaterial({ color: palette.brass, emissive: palette.brass, emissiveIntensity: 0.8 })
  );
  mesh.position.set(0, 0, RADIUS);
  mesh.scale.setScalar(0.16);
  return mesh;
}

function buildShepard(group: THREE.Group, palette: Palette) {
  const octaves = 8;
  group.add(helixLine(0, octaves * 12, octaves, new THREE.MeshBasicMaterial({ color: palette.mist, transparent: true, opacity: 0.6 })));
  const sphere = new THREE.SphereGeometry(1, 16, 12);
  const material = new THREE.MeshStandardMaterial({ color: palette.lavender, emissive: palette.lavender, emissiveIntensity: 0.3, roughness: 0.5 });
  for (let s = 0; s <= octaves * 12; s++) {
    const mesh = new THREE.Mesh(sphere, material);
    mesh.position.copy(helixPoint(s, octaves));
    mesh.scale.setScalar(0.07);
    group.add(mesh);
  }
}

export default function PitchHelix({ mode, learned = [], next = null, accuracy, height = 320, className = '' }: PitchHelixProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const learnedKey = learned.join(',');
  const accuracyKey = JSON.stringify(accuracy ?? {});

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // sin WebGL: no se muestra la hélice
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'pan-y';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(mode === 'map' ? 34 : 40, 1, 0.1, 100);
    if (mode === 'map') {
      camera.position.set(0, 2.2, 10);
      camera.lookAt(0, 0.25, 0);
    } else {
      camera.position.set(0, 1.2, 8.5);
      camera.lookAt(0, 0, 0);
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.PointLight(0xffffff, 60, 40);
    key.position.set(4, 6, 8);
    scene.add(key);

    const group = new THREE.Group();
    scene.add(group);

    let marker: THREE.Mesh | null = null;
    const build = () => {
      disposeTree(group);
      group.clear();
      if (marker) {
        disposeTree(marker);
        scene.remove(marker);
        marker = null;
      }
      const palette = readPalette();
      scene.fog = new THREE.Fog(palette.room, mode === 'map' ? 10.5 : 6.5, mode === 'map' ? 17 : 12);
      if (mode === 'map') buildMap(group, palette, learned, next, accuracy);
      else {
        buildShepard(group, palette);
        marker = shepardMarker(palette);
        scene.add(marker);
      }
    };
    build();

    // re-pintar si cambia el tema
    const themeObserver = new MutationObserver(build);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const resize = () => {
      const width = host.clientWidth;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    // arrastrar para girar (solo el mapa)
    let dragging = false;
    let lastX = 0;
    let userSpin = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      userSpin += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    };
    const onUp = () => {
      dragging = false;
    };
    if (mode === 'map') {
      renderer.domElement.addEventListener('pointerdown', onDown);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    }

    const clock = new THREE.Clock();
    let frame = 0;
    const render = () => {
      const t = clock.getElapsedTime();
      if (mode === 'map') {
        group.rotation.y = (reduceMotion ? 0.5 : t * 0.18) + userSpin;
      } else if (!reduceMotion) {
        // bajar una octava = una vuelta y una altura de octava; el ciclo empalma sin salto
        const phase = (t / SHEPARD_SECONDS_PER_OCTAVE) % 1;
        group.position.y = phase * RISE;
        group.rotation.y = phase * Math.PI * 2;
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      themeObserver.disconnect();
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      disposeTree(group);
      if (marker) disposeTree(marker);
      renderer.dispose();
      renderer.domElement.remove();
    };
    // learnedKey y accuracyKey resumen learned y accuracy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, learnedKey, next, accuracyKey, height]);

  // los extremos de la hélice se desvanecen: sugiere que sigue más allá del rango entrenado
  const fade = 'linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)';
  return <div ref={hostRef} className={className} style={{ height, maskImage: fade, WebkitMaskImage: fade }} aria-hidden />;
}
