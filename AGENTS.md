# Guía para agentes

Antes de tocar la lógica, leer `docs/PROTOCOLO.md`: explica qué parte sale del paper y qué parte es reconstrucción.

## Reglas

- La lógica del protocolo vive en `src/protocol/` y es pura (sin React, sin `window`). Todo cambio ahí va con tests en `src/protocol/__tests__/`.
- Los números del protocolo van en `src/protocol/params.ts`, marcados como [PAPER], [RECONSTRUIDO] o [PROPIO]. No hardcodear parámetros en componentes.
- El tiempo de respuesta se mide desde el inicio de la nota (`AudioEngine.playMidi` devuelve ese instante). Las opciones se habilitan recién cuando la nota empieza a sonar.
- Nunca mostrar la respuesta correcta en niveles sin feedback ni en los tests.
- Notas consecutivas en los tests: siempre a más de 12 semitonos (`TEST_MIN_SEMITONE_GAP`).
- La hélice 3D (`PitchHelix`, Three.js) va solo en el inicio y en la pantalla del tono de Shepard, siempre con `lazy()`. Nunca durante un trial: mostraría la octava de lo que suena.
- Durante un trial nada en pantalla puede depender de la nota antes de responder (el pulso es igual para las 12).
- Colores de la sala de escucha: variables `--np-*` en `src/index.css`, con paleta de día (`:root`) y de noche (`.dark`). No hardcodear hex en la rueda ni en la hélice. En SVG, los colores con `var()` van en `style` de elementos comunes, no en props de `motion` (no se actualizan).
- Datos persistidos en `localStorage` bajo `neuro_pitch_v3`. Si cambia la forma de `UserData`, subir `DATA_VERSION` en `src/state/userData.ts`.

## Flujo

`Home` → `TestFlow` (pre) → `TrainingFlow` (intro con muestras → Shepard si corresponde → 30 trials → resumen → ejercicio especial si toca) → `TestFlow` (post).

`useTrialRunner` corre cualquier secuencia de trials: la persona aprieta Escuchar (o espacio), suena la nota, responde dentro de la ventana o cuenta como error.

`applyAttempt` (en `progression.ts`) decide el avance: pasar, saltar, sumar nota, racha final, pase en frío.

## Verificar

```bash
npm test && npx tsc -b && npx eslint src && npm run build
```

Para probar a mano, `?dev=1`.
