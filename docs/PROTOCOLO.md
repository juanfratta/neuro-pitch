# Protocolo: paper vs. implementación

Cada parámetro de `src/protocol/params.ts` está marcado con su origen:

- **[PAPER]** dato del artículo o de su material suplementario (OSM).
- **[RECONSTRUIDO]** el artículo da el marco pero no el número exacto.
- **[PROPIO]** decisión nuestra que el paper no especifica.

| Aspecto | Paper | Implementación | Origen |
| --- | --- | --- | --- |
| Orden de notas | F y vecinas alternando abajo y arriba | Igual (`introductionOrder`) | PAPER |
| Fuera de rango | ±1 y ±2 semitonos de los bordes del set, con botón propio | Igual (`outOfBoundSet`). El botón es el centro de la rueda mientras suena la nota: queda donde estaba el cursor al tocar Escuchar y a igual distancia de todas las notas | PAPER + PROPIO |
| Proporción de fuera de rango | No informada | Al menos 50% de trials con notas aprendidas, y para pasar también hay que alcanzar el mínimo en esas | PROPIO |
| Niveles | 24 por nota, 288 en total, 20% a 90%, primero con feedback | 1-8 con feedback 20-90% (ventana x1,5); 9-12 con feedback 90% achicando la ventana; 13-20 sin feedback 20-90%; 21-24 sin feedback 90% | RECONSTRUIDO |
| Ventana final por etapa | OSM Table 1: 1183, 1242, 1305, 1371, 1440, 1513, 1589, 1668, 1751, 1839, 1930, 2028 ms | Igual | PAPER |
| Respuesta tardía | Error | Error; se mide desde el inicio de la nota | PAPER |
| Trials por intento | No informado | 30 | PROPIO |
| Estímulos | Piano C4-B6, 800 ms, rampa de 100 ms | Igual; MusyngKite para entrenar | PAPER |
| Muestras | Opcionales, tres octavas en orden aleatorio | Igual | PAPER |
| Shepard | 20 s si el nivel siguiente es sin feedback | Igual, solo si se escucharon muestras | PAPER |
| Salto de nivel | 90% en un nivel fácil salta al siguiente del primero que pide 90% | Igual, dentro del bloque con o sin feedback | PAPER |
| Retroceso | Tras 10 intentos fallidos, a criterio del experimentador | Se ofrece un botón: sin feedback vuelve al nivel 9; con feedback, 4 niveles atrás | PAPER + PROPIO |
| Nota más floja | Con 5+ notas, cada 15 niveles: 12 trials con feedback y 22 sin | Igual; ventana x1,5 con feedback | PAPER |
| Cierre | Nivel 288 tres veces seguidas y una más al primer intento tras 12 h | Igual | PAPER |
| Pre/post test | 144 trials, 12 notas x 3 octavas x 2 timbres x 2, >12 semitonos entre consecutivas, 5 s, sin feedback | Igual. Piano de test: FluidR3_GM (distinto del de entrenamiento). Guitarra: FluidR3_GM nylon | PAPER |
| Post-test | Con 10 h o más de entrenamiento | 10 h o protocolo completo; una vez por semana; 12 h sin entrenar antes | PAPER + PROPIO |
| Métricas | Aciertos, error en semitonos, tiempo de aciertos | Igual, por timbre | PAPER |
| Adherencia | Fichas, multiplicadores, racha de días | Racha (se corta tras 2 días sin entrenar), meta semanal de 2 h, total de 25 h. Sin fichas ni multiplicadores | PAPER parcial |
| Control de trampa | Zoom, webcam, pantalla compartida | Confirmación de auriculares y sin referencias | PROPIO |

## Pendientes

- Confirmar con los autores el reparto exacto de los 24 niveles y los trials por nivel.
- Servir los samples desde la app en vez del CDN de soundfonts, y normalizar el volumen entre notas.
- Fichas y multiplicadores de puntos (gamificación del paper), si se quiere replicar del todo.
