# Búsqueda binaria y encadenamiento separado

En **Nueva actividad** se pueden añadir ejercicios individuales de búsqueda binaria y encadenamiento separado, o usar **Plantilla: búsqueda binaria y encadenamiento** para generar exactamente uno de cada tipo. La plantilla reemplaza los ejercicios del formulario con confirmación; no altera actividades ya publicadas.

Cada ejercicio incluye **Explicación y algoritmo**: texto conceptual en español, ejemplo del cálculo hash, reglas de la variante y pseudocódigo. El profesor puede consultar el procedimiento esperado y configurar datos, objetivos, tabla y máximo de intentos. Los tipos anteriores siguen siendo compatibles.

## Búsqueda binaria

Arreglo estrictamente creciente de 3 a 31 enteros entre 0 y 999, sin repetidos; de 1 a 6 objetivos, presentes o ausentes. El alumno elige el índice medio usando `floor((bajo+alto)/2)`, compara y decide descartar izquierda o derecha incluyendo el medio. El estado muestra el intervalo restante. No se permite declarar encontrado antes de comparar, ni declarar ausente mientras el intervalo siga siendo válido. Cada objetivo nuevo reinicia los límites. No se evalúa el tiempo.

## Encadenamiento separado

De 1 a 12 claves enteras únicas entre 0 y 999, tabla de 2 a 13 cubetas y de 1 a 6 objetivos. Función fija y visible `h(k) = k mod m`. No se muestra su resultado antes de que el alumno lo calcule correctamente.

Primera fase, por cada clave en el orden dado:

1. Escribir y comprobar el resultado de la función.
2. Elegir la cubeta correcta.
3. Seleccionar la tarjeta e indicar la posición final de la cadena, numerada desde 0.
4. Insertar. Una colisión agrega un nodo al final; no reemplaza anteriores.

Segunda fase, por cada objetivo, sobre la tabla construida:

1. Calcular otra vez la función y elegir cubeta.
2. Si está vacía, declarar ausencia. Si no, pulsar el primer nodo para visitarlo.
3. Comparar y avanzar de uno en uno, sin saltarse nodos.
4. Declarar encontrado al coincidir o ausente solo al llegar a `∅`.

Los errores no cambian el estado ni avanzan el puntero. Se separan por cálculo hash, inserción y búsqueda. La rúbrica asigna 30, 35 y 35 puntos respectivamente. Para cada rubro se multiplica su peso por avance y precisión (`correctos/(correctos+errores)`), redondeando cada rubro; la suma es la nota. En búsqueda binaria el procedimiento de búsqueda vale 100 puntos. Solo se permite evaluar un recorrido completo; guardar parcial no consume un intento.

## Borradores, servidor y revisión

El historial compacto se guarda localmente por cada acción; no hay escritura por clic en Firebase. Guardar en la nube o evaluar envía una sola entrega. El backend valida configuración, pertenencia al grupo, estado abierto, esquema e historial; reproduce las acciones y recalcula nota e intentos. No confía en notas, errores ni punteros declarados por el navegador. El máximo es 3000 acciones por recorrido. Un fallo de red conserva el borrador y no consume un intento confirmado. Si quedan oportunidades, se puede iniciar otro recorrido desde una entrega evaluada; no se ofrece borrar errores a mitad de uno nuevo.

La matriz conserva el formato de las entregas anteriores y añade el detalle del procedimiento: clave, acción, resultado y acción esperada, además de la rúbrica. No se prometen pruebas de autoría de clics: como en ordenamiento, se comprueba la coherencia del historial recibido, no se proporciona supervisión antifraude.

## Ensayo local

`http://127.0.0.1:5180/tools/search-preview.html` con Vite abierto en ese puerto. Este laboratorio no importa Firebase ni autenticación y no crea actividades reales. Las pruebas de navegador verifican un cálculo hash incorrecto, su corrección, dos claves colisionando en la misma cubeta y el avance de un intervalo binario. Los tests automatizados cubren extremos, ausencias, cubeta vacía, colisiones, prevención de saltos, validación, nota e intentos en servidor, reanudación, fallo de envío y constructor docente.

El despliegue debe actualizar primero el backend de Render y después GitHub Pages. No requiere migración de datos ni cambios de reglas Firestore.
