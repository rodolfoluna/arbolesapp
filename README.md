# 🌳 Estructura de Datos APP (PWA Offline-First)

Aplicación Web Progresiva (**PWA**) instalable en celulares, laptops y computadoras para la enseñanza, construcción interactiva y evaluación automática de **Árboles** (Binario por niveles, BST y AVL) y **Estructuras Lineales** (Listas, Pilas y Colas con simulación secuencial de operaciones).

Diseñada para funcionar **100% sin conexión a internet** (offline-first) y sincronizarse automáticamente con **Google Firebase** cuando el dispositivo detecta conexión WiFi o por cable, alojada gratis en **GitHub Pages**.

---

## 🚀 Características Principales

1. **Construcción Manual de Árboles (Lienzo Táctil & PC):**
   - El alumno nunca recibe el árbol dibujado automáticamente.
   - Crea el nodo raíz con un clic (`[ + Crear Nodo Raíz ]`).
   - Al tocar cualquier nodo se despliegan acciones contextuales: `[ ↙ Hijo izq ]`, `[ Hijo der ↘ ]`, `[ ✎ Editar ]` y `[ 🗑 Eliminar subárbol ]`.
   - Soporta Pan (arrastre) y Zoom con rueda del ratón o gesto de pellizco en pantallas táctiles, además de atajos de teclado (`Ctrl+Z` para deshacer, `Enter` para editar, `Delete` para borrar).
   - Chips visuales del conjunto de datos con control de valores ya usados (tachados automáticamente).

2. **Cuestionario Teórico y de Recorridos:**
   - Raíz.
   - Nodos hoja (separados por comas o mediante chips clicables).
   - Nodos internos / rama.
   - Altura del árbol (criterio configurable: por niveles con raíz = 1, o por aristas con raíz = 0).
   - Recorridos ordenados: Preorden, Enorden (Inorden) y Postorden.

3. **Motor de Evaluación Automática en Segundo Plano:**
   - Árbol canónico esperado generado en memoria según el tipo:
     - **Binario Completo:** Inserción por niveles (Level-Order) usando colas (`2i+1` y `2i+2`).
     - **BST:** Comparación menores a la izquierda, mayores o iguales a la derecha (soporta números o letras con orden alfabético español).
     - **AVL:** Inserción BST con cálculo de Factor de Equilibrio ($FE = h_{izq} - h_{der}$) y rotaciones simples (LL, RR) y dobles (LR, RL).
   - Calificación determinista (0 a 100 puntos):
     - Estructura y topología exacta (30 pts).
     - Raíz (10 pts).
     - Nodos hoja como multiconjunto independiente del orden (10 pts).
     - Nodos internos como multiconjunto (10 pts).
     - Altura (10 pts).
     - Preorden (10 pts).
     - Enorden (10 pts).
     - Postorden (10 pts).

4. **Ejercicios de Estructuras Lineales (Listas, Pilas y Colas):**
   - El profesor configura el estado inicial de la estructura y una secuencia ordenada de operaciones.
   - Catálogo interactivo de operaciones según la estructura seleccionada:
     - **Lista:** `add(x)`, `add(i, x)`, `remove(i)`, `get(i)` / `getElementAt(i)`, `set(i, x)`, `head()`, `tail()`, `indexOf(x)`, `size()`, `isEmpty()`.
     - **Pila:** `push(x)`, `pop()`, `peek()`, `size()`, `isEmpty()`.
     - **Cola:** `enqueue(x)`, `dequeue()`, `front()`, `size()`, `isEmpty()`.
   - Previsualización paso a paso en vivo para el docente con validación de sintaxis y estado final.
   - El alumno deduce y captura:
     - **Estado final** de la estructura tras ejecutar todas las instrucciones.
     - **Datos extraídos / retornados** por las operaciones de consulta o extracción.
   - Calificación determinista y automática (50% estado final, 50% datos extraídos).

