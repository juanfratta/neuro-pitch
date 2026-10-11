# Neuro Pitch

Entrenamiento de oído absoluto para adultos basado en el protocolo de Wong, Cheung, Ngan y Wong (2025), "Learning fast and accurate absolute pitch judgment in adulthood", *Psychonomic Bulletin & Review* 32:1676–1688 ([doi:10.3758/s13423-024-02620-2](https://doi.org/10.3758/s13423-024-02620-2)).

## Qué hace

1. **Test inicial.** 144 notas sueltas, piano y guitarra, tres octavas, notas consecutivas a más de 12 semitonos, sin feedback. Es la línea de base.
2. **Entrenamiento.** Se arranca con F y se agrega una nota vecina por etapa (F, E, F#, D#, G…). Cada etapa tiene 24 niveles: la exigencia sube de 20% a 90%, primero con feedback y después sin, y la ventana de respuesta se ajusta a la de la tabla del paper (1.183 ms con 1 nota a 2.028 ms con 12).
3. **Tonos fuera de rango.** En cada trial pueden sonar las notas vecinas a 1 y 2 semitonos del set aprendido; se responden con el botón "Fuera de rango". Así, aun con una sola nota, hay que reconocerla por cómo suena.
4. **Herramientas del paper.** Muestras antes de cada nivel, tono de Shepard de 20 s antes de un nivel sin feedback, salto de nivel, retroceso tras 10 intentos fallidos y ejercicios sobre la nota más floja.
5. **Cierre.** Pasar el último nivel tres veces seguidas y después una vez al primer intento, tras 12 h sin entrenar.
6. **Test de progreso.** El mismo test del inicio, con 10 h de entrenamiento como mínimo, una vez por semana y con 12 h sin entrenar antes. Reporta aciertos, error en semitonos y tiempo, por timbre.

Qué esperar: en el estudio, músicos adultos que entrenaron unas 21 h en 8 semanas aprendieron en promedio 7 notas al 90%; dos de doce llegaron a las 12.

El detalle de qué sale del paper y qué es reconstrucción está en [docs/PROTOCOLO.md](docs/PROTOCOLO.md).

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests del motor del protocolo
npm run build
```

Modo desarrollo: abrir con `?dev=1`. Muestra la respuesta esperada en cada trial, permite saltear el tono de Shepard, mover etapa y nivel, simular 12 h sin entrenar y exportar los datos en JSON o CSV. Solo dura mientras `?dev=1` esté en la URL; la respuesta esperada en cada trial es una opción aparte del panel, apagada por defecto.

## Estructura

```
src/
  protocol/   motor puro y testeado: notas, currículum, escalera, avance, tests
  audio/      soundfonts, clips de 800 ms, tono de Shepard
  state/      datos del usuario (localStorage) y reglas de calendario
  hooks/      useTrialRunner: un trial = escuchar, responder dentro de la ventana
  screens/    Inicio, Entrenamiento, Test
  components/ piezas de UI
```

Los parámetros del protocolo están todos en `src/protocol/params.ts`.

## Licencia

MIT
