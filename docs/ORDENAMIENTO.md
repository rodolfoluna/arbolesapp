# Actividades de algoritmos de ordenamiento

Versión de publicación del 18 de noviembre de 2026: integrada con Aula Identidad, el backend de Render y GitHub Pages. El despliegue actualiza primero el backend compatible y después la interfaz. No requiere migrar ni recrear grupos o entregas; los ensayos previos no modificaron datos académicos reales.

En **Nueva actividad → Plantilla: los 10 algoritmos de ordenamiento** se genera un ejercicio por algoritmo. La plantilla reemplaza los ejercicios del formulario con confirmación y solo está disponible al crear una actividad. También se pueden añadir ejercicios individuales y combinar tipos. Los ejercicios anteriores conservan sus formatos e IDs.

Algoritmos: Bucket, Radix, Counting, Shell, Heap, Quick, Merge, Insertion, Selection y Bubble. Cada ejercicio incluye **Leer algoritmo**, pseudocódigo en español, variante exacta y acciones específicas. El editor docente permite cambiar los datos iniciales y consultar el procedimiento esperado.

## Procedimiento y evaluación

Las tarjetas tienen una identidad independiente del valor (#1, #2, …), para distinguir números repetidos. Las posiciones comienzan en cero. El alumno selecciona una o dos tarjetas, el destino cuando corresponde y la acción. Comparar antes de intercambiar es obligatorio. Un movimiento incorrecto se registra, no cambia el estado ni avanza el puntero. `Siguiente pasada` solo se acepta al terminar la fase prevista. Las cubetas, la clave extraída, los conteos y el arreglo auxiliar aparecen según el algoritmo.

Se admiten de 3 a 12 enteros entre 0 y 99, incluidos repetidos. Esto mantiene acotados los historiales y los auxiliares de los algoritmos distributivos. Variantes acordadas: Bubble ascendente sin corte anticipado; Selection conserva el primer mínimo; Insertion desplaza mayores; Shell usa mitades enteras del salto n/2; Heap usa max-heap; Quick usa Lomuto con pivote final y ≤; Merge superior estable (izquierda en empate); Bucket usa decenas e inserción interna por intercambios adyacentes; Radix LSD decimal estable; Counting estable con acumulados y salida desde la derecha. Las variantes están escritas en el pseudocódigo de cada ejercicio.

La nota es `redondear(100 × avance × pasos_correctos / acciones_registradas)`. El avance es la fracción de pasos del algoritmo completados. Para evaluar se exige terminar el procedimiento; un historial parcial se puede guardar sin consumir un intento. Cada error reduce la precisión. Los intentos son evaluaciones completas, no clics ni movimientos rechazados. Otro recorrido se puede iniciar desde una entrega evaluada si quedan intentos; no se ofrece borrar errores a mitad de un recorrido nuevo.

En modo central, el backend valida el esquema del historial, reproduce los pasos y calcula errores y nota; ignora notas, punteros y contadores que envíe el navegador. Un envío incompleto no consume intentos ni escribe una evaluación. El bloqueo de actividad, la pertenencia a grupos y el máximo de intentos siguen aplicándose en servidor. Este mecanismo comprueba coherencia del procedimiento registrado: no es una prueba de autoría de clics ni un sistema de supervisión antifraude; el algoritmo y la validación inmediata también son visibles en el navegador.

## Borradores y consumo de Firebase

Cada clic actualiza el borrador local (incluidos los errores). No se envía una petición por paso. **Guardar en la nube** y **Guardar y evaluar recorrido** envían el historial compacto completo a través del backend, usando el documento de entrega existente. No se guardan snapshots por paso ni documentos separados por clic en Firestore. El máximo es 5000 acciones por recorrido. La confirmación del servidor actualiza los intentos; un fallo de envío conserva el historial para reintentar.

La matriz muestra las notas guardadas. Al abrir el detalle docente aparecen avance, errores, acciones aceptadas/rechazadas, respuestas esperadas y algoritmo. No es necesario cambiar reglas Firestore, migrar datos ni recrear grupos para habilitar el nuevo tipo. Backend y frontend deben desplegarse coordinados: primero el backend compatible, después la interfaz.

## Prueba local sin datos reales

Con `npm run dev -- --host 127.0.0.1 --port 5180 --strictPort`, abrir `http://127.0.0.1:5180/tools/sorting-preview.html`. Este laboratorio permite seleccionar los diez algoritmos, usar las tarjetas y abrir la revisión docente. No importa autenticación ni Firebase y sus acciones no crean usuarios, actividades o entregas. No forma parte del bundle público de la app.

Las pruebas automatizadas cubren orden final y conservación de tarjetas con entradas ordenadas, invertidas, ceros y duplicados; estabilidad de los algoritmos estables; rechazo sin avance; reanudación de errores; validación en servidor; nota autoritativa, máximo de intentos, evaluación incompleta y borradores sin escrituras por clic. La prueba de navegador local verifica lectura del algoritmo, rechazo de intercambio prematuro, comparación/intercambio correctos, distribución Radix e historial docente. No se crearon actividades académicas reales durante este ensayo.

Validación de esta entrega: 197 pruebas en 21 archivos, comprobación TypeScript del backend y compilación frontend correctas. La comprobación central del bundle valida CSP, callback y ausencia de patrones de claves administrativas.

## Publicación verificada

El 18 de noviembre de 2026 se desplegó el backend compatible en `arboles-api` (Render, commit `321cf2d`) y después la interfaz en GitHub Pages (commit `f118951`). Ambos despliegues finalizaron correctamente. El backend respondió 200 en `/health`; el bundle público contiene la plantilla y los diez algoritmos. Se verificó el ingreso docente, la generación de diez ejercicios en el formulario y la lectura de pseudocódigo. El formulario de comprobación no se guardó como actividad real. El respaldo posterior conserva idénticos los dos grupos, las tres actividades, las 88 entregas y los 33 vínculos centrales; todas las membresías permanecen intactas.
