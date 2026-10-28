# Compostaje fílmico y formas de encuentro

Demo estática para publicar en GitHub Pages. La interfaz y los mensajes están en español.

## Agregar los videos

- Coloca el video de fondo en `assets/ambient-loop.mp4`.
- Coloca los seis videos en `assets/videos/` con los nombres `video-01.mp4` a `video-06.mp4`.
- MP4 con video H.264 es el formato recomendado para el navegador.
- Puedes cambiar los nombres que aparecen en la galería en la lista `clips` de `app.js`.
- El cursor de la página usa el PNG que agregaste.
- La tipografía de la interfaz usa `assets/TheMeshroom-3zaXL.ttf`.
- Las texturas que agregaste en `assets/backgrounds/` se muestran como fondo en las distintas pantallas y en las seis tarjetas de video. Las copias JPG optimizadas que usa el sitio están en `assets/backgrounds/web/`.
- El papel se recorta dentro de las letras con `background-clip: text`. La intensidad se puede ajustar con `--font-texture-contrast` y la escala con `--font-texture-size` en `styles.css`.
- El sitio usa una copia recortada y reducida en `assets/cursor-48.png` para que el navegador pueda mostrarlo. El PNG original queda intacto.

## Publicar en Netlify

El sitio es HTML, CSS y JavaScript estático; no requiere instalar paquetes ni ejecutar un comando de build. `netlify.toml` configura la raíz del repositorio como carpeta de publicación. Conecta este repositorio en Netlify y publica la rama `main`.

Para probar localmente, sirve esta carpeta desde `localhost`, por ejemplo con `python3 -m http.server 8000`. El acceso a la cámara requiere HTTPS o localhost. Si hay más de una cámara, el navegador puede permitir seleccionar el microscopio USB.

Los videos no están incluidos todavía. Agrega el video de bienvenida como `assets/ambient-loop.mp4` y los seis clips como `assets/videos/video-01.mp4` a `video-06.mp4` para completar el contenido multimedia.

## Guardar fotos y videos

En navegadores compatibles, la primera captura pide elegir una carpeta y guarda ahí las siguientes capturas durante esa sesión. Otros navegadores descargan cada archivo con el flujo normal del navegador. El sitio no envía ni sube las capturas. Los videos se detienen después de dos minutos y cinco minutos sin interacción regresan al inicio.