5. **Arquitectura 100% Gratuita (Sin Backend de Pago):**
   - **Correo Sintético:** Alumnos inician sesión solo con su **Número de Control** (ej. `22010456`). La app mapea internamente a `22010456@arboles.app`.
   - **Alta Masiva por CSV con Instancia Secundaria:** El profesor sube un archivo `.csv` con `NumeroControl, Nombre`. El navegador genera contraseñas aleatorias de 6 caracteres mediante una instancia secundaria de Firebase Auth en memoria (sin cerrar la sesión del profesor) y descarga automáticamente `credenciales_iniciales.csv`.
   - **Primer Inicio Obligatorio:** Si `mustChangePassword == true`, la app bloquea el acceso hasta que el alumno defina su propia contraseña.
   - **Restablecimiento de Contraseña:** Genera una nueva credencial temporal sin perder las entregas previas del alumno.

6. **Panel del Docente y Matriz de Avances en Tiempo Real:**
   - Monitoreo en vivo de avances y promedios por actividad.
   - Clic en cualquier celda para ver el desglose rubro por rubro tanto en ejercicios de árboles como de estructuras lineales.
   - Exportación de calificaciones a archivo CSV / Excel.

7. **Offline-First:**
   - Caché persistente multi-pestaña en **IndexedDB** (`persistentLocalCache` + `persistentMultipleTabManager`).
   - Service Worker con precaché de todas las fuentes, íconos y bundle compilado vía **Vite PWA**.
   - Indicador visual: 🟢 Sincronizado en la nube / 🟡 Modo sin conexión (Guardado en dispositivo).

---

## 🛠️ Tecnologías Utilizadas

- **Frontend:** React 19 + TypeScript + Vite 8
- **Estilos:** Tailwind CSS v4 + Fuentes variables empaquetadas localmente (`Outfit`, `JetBrains Mono`)
- **PWA:** `vite-plugin-pwa` + `Workbox` (Service Worker)
- **Base de Datos & Auth:** Firebase Cloud Firestore + Firebase Authentication (Plan Spark gratuito)
- **Manipulación de CSV:** PapaParse
- **Testing:** Vitest (27 pruebas unitarias automáticas de árboles y estructuras lineales)
- **CI/CD & Hosting:** GitHub Actions + GitHub Pages (HTTPS gratuito)

---

## 💻 Ejecución Local

1. Clona el repositorio e instala las dependencias:
   ```bash
   npm install
   ```

2. Ejecuta las pruebas unitarias:
   ```bash
   npx vitest run
   ```

3. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

> **💡 Modo Demo:** Si aún no configuras Firebase, la aplicación incluye un modo demo local que te permite probar todas las vistas (profesor, alumno, canvas táctil, matrices de avance y evaluación) sin requerir claves de inmediato.

---

## ⚙️ Configuración de Firebase (Plan Gratuito)

1. Ingresa a [console.firebase.google.com](https://console.firebase.google.com/) y crea un proyecto gratuito.
2. En **Authentication > Sign-in method**, habilita el proveedor **Correo electrónico / Contraseña**.
3. En **Firestore Database**, crea una base de datos en modo producción y pega las reglas de [firestore.rules](file:///c:/ws/arboles/firestore.rules).
4. En **Authentication > Users**, crea tu cuenta de profesor con tu correo electrónico.
5. Registra una app web en la configuración del proyecto y copia las credenciales a `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Llena las variables:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=tu-proyecto
   VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
   VITE_TEACHER_EMAIL=tu_correo_profesor@ejemplo.com
   VITE_EMAIL_DOMAIN=arboles.app
   ```

---

## 🌐 Despliegue Gratuito en GitHub Pages

1. Sube tu código a un repositorio en GitHub en la rama `main`.
2. En tu repositorio de GitHub, ve a **Settings > Secrets and variables > Actions** y agrega los mismos valores de tu `.env.local` como secrets del repositorio.
3. En **Settings > Pages**, en *Build and deployment > Source*, selecciona **GitHub Actions**.
4. Cada `git push origin main` compilará y publicará la PWA automáticamente con HTTPS gracias al flujo configurado en [.github/workflows/deploy.yml](file:///c:/ws/arboles/.github/workflows/deploy.yml).
