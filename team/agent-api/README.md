# OcToS Team · piloto jerárquico de tres agentes

Interfaz pública: https://toniquerol.github.io/octos-apps/team/
Servicio independiente: `team/agent-api/worker.js` (Cloudflare Worker).

**Nunca introducir la clave OPENAI_API_KEY en el HTML, en GitHub ni en el navegador.**

## Funciones
- Dirección `chief`: recibe la consulta y sintetiza.
- Agente 03 `agent-3`: cartografía, WMS y sistemas de referencia.
- Agente 04 `agent-4`: integración y verificación técnica (razonada; sin acceso a red).
- Por petición se realizan 3 llamadas Responses API: dos especialistas en paralelo y una síntesis.
- No tiene permisos de escritura sobre GitHub ni WordPress.

## Despliegue
Crear un Cloudflare Worker con Wrangler. Desde `team/agent-api`:
```sh
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put TEAM_ACCESS_TOKEN
npx wrangler deploy
```

`OPENAI_API_KEY`: clave OpenAI contratada, **solo en Cloudflare**.
`TEAM_ACCESS_TOKEN`: contraseña aleatoria larga, distinta del PIN maestro y de la clave OpenAI, **solo en Cloudflare**.
Si Wrangler requiere un despliegue inicial antes de añadir secretos, ejecutar `npx wrangler deploy` primero y después los dos comandos de secretos.

En OcToS Team → Entrada / Input, configurar la URL HTTPS del Worker, introducir **solo** la contraseña del servicio (`TEAM_ACCESS_TOKEN`), pulsar 'Comprobar conexión' y 'Enviar con API'. La URL se guarda en este navegador; la contraseña no.

## Seguridad / limitaciones
- GitHub Pages y el PIN de la sala no son un servidor de autenticación.
- El servicio comprueba un token privado, limita orígenes del navegador, reduce longitud de entradas y limita la salida del modelo. CORS no es una medida de autenticación.
- Antes de abrir la aplicación a más usuarios, implementar autenticación individual y límites de consumo/peticiones en el borde (Cloudflare).
- `GET /health` comprueba la conexión sin generar tokens OpenAI.
- `POST /run` acepta `{ "task": "..." }` y devuelve NDJSON con eventos `state`, `report`, `done` y `error`.
- `Probar recorrido local` es una **simulación de estados**, no genera respuestas IA ni consume tokens.
- La animación de actividad representa únicamente la sesión de navegador que ejecuta la petición. No altera `team/status.json` ni sincroniza otros equipos.
- Los agentes no tienen navegación web: no afirmar que verificaron la disponibilidad de servicios WMS.
- Modelo por defecto: `gpt-6-luna`. Límite de salida: 650 + 650 + 900 tokens por ejecución.
