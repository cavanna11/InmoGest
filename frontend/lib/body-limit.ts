/**
 * Lee el cuerpo de un pedido como texto con un tope en BYTES. Primero mira Content-Length (corta sin
 * leer nada) y después cuenta lo que llegó de verdad, por si la cabecera falta o miente.
 * null = demasiado grande.
 */
export async function readTextWithLimit(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  const body = await request.arrayBuffer();
  if (body.byteLength > maxBytes) return null;
  return new TextDecoder().decode(body);
}
