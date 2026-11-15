# OcToS Team · primera conexión de agentes por API

Interfaz: https://toniquerol.github.io/octos-apps/team/

Código del Worker: `team/agent-api/worker.js`.

## Alcance

- Dirección coordina a Agente 03 (Cartografía) y Agente 04 (Integración).
- La sala presenta las tres figuras sentadas en sus puestos, el estado de ejecución y el botón **Nueva petición / Input**.
- Prueba local sin llamadas IA (coste cero); prueba con IA usando tres peticiones a OpenAI Responses API.
- El piloto no consulta Internet por sí mismo, no publica cambios en GitHub ni WordPress y no comparte estados entre navegadores.

## Seguridad

**Nunca pegues la clave OpenAI en ChatGPT ni en GitHub, ni la escribas en el HTML público o en el PIN.** La primera configuración desde la sala solo es segura cuando el Worker **ya está desplegado en tu cuenta Cloudflare**, con un token de configuración privado y un almacenamiento KV vinculado. La clave viaja al Worker por HTTPS; allí se cifra con **AES-256-GCM** mediante una clave criptográfica guardada como `TEAM_ENCRYPTION_KEY` en los secretos de Cloudflare. Cloudflare KV guarda únicamente el texto cifrado.

Cloudflare recomienda utilizar `secrets` para las credenciales del Worker. Aquí los secretos duraderos para el cifrado, el acceso y la instalación están en Cloudflare; la clave OpenAI se mantiene cifrada en Workers KV para permitir introducirla una sola vez desde la sala. También se admite `OPENAI_API_KEY` como secreto Cloudflare convencional, sin pasar por la sala.

El PIN de OcToS Team únicamente oculta la interfaz; **no autentica ante el Worker**. Son imprescindibles los tokens privados del servidor. La contraseña de acceso y la contraseña de configuración deben ser aleatorias, largas y diferentes.

## Instalación del servidor · se realiza una sola vez

Requisitos: cuenta Cloudflare, Node.js y Wrangler; autenticación y despliegue en la cuenta del titular. No se puede hacer esta etapa desde GitHub Pages.

1. Descarga/clona el repositorio y abre una terminal en la carpeta `team/agent-api`.
2. Inicia sesión: `npx wrangler login`.
3. Crea el almacén KV: `npx wrangler kv namespace create TEAM_SECRETS`. Guarda el ID que te muestra.
4. Añade al final de `wrangler.toml` lo siguiente con **tu ID real de KV**:

```toml
[[kv_namespaces]]
binding = "TEAM_SECRETS"
id = "PEGA_AQUI_EL_ID_REAL_DE_KV"
```

5. Prepara tres contraseñas distintas con un generador criptográfico de tu equipo. En una terminal con Node.js puedes ejecutar tres veces el siguiente comando. No copies los resultados a GitHub:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

6. Despliega el Worker: `npx wrangler deploy`. Copia la URL HTTPS `https://...workers.dev` que muestra Cloudflare.
7. Introduce **en Cloudflare**, nunca en el repositorio, las tres credenciales generadas (por separado, cuando Wrangler lo solicite):

```sh
npx wrangler secret put TEAM_ACCESS_TOKEN
npx wrangler secret put TEAM_SETUP_TOKEN
npx wrangler secret put TEAM_ENCRYPTION_KEY
```

Cada comando solicita el valor del secreto. `TEAM_ENCRYPTION_KEY` debe tener exactamente **64 caracteres hexadecimales**; el comando Node del paso 5 produce ese formato. Guarda las contraseñas fuera del repositorio, por ejemplo en un gestor de contraseñas; no se mostrarán desde Cloudflare una vez instaladas. No cambies ni borres `TEAM_ENCRYPTION_KEY` sin migrar primero el registro cifrado o se perderá el acceso a la clave OpenAI guardada.

También puedes configurar los secretos desde **Cloudflare → Workers & Pages → tu Worker → Settings → Variables and Secrets → Add (Secret)** y el almacén desde **Settings → Bindings → Add → KV Namespace → TEAM_SECRETS**.

## Primera conexión desde la sala

1. Entra en **OcToS Team → Sala → Nueva petición / Input**.
2. En **Conexión segura**, pega la **URL HTTPS de tu Worker**.
3. Escribe la contraseña `TEAM_ACCESS_TOKEN` en **Contraseña privada del servicio**. Esa contraseña no se guarda en el navegador.
4. Abre **Primera conexión · Registrar clave OpenAI**.
5. Introduce `TEAM_SETUP_TOKEN` en **Contraseña de configuración del Worker**.
6. Solo ahora pega la **clave OpenAI** en el campo correspondiente y pulsa **Guardar clave cifrada en Worker**.
7. La sala vacía ambos campos secretos al terminar. Pulsa **Comprobar conexión**; el Worker confirmará si la API está configurada, sin revelar su clave.
8. Escribe una consulta y pulsa **Enviar con API**. Verás estados y el resultado final junto con el consumo de tokens (no necesariamente el importe).

La URL del Worker se conserva en ese navegador; las contraseñas y la clave OpenAI no se conservan. El registro `POST /setup` solo admite el **primer registro**; para sustituir una clave existente debes hacerlo de forma administrada desde Cloudflare. El envío de una clave nueva a un Worker no desplegado o sin el secreto de configuración fallará.

## Rutas

- `POST /setup` — autorización con `TEAM_SETUP_TOKEN`, cuerpo `{"openai_api_key":"sk-..."}`; cifra y almacena **una sola vez**. No devuelve secretos.
- `GET /health` — autorización con `TEAM_ACCESS_TOKEN`; devuelve `ready` y `configured`.
- `POST /run` — autorización con `TEAM_ACCESS_TOKEN`; envía `{"task":"..."}` y devuelve NDJSON `state`, `report`, `done` o `error`.

## Límites del piloto

El Worker restringe los orígenes de navegador a OcToS GitHub Pages y WordPress, pero CORS no reemplaza la autenticación. Limita el texto de entrada a 2500 caracteres y las salidas de los especialistas y dirección; no hay rate limiting robusto, límite presupuestario automático ni autenticación individual. Antes de distribuir el acceso a más personas, configurar límites y control de acceso real en Cloudflare y límites de presupuesto en OpenAI.

Modelo inicial: `gpt-6-luna`, definido en `wrangler.toml`. La disponibilidad del modelo y facturación dependen del proyecto OpenAI asociado a tu clave.
