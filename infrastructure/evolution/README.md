# VPS de WhatsApp

Levanta Evolution API v2.3.7, su Postgres y Redis, el worker de InmoPanel y un proxy con TLS.

**Estado:** estos archivos todavía no se probaron en un VPS real. La primera instalación es también su prueba.

## Requisitos

- VPS Linux con Docker y Docker Compose, con al menos 2 GB de RAM.
- Firewall abierto solo en los puertos 80, 443 y SSH con clave.
- Un subdominio apuntando a la IP del VPS. Sin dominio propio no se puede emitir el certificado, así que este paso depende de comprar el dominio o de usar otro que ya tengas.

## Instalación

1. Cloná el repositorio en el VPS.
2. En `infrastructure/evolution/`, copiá `.env.example` como `.env` y completalo.
3. Levantá todo:

   ```bash
   docker compose up -d --build
   ```

4. En Vercel, cargá `EVOLUTION_API_URL` (`https://<subdominio>`) y `EVOLUTION_API_KEY`, y confirmá que `NEXT_PUBLIC_APP_URL` tenga la URL pública de la app. Evolution usa esa URL para avisar los mensajes nuevos. Después volvé a desplegar.
5. En el panel, andá a **WhatsApp**, aceptá las pautas y escaneá el QR con un número de prueba.

## Primera prueba

- Escribile al número desde otro teléfono: el mensaje tiene que aparecer en **Conversaciones** en menos de 10 segundos.
- Respondé desde el panel, con texto y con una foto.
- Mandá una foto y un audio desde el otro teléfono: tienen que verse en la conversación.
- Enviá la ficha de una propiedad con fotos.
- Cerrá la sesión desde el teléfono: el dueño tiene que recibir el aviso en menos de 2 minutos.

## Actualizar

Usá solo versiones estables de Evolution y revisá sus notas de versión antes de cambiar la imagen. Para actualizar el worker:

```bash
git pull
docker compose up -d --build worker
```

Las sesiones de WhatsApp viven en el volumen `evolution_instances`. Si se pierde, hay que volver a escanear todos los números.
